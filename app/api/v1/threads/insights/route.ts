import { NextRequest, NextResponse } from 'next/server';
import { authorizeMachine } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { decryptToken } from '@/lib/server/token-crypto';

const THREADS_GRAPH = 'https://graph.threads.net/v1.0';

async function threadsGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${THREADS_GRAPH}/${path}`);
  url.searchParams.set('access_token', token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  return res.json();
}

export async function GET(request: NextRequest) {
  const denied = authorizeMachine(request); if (denied) return denied;
  const db = getSupabaseAdmin();
  const mode = request.nextUrl.searchParams.get('mode') || 'summary'; // summary | posts | account

  const { data: account } = await db.from('accounts')
    .select('*').eq('platform', 'threads').eq('is_active', true)
    .order('updated_at', { ascending: false }).limit(1).single();
  if (!account) return NextResponse.json({ error: 'no_active_threads_account' }, { status: 404 });

  const token = decryptToken(account.access_token_encrypted);
  const uid = account.account_id as string;

  try {
    // Account-level insights
    const accountInsights = await threadsGet(`${uid}/threads_insights`, token, {
      metric: 'views,reach,follower_count,followers_count,impressions',
      period: 'day',
    });

    // Profile info
    const profile = await threadsGet(`${uid}`, token, {
      fields: 'id,username,threads_biography,threads_profile_picture_url',
    });

    // Recent posts
    const postsData = await threadsGet(`${uid}/threads`, token, {
      fields: 'id,text,timestamp,permalink,media_type',
      limit: '10',
    }) as { data?: Record<string, unknown>[] };

    const posts = postsData.data || [];

    // Per-post insights
    const postInsights = await Promise.all(
      posts.slice(0, 10).map(async (post) => {
        try {
          const insights = await threadsGet(`${post.id}/insights`, token, {
            metric: 'views,likes,replies,reposts,quotes,impressions,reach',
          }) as { data?: { name: string; values: { value: number }[] }[] };

          const metrics: Record<string, number> = {};
          for (const m of insights.data || []) {
            metrics[m.name] = m.values?.[0]?.value ?? 0;
          }

          // Save to DB
          const today = new Date().toISOString().split('T')[0];
          await db.from('post_insights').upsert({
            account_id: account.id,
            post_id: post.id as string,
            permalink: post.permalink as string,
            post_text: ((post.text as string) || '').slice(0, 200),
            likes: metrics.likes || 0,
            replies: metrics.replies || 0,
            reposts: metrics.reposts || 0,
            quotes: metrics.quotes || 0,
            views: metrics.views || 0,
            reach: metrics.reach || 0,
            impressions: metrics.impressions || 0,
            snapshot_date: today,
            snapshot_at: new Date().toISOString(),
          }, { onConflict: 'post_id,snapshot_date' });

          return {
            post_id: post.id,
            text: ((post.text as string) || '').slice(0, 100),
            permalink: post.permalink,
            timestamp: post.timestamp,
            metrics,
          };
        } catch {
          return { post_id: post.id, text: ((post.text as string) || '').slice(0, 100), permalink: post.permalink, metrics: {} as Record<string, number> };
        }
      })
    );

    // Extract account metrics
    const accMetrics: Record<string, number> = {};
    for (const m of accountInsights?.data || []) {
      const item = m as { name: string; values?: { value: number }[]; total_value?: { value: number } };
      accMetrics[item.name] = item.total_value?.value ?? item.values?.[0]?.value ?? 0;
    }

    // Save account snapshot
    const today = new Date().toISOString().split('T')[0];
    await db.from('account_insights').upsert({
      account_id: account.id,
      snapshot_date: today,
      followers_count: accMetrics.follower_count || accMetrics.followers_count || 0,
      reach: accMetrics.reach || 0,
      impressions: accMetrics.impressions || 0,
      views: accMetrics.views || 0,
      total_posts: posts.length,
    }, { onConflict: 'account_id,snapshot_date' });

    // Summary stats
    const totalViews = postInsights.reduce((s, p) => s + (p.metrics.views || 0), 0);
    const totalLikes = postInsights.reduce((s, p) => s + (p.metrics.likes || 0), 0);
    const totalReplies = postInsights.reduce((s, p) => s + (p.metrics.replies || 0), 0);
    const totalReposts = postInsights.reduce((s, p) => s + (p.metrics.reposts || 0), 0);
    const bestPost = postInsights.reduce((best, p) =>
      (p.metrics.views || 0) > (best.metrics?.views || 0) ? p : best, postInsights[0]);

    return NextResponse.json({
      account: {
        username: profile.username,
        followers: accMetrics.follower_count || accMetrics.followers_count || 0,
        reach_today: accMetrics.reach || 0,
        views_today: accMetrics.views || 0,
        impressions_today: accMetrics.impressions || 0,
      },
      summary: {
        total_posts_tracked: postInsights.length,
        total_views: totalViews,
        total_likes: totalLikes,
        total_replies: totalReplies,
        total_reposts: totalReposts,
        avg_views_per_post: postInsights.length ? Math.round(totalViews / postInsights.length) : 0,
        best_post: bestPost ? {
          text: bestPost.text,
          permalink: bestPost.permalink,
          views: bestPost.metrics.views || 0,
          likes: bestPost.metrics.likes || 0,
          replies: bestPost.metrics.replies || 0,
        } : null,
      },
      posts: postInsights,
      snapshot_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({
      error: 'insights_failed',
      message: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
