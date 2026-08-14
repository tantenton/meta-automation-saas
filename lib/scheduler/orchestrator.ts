/**
 * orchestrator.ts — Autonomous scheduled content loop, no HTTP layer.
 *
 * Cycle (per account):
 *  1. Research  — POST /api/v1/content/research
 *  2. Generate  — POST /api/v1/content/generate
 *  3. Media     — POST /api/v1/generate-image for FB/IG when livePublish=true
 *  4. QC        — enforceMediaQC
 *  5. Persist   — /api/v1/posts; publish_now=true only when livePublish=true
 *  6. Metrics   — POST /api/v1/learning
 *
 * dry_run=true   -> steps 1-2 only; no DB writes, no media gen, no metrics.
 * dry_run=false  -> full cycle; drafts saved (publish_now=false).
 * livePublish=true -> requires SCHEDULER_LIVE_PUBLISH=true env (checked by
 *                     route.ts before calling here); FB/IG get real media_url
 *                     from /api/v1/generate-image; Threads publish_now=true.
 */

import { createHash } from 'node:crypto';
import { enforceMediaQC, type Platform, type MediaType } from './media-qc';

export interface AccountConfig {
  id: string;
  platform: Platform;
  name?: string;
}

export interface OrchestratorOptions {
  baseUrl: string;
  secret: string;
  dryRun: boolean;
  /**
   * Enable live publishing. Only effective when dryRun=false AND the caller
   * has already verified SCHEDULER_LIVE_PUBLISH=true. Has no effect in dry-run.
   */
  livePublish: boolean;
  accounts: AccountConfig[];
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
  published: boolean;
  postId?: string;
}

export interface OrchestratorResult {
  dryRun: boolean;
  livePublish: boolean;
  researchOk: boolean;
  drafts: DraftResult[];
  draftsCreated: number;
  draftsRejected: number;
  /** Posts queued for immediate publishing (livePublish=true only) */
  draftsQueued: number;
  metricsProcessed: number;
  errors: string[];
  durationMs: number;
}

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

function makeIdempotencyKey(accountId: string, platform: string, rank: number): string {
  const day = new Date().toISOString().slice(0, 10);
  return createHash('sha256')
    .update('scheduler:' + accountId + ':' + platform + ':' + day + ':' + rank)
    .digest('hex')
    .slice(0, 64);
}

interface PlatformConfig {
  defaultMediaType: MediaType;
  requiresMedia: boolean;
}

const PLATFORM_CONFIG: Record<Platform, PlatformConfig> = {
  facebook:  { defaultMediaType: 'image', requiresMedia: true },
  instagram: { defaultMediaType: 'image', requiresMedia: true },
  threads:   { defaultMediaType: 'text',  requiresMedia: false },
};

interface GeneratedVariant {
  content: string;
  pattern_used: string;
  hook_type: string;
  ai_score: number;
  composite_score: number;
  rank: number;
  reasoning: string;
}

interface GenerateImageResponse {
  public_url: string;
  media_id: string;
}

/** Calls /api/v1/generate-image and returns the uploaded public URL.
 *  Never fabricates a URL — throws if the response has no public_url. */
async function acquireMediaUrl(
  baseUrl: string,
  secret: string,
  content: string,
  platform: Platform,
): Promise<string> {
  const prompt =
    'Social media image for ' + platform + ': ' + content.slice(0, 200).replace(/\n/g, ' ');
  const res = await postInternal<GenerateImageResponse>(
    baseUrl, secret, '/api/v1/generate-image', { prompt },
  );
  if (!res.public_url) throw new Error('generate-image returned no public_url');
  return res.public_url;
}

export async function runOrchestrationCycle(
  opts: OrchestratorOptions,
): Promise<OrchestratorResult> {
  const t0 = Date.now();
  const errors: string[] = [];
  const allDrafts: DraftResult[] = [];
  let researchOk = false;
  let metricsProcessed = 0;
  let draftsQueued = 0;

  // livePublish is only honoured outside dry-run
  const effectiveLive = !opts.dryRun && opts.livePublish;

  for (const account of opts.accounts) {
    // -------------------------------------------------------------------------
    // Step 1: Research
    // -------------------------------------------------------------------------
    try {
      await postInternal(opts.baseUrl, opts.secret, '/api/v1/content/research', {
        account_id: account.id,
      });
      researchOk = true;
    } catch (err) {
      errors.push(
        '[research][' + account.id + '] ' +
        (err instanceof Error ? err.message : String(err)),
      );
    }

    // -------------------------------------------------------------------------
    // Step 2: Generate
    // -------------------------------------------------------------------------
    const platform = account.platform;
    const cfg = PLATFORM_CONFIG[platform];
    let generatedVariants: GeneratedVariant[] = [];

    try {
      const genRes = await postInternal<{ variants: GeneratedVariant[] }>(
        opts.baseUrl, opts.secret, '/api/v1/content/generate',
        { account_id: account.id, platform, ...(opts.topic ? { topic: opts.topic } : {}) },
      );
      generatedVariants = genRes.variants ?? [];
    } catch (err) {
      errors.push(
        '[generate][' + account.id + '/' + platform + '] ' +
        (err instanceof Error ? err.message : String(err)),
      );
    }

    const topVariant = generatedVariants.find(v => v.rank === 1) ?? generatedVariants[0];

    if (topVariant) {
      const mediaType = cfg.defaultMediaType;
      let mediaUrl: string | null = null;

      // -----------------------------------------------------------------------
      // Step 3: Media acquisition — live mode, FB/IG only, never fabricate URL
      // -----------------------------------------------------------------------
      if (effectiveLive && cfg.requiresMedia) {
        try {
          mediaUrl = await acquireMediaUrl(
            opts.baseUrl, opts.secret, topVariant.content, platform,
          );
        } catch (err) {
          errors.push(
            '[media][' + account.id + '/' + platform + '] ' +
            (err instanceof Error ? err.message : String(err)),
          );
          // mediaUrl stays null — QC will reject, preserving safety net
        }
      }

      // -----------------------------------------------------------------------
      // Step 4: QC
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
        published: false,
      };
      allDrafts.push(draft);

      // -----------------------------------------------------------------------
      // Step 5: Persist
      // -----------------------------------------------------------------------
      if (qcResult.pass && !opts.dryRun) {
        const publishNow = effectiveLive;
        try {
          const postRes = await postInternal<{ post: { id: string } }>(
            opts.baseUrl, opts.secret, '/api/v1/posts',
            {
              account_id: account.id,
              content_id: 'scheduler:' + account.id + ':' + new Date().toISOString().slice(0, 10),
              revision: 1,
              caption: topVariant.content,
              media_type: mediaType,
              ...(mediaUrl ? { media_url: mediaUrl } : {}),
              publish_now: publishNow,
              idempotency_key: draft.idempotencyKey,
            },
          );
          draft.persisted = true;
          draft.postId = postRes.post?.id;
          if (publishNow) {
            draft.published = true;
            draftsQueued++;
          }
        } catch (err) {
          errors.push(
            '[persist][' + account.id + '/' + platform + '] ' +
            (err instanceof Error ? err.message : String(err)),
          );
        }
      }
    }

    // -------------------------------------------------------------------------
    // Step 6: Metrics
    // -------------------------------------------------------------------------
    if (!opts.dryRun) {
      try {
        const lr = await postInternal<{ processed: number }>(
          opts.baseUrl, opts.secret, '/api/v1/learning', { account_id: account.id },
        );
        metricsProcessed += lr.processed ?? 0;
      } catch (err) {
        errors.push(
          '[learning][' + account.id + '] ' +
          (err instanceof Error ? err.message : String(err)),
        );
      }
    }
  }

  return {
    dryRun: opts.dryRun,
    livePublish: effectiveLive,
    researchOk,
    drafts: allDrafts,
    draftsCreated: allDrafts.filter(d => d.qcPassed && d.persisted).length,
    draftsRejected: allDrafts.filter(d => !d.qcPassed).length,
    draftsQueued,
    metricsProcessed,
    errors,
    durationMs: Date.now() - t0,
  };
}
