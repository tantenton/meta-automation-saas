import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeMachine } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

const schema = z.object({
  account_id: z.string().uuid(),
  content_id: z.string().min(1).max(160),
  revision: z.number().int().positive().default(1),
  caption: z.string().max(2200),
  media_url: z.string().url().optional(),
  media_type: z.enum(['text', 'image', 'video']),
  scheduled_at: z.string().datetime().optional(),
  publish_now: z.boolean().default(false),
  idempotency_key: z.string().min(8).max(200),
});

export async function GET(request: NextRequest) {
  const denied = authorizeMachine(request); if (denied) return denied;
  const db = getSupabaseAdmin();
  const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') || 50), 100);
  const { data, error } = await db.from('posts').select('*,accounts(id,platform,account_name,account_id)').order('created_at', { ascending: false }).limit(limit);
  if (error) return NextResponse.json({ error: 'database_error', message: error.message }, { status: 500 });
  return NextResponse.json({ posts: data });
}

export async function POST(request: NextRequest) {
  const denied = authorizeMachine(request); if (denied) return denied;
  try {
    const input = schema.parse(await request.json());
    if (input.media_type !== 'text' && !input.media_url) return NextResponse.json({ error: 'media_url_required' }, { status: 400 });
    const db = getSupabaseAdmin();
    const { data: account, error: accountError } = await db.from('accounts').select('id,platform,is_active').eq('id', input.account_id).single();
    if (accountError || !account || !account.is_active) return NextResponse.json({ error: 'account_not_found_or_inactive' }, { status: 404 });
    if (account.platform === 'instagram' && input.media_type === 'text') return NextResponse.json({ error: 'instagram_requires_media' }, { status: 400 });
    const { data: existing } = await db.from('posts').select('*').eq('idempotency_key', input.idempotency_key).maybeSingle();
    if (existing) return NextResponse.json({ post: existing, idempotent_replay: true }, { status: 200 });
    const contentHash = createHash('sha256').update(JSON.stringify({ caption: input.caption, media_url: input.media_url || null, account_id: input.account_id })).digest('hex');
    const status = input.publish_now ? 'queued' : input.scheduled_at ? 'scheduled' : 'draft';
    const { data, error } = await db.from('posts').insert({
      account_id: input.account_id,
      external_content_id: input.content_id,
      revision: input.revision,
      content: input.caption,
      media_url: input.media_url ? [input.media_url] : [],
      media_type: input.media_type,
      scheduled_at: input.scheduled_at || null,
      status,
      idempotency_key: input.idempotency_key,
      content_hash: contentHash,
    }).select('*').single();
    if (error) throw error;
    return NextResponse.json({ post: data }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'validation_error', issues: error.issues }, { status: 400 });
    return NextResponse.json({ error: 'create_post_failed', message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
