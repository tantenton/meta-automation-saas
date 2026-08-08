import { NextRequest, NextResponse } from 'next/server';
import { authorizeMachine } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { getThreadsReplies, getThreadsConversation } from '@/lib/meta-api/client';
import { decryptToken } from '@/lib/server/token-crypto';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = authorizeMachine(request); if (denied) return denied;
  const { id: postId } = await params;
  const mode = request.nextUrl.searchParams.get('mode') || 'replies';
  const accountId = request.nextUrl.searchParams.get('account_id');
  const db = getSupabaseAdmin();

  // Try to find account via post DB lookup first
  let token: string | null = null;

  const { data: post } = await db.from('posts')
    .select('*, accounts(*)')
    .or(`meta_post_id.eq.${postId},id.eq.${postId}`)
    .maybeSingle();

  if (post?.accounts) {
    const account = post.accounts as Record<string, unknown>;
    if (account?.access_token_encrypted) {
      token = decryptToken(account.access_token_encrypted as string);
    }
  }

  // Fallback: lookup account directly by account_id param or first active threads account
  if (!token) {
    const query = accountId
      ? db.from('accounts').select('*').eq('id', accountId).eq('platform', 'threads').single()
      : db.from('accounts').select('*').eq('platform', 'threads').eq('is_active', true).order('updated_at', { ascending: false }).limit(1).single();
    const { data: account } = await query;
    if (account?.access_token_encrypted) {
      token = decryptToken(account.access_token_encrypted as string);
    }
  }

  if (!token) return NextResponse.json({ error: 'no_active_threads_account' }, { status: 404 });

  try {
    const data = mode === 'conversation'
      ? await getThreadsConversation(token, postId)
      : await getThreadsReplies(token, postId);
    return NextResponse.json({ post_id: postId, mode, ...data });
  } catch (err) {
    return NextResponse.json({ error: 'fetch_failed', message: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
