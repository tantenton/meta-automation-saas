import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from('accounts')
      .select('id, platform, account_id, account_name, profile_picture_url, follower_count, is_active, token_expires_at, token_last_validated_at, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[accounts/list] Supabase error:', error.message);
      return NextResponse.json({ accounts: [] });
    }

    return NextResponse.json({ accounts: data || [] });
  } catch (err) {
    console.error('[accounts/list] Unexpected error:', err);
    return NextResponse.json({ accounts: [] });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id parameter is required' }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const { error } = await db.from('accounts').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Account disconnected successfully' });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
