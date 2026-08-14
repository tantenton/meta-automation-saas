/**
 * POST /api/v1/threads-auto-reply
 *
 * Production-safe contextual comment-reply loop for Threads.
 *
 * Safety guarantees:
 *  - Auth: Bearer CRON_SECRET / HERMES_API_KEY (authorizeWorker)
 *  - Skips own comments (username === account.account_name)
 *  - Skips already-replied comments (DB dedup via post_comments.comment_id UNIQUE)
 *  - AI safety filter: returns SKIP for spam/scam/hate/abuse/medical/legal/financial/sensitive
 *  - Hard cap: max 10 replies per calendar day (UTC) per account
 *  - AI-generated replies using persona Birru — contextual, no templates
 *  - Falls back gracefully when AI_BASE_URL is not configured (dry-run mode)
 *  - No browser, no file-based state
 *
 * GET: health-check ping (also requires auth)
 */

import { NextRequest, NextResponse } from 'next/server';
import { authorizeWorker } from '@/lib/server/api-auth';
import { decryptToken } from '@/lib/server/token-crypto';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { getThreadsReplies, replyToThreadsPost, getPermalink } from '@/lib/meta-api/client';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_REPLIES_PER_DAY = 10;
const MAX_POSTS_TO_SCAN   = 10;
const MAX_REPLY_CHARS     = 280;

// ---------------------------------------------------------------------------
// Persona prompt — Birru, contextual, safety-filtered
// ---------------------------------------------------------------------------

const PERSONA_SYSTEM = `Kamu adalah Birru — cowok 25 tahun, casual, tech-savvy, suka share hal simpel yang bikin hidup lebih produktif dan rapi.

Tugas kamu: balas komentar di postingan Threads secara natural seperti ngobrol sama temen.

ATURAN WAJIB:
- Singkat: 1-3 kalimat maksimal
- Casual, pakai bahasa sehari-hari (Bahasa Indonesia / campur English natural)
- SESUAI konteks: baca isi postingan dan komentarnya, balas dengan relevan
- Boleh balik tanya kalau natural
- JANGAN formal, JANGAN "Terima kasih kak!", JANGAN emoji berlebihan
- Pakai "gue/lo" tapi jangan dipaksain tiap kalimat
- Komentar humor: balas humor juga
- Komentar singkat: match energinya
- Kalau ada yang tanya produk/barang: jawab valuenya dulu

WAJIB RETURN "SKIP" (persis, tanpa teks lain) untuk komentar berikut:
- Spam atau promosi produk/jasa tidak relevan
- Scam, penipuan, MLM, investasi bodong, giveaway palsu
- Konten hate speech, kebencian, atau serangan personal
- Bahasa kasar/abusif/pelecehan
- Pertanyaan medis, diagnosis penyakit, saran obat/kesehatan klinis
- Pertanyaan atau saran hukum/legal
- Pertanyaan atau saran keuangan/investasi spesifik (saham, crypto, reksa dana)
- Konten sensitif politik ekstrem atau SARA
- Komentar tidak jelas / tidak dapat dimengerti

Contoh balasan bagus:
- "silly 😅" → "kan 😭 udah berapa tahun baru ngeh"
- "Ya itu penghangat gratis" → "fitur bonus yang gak ada di brosur 😭"
- "ini gue banget" → "berarti kita sama-sama pernah bodoh 🤝"
- "keren banget tipsnya" → "makasih! coba dulu, nanti share lagi kalau ada update"

Return ONLY the reply text. If you should skip, return exactly: SKIP`;

// ---------------------------------------------------------------------------
// AI reply drafting
// ---------------------------------------------------------------------------

export async function draftContextualReply(
  postContent: string,
  commentText: string,
  username: string,
): Promise<string | null> {
  const apiKey  = process.env.AI_API_KEY || 'dummy';
  const baseUrl = process.env.AI_BASE_URL;
  const model   = process.env.AI_MODEL || 'marketku/mk/haiku-4.5';

  if (!baseUrl) return null; // AI not configured — caller treats as dry-run

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 120,
        stream: false,
        messages: [
          { role: 'system', content: PERSONA_SYSTEM },
          {
            role: 'user',
            content:
              `Konteks postingan:\n"${postContent.slice(0, 400)}"\n\n` +
              `Komentar dari @${username}:\n"${commentText}"\n\n` +
              `Buat reply natural sesuai persona Birru.`,
          },
        ],
      }),
    });

    if (!res.ok) return null;

    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();

    if (!text || text === 'SKIP') return null;
    if (text.length > MAX_REPLY_CHARS) return null; // safety: too long
    return text;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Daily reply count helper
// ---------------------------------------------------------------------------

async function countRepliesToday(
  db: ReturnType<typeof import('@/lib/server/supabase-admin').getSupabaseAdmin>,
  accountId: string,
): Promise<number> {
  const todayUtc = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const { count } = await db
    .from('post_comments')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .eq('reply_status', 'replied')
    .gte('replied_at', `${todayUtc}T00:00:00.000Z`);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

async function handler(request: NextRequest) {
  // Health-check (GET)
  if (request.method === 'GET') {
    const denied = authorizeWorker(request);
    if (denied) return denied;
    return NextResponse.json({
      status: 'ok',
      message: 'Threads auto-reply service is running',
      max_replies_per_day: MAX_REPLIES_PER_DAY,
      ai_configured: !!process.env.AI_BASE_URL,
      timestamp: new Date().toISOString(),
    });
  }

  const denied = authorizeWorker(request);
  if (denied) return denied;

  const db = getSupabaseAdmin();

  try {
    // -----------------------------------------------------------------------
    // 1. Load active Threads account
    // -----------------------------------------------------------------------
    const { data: account } = await db
      .from('accounts')
      .select('*')
      .eq('platform', 'threads')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!account?.access_token_encrypted) {
      return NextResponse.json(
        { error: 'no_threads_token', message: 'No active Threads account found' },
        { status: 400 },
      );
    }

    const accessToken = decryptToken(account.access_token_encrypted);
    const ownUsername = (account.account_name as string) || '';

    // -----------------------------------------------------------------------
    // 2. Check daily cap
    // -----------------------------------------------------------------------
    const repliedToday = await countRepliesToday(db, account.id);
    if (repliedToday >= MAX_REPLIES_PER_DAY) {
      return NextResponse.json({
        success: true,
        message: 'daily_cap_reached',
        replied_today: repliedToday,
        cap: MAX_REPLIES_PER_DAY,
        replied_comments: 0,
        found_comments: 0,
      });
    }

    let remainingBudget = MAX_REPLIES_PER_DAY - repliedToday;

    // -----------------------------------------------------------------------
    // 3. Load recent published posts (last N)
    // -----------------------------------------------------------------------
    const { data: posts } = await db
      .from('posts')
      .select('id, meta_post_id, content, permalink')
      .eq('account_id', account.id)
      .eq('status', 'published')
      .not('meta_post_id', 'is', null)
      .order('published_at', { ascending: false })
      .limit(MAX_POSTS_TO_SCAN);

    if (!posts?.length) {
      return NextResponse.json({ success: true, message: 'no_posts_found', replied_comments: 0, found_comments: 0 });
    }

    // -----------------------------------------------------------------------
    // 4. Process comments per post
    // -----------------------------------------------------------------------
    const results: {
      comment_id: string;
      username: string;
      status: string;
      reply_text?: string;
      reply_permalink?: string | null;
      reason?: string;
    }[] = [];
    let foundComments = 0;

    outer: for (const post of posts) {
      let repliesData: { data?: Record<string, unknown>[] };
      try {
        repliesData = await getThreadsReplies(accessToken, post.meta_post_id) as typeof repliesData;
      } catch {
        continue; // skip posts where API call fails (e.g. expired permission)
      }

      const comments = repliesData.data ?? [];

      for (const comment of comments) {
        if (remainingBudget <= 0) break outer;

        const commentId = comment.id as string;
        const username  = comment.username as string;
        const text      = comment.text as string;

        // Skip own replies
        if (ownUsername && username === ownUsername) continue;

        // DB dedup: skip if already processed
        const { data: existing } = await db
          .from('post_comments')
          .select('id, reply_status')
          .eq('comment_id', commentId)
          .maybeSingle();

        if (existing?.reply_status === 'replied') continue;
        foundComments++;

        // AI safety filter + contextual reply generation
        const draftedReply = await draftContextualReply(
          post.content ?? '',
          text,
          username,
        );

        if (!draftedReply) {
          // AI returned SKIP, not configured, or empty
          if (!existing) {
            await db.from('post_comments').insert({
              account_id:   account.id,
              post_id:      post.meta_post_id,
              comment_id:   commentId,
              username,
              text,
              timestamp:    comment.timestamp as string ?? null,
              has_replies:  comment.has_replies ?? false,
              reply_status: 'skipped',
              reply_drafted: null,
            });
          } else if (existing.reply_status === 'pending') {
            await db.from('post_comments')
              .update({ reply_status: 'skipped' })
              .eq('comment_id', commentId);
          }
          results.push({ comment_id: commentId, username, status: 'skipped', reason: 'ai_skip_or_unavailable' });
          continue;
        }

        // Publish reply to Threads
        let replyPostId: string | null = null;
        let permalink:   string | null = null;

        try {
          const reply = await replyToThreadsPost({
            token:      accessToken,
            accountId:  account.account_id as string,
            text:       draftedReply,
            replyToId:  commentId,
          });
          replyPostId = reply.postId;
          permalink   = await getPermalink('threads', accessToken, replyPostId).catch(() => null);
        } catch (replyErr) {
          // Publish failed — record as failed, don't retry this run
          const errMsg = replyErr instanceof Error ? replyErr.message : String(replyErr);
          if (!existing) {
            await db.from('post_comments').insert({
              account_id:   account.id,
              post_id:      post.meta_post_id,
              comment_id:   commentId,
              username,
              text,
              timestamp:    comment.timestamp as string ?? null,
              has_replies:  comment.has_replies ?? false,
              reply_drafted: draftedReply,
              reply_status: 'failed',
            });
          } else {
            await db.from('post_comments')
              .update({ reply_status: 'failed', reply_drafted: draftedReply })
              .eq('comment_id', commentId);
          }
          results.push({ comment_id: commentId, username, status: 'failed', reason: errMsg });
          continue;
        }

        // Upsert dedup record — replied
        const now = new Date().toISOString();
        if (!existing) {
          await db.from('post_comments').insert({
            account_id:      account.id,
            post_id:         post.meta_post_id,
            comment_id:      commentId,
            username,
            text,
            timestamp:       comment.timestamp as string ?? null,
            has_replies:     true,
            reply_drafted:   draftedReply,
            reply_status:    'replied',
            reply_post_id:   replyPostId,
            reply_permalink: permalink,
            replied_at:      now,
          });
        } else {
          await db.from('post_comments').update({
            reply_status:    'replied',
            reply_drafted:   draftedReply,
            reply_post_id:   replyPostId,
            reply_permalink: permalink,
            replied_at:      now,
          }).eq('comment_id', commentId);
        }

        remainingBudget--;
        results.push({
          comment_id:      commentId,
          username,
          status:          'replied',
          reply_text:      draftedReply,
          reply_permalink: permalink,
        });
      }
    }

    const repliedCount = results.filter(r => r.status === 'replied').length;

    return NextResponse.json({
      success:          true,
      found_comments:   foundComments,
      replied_comments: repliedCount,
      replied_today:    repliedToday + repliedCount,
      cap:              MAX_REPLIES_PER_DAY,
      ai_configured:    !!process.env.AI_BASE_URL,
      results,
    });

  } catch (error) {
    return NextResponse.json(
      {
        error:   'auto_reply_failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export const GET  = handler;
export const POST = handler;
