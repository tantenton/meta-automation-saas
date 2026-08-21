import { NextRequest, NextResponse } from 'next/server';
import { authorizeMachine } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth) {
    const denied = authorizeMachine(request);
    if (denied) return denied;
  }

  let db;
  try {
    db = getSupabaseAdmin();
  } catch (e) {
    return NextResponse.json({
      chart_data: [],
      summary: { total_reach: 0, total_likes: 0, total_comments: 0, total_shares: 0, posts_published: 0 },
      top_posts: [],
      has_data: false,
    });
  }


  // Aggregate analytics by day for last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data: analyticsRows } = await db
    .from('analytics')
    .select('date, reach, likes, comments, shares')
    .gte('date', sevenDaysAgo)
    .order('date', { ascending: true });

  // Aggregate per day
  const byDay: Record<string, { reach: number; engagement: number }> = {};
  for (const row of analyticsRows || []) {
    const d = row.date as string;
    if (!byDay[d]) byDay[d] = { reach: 0, engagement: 0 };
    byDay[d].reach += (row.reach as number) || 0;
    byDay[d].engagement += ((row.likes as number) || 0) + ((row.comments as number) || 0) + ((row.shares as number) || 0);
  }

  // Build 7-day series with day labels
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const chartData = Object.entries(byDay).map(([date, vals]) => ({
    day: days[new Date(date).getDay()],
    date,
    reach: vals.reach,
    engagement: vals.engagement,
  }));

  // Summary totals
  const totalReach = (analyticsRows || []).reduce((s, r) => s + ((r.reach as number) || 0), 0);
  const totalLikes = (analyticsRows || []).reduce((s, r) => s + ((r.likes as number) || 0), 0);
  const totalComments = (analyticsRows || []).reduce((s, r) => s + ((r.comments as number) || 0), 0);
  const totalShares = (analyticsRows || []).reduce((s, r) => s + ((r.shares as number) || 0), 0);

  // Published posts count
  const { count: publishedCount } = await db
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published');

  // Top posts by likes from analytics join
  const { data: topPostsRaw } = await db
    .from('analytics')
    .select('post_id, likes, reach, posts(content, permalink, published_at)')
    .order('likes', { ascending: false })
    .limit(5);

  const topPosts = (topPostsRaw || []).map((r) => ({
    post_id: r.post_id,
    likes: r.likes,
    reach: r.reach,
    content: (r.posts as { content?: string } | null)?.content?.slice(0, 100) ?? '',
    permalink: (r.posts as { permalink?: string } | null)?.permalink ?? null,
    published_at: (r.posts as { published_at?: string } | null)?.published_at ?? null,
  }));

  return NextResponse.json({
    chart_data: chartData,
    summary: {
      total_reach: totalReach,
      total_likes: totalLikes,
      total_comments: totalComments,
      total_shares: totalShares,
      posts_published: publishedCount ?? 0,
    },
    top_posts: topPosts,
    has_data: (analyticsRows?.length ?? 0) > 0,
  });
}
