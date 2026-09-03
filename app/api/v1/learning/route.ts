import { NextRequest, NextResponse } from 'next/server';
import { authorizeMachine } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { decryptToken } from '@/lib/server/token-crypto';

const THREADS_GRAPH = 'https://graph.threads.net/v1.0';

async function fetchThreadsInsights(threadsPostId: string, token: string): Promise<Record<string, number>> {
  const url = new URL(`${THREADS_GRAPH}/${threadsPostId}/insights`);
  url.searchParams.set('access_token', token);
  url.searchParams.set('metric', 'likes,replies,reposts,views');

  const res = await fetch(url.toString());
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Threads insights fetch failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const metrics: Record<string, number> = {};

  for (const item of (data.data || []) as { name: string; values?: { value: number }[] }[]) {
    metrics[item.name] = item.values?.[0]?.value ?? 0;
  }

  return metrics;
}

export async function POST(request: NextRequest) {
  const denied = authorizeMachine(request);
  if (denied) return denied;

  const db = getSupabaseAdmin();

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const accountId = body.account_id as string;

    if (!accountId) {
      return NextResponse.json({ error: 'account_id_required' }, { status: 400 });
    }

    // Get active account — select encrypted token only (never expose plaintext token)
    const { data: account } = await db.from('accounts')
      .select('id, account_id, access_token_encrypted, platform')
      .eq('id', accountId)
      .single();

    if (!account?.access_token_encrypted) {
      return NextResponse.json({ error: 'account_not_found_or_no_token' }, { status: 404 });
    }

    // Decrypt server-side; plaintext token never stored or returned
    const token = decryptToken(account.access_token_encrypted);

    // Fetch pending metrics rows
    let { data: pendingRows, error: pendingError } = await db.from('pending_metrics')
      .select('*')
      .eq('account_id', accountId)
      .eq('metrics_collected', false)
      .lte('check_after', new Date().toISOString())
      .order('check_after', { ascending: true });

    if (pendingError) {
      return NextResponse.json({ error: 'pending_fetch_failed', message: pendingError.message }, { status: 500 });
    }

    if (!pendingRows?.length) {
      // Auto-seed pending_metrics from published Threads posts (last 7 days) that haven't been seeded yet
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: unseededPosts } = await db.from('posts')
        .select('id, meta_post_id, content, published_at, external_content_id')
        .eq('account_id', accountId)
        .eq('platform', 'threads')
        .eq('status', 'published')
        .not('meta_post_id', 'is', null)
        .gte('published_at', sevenDaysAgo)
        .order('published_at', { ascending: false });

      if (unseededPosts?.length) {
        // Filter out posts already in pending_metrics
        const { data: existingSeeds } = await db.from('pending_metrics')
          .select('post_id')
          .eq('account_id', accountId)
          .in('post_id', unseededPosts.map((p: { id: string }) => p.id));

        const existingIds = new Set((existingSeeds || []).map((r: { post_id: string }) => r.post_id));
        const toSeed = unseededPosts.filter((p: { id: string }) => !existingIds.has(p.id));

        if (toSeed.length) {
          const seedRows = toSeed.map((p: { id: string; meta_post_id: string; content: string; published_at: string }) => ({
            account_id: accountId,
            post_id: p.id,
            threads_post_id: p.meta_post_id,
            content: p.content,
            published_at: p.published_at,
            check_after: new Date(new Date(p.published_at).getTime() + 24 * 60 * 60 * 1000).toISOString(),
            metrics_collected: false,
          }));
          await db.from('pending_metrics').insert(seedRows);

          // Re-fetch pending rows that are now due
          const { data: reseededRows } = await db.from('pending_metrics')
            .select('*')
            .eq('account_id', accountId)
            .eq('metrics_collected', false)
            .lte('check_after', new Date().toISOString())
            .order('check_after', { ascending: true });

          if (reseededRows?.length) {
            // Replace pendingRows and continue processing below
            // We reassign via a mutable ref pattern — splice into array
            pendingRows.push(...reseededRows);
          }
        }
      }

      if (!pendingRows?.length) {
        return NextResponse.json({ processed: 0, patterns_updated: [], strategy_iteration: 0 });
      }
    }

    // Fetch max_likes_seen across all posts for this account
    const { data: posts } = await db.from('posts')
      .select('likes')
      .eq('account_id', accountId)
      .not('likes', 'is', null);
    const maxLikesSeen = posts?.reduce((max: number, p: { likes: number | null }) => Math.max(max, p.likes || 0), 0) || 1;

    const patternsUpdated: string[] = [];
    const patternData: Record<string, { likes: number; replies: number; reposts: number; views: number; count: number; lastUsed: string }> = {};

    // Process each pending metric
    for (const row of pendingRows) {
      const threadsPostId = row.threads_post_id;

      if (!threadsPostId) continue;

      try {
        // Fetch real metrics from Threads API
        const metrics = await fetchThreadsInsights(threadsPostId, token);

        // Update pending_metrics with actual metrics
        await db.from('pending_metrics')
          .update({
            likes: metrics.likes,
            replies: metrics.replies,
            reposts: metrics.reposts,
            views: metrics.views,
            engagement_rate: metrics.views > 0 ? ((metrics.likes + metrics.replies + metrics.reposts) / metrics.views) * 100 : 0,
            metrics_collected: true,
            collected_at: new Date().toISOString(),
          })
          .eq('id', row.id);

        const patternName = row.pattern_used;
        if (patternName) {
          if (!patternData[patternName]) {
            patternData[patternName] = { likes: 0, replies: 0, reposts: 0, views: 0, count: 0, lastUsed: '' };
          }
          patternData[patternName].likes += metrics.likes || 0;
          patternData[patternName].replies += metrics.replies || 0;
          patternData[patternName].reposts += metrics.reposts || 0;
          patternData[patternName].views += metrics.views || 0;
          patternData[patternName].count += 1;
          patternData[patternName].lastUsed = new Date().toISOString();
        }
      } catch (err) {
        // Continue processing other rows even if one fails
        console.error(`Failed to fetch insights for post ${threadsPostId}:`, err);
      }
    }

    // Update content_patterns table
    for (const [patternName, data] of Object.entries(patternData)) {
      const avgEngagementRate = data.views > 0 ? ((data.likes + data.replies + data.reposts) / data.views) * 100 : 0;
      const effectiveLikes = data.likes / Math.max(data.count, 1);

      // Effectiveness score: 60% engagement rate (normalized) + 40% likes relative to max seen
      const engagementComponent = Math.min(avgEngagementRate / 20, 1) * 6; // cap at 6 from engagement
      const likesComponent = Math.min(effectiveLikes / maxLikesSeen, 1) * 4; // cap at 4 from likes
      const baseScore = Math.min(engagementComponent + likesComponent, 10);

      // 14-day recency decay toward 5.0
      const lastUsed = data.lastUsed ? new Date(data.lastUsed) : null;
      const daysSinceUse = lastUsed ? (new Date().getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24) : 30;
      const decayFactor = daysSinceUse > 14 ? 0.5 + 0.5 * Math.max(0, 1 - (daysSinceUse - 14) / 14) : 1;
      const effectivenessScore = 5.0 + (baseScore - 5.0) * decayFactor;

      // Upsert pattern
      const { error: patternErr } = await db.from('content_patterns')
        .upsert({
          account_id: accountId,
          pattern_name: patternName,
          times_used: data.count,
          total_likes: data.likes,
          total_replies: data.replies,
          total_reposts: data.reposts,
          total_views: data.views,
          avg_engagement_rate: parseFloat(avgEngagementRate.toFixed(2)),
          effectiveness_score: parseFloat(effectivenessScore.toFixed(2)),
          last_used_at: data.lastUsed,
        }, { onConflict: 'account_id,pattern_name' });

      if (!patternErr) {
        patternsUpdated.push(patternName);
      }
    }

    // Update content_strategy
    const { data: existingStrategy } = await db.from('content_strategy')
      .select('*')
      .eq('account_id', accountId)
      .maybeSingle();

    // Re-rank patterns by effectiveness_score
    const { data: allPatterns } = await db.from('content_patterns')
      .select('pattern_name, effectiveness_score')
      .eq('account_id', accountId)
      .order('effectiveness_score', { ascending: false });

    const rankedPatterns = (allPatterns || []).map((p: { pattern_name: string; effectiveness_score: number | null }) => ({
      pattern_name: p.pattern_name,
      effectiveness_score: p.effectiveness_score || 0,
    }));

    // Add key learnings from top/bottom performers
    const topPatterns = rankedPatterns.slice(0, 3);
    const bottomPatterns = rankedPatterns.slice(-3).reverse();

    const keyLearningsArray: { pattern: string; type: 'top' | 'bottom'; insight: string }[] = [];

    for (const p of topPatterns) {
      keyLearningsArray.push({
        pattern: p.pattern_name,
        type: 'top',
        insight: `Pattern "${p.pattern_name}" performed well with effectiveness score ${p.effectiveness_score.toFixed(1)}`,
      });
    }

    for (const p of bottomPatterns) {
      if (p.effectiveness_score < 5) {
        keyLearningsArray.push({
          pattern: p.pattern_name,
          type: 'bottom',
          insight: `Pattern "${p.pattern_name}" underperformed with effectiveness score ${p.effectiveness_score.toFixed(1)}`,
        });
      }
    }

    // Prepare new strategy
    const strategyData = {
      preferred_patterns: rankedPatterns.map((p: { pattern_name: string }) => p.pattern_name),
      key_learnings: keyLearningsArray,
      iteration: (existingStrategy?.iteration || 0) + 1,
      last_updated: new Date().toISOString(),
    };

    if (existingStrategy) {
      await db.from('content_strategy')
        .update(strategyData)
        .eq('id', existingStrategy.id);
    } else {
      await db.from('content_strategy').insert({
        account_id: accountId,
        preferred_patterns: strategyData.preferred_patterns,
        avoid_patterns: [],
        key_learnings: keyLearningsArray,
        iteration: strategyData.iteration,
      });
    }

    const strategyIteration = (existingStrategy?.iteration || 0) + 1;

    return NextResponse.json({
      processed: pendingRows.length,
      patterns_updated: patternsUpdated,
      strategy_iteration: strategyIteration,
    });
  } catch (err) {
    return NextResponse.json({
      error: 'learning_failed',
      message: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
