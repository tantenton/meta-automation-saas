import { NextRequest, NextResponse } from 'next/server';
import { authorizeMachine } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { processPost } from '@/lib/server/post-worker';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const denied = authorizeMachine(request); if (denied) return denied;
  const { id } = await context.params;
  const db = getSupabaseAdmin();
  const { data, error } = await db.from('posts').select('id,status').eq('id', id).single();
  if (error || !data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (data.status === 'published') return NextResponse.json({ post: data, idempotent_replay: true });
  await db.from('posts').update({ status: 'queued', scheduled_at: null }).eq('id', id);
  try {
    const post = await processPost(id);
    return NextResponse.json({ post });
  } catch (error) {
    return NextResponse.json({ error: 'publish_failed', message: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
}
