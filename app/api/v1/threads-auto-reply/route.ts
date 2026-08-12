import { NextRequest, NextResponse } from 'next/server';
import { authorizeWorker } from '@/lib/server/api-auth';
import { decryptToken } from '@/lib/server/token-crypto';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { replyToThreadsPost, getPermalink } from '@/lib/meta-api/client';

// Persona Birru: casual Bahasa Indonesia, tech-savvy, 25yo guy
function generateReply(): string {
  const replies = [
    "Wah keren juga tuh, mantap!",
    "Sip, setuju dengan opini lu.",
    "Oke juga nih, keep sharing!",
    "Menarik banget, makasih sharing!",
    "Bener banget, gue suka!",
    "Nice one! Keep it up.",
    "Mantap, gue juga suka gituan.",
    "Waduh jadi inget time ago ya.",
    "Agree, gue juga pernah gitu.",
    "Top markotop, makasih info!",
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

async function handler(request: NextRequest) {
  if (request.method === 'GET') {
    return NextResponse.json({
      status: 'ok',
      message: 'Threads auto-reply service is running',
      timestamp: new Date().toISOString()
    });
  }

  const denied = authorizeWorker(request);
  if (denied) return denied;

  try {
    const db = getSupabaseAdmin();

    // Fetch and decrypt Threads access token from database
    const { data: account } = await db.from('accounts')
      .select('*')
      .eq('platform', 'threads')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!account?.access_token_encrypted) {
      return NextResponse.json({ error: 'no_threads_token', message: 'No active Threads account found' }, { status: 400 });
    }

    const accessToken = decryptToken(account.access_token_encrypted);

    // Get latest 5 threads posts
    const threadsRes = await fetch('https://graph.threads.net/v1.0/me/threads?fields=id,text,timestamp&limit=5', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!threadsRes.ok) {
      const err = await threadsRes.text();
      return NextResponse.json({ error: 'fetch_threads_failed', message: err }, { status: 500 });
    }

    const threadsData = await threadsRes.json();
    const posts = threadsData.data || [];

    const results = {
      found_comments: 0,
      replied_comments: 0,
      replies: [] as { comment_id: string; text: string; permalink?: string | null }[]
    };

    for (const post of posts) {
      const postId = post.id as string;

      const repliesRes = await fetch(`https://graph.threads.net/v1.0/${postId}/replies?fields=id,text,username,timestamp&access_token=${accessToken}`);
      if (!repliesRes.ok) continue;

      const repliesData = await repliesRes.json();
      const comments = (repliesData.data || []) as { id: string; text: string; username: string; timestamp: string }[];

      for (const comment of comments) {
        const commentId = comment.id;

        // Skip own replies
        if (comment.username === account.account_name) continue;

        // DB-backed dedup: skip if already replied
        const { data: existing } = await db.from('post_comments')
          .select('id, reply_status')
          .eq('comment_id', commentId)
          .maybeSingle();
        if (existing?.reply_status === 'replied') continue;

        results.found_comments++;

        const replyText = generateReply();
        if (replyText.length > 150) continue;

        let replyPostId: string | null = null;
        let permalink: string | null = null;

        try {
          const reply = await replyToThreadsPost({
            token: accessToken,
            accountId: account.account_id,
            text: replyText,
            replyToId: commentId,
          });
          replyPostId = reply.postId;
          permalink = await getPermalink('threads', accessToken, replyPostId).catch(() => null);
        } catch {
          // Reply failed — upsert comment as skipped and move on
          if (!existing) {
            await db.from('post_comments').insert({
              account_id: account.id,
              post_id: postId,
              comment_id: commentId,
              username: comment.username,
              text: comment.text,
              timestamp: comment.timestamp,
              has_replies: false,
              reply_drafted: replyText,
              reply_status: 'skipped',
            });
          }
          continue;
        }

        // Upsert dedup record in DB
        if (!existing) {
          await db.from('post_comments').insert({
            account_id: account.id,
            post_id: postId,
            comment_id: commentId,
            username: comment.username,
            text: comment.text,
            timestamp: comment.timestamp,
            has_replies: true,
            reply_drafted: replyText,
            reply_status: 'replied',
            reply_post_id: replyPostId,
            reply_permalink: permalink,
          });
        } else {
          await db.from('post_comments').update({
            reply_status: 'replied',
            reply_post_id: replyPostId,
            reply_permalink: permalink,
          }).eq('comment_id', commentId);
        }

        results.replied_comments++;
        results.replies.push({ comment_id: commentId, text: replyText, permalink });
      }
    }

    return NextResponse.json({
      success: true,
      ...results
    });

  } catch (error) {
    return NextResponse.json({
      error: 'auto_reply_failed',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export const GET = handler;
export const POST = handler;
