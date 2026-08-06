import { NextRequest, NextResponse } from 'next/server';
import { authorizeMachine } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const denied = authorizeMachine(request); if (denied) return denied;
  const { id } = await context.params;
  const db = getSupabaseAdmin();
  const { data, error } = await db.from('posts').select('*,accounts(id,platform,account_name,account_id)').eq('id', id).single();
  if (error) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ post: data });
}
