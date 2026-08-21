import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { processPost } from '@/lib/server/post-worker';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('posts')
      .select('*, accounts(id, platform, account_name, account_id)')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    return NextResponse.json({ post: data });
  } catch (err) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const db = getSupabaseAdmin();
    const { error } = await db.from('posts').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { action } = await request.json().catch(() => ({ action: 'publish' }));

    if (action === 'publish') {
      const db = getSupabaseAdmin();
      await db.from('posts').update({ status: 'queued', scheduled_at: null }).eq('id', id);
      const post = await processPost(id);
      return NextResponse.json({ success: true, post });
    }

    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({
      error: 'publish_failed',
      message: err instanceof Error ? err.message : String(err),
    }, { status: 502 });
  }
}
