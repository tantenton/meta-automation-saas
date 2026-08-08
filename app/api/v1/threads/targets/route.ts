import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeMachine } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

const addSchema = z.object({
  target_username: z.string().min(1).max(100),
  category: z.enum(['productivity', 'tech-lifestyle', 'self-improvement', 'male-lifestyle', 'general']).optional().default('general'),
});

// GET — list all targets
export async function GET(request: NextRequest) {
  const denied = authorizeMachine(request); if (denied) return denied;
  const db = getSupabaseAdmin();
  const { data: account } = await db.from('accounts').select('id').eq('platform', 'threads').eq('is_active', true).order('updated_at', { ascending: false }).limit(1).single();
  if (!account) return NextResponse.json({ error: 'no_active_threads_account' }, { status: 404 });

  const { data } = await db.from('outbound_targets').select('*').eq('account_id', account.id).order('created_at', { ascending: false });
  return NextResponse.json({ targets: data || [] });
}

// POST — add target
export async function POST(request: NextRequest) {
  const denied = authorizeMachine(request); if (denied) return denied;
  const db = getSupabaseAdmin();
  const { data: account } = await db.from('accounts').select('id').eq('platform', 'threads').eq('is_active', true).order('updated_at', { ascending: false }).limit(1).single();
  if (!account) return NextResponse.json({ error: 'no_active_threads_account' }, { status: 404 });

  try {
    const body = await request.json();
    const input = addSchema.parse(body);
    const { data, error } = await db.from('outbound_targets').upsert({
      account_id: account.id,
      target_username: input.target_username.replace('@', ''),
      category: input.category,
      is_active: true,
    }, { onConflict: 'account_id,target_username' }).select().single();
    if (error) throw error;
    return NextResponse.json({ target: data }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: 'validation_error', issues: err.issues }, { status: 400 });
    return NextResponse.json({ error: 'add_failed', message: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// DELETE — remove target
export async function DELETE(request: NextRequest) {
  const denied = authorizeMachine(request); if (denied) return denied;
  const db = getSupabaseAdmin();
  const username = request.nextUrl.searchParams.get('username');
  if (!username) return NextResponse.json({ error: 'username_required' }, { status: 400 });

  const { data: account } = await db.from('accounts').select('id').eq('platform', 'threads').eq('is_active', true).order('updated_at', { ascending: false }).limit(1).single();
  if (!account) return NextResponse.json({ error: 'no_active_threads_account' }, { status: 404 });

  await db.from('outbound_targets').update({ is_active: false }).eq('account_id', account.id).eq('target_username', username.replace('@', ''));
  return NextResponse.json({ ok: true });
}
