import { NextRequest, NextResponse } from 'next/server';
import { authorizeMachine } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { deleteThreadsPost } from '@/lib/meta-api/client';
import { decryptToken } from '@/lib/server/token-crypto';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = authorizeMachine(request); if (denied) return denied;
  const { id: commentId } = await params;

  const db = getSupabaseAdmin();
  const { data: account } = await db
    .from('accounts')
    .select('*')
    .eq('platform', 'threads')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (!account?.access_token_encrypted) {
    return NextResponse.json({ error: 'no_active_threads_account' }, { status: 404 });
  }

  const token = decryptToken(account.access_token_encrypted as string);

  try {
    const result = await deleteThreadsPost(token, commentId);
    return NextResponse.json({ comment_id: commentId, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: 'delete_failed', message: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
