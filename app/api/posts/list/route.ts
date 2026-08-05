// app/api/posts/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getPosts } from '@/lib/meta-api/posts';
import { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = new SupabaseClient(supabaseUrl, supabaseAnonKey);

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query params for pagination and filtering
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const accountId = url.searchParams.get('accountId');
    const status = url.searchParams.get('status');

    // Build query
    let query = supabase
      .from('posts')
      .select(`*, social_accounts:account_id ( id, platform, username )`)
      .eq('social_accounts.user_id', session.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (accountId) {
      query = query.eq('account_id', accountId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: posts, error } = await query;

    if (error) throw error;

    return NextResponse.json({ posts }, { status: 200 });
  } catch (error: any) {
    console.error('Get posts error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}
