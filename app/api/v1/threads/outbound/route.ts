/**
 * POST /api/v1/threads/outbound
 *
 * Dynamic persona-led Threads outbound discovery & engagement.
 *
 * What's new vs v1:
 *  - Infers persona weights from latest 30 published posts
 *  - Accepts trend_candidates in body (or falls back to static outbound_targets)
 *  - Scores each candidate post on relevance/freshness/saturation/safety
 *  - Upserts qualified dynamic targets into outbound_targets (preserves static ones)
 *  - Default: dry_run=true — no comments published unless auto_post=true explicitly
 *  - Max 3-5 comments per run, deduped via outbound_comments table
 *  - Comments are casual Indonesian, reference actual post content
 *  - Structured response: research_signals, candidates, drafts, posted_permalinks, skip_reasons
 *  - Safe pacing: 1s delay between posts in auto_post mode
 *
 * Safety gates (pre-AI):
 *  - isSafe() blocklist: politics, SARA, scam, hate, medical, financial advice, generic
 *  - Post text length >= 10 chars
 *  - No double-posting (outbound_comments dedup by account_id+target_post_id)
 *
 * No browser, no login — Threads Graph API + Jina public reader only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authorizeMachine } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { replyToThreadsPost, getPermalink } from '@/lib/meta-api/client';
import { decryptToken } from '@/lib/server/token-crypto';
import { discoverTrendCandidates, upsertDiscoveredTargets, type TrendCandidate } from '@/lib/threads/trend-discovery';
import { isSafe } from '@/lib/threads/outbound-scorer';
import { inferPersonaWeights, DEFAULT_WEIGHTS } from '@/lib/threads/persona-weights';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_PER_RUN = 5;
const MIN_SCORE   = 0.20;
const POST_DELAY_MS = 1200; // safe pacing between auto_post calls

// ---------------------------------------------------------------------------
// Persona system prompt — Birru, casual Indonesian, post-specific
// ---------------------------------------------------------------------------

const PERSONA_SYSTEM = `Kamu adalah Birru — cowok 25 tahun yang aktif di Threads. Kamu sering komen di post orang lain yang relevan dengan topik favorit kamu: AI/coding tools, produktivitas realistis, desk setup, digital focus, tekanan ekonomi/karir quarter-life.

Cara komen yang natural:
- Singkat, 1-3 kalimat max
- Casual Indonesian, pakai "gue/lo" kalau terasa natural
- HARUS spesifik ke konten post — bukan generic
- Bisa: tambah insight ringan atau tanya lanjutan yang genuine
- JANGAN mengarang pengalaman, pekerjaan, teman, kebiasaan, hasil, atau penggunaan produk pribadi. Jangan menulis "gue pernah", "pengalaman gue", "temen gue", "gue switch", atau klaim personal lain kecuali faktanya diberikan di konteks.
- JANGAN: "keren kak!", "mantap!", "setuju banget!", "nice post", atau apapun yang bisa dikirim ke siapa saja
- JANGAN: sok tahu, sales, promosi diri, atau bawa-bawa produk/jasa
- Kalau post tidak relevan / sensitif / politis / SARA / scam / medis / keuangan: return SKIP
- Kalau post bahasa Inggris: boleh balas English tapi tetap casual
- Max 150 karakter

Return ONLY the comment text. If irrelevant or sensitive: return exactly SKIP`;

// ---------------------------------------------------------------------------
// AI comment drafting
// ---------------------------------------------------------------------------

async function draftComment(
  postText: string,
  targetUsername: string,
): Promise<string | null> {
  const baseUrl = process.env.AI_BASE_URL;
  if (!baseUrl) return null;

  const apiKey = process.env.AI_API_KEY || 'dummy';
  const model  = process.env.AI_MODEL   || 'marketku/mk/haiku-4.5';

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 80,
        stream: false,
        messages: [
          { role: 'system', content: PERSONA_SYSTEM },
          {
            role: 'user',
            content:
              `Post dari @${targetUsername}:\n"${postText.slice(0, 500)}"\n\n` +
              `Buat komentar natural dari Birru yang spesifik ke konten ini.`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text || text === 'SKIP' || text.length < 5) return null;
    // Fail closed on fabricated first-person anecdotes. The public persona may
    // add an observation, but must not invent biography or personal evidence.
    const fabricatedPersonalClaim = /\b(gue|gua|aku)\s+(pernah|switch|pakai|pake|punya|kerja|coba|nyoba|relate|juga)|\b(pengalaman|temen|teman)\s+(gue|gua|aku)\b|\b(di|kalau|kalo)\s+(gue|gua|aku)\b/i;
    if (fabricatedPersonalClaim.test(text)) return null;
    if (text.length > 150) return text.slice(0, 150);
    return text;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Shortcode → numeric ID helper (Threads API requires numeric IDs for replies)
// ---------------------------------------------------------------------------

function shortcodeToNumericId(shortcode: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const digits = [0];
  function multiplyBy(factor: number) {
    let carry = 0;
    for (let i = 0; i < digits.length; i++) {
      const val = digits[i] * factor + carry;
      digits[i] = val % 10;
      carry = Math.floor(val / 10);
    }
    while (carry > 0) { digits.push(carry % 10); carry = Math.floor(carry / 10); }
  }
  function addTo(val: number) {
    let carry = val;
    for (let i = 0; i < digits.length && carry > 0; i++) {
      const sum = digits[i] + carry;
      digits[i] = sum % 10;
      carry = Math.floor(sum / 10);
    }
    while (carry > 0) { digits.push(carry % 10); carry = Math.floor(carry / 10); }
  }
  for (const char of shortcode) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) throw new Error(`Invalid shortcode char: ${char}`);
    multiplyBy(64);
    addTo(idx);
  }
  return digits.reverse().join('');
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const denied = authorizeMachine(request);
  if (denied) return denied;

  const db = getSupabaseAdmin();

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;

    // auto_post must be EXPLICITLY true — default is dry_run
    const autoPost   = body.auto_post === true;
    const dryRun     = body.auto_post !== true; // alias for clarity in response
    const maxPerRun  = Math.min(Number(body.max_per_run) || MAX_PER_RUN, 10);
    const forceRetry = body.force_retry === true;

    // Caller-supplied trend candidates (usernames + optional user_ids + hints)
    const rawCandidates = Array.isArray(body.trend_candidates)
      ? (body.trend_candidates as TrendCandidate[])
      : [];

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
      .single();

    if (!account) {
      return NextResponse.json({ error: 'no_active_threads_account' }, { status: 404 });
    }

    const token = decryptToken(account.access_token_encrypted);

    // -----------------------------------------------------------------------
    // 2. Load static outbound_targets (always preserved)
    // -----------------------------------------------------------------------
    const { data: staticTargets } = await db
      .from('outbound_targets')
      .select('*')
      .eq('account_id', account.id as string)
      .eq('is_active', true)
      .order('last_scanned_at', { ascending: true, nullsFirst: true })
      .limit(30);

    // Build merged trend candidate list: static targets + caller-supplied
    const staticCandidates: TrendCandidate[] = (staticTargets ?? []).map(
      (t: Record<string, unknown>) => ({
        username: t.target_username as string,
        user_id: t.target_user_id as string | null,
        category: t.category as string,
      })
    );

    const allTrendCandidates: TrendCandidate[] = [
      ...staticCandidates,
      ...rawCandidates.filter(
        c => !staticCandidates.some(s => s.username === c.username)
      ),
    ];

    if (!allTrendCandidates.length) {
      return NextResponse.json({
        dry_run: dryRun,
        message: 'no_targets_configured',
        research_signals: [],
        candidates: [],
        drafts: [],
        posted_permalinks: [],
        skip_reasons: [],
        processed: 0,
      });
    }

    // -----------------------------------------------------------------------
    // 3. Load already-processed post IDs for dedup
    // -----------------------------------------------------------------------
    const { data: existingComments } = await db
      .from('outbound_comments')
      .select('target_post_id, comment_status')
      .eq('account_id', account.id as string);

    const postedIds = new Set<string>(
      (existingComments ?? [])
        .filter((c: Record<string, unknown>) => c.comment_status === 'posted')
        .map((c: Record<string, unknown>) => c.target_post_id as string)
    );

    const pendingIds = new Set<string>(
      (existingComments ?? [])
        .filter((c: Record<string, unknown>) =>
          !forceRetry && c.comment_status !== 'post_failed'
        )
        .map((c: Record<string, unknown>) => c.target_post_id as string)
    );

    const excludeIds = new Set<string>([...postedIds, ...pendingIds]);

    // -----------------------------------------------------------------------
    // 4. Infer persona weights from own recent posts
    // -----------------------------------------------------------------------
    const { data: ownPosts } = await db
      .from('posts')
      .select('content')
      .eq('account_id', account.id as string)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(30);

    const ownTexts = (ownPosts ?? []).map((p: Record<string, unknown>) => p.content as string).filter(Boolean);
    const personaWeights = ownTexts.length
      ? inferPersonaWeights(ownTexts)
      : { ...DEFAULT_WEIGHTS };

    // -----------------------------------------------------------------------
    // 5. Dynamic discovery: fetch + score posts from all candidate accounts
    // -----------------------------------------------------------------------
    const discovery = await discoverTrendCandidates({
      token,
      accountId: account.account_id as string,
      trendCandidates: allTrendCandidates,
      excludePostIds: excludeIds,
      minScore: MIN_SCORE,
      maxCandidates: 100,
    });

    // Upsert dynamically discovered targets (new usernames from rawCandidates)
    if (rawCandidates.length && discovery.candidates.length) {
      await upsertDiscoveredTargets(db, account.id as string, discovery.candidates);
    }

    // -----------------------------------------------------------------------
    // 6. Pick top candidates up to maxPerRun, draft + optionally post comments
    // -----------------------------------------------------------------------
    // Public-reader candidates are useful for research, but only official API
    // results carry app-valid media IDs that Threads accepts for replies.
    const eligibleCandidates = autoPost
      ? discovery.candidates.filter(candidate => candidate.reply_eligible === true)
      : discovery.candidates;
    const topCandidates = eligibleCandidates.slice(0, maxPerRun);

    const drafts: Record<string, unknown>[] = [];
    const postedPermalinks: string[] = [];
    const skipReasons: { post_id: string; username: string; reason: string }[] = [];

    let commented = 0;

    for (const candidate of topCandidates) {
      if (commented >= maxPerRun) break;

      const postId   = candidate.id;
      const postText = candidate.text;
      const username = candidate.username;
      const permalink = candidate.permalink;

      // Safety double-check (scorer already filters but be explicit)
      const safety = isSafe(postText);
      if (!safety.safe) {
        skipReasons.push({ post_id: postId, username, reason: safety.reason ?? 'unsafe' });
        continue;
      }

      // Draft comment via AI
      const draft = await draftComment(postText, username);

      if (!draft) {
        skipReasons.push({ post_id: postId, username, reason: 'ai_skip_or_unavailable' });
        // Persist skipped record
        await db.from('outbound_comments').upsert(
          {
            account_id: account.id,
            target_username: username,
            target_post_id: postId,
            target_post_text: postText.slice(0, 500),
            target_post_permalink: permalink,
            comment_drafted: null,
            comment_status: 'skipped',
            idempotency_key: `outbound-${account.id}-${postId}`,
          },
          { onConflict: 'account_id,target_post_id' }
        );
        continue;
      }

      const draftRecord: Record<string, unknown> = {
        target_username: username,
        post_id: postId,
        post_text: postText.slice(0, 120) + (postText.length > 120 ? '...' : ''),
        post_permalink: permalink,
        drafted_comment: draft,
        score: candidate.scores.composite,
        status: 'pending_approval',
      };

      // Persist draft
      await db.from('outbound_comments').upsert(
        {
          account_id: account.id,
          target_username: username,
          target_post_id: postId,
          target_post_text: postText.slice(0, 500),
          target_post_permalink: permalink,
          comment_drafted: draft,
          comment_status: 'pending',
          idempotency_key: `outbound-${account.id}-${postId}`,
        },
        { onConflict: 'account_id,target_post_id' }
      );

      // Auto-post only if explicitly enabled
      if (autoPost) {
        try {
          let replyToId = postId;
          if (!/^\d+$/.test(postId)) {
            try { replyToId = shortcodeToNumericId(postId); } catch { replyToId = postId; }
          }

          const { postId: commentPostId } = await replyToThreadsPost({
            token,
            accountId: account.account_id as string,
            text: draft,
            replyToId,
          });

          const commentPermalink = await getPermalink('threads', token, commentPostId).catch(() => null);

          await db.from('outbound_comments').update({
            comment_status: 'posted',
            comment_post_id: commentPostId,
            comment_permalink: commentPermalink,
            posted_at: new Date().toISOString(),
          })
            .eq('account_id', account.id)
            .eq('target_post_id', postId);

          draftRecord.status = 'posted';
          draftRecord.comment_permalink = commentPermalink;
          if (commentPermalink) postedPermalinks.push(commentPermalink);
          commented++;

          // Safe pacing
          if (commented < maxPerRun) {
            await new Promise(r => setTimeout(r, POST_DELAY_MS));
          }
        } catch (e) {
          draftRecord.status = 'post_failed';
          draftRecord.error  = e instanceof Error ? e.message : String(e);
          skipReasons.push({ post_id: postId, username, reason: `post_failed: ${draftRecord.error}` });
        }
      } else {
        commented++; // counts drafted comments toward run cap
      }

      drafts.push(draftRecord);

      // Update last_scanned_at for the target
      await db.from('outbound_targets')
        .update({ last_scanned_at: new Date().toISOString() })
        .eq('account_id', account.id)
        .eq('target_username', username);
    }

    // Collect skip reasons from unsafe/low-score candidates not even drafted
    for (const c of discovery.candidates.slice(maxPerRun)) {
      skipReasons.push({
        post_id: c.id,
        username: c.username,
        reason: `below_max_per_run (score=${c.scores.composite})`,
      });
    }

    // Also expose candidates that were filtered as unsafe
    const unsafeCandidates = (await Promise.all(
      // Re-check raw fetched posts that didn't make the ranked list
      []
    ));
    void unsafeCandidates; // suppresses unused warning — kept for future extension

    return NextResponse.json({
      dry_run: dryRun,
      auto_post: autoPost,
      persona_weights: personaWeights,
      research_signals: discovery.research_signals,
      candidates: discovery.candidates.slice(0, 20).map(c => ({
        username: c.username,
        post_id: c.id,
        post_text: c.text.slice(0, 120),
        permalink: c.permalink,
        scores: c.scores,
      })),
      drafts,
      posted_permalinks: postedPermalinks,
      skip_reasons: skipReasons,
      processed: drafts.length,
      total_candidates_discovered: discovery.total_scored,
      total_fetched: discovery.total_fetched,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'outbound_failed',
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
