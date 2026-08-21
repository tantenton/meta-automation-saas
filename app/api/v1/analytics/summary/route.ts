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

  // 1. Build continuous 7-day date list (Today and previous 6 days)
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayBuckets: Record<string, { day: string; date: string; reach: number; engagement: number; posts: number }> = {};
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = daysOfWeek[d.getDay()];
    dayBuckets[dateStr] = {
      day: dayName,
      date: dateStr,
      reach: 0,
      engagement: 0,
      posts: 0,
    };
  }

  const startDate = Object.keys(dayBuckets)[0];

  // 2. Fetch real rows from analytics table (if scraped by worker)
  const { data: analyticsRows } = await db
    .from('analytics')
    .select('date, reach, likes, comments, shares')
    .gte('date', startDate)
    .order('date', { ascending: true });

  for (const row of analyticsRows || []) {
    const d = row.date as string;
    if (dayBuckets[d]) {
      const reach = Number(row.reach) || 0;
      const eng = (Number(row.likes) || 0) + (Number(row.comments) || 0) + (Number(row.shares) || 0);
      dayBuckets[d].reach += reach;
      dayBuckets[d].engagement += eng;
    }
  }

  // 3. Fetch real rows from post_insights table (if scraped from Threads/Meta API)
  const { data: insightRows } = await db
    .from('post_insights')
    .select('post_id, snapshot_date, views, reach, likes, replies, reposts')
    .gte('snapshot_date', startDate);

  const postInsightMap: Record<string, { views: number; reach: number; likes: number; replies: number; reposts: number }> = {};

  for (const row of insightRows || []) {
    const d = row.snapshot_date as string;
    if (dayBuckets[d]) {
      const reach = Number(row.reach || row.views) || 0;
      const eng = (Number(row.likes) || 0) + (Number(row.replies) || 0) + (Number(row.reposts) || 0);
      dayBuckets[d].reach += reach;
      dayBuckets[d].engagement += eng;
    }
    if (row.post_id) {
      postInsightMap[row.post_id] = {
        views: Number(row.views) || 0,
        reach: Number(row.reach) || 0,
        likes: Number(row.likes) || 0,
        replies: Number(row.replies) || 0,
        reposts: Number(row.reposts) || 0,
      };
    }
  }

  // 4. Fetch actual published posts activity for the 7 days
  const { data: publishedIn7Days } = await db
    .from('posts')
    .select('id, content, permalink, published_at, created_at, accounts(platform, account_name)')
    .eq('status', 'published')
    .gte('published_at', `${startDate}T00:00:00Z`);

  for (const post of publishedIn7Days || []) {
    const dateStr = (post.published_at || post.created_at || '').split('T')[0];
    if (dayBuckets[dateStr]) {
      dayBuckets[dateStr].posts += 1;
    }
  }

  const chartData = Object.values(dayBuckets);

  // 5. Total published posts count (100% exact from posts table)
  const { count: totalPublishedCount } = await db
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published');

  // 6. Top recent published posts (100% exact metadata, strictly real metrics only)
  const { data: recentPublished } = await db
    .from('posts')
    .select('id, content, permalink, published_at, meta_post_id, accounts(platform, account_name)')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(10);

  const topPosts = (recentPublished || []).map((p: any) => {
    const acc = Array.isArray(p.accounts) ? p.accounts[0] : p.accounts;
    const insight = postInsightMap[p.id] || (p.meta_post_id ? postInsightMap[p.meta_post_id] : null);

    return {
      post_id: p.id,
      platform: acc?.platform || 'meta',
      account_name: acc?.account_name || 'Creator',
      content: p.content || '',
      permalink: p.permalink,
      published_at: p.published_at,
      likes: insight ? insight.likes : 0,
      reach: insight ? (insight.reach || insight.views) : 0,
      is_synced: Boolean(insight),
    };
  });

  const totalReach = chartData.reduce((s, r) => s + r.reach, 0);
  const totalLikes = (analyticsRows || []).reduce((s, r) => s + ((r.likes as number) || 0), 0) + (insightRows || []).reduce((s, r) => s + ((r.likes as number) || 0), 0);
  const totalComments = (analyticsRows || []).reduce((s, r) => s + ((r.comments as number) || 0), 0) + (insightRows || []).reduce((s, r) => s + ((r.replies as number) || 0), 0);
  const totalShares = (analyticsRows || []).reduce((s, r) => s + ((r.shares as number) || 0), 0) + (insightRows || []).reduce((s, r) => s + ((r.reposts as number) || 0), 0);

  return NextResponse.json({
    chart_data: chartData,
    summary: {
      total_reach: totalReach,
      total_likes: totalLikes,
      total_comments: totalComments,
      total_shares: totalShares,
      posts_published: totalPublishedCount || 0,
    },
    top_posts: topPosts,
    has_data: (totalPublishedCount || 0) > 0,
  });
}
