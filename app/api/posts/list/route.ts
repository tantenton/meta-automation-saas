import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const platform = searchParams.get('platform');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const db = getSupabaseAdmin();
    let query = db
      .from('posts')
      .select(`
        id,
        account_id,
        content,
        media_url,
        media_type,
        status,
        scheduled_at,
        published_at,
        permalink,
        meta_post_id,
        error_message,
        created_at,
        updated_at,
        accounts (
          id,
          platform,
          account_name,
          account_id
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[posts/list] Supabase error:', error.message);
      return NextResponse.json({ posts: [] });
    }

    // Format posts for the frontend
    const formatted = (data || []).map((post: any) => {
      const acc = Array.isArray(post.accounts) ? post.accounts[0] : post.accounts;
      const postPlatform = acc?.platform || (post.media_type === 'video' ? 'instagram' : 'instagram');
      return {
        id: post.id,
        platform: postPlatform,
        accountName: acc?.account_name || 'Account',
        caption: post.content,
        imageUrl: Array.isArray(post.media_url) ? post.media_url[0] : post.media_url,
        mediaUrls: Array.isArray(post.media_url) ? post.media_url : [post.media_url].filter(Boolean),
        mediaType: post.media_type || 'image',
        scheduledAt: post.scheduled_at,
        publishedAt: post.published_at,
        permalink: post.permalink,
        status: post.status,
        errorMessage: post.error_message,
        createdAt: post.created_at,
      };
    });

    // Filter by platform if specified
    const filtered = platform && platform !== 'all'
      ? formatted.filter(p => p.platform.toLowerCase() === platform.toLowerCase())
      : formatted;

    return NextResponse.json({ posts: filtered });
  } catch (err) {
    console.error('[posts/list] Unexpected error:', err);
    return NextResponse.json({ posts: [] });
  }
}
