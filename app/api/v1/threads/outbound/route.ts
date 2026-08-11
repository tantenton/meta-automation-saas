import { NextRequest, NextResponse } from 'next/server';
import { authorizeMachine } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { replyToThreadsPost, getPermalink } from '@/lib/meta-api/client';
import { decryptToken } from '@/lib/server/token-crypto';

const PERSONA_SYSTEM = `Kamu adalah Birru — cowok 25 tahun yang aktif di Threads. Kamu sering komen di post orang lain yang relevan sama topik yang lo suka: productivity, tech lifestyle, self-improvement, barang berguna, kehidupan cowok 20-an.

Cara komen yang natural:
- Singkat, 1-2 kalimat max
- Casual Indo, pakai "gue/lo" kalau natural
- Harus SPESIFIK ke konten post — bukan generic
- Bisa: share pengalaman relate, tambahin insight ringan, tanya lanjutan yang genuine
- Jangan: "keren kak!", "mantap!", "setuju banget!", "nice post"
- Jangan sok tahu, jangan sales, jangan promosi diri
- Kalau post tidak relevan sama sekali atau sensitif: return SKIP
- Kalau post bahasa Inggris: boleh balas English tapi tetap casual

Panjang komentar: 10-80 karakter ideal. Max 150 karakter.

Return ONLY the comment text. If irrelevant or sensitive, return exactly: SKIP`;

function shortcodeToNumericId(shortcode: string): string {
  // Decode Threads shortcode (base64url-encoded big-endian integer)
  // Uses string-based multiplication to avoid BigInt (ES2020+) requirement
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  // Represent number as array of decimal digits (little-endian)
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

async function draftComment(postText: string, targetUsername: string): Promise<string | null> {
  const baseUrl = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY || 'dummy';
  const model = process.env.AI_MODEL || 'marketku/mk/haiku-4.5';
  if (!baseUrl) return null;

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: 80,
        stream: false,
        messages: [
          { role: 'system', content: PERSONA_SYSTEM },
          { role: 'user', content: `Post dari @${targetUsername}:\n"${postText.slice(0, 500)}"\n\nBuat komentar natural dari Birru.` }
        ]
      })
    });
    if (!res.ok) return null;
    const data = await res.json() as { choices: { message: { content: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text || text === 'SKIP' || text.length < 5) return null;
    if (text.length > 450) return text.slice(0, 450); // Threads 500 char limit safety
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
    const autoPost = body.auto_post === true; // default: draft only
    const maxPerRun = Math.min(Number(body.max_per_run) || 5, 10);
    const forceRetry = body.force_retry === true; // bypass deduplication for failed/pending

    // Get active Threads account
    const { data: account } = await db.from('accounts')
      .select('*').eq('platform', 'threads').eq('is_active', true)
      .order('updated_at', { ascending: false }).limit(1).single();
    if (!account) return NextResponse.json({ error: 'no_active_threads_account' }, { status: 404 });

    const token = decryptToken(account.access_token_encrypted);

    // Get active targets
    const { data: targets } = await db.from('outbound_targets')
      .select('*').eq('account_id', account.id as string).eq('is_active', true)
      .order('last_scanned_at', { ascending: true, nullsFirst: true })
      .limit(20);

    if (!targets?.length) return NextResponse.json({ message: 'no_targets_configured', processed: 0 });

    const results: Record<string, unknown>[] = [];
    let commented = 0;

    for (const target of targets) {
      if (commented >= maxPerRun) break;

      try {
        // Resolve username to numeric ID if not cached
        // NOTE: Threads API does not allow resolving OTHER users' numeric IDs via user token.
        // target_user_id must be set manually in outbound_targets table.
        const targetUserId = target.target_user_id as string | null;
        if (!targetUserId) {
          // Skip targets without a cached user ID — must be set manually
          await db.from('outbound_targets').update({ last_scanned_at: new Date().toISOString() }).eq('id', target.id);
          results.push({ target_username: target.target_username, status: 'skipped_no_user_id', message: 'target_user_id not set — set it manually via PATCH /api/v1/threads/targets' });
          continue;
        }

        // Fetch target's recent posts via Threads API using target_user_id (gets real numeric post IDs)
        const threadsApiUrl = new URL(`https://graph.threads.net/v1.0/${targetUserId}/threads`);
        threadsApiUrl.searchParams.set('fields', 'id,text,permalink,timestamp');
        threadsApiUrl.searchParams.set('limit', '10');
        threadsApiUrl.searchParams.set('access_token', token);
        const apiAbort = new AbortController();
        const apiTimeout = setTimeout(() => apiAbort.abort(), 10000);
        const apiRes = await fetch(threadsApiUrl.toString(), { signal: apiAbort.signal }).catch(() => null);
        clearTimeout(apiTimeout);

        let posts: Record<string, unknown>[] = [];

        if (apiRes && apiRes.ok) {
          const apiData = await apiRes.json() as { data?: { id: string; text?: string; permalink?: string }[] };
          posts = (apiData.data || []).slice(0, 5).map(p => ({
            id: p.id,
            text: (p.text || '').trim(),
            permalink: p.permalink || `https://www.threads.com/@${target.target_username}/post/${p.id}`,
          }));
        }

        // Fallback to Jina if API returns empty (private or unsupported)
        if (!posts.length) {
          const jinaUrl = `https://r.jina.ai/https://www.threads.com/@${target.target_username}`;
          const jinaAbort = new AbortController();
          const jinaTimeout = setTimeout(() => jinaAbort.abort(), 8000);
          const jinaRes = await fetch(jinaUrl, { headers: { 'Accept': 'text/markdown' }, signal: jinaAbort.signal }).catch(() => null);
          clearTimeout(jinaTimeout);
          if (!jinaRes || !jinaRes.ok) {
            await db.from('outbound_targets').update({ last_scanned_at: new Date().toISOString() }).eq('id', target.id);
            results.push({ target_username: target.target_username, status: 'fetch_failed' });
            continue;
          }
          const jinaText = await jinaRes.text();
          const postMatches = [...jinaText.matchAll(/https:\/\/www\.threads\.com\/@[^/]+\/post\/([A-Za-z0-9_-]+)[^)]*\)\n+([^\n![\-]{10,500})/g)];
          posts = postMatches.slice(0, 5).map(m => ({
            id: m[1],
            text: m[2].trim(),
            permalink: `https://www.threads.com/@${target.target_username}/post/${m[1]}`,
          }));
          if (!posts.length) {
            const blocks = jinaText.split(/\n--\n/).slice(1, 6);
            blocks.forEach((block, i) => {
              const text = block.replace(/!\[.*?\]\(.*?\)/g, '').replace(/\[.*?\]\(.*?\)/g, '').trim();
              if (text.length > 10) posts.push({ id: `jina-${target.target_username}-${i}`, text, permalink: null });
            });
          }
        }

        for (const post of posts) {
          if (commented >= maxPerRun) break;
          const postId = post.id as string;
          const postText = (post.text as string) || '';
          const permalink = post.permalink as string;

          if (!postText || postText.length < 10) continue;

          // Check if already processed (skip if posted, retry if post_failed or force_retry)
          const { data: existing } = await db.from('outbound_comments')
            .select('id, comment_status').eq('account_id', account.id).eq('target_post_id', postId).maybeSingle();
          if (existing && existing.comment_status === 'posted') continue;
          if (existing && !forceRetry && existing.comment_status !== 'post_failed') continue;

          // Draft comment
          const draft = await draftComment(postText, target.target_username);

          const record = {
            account_id: account.id,
            target_username: target.target_username,
            target_post_id: postId,
            target_post_text: postText.slice(0, 500),
            target_post_permalink: permalink,
            comment_drafted: draft,
            comment_status: draft ? 'pending' : 'skipped',
            idempotency_key: `outbound-${account.id}-${postId}`,
          };

          if (existing) {
            // Update existing post_failed record with fresh draft
            await db.from('outbound_comments').update({
              comment_drafted: draft,
              comment_status: draft ? 'pending' : 'skipped',
            }).eq('account_id', account.id).eq('target_post_id', postId);
          } else {
            await db.from('outbound_comments').insert(record);
          }

          const result: Record<string, unknown> = {
            target_username: target.target_username,
            post_id: postId,
            post_text: postText.slice(0, 100) + (postText.length > 100 ? '...' : ''),
            post_permalink: permalink,
            drafted_comment: draft,
            status: draft ? 'pending_approval' : 'skipped',
          };

          // Auto-post if enabled
          if (autoPost && draft) {
            try {
              // Resolve shortcode to numeric Media ID if needed (Threads API requires numeric ID)
              let replyToId = postId;
              if (!/^\d+$/.test(postId)) {
                try { replyToId = shortcodeToNumericId(postId); } catch { replyToId = postId; }
              }
              const { postId: commentPostId } = await replyToThreadsPost({
                token,
                accountId: account.account_id,
                text: draft,
                replyToId,
              });
              const commentPermalink = await getPermalink('threads', token, commentPostId).catch(() => null);
              await db.from('outbound_comments').update({
                comment_status: 'posted',
                comment_post_id: commentPostId,
                comment_permalink: commentPermalink,
                posted_at: new Date().toISOString(),
              }).eq('account_id', account.id).eq('target_post_id', postId);
              result.status = 'posted';
              result.comment_permalink = commentPermalink;
              commented++;
            } catch (e) {
              result.status = 'post_failed';
              result.error = e instanceof Error ? e.message : String(e);
            }
          } else if (draft) {
            commented++;
          }

          results.push(result);
        }

        // Update last scanned
        await db.from('outbound_targets').update({ last_scanned_at: new Date().toISOString() }).eq('id', target.id);
      } catch {
        continue;
      }
    }

    return NextResponse.json({ processed: results.length, auto_post: autoPost, results });
  } catch (err) {
    return NextResponse.json({
      error: 'outbound_failed',
      message: err instanceof Error ? err.message : String(err)
    }, { status: 500 });
  }
}
