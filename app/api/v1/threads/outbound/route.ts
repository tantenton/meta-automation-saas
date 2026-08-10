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

        // Fetch target's recent posts via Threads API using numeric ID
        const postsUrl = new URL(`https://graph.threads.net/v1.0/${targetUserId}/threads`);
        postsUrl.searchParams.set('fields', 'id,text,timestamp,permalink');
        postsUrl.searchParams.set('limit', '5');
        postsUrl.searchParams.set('access_token', token);
        const postsRes = await fetch(postsUrl.toString());
        if (!postsRes.ok) {
          await db.from('outbound_targets').update({ last_scanned_at: new Date().toISOString() }).eq('id', target.id);
          continue;
        }
        const postsData = await postsRes.json() as { data?: Record<string, unknown>[] };
        const posts = postsData.data || [];

        for (const post of posts) {
          if (commented >= maxPerRun) break;
          const postId = post.id as string;
          const postText = (post.text as string) || '';
          const permalink = post.permalink as string;

          if (!postText || postText.length < 10) continue;

          // Check if already processed
          const { data: existing } = await db.from('outbound_comments')
            .select('id, comment_status').eq('account_id', account.id).eq('target_post_id', postId).maybeSingle();
          if (existing) continue;

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

          await db.from('outbound_comments').insert(record);

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
              const { postId: commentPostId } = await replyToThreadsPost({
                token,
                accountId: account.account_id,
                text: draft,
                replyToId: postId,
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
