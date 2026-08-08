import { NextRequest, NextResponse } from 'next/server';
import { authorizeMachine } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { getThreadsReplies, replyToThreadsPost, getPermalink } from '@/lib/meta-api/client';
import { decryptToken } from '@/lib/server/token-crypto';

const PERSONA_SYSTEM = `Kamu adalah Birru — cowok 25 tahun yang suka share hal-hal simpel yang bikin hidup lebih enak, lebih rapi, dan lebih produktif. 

Cara kamu balas komentar:
- Casual, natural, seperti ngobrol sama temen
- Singkat (1-3 kalimat max)
- Sesuai konteks komentar dan konten post
- Kadang balik tanya kalau natural
- Jangan "Terima kasih kak!", jangan formal, jangan emoji berlebihan
- Pakai "gue/lo" tapi jangan dipaksain tiap kalimat
- Komentar humor/lucu: balas dengan humor juga, jangan kaku
- Komentar singkat (1-2 kata): tetap balas, match energinya
- Komentar relatable: acknowledge dengan spesifik
- Kalau ada yang tanya produk/barang: jawab dulu valuenya
- Kalau komentar toxic/hate/spam jualan: skip (return SKIP)
- JANGAN reply ke komentar dari akun sendiri (username: albirrukhaliefnugraha)

Contoh balasan yang bagus:
- "silly 😅" → "kan 😭 udah berapa tahun baru ngeh"
- "Ya itu penghangat gratis" → "fitur bonus yang gak ada di brosur 😭"
- "ini gue banget" → "berarti kita sama-sama pernah bodoh 🤝"

Return ONLY the reply text, nothing else. If you should skip, return exactly: SKIP`;

async function draftReply(postContent: string, comment: string, username: string): Promise<string | null> {
  const apiKey = process.env.AI_API_KEY || 'dummy';
  const baseUrl = process.env.AI_BASE_URL;
  const model = process.env.AI_MODEL || 'marketku/mk/haiku-4.5';

  if (!baseUrl) return null;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: 150,
        stream: false,
        messages: [
          { role: 'system', content: PERSONA_SYSTEM },
          { role: 'user', content: `Konteks post:\n"${postContent}"\n\nKomentar dari @${username}:\n"${comment}"\n\nBuat reply yang natural sesuai persona Birru.` }
        ]
      })
    });
    if (!res.ok) return null;
    const data = await res.json() as { choices: { message: { content: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text || text === 'SKIP') return null;
    return text;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const denied = authorizeMachine(request); if (denied) return denied;
  const db = getSupabaseAdmin();

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const autoReply = body.auto_reply === true; // default: draft only, no auto publish

    // Get active Threads account
    const { data: account } = await db.from('accounts')
      .select('*').eq('platform', 'threads').eq('is_active', true)
      .order('updated_at', { ascending: false }).limit(1).single();
    if (!account) return NextResponse.json({ error: 'no_active_threads_account' }, { status: 404 });

    const token = decryptToken(account.access_token_encrypted);

    // Get recent published posts (last 10)
    const { data: posts } = await db.from('posts')
      .select('id, meta_post_id, content, permalink')
      .eq('account_id', account.id)
      .eq('status', 'published')
      .not('meta_post_id', 'is', null)
      .order('published_at', { ascending: false })
      .limit(10);

    if (!posts?.length) return NextResponse.json({ message: 'no_posts_found', processed: 0 });

    const results: Record<string, unknown>[] = [];

    for (const post of posts) {
      try {
        const repliesData = await getThreadsReplies(token, post.meta_post_id) as { data?: Record<string, unknown>[] };
        const comments = repliesData.data || [];

        for (const comment of comments) {
          const commentId = comment.id as string;
          const username = comment.username as string;
          const text = comment.text as string;

          // Skip own replies
          if (username === account.account_name) continue;

          // Check if already processed
          const { data: existing } = await db.from('post_comments')
            .select('id, reply_status').eq('comment_id', commentId).maybeSingle();
          if (existing?.reply_status === 'replied') continue;

          // Draft reply using AI
          const draftedReply = await draftReply(post.content, text, username);

          if (!existing) {
            // Insert new comment
            await db.from('post_comments').insert({
              account_id: account.id,
              post_id: post.meta_post_id,
              comment_id: commentId,
              username,
              text,
              timestamp: comment.timestamp,
              has_replies: comment.has_replies || false,
              reply_drafted: draftedReply,
              reply_status: draftedReply ? 'pending' : 'skipped',
            });
          } else if (existing.reply_status === 'pending') {
            // Re-draft if pending but no reply yet
            await db.from('post_comments').update({
              reply_drafted: draftedReply,
              reply_status: draftedReply ? 'pending' : 'skipped',
            }).eq('comment_id', commentId);
          }

          const result: Record<string, unknown> = {
            comment_id: commentId,
            username,
            text,
            drafted_reply: draftedReply,
            status: draftedReply ? 'pending_approval' : 'skipped',
          };

          // Auto-reply if enabled and draft exists
          if (autoReply && draftedReply) {
            try {
              const { postId: replyPostId } = await replyToThreadsPost({
                token,
                accountId: account.account_id,
                text: draftedReply,
                replyToId: commentId,
              });
              const permalink = await getPermalink('threads', token, replyPostId).catch(() => null);
              await db.from('post_comments').update({
                reply_status: 'replied',
                reply_post_id: replyPostId,
                reply_permalink: permalink,
              }).eq('comment_id', commentId);
              result.status = 'replied';
              result.reply_permalink = permalink;
            } catch (replyErr) {
              result.status = 'reply_failed';
              result.error = replyErr instanceof Error ? replyErr.message : String(replyErr);
            }
          }

          results.push(result);
        }
      } catch {
        // Skip posts that fail (e.g. old posts with no permission)
        continue;
      }
    }

    return NextResponse.json({
      processed: results.length,
      auto_reply: autoReply,
      results,
    });
  } catch (err) {
    return NextResponse.json({
      error: 'engage_failed',
      message: err instanceof Error ? err.message : String(err)
    }, { status: 500 });
  }
}
