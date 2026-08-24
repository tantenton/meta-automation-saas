/**
 * POST /api/v1/threads/discover
 *
 * Trend-discovery-before-outbound endpoint.
 * Cron-compatible: call this first, then pass its candidates to /outbound.
 *
 * Body (all optional):
 *   trend_candidates: TrendCandidate[]  — usernames + optional user_ids + hints
 *   min_score: number                   — default 0.20
 *   max_candidates: number              — default 50
 *   upsert_targets: boolean             — default true (persist qualified as outbound_targets)
 *
 * Response: DiscoveryResult + upsert summary
 *
 * No browser, no login — Threads Graph API + Jina public reader only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authorizeMachine } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { decryptToken } from '@/lib/server/token-crypto';
import {
  discoverTrendCandidates,
  upsertDiscoveredTargets,
  type TrendCandidate,
} from '@/lib/threads/trend-discovery';

export async function POST(request: NextRequest) {
  const denied = authorizeMachine(request);
  if (denied) return denied;

  const db = getSupabaseAdmin();

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;

    const rawCandidates: TrendCandidate[] = Array.isArray(body.trend_candidates)
      ? (body.trend_candidates as TrendCandidate[])
      : [];
    const minScore      = typeof body.min_score === 'number' ? body.min_score : 0.20;
    const maxCandidates = typeof body.max_candidates === 'number' ? body.max_candidates : 50;
    const upsertTargets = body.upsert_targets !== false; // default true

    // Load active Threads account
    const { data: account } = await db
      .from('accounts')
      .select('*')
      .eq('platform', 'threads')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (!account) {
      return NextResponse.json({ error: 'no_active_threads_account' }, { status: 404 });
    }

    const token = decryptToken(account.access_token_encrypted);

    // Load static outbound_targets as baseline candidates
    const { data: staticTargets } = await db
      .from('outbound_targets')
      .select('target_username, target_user_id, category')
      .eq('account_id', account.id as string)
      .eq('is_active', true)
      .limit(30);

    const staticCandidates: TrendCandidate[] = (staticTargets ?? []).map(
      (t: Record<string, unknown>) => ({
        username: t.target_username as string,
        user_id: t.target_user_id as string | null,
        category: t.category as string,
      })
    );

    // Merge: static + caller-supplied (no duplicates)
    const allCandidates: TrendCandidate[] = [
      ...staticCandidates,
      ...rawCandidates.filter(c => !staticCandidates.some(s => s.username === c.username)),
    ];

    if (!allCandidates.length) {
      return NextResponse.json({
        message: 'no_candidates_provided',
        persona_weights: null,
        research_signals: [],
        candidates: [],
        upserted: 0,
      });
    }

    // Load already-processed post IDs to exclude
    const { data: existingComments } = await db
      .from('outbound_comments')
      .select('target_post_id')
      .eq('account_id', account.id as string)
      .eq('comment_status', 'posted');

    const excludePostIds = new Set<string>(
      (existingComments ?? []).map((c: Record<string, unknown>) => c.target_post_id as string)
    );

    // Run discovery
    const result = await discoverTrendCandidates({
      token,
      accountId: account.account_id as string,
      trendCandidates: allCandidates,
      excludePostIds,
      minScore,
      maxCandidates,
    });

    // Optionally persist qualified targets
    let upsertSummary = { upserted: 0, errors: [] as string[] };
    if (upsertTargets && result.candidates.length) {
      upsertSummary = await upsertDiscoveredTargets(
        db,
        account.id as string,
        result.candidates,
      );
    }

    return NextResponse.json({
      persona_weights: result.persona_weights,
      research_signals: result.research_signals,
      candidates: result.candidates.map(c => ({
        username: c.username,
        post_id: c.id,
        post_text: c.text.slice(0, 150),
        permalink: c.permalink,
        timestamp: c.timestamp,
        scores: c.scores,
      })),
      total_fetched: result.total_fetched,
      total_safe: result.total_safe,
      total_scored: result.total_scored,
      upsert_targets: upsertTargets,
      upserted: upsertSummary.upserted,
      upsert_errors: upsertSummary.errors,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'discovery_failed',
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
