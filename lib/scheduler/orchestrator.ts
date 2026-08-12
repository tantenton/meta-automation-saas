/**
 * orchestrator.ts
 * Autonomous scheduled content loop — pure business logic, no HTTP layer.
 *
 * Cycle (per account):
 *  1. Research  — POST /api/v1/content/research to refresh content_patterns
 *  2. Generate  — POST /api/v1/content/generate for the account platform
 *  3. QC        — enforce media-first rules via enforceMediaQC
 *  4. Persist   — insert passing drafts as status='draft' (publish_now=false)
 *  5. Metrics   — POST /api/v1/learning to collect pending engagement data
 *
 * dry_run=true  → steps 1–3 run; DB writes and metric calls are skipped.
 * dry_run=false → full cycle; posts saved as draft only (never queued).
 *
 * No live Meta API calls are made here. All platform I/O goes through
 * existing internal endpoints guarded by CRON_SECRET.
 */

import { createHash } from 'node:crypto';
import { enforceMediaQC, type Platform, type MediaType } from './media-qc';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AccountConfig {
  id: string;        // accounts.id (UUID)
  platform: Platform;
  name?: string;
}

export interface OrchestratorOptions {
  /** Base URL of the Next.js app, e.g. https://example.com */
  baseUrl: string;
  /** Bearer token for internal API calls (CRON_SECRET) */
  secret: string;
  /** When true, skip all DB writes and metric fetches */
  dryRun: boolean;
  /** Accounts to process this cycle */
  accounts: AccountConfig[];
  /** Optional topic hint passed to content/generate */
  topic?: string;
}

export interface DraftResult {
  accountId: string;
  platform: Platform;
  content: string;
  mediaType: MediaType;
  mediaUrl?: string | null;
  patternUsed: string;
  compositeScore: number;
  idempotencyKey: string;
  qcPassed: boolean;
  qcReason?: string;
  persisted: boolean;
  postId?: string;
}

export interface OrchestratorResult {
  dryRun: boolean;
  researchOk: boolean;
  drafts: DraftResult[];
  draftsCreated: number;
  draftsRejected: number;
  /** Always 0 — this scheduler never auto-queues */
  draftsQueued: number;
  metricsProcessed: number;
  errors: string[];
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function makeHeaders(secret: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: 'Bearer ' + secret };
}

async function postInternal<T>(
  baseUrl: string,
  secret: string,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(baseUrl + path, {
    method: 'POST',
    headers: makeHeaders(secret),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(path + ' HTTP ' + res.status + ': ' + text.slice(0, 200));
  }
  return res.json() as Promise<T>;
}

/** Stable per-day idempotency key so duplicate cron runs are harmless */
function makeIdempotencyKey(accountId: string, platform: string, rank: number): string {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return createHash('sha256')
    .update('scheduler:' + accountId + ':' + platform + ':' + day + ':' + rank)
    .digest('hex')
    .slice(0, 64);
}

// ---------------------------------------------------------------------------
// Per-platform defaults
// ---------------------------------------------------------------------------

interface PlatformConfig {
  defaultMediaType: MediaType;
  requiresMedia: boolean;
}

const PLATFORM_CONFIG: Record<Platform, PlatformConfig> = {
  facebook:  { defaultMediaType: 'image', requiresMedia: true },
  instagram: { defaultMediaType: 'image', requiresMedia: true },
  threads:   { defaultMediaType: 'text',  requiresMedia: false },
};

// ---------------------------------------------------------------------------
// Response shapes from internal endpoints
// ---------------------------------------------------------------------------

interface GeneratedVariant {
  content: string;
  pattern_used: string;
  hook_type: string;
  ai_score: number;
  composite_score: number;
  rank: number;
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Core orchestration cycle
// ---------------------------------------------------------------------------

export async function runOrchestrationCycle(
  opts: OrchestratorOptions,
): Promise<OrchestratorResult> {
  const t0 = Date.now();
  const errors: string[] = [];
  const allDrafts: DraftResult[] = [];
  let researchOk = false;
  let metricsProcessed = 0;

  for (const account of opts.accounts) {
    // -----------------------------------------------------------------------
    // Step 1: Research — refresh content_patterns from trending signals
    // -----------------------------------------------------------------------
    try {
      await postInternal(opts.baseUrl, opts.secret, '/api/v1/content/research', {
        account_id: account.id,
      });
      researchOk = true;
    } catch (err) {
      // Non-fatal: existing patterns are still usable
      errors.push(
        '[research][' + account.id + '] ' +
        (err instanceof Error ? err.message : String(err)),
      );
    }

    // -----------------------------------------------------------------------
    // Step 2: Generate — get ranked variants for this account's platform
    // -----------------------------------------------------------------------
    const platform = account.platform;
    const cfg = PLATFORM_CONFIG[platform];
    let generatedVariants: GeneratedVariant[] = [];

    try {
      const genRes = await postInternal<{ variants: GeneratedVariant[] }>(
        opts.baseUrl,
        opts.secret,
        '/api/v1/content/generate',
        {
          account_id: account.id,
          platform,
          ...(opts.topic ? { topic: opts.topic } : {}),
        },
      );
      generatedVariants = genRes.variants ?? [];
    } catch (err) {
      errors.push(
        '[generate][' + account.id + '/' + platform + '] ' +
        (err instanceof Error ? err.message : String(err)),
      );
    }

    // Take the top-ranked variant only (safest for automated draft creation)
    const topVariant = generatedVariants.find(v => v.rank === 1) ?? generatedVariants[0];

    if (topVariant) {
      const mediaType = cfg.defaultMediaType;
      // Scheduler never fabricates media URLs — QC will flag FB/IG until a real
      // URL is attached downstream (e.g. image generation step).
      const mediaUrl: string | null = null;

      // -----------------------------------------------------------------------
      // Step 3: QC — enforce media-first rules
      // -----------------------------------------------------------------------
      const qcResult = enforceMediaQC({ platform, mediaType, mediaUrl });

      const draft: DraftResult = {
        accountId: account.id,
        platform,
        content: topVariant.content,
        mediaType,
        mediaUrl,
        patternUsed: topVariant.pattern_used,
        compositeScore: topVariant.composite_score,
        idempotencyKey: makeIdempotencyKey(account.id, platform, topVariant.rank),
        qcPassed: qcResult.pass,
        qcReason: qcResult.reason,
        persisted: false,
      };
      allDrafts.push(draft);

      // -----------------------------------------------------------------------
      // Step 4: Persist as draft — only if QC passed and not dry_run
      // -----------------------------------------------------------------------
      if (qcResult.pass && !opts.dryRun) {
        try {
          const postRes = await postInternal<{ post: { id: string } }>(
            opts.baseUrl,
            opts.secret,
            '/api/v1/posts',
            {
              account_id: account.id,
              content_id:
                'scheduler:' + account.id + ':' + new Date().toISOString().slice(0, 10),
              revision: 1,
              caption: topVariant.content,
              media_type: mediaType,
              publish_now: false,       // NEVER auto-publish
              idempotency_key: draft.idempotencyKey,
            },
          );
          draft.persisted = true;
          draft.postId = postRes.post?.id;
        } catch (err) {
          errors.push(
            '[persist][' + account.id + '/' + platform + '] ' +
            (err instanceof Error ? err.message : String(err)),
          );
        }
      }
    }

    // -----------------------------------------------------------------------
    // Step 5: Metrics/learning — collect engagement on previously published posts
    // -----------------------------------------------------------------------
    if (!opts.dryRun) {
      try {
        const lr = await postInternal<{ processed: number }>(
          opts.baseUrl,
          opts.secret,
          '/api/v1/learning',
          { account_id: account.id },
        );
        metricsProcessed += lr.processed ?? 0;
      } catch (err) {
        // Non-fatal — metrics will be collected on next cycle
        errors.push(
          '[learning][' + account.id + '] ' +
          (err instanceof Error ? err.message : String(err)),
        );
      }
    }
  }

  return {
    dryRun: opts.dryRun,
    researchOk,
    drafts: allDrafts,
    draftsCreated: allDrafts.filter(d => d.qcPassed && d.persisted).length,
    draftsRejected: allDrafts.filter(d => !d.qcPassed).length,
    draftsQueued: 0,
    metricsProcessed,
    errors,
    durationMs: Date.now() - t0,
  };
}
