import { NextRequest, NextResponse } from 'next/server';
import { authorizeWorker } from '@/lib/server/api-auth';
import { readRepliedComments, writeRepliedComments } from '@/lib/server/replied-comments';
import { decryptToken } from '@/lib/server/token-crypto';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

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

  const authHeader = request.headers.get('authorization') || '';
  console.log('Auth header:', authHeader);
  const denied = authorizeWorker(request);
  if (denied) return denied;

  try {
    // Fetch and decrypt Threads access token from database
    const db = getSupabaseAdmin();
    const { data: account } = await db.from('accounts')
      .select('access_token_encrypted')
      .eq('platform', 'threads')
      .eq('is_active', true)
      .maybeSingle();
    
    if (!account?.access_token_encrypted) {
      return NextResponse.json({ error: 'no_threads_token', message: 'No active Threads account found' }, { status: 400 });
    }
    
    const accessToken = decryptToken(account.access_token_encrypted);

    // Get latest 5 threads
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
      replies: [] as { comment_id: string; text: string }[]
    };

    // Check replies for each post
    for (const post of posts) {
      const postId = post.id;

      const repliesRes = await fetch(`https://graph.threads.net/v1.0/${postId}/replies?fields=id,text,username,timestamp&access_token=${accessToken}`);

      if (!repliesRes.ok) continue;

      const repliesData = await repliesRes.json();
      const comments = repliesData.data || [];

      const repliedComments = await readRepliedComments();
      const existingReplied = new Set(repliedComments);
      for (const comment of comments) {
        if (existingReplied.has(comment.id)) continue;

        const replyText = generateReply();
        if (replyText.length > 150) continue;

        const createRes = await fetch('https://graph.threads.net/v1.0/me/threads', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            media_type: 'TEXT',
            text: replyText,
            reply_to_id: comment.id
          })
        });

        if (!createRes.ok) continue;

        const createData = await createRes.json();
        const creationId = createData.id;

        const publishRes = await fetch('https://graph.threads.net/v1.0/me/threads_publish', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ creation_id: creationId })
        });

        if (!publishRes.ok) continue;

        repliedComments.add(comment.id);
        await writeRepliedComments(repliedComments);

        results.found_comments++;
        results.replied_comments++;
        results.replies.push({ comment_id: comment.id, text: replyText });
      }
    }

    const currentReplied = await readRepliedComments();
    for (const reply of results.replies) {
      currentReplied.add(reply.comment_id);
    }
    await writeRepliedComments(currentReplied);

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
