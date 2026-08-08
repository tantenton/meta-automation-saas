import { NextRequest, NextResponse } from 'next/server';
import { authorizeMachine } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { getThreadsReplies, getThreadsConversation } from '@/lib/meta-api/client';
import { decryptToken } from '@/lib/server/token-crypto';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = authorizeMachine(request); if (denied) return denied;
  const { id: postId } = await params;
  const mode = request.nextUrl.searchParams.get('mode') || 'replies'; // replies | conversation
  const db = getSupabaseAdmin();

  // Find account for this post
  const { data: post, error } = await db.from('posts')
    .select('*, accounts(*)')
    .eq('meta_post_id', postId)
    .maybeSingle();

  // If not found by meta_post_id, try by DB id
  const { data: post2 } = !post
    ? await db.from('posts').select('*, accounts(*)').eq('id', postId).maybeSingle()
    : { data: null };

  const record = post || post2;
  if (error || !record) return NextResponse.json({ error: 'post_not_found' }, { status: 404 });

  const account = record.accounts as Record<string, unknown>;
  if (!account?.access_token_encrypted) return NextResponse.json({ error: 'account_token_missing' }, { status: 400 });

  const token = decryptToken(account.access_token_encrypted as string);
  const targetId = record.meta_post_id as string || postId;

  try {
    const data = mode === 'conversation'
      ? await getThreadsConversation(token, targetId)
      : await getThreadsReplies(token, targetId);
    return NextResponse.json({ post_id: targetId, mode, ...data });
  } catch (err) {
    return NextResponse.json({ error: 'fetch_failed', message: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
