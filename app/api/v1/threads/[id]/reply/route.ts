import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeMachine } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { replyToThreadsPost, getPermalink } from '@/lib/meta-api/client';
import { decryptToken } from '@/lib/server/token-crypto';

const schema = z.object({
  text: z.string().min(1).max(500),
  reply_to_id: z.string().min(1), // Threads post/comment ID to reply to
  account_id: z.string().uuid(),
  idempotency_key: z.string().min(8).max(200),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = authorizeMachine(request); if (denied) return denied;
  const { id: postId } = await params;
  const db = getSupabaseAdmin();

  try {
    const body = await request.json();
    const input = schema.parse({ ...body, reply_to_id: body.reply_to_id || postId });

    // Idempotency check
    const { data: existing } = await db.from('post_replies')
      .select('*').eq('idempotency_key', input.idempotency_key).maybeSingle();
    if (existing) return NextResponse.json({ reply: existing, idempotent_replay: true });

    // Get account
    const { data: account, error: accErr } = await db.from('accounts')
      .select('*').eq('id', input.account_id).single();
    if (accErr || !account || !account.is_active) return NextResponse.json({ error: 'account_not_found' }, { status: 404 });
    if (account.platform !== 'threads') return NextResponse.json({ error: 'replies_only_supported_for_threads' }, { status: 400 });

    const token = decryptToken(account.access_token_encrypted);

    // Publish reply
    const { containerId, postId: replyPostId } = await replyToThreadsPost({
      token,
      accountId: account.account_id,
      text: input.text,
      replyToId: input.reply_to_id,
    });

    const permalink = await getPermalink('threads', token, replyPostId).catch(() => null);

    // Save to post_replies table (best-effort)
    const replyRecord = {
      account_id: input.account_id,
      parent_post_id: postId,
      reply_to_id: input.reply_to_id,
      text: input.text,
      container_id: containerId,
      meta_reply_id: replyPostId,
      permalink,
      idempotency_key: input.idempotency_key,
      published_at: new Date().toISOString(),
    };

    const { error: insertErr } = await db.from('post_replies').insert(replyRecord);
    if (insertErr) console.error('Failed to save reply record:', insertErr.message);

    return NextResponse.json({ reply: replyRecord }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'validation_error', issues: err.issues }, { status: 400 });
    return NextResponse.json({ error: 'reply_failed', message: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
