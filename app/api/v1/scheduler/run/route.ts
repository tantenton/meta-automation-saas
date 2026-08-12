/**
 * POST /api/v1/scheduler/run
 *
 * Trusted scheduled endpoint — invoked by cron (Vercel Cron, GitHub Actions,
 * or a system crontab) every N hours.
 *
 * Auth: Bearer CRON_SECRET  (same secret used by /api/v1/worker/run)
 *
 * Body (all optional):
 *   dry_run  boolean  — default true in dev; false only in production
 *   topic    string   — optional content topic hint
 *   limit    number   — max accounts to process this cycle (default 10)
 *
 * Safety guarantees:
 *  - publish_now is always false — drafts only, never auto-publish
 *  - No raw secrets or tokens in the response
 *  - Every run is logged to scheduler_runs table for audit
 */

import { NextRequest, NextResponse } from 'next/server';
import { authorizeWorker } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { runOrchestrationCycle, type AccountConfig } from '@/lib/scheduler/orchestrator';

export const maxDuration = 300; // 5-minute Vercel function timeout

export async function POST(request: NextRequest) {
  const denied = authorizeWorker(request);
  if (denied) return denied;

  const db = getSupabaseAdmin();
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  // dry_run defaults to true everywhere except explicit false in production
  const dryRun =
    body.dry_run === false && process.env.NODE_ENV === 'production' ? false : true;

  const topic = typeof body.topic === 'string' ? body.topic : undefined;
  const limit = Math.min(Number(body.limit ?? 10), 20);

  // Load active accounts
  const { data: accounts, error: accountsError } = await db
    .from('accounts')
    .select('id, platform, account_name')
    .eq('is_active', true)
    .limit(limit);

  if (accountsError) {
    return NextResponse.json(
      { error: 'accounts_fetch_failed', message: accountsError.message },
      { status: 500 },
    );
  }

  if (!accounts?.length) {
    return NextResponse.json({ message: 'no_active_accounts', dry_run: dryRun });
  }

  const accountConfigs: AccountConfig[] = (
    accounts as Array<{
      id: string;
      platform: 'facebook' | 'instagram' | 'threads';
      account_name: string | null;
    }>
  ).map(a => ({
    id: a.id,
    platform: a.platform,
    name: a.account_name ?? undefined,
  }));

  const vercelUrl = process.env.VERCEL_URL;
  const baseUrl =
    process.env.NEXTAUTH_URL ??
    (vercelUrl ? 'https://' + vercelUrl : 'http://localhost:3000');
  const secret = process.env.CRON_SECRET ?? process.env.HERMES_API_KEY ?? '';

  const t0 = Date.now();
  let result;

  try {
    result = await runOrchestrationCycle({
      baseUrl,
      secret,
      dryRun,
      accounts: accountConfigs,
      topic,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Best-effort audit log even on hard failure
    try {
      await db.from('scheduler_runs').insert({
        dry_run: dryRun,
        accounts_processed: accountConfigs.map(a => a.id),
        research_ok: false,
        drafts_created: 0,
        drafts_rejected: 0,
        drafts_queued: 0,
        metrics_processed: 0,
        error_message: message,
        duration_ms: Date.now() - t0,
      });
    } catch { /* non-fatal */ }

    return NextResponse.json({ error: 'orchestration_failed', message }, { status: 500 });
  }

  // Persist run log (non-fatal)
  try {
    await db.from('scheduler_runs').insert({
      dry_run: result.dryRun,
      accounts_processed: accountConfigs.map(a => a.id),
      research_ok: result.researchOk,
      drafts_created: result.draftsCreated,
      drafts_rejected: result.draftsRejected,
      drafts_queued: result.draftsQueued,
      metrics_processed: result.metricsProcessed,
      error_message: result.errors.length ? result.errors.join('; ') : null,
      duration_ms: result.durationMs,
    });
  } catch { /* non-fatal */ }

  return NextResponse.json({
    dry_run: result.dryRun,
    accounts_processed: accountConfigs.length,
    research_ok: result.researchOk,
    drafts_created: result.draftsCreated,
    drafts_rejected: result.draftsRejected,
    drafts_queued: result.draftsQueued,
    metrics_processed: result.metricsProcessed,
    errors: result.errors,
    duration_ms: result.durationMs,
    // Only IDs — never include draft content in the HTTP response
    draft_ids: result.drafts.filter(d => d.postId).map(d => d.postId),
  });
}

/** GET is a health-check ping only — returns no data, costs nothing */
export async function GET(request: NextRequest) {
  const denied = authorizeWorker(request);
  if (denied) return denied;
  return NextResponse.json({
    message: 'Use POST to trigger orchestration. GET is a health-check ping only.',
    dry_run_default: true,
  });
}
