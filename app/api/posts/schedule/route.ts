// app/api/posts/schedule/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { schedulePost } from '@/lib/meta-api/posts';
import { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = new SupabaseClient(supabaseUrl, supabaseAnonKey);

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { accountId, content, mediaUrl, scheduledAt } = body;

    if (!accountId || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: accountId and content' },
        { status: 400 }
      );
    }

    // Validate scheduledAt if provided
    let scheduledAtDate: string | null = null;
    if (scheduledAt) {
      const date = new Date(scheduledAt);
      if (isNaN(date.getTime())) {
        return NextResponse.json({ error: 'Invalid scheduledAt date' }, { status: 400 });
      }
      scheduledAtDate = date.toISOString();
    }

    // Check if account belongs to user
    const { data: account, error: accountError } = await supabase
      .from('social_accounts')
      .select('user_id, platform')
      .eq('id', accountId)
      .single();

    if (accountError || !account || account.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Account not found or access denied' }, { status: 403 });
    }

    // Schedule the post
    const { data: post, error } = await schedulePost(
      supabase,
      session.user.id,
      accountId,
      content,
      mediaUrl,
      scheduledAtDate
    );

    if (error) throw error;

    return NextResponse.json({ success: true, post }, { status: 201 });
  } catch (error: any) {
    console.error('Schedule post error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to schedule post' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query params for pagination
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const status = url.searchParams.get('status');

    // Build query
    let query = supabase
      .from('posts')
      .select(`*, social_accounts:account_id ( id, platform, username )`)
      .eq('social_accounts.user_id', session.user.id)
      .order('scheduled_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: posts, error } = await query;

    if (error) throw error;

    return NextResponse.json({ posts }, { status: 200 });
  } catch (error: any) {
    console.error('Get scheduled posts error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch scheduled posts' },
      { status: 500 }
    );
  }
}
