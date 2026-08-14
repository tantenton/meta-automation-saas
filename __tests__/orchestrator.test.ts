import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runOrchestrationCycle, type OrchestratorOptions } from '../lib/scheduler/orchestrator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ACCOUNT_FB = { id: 'acct-fb-001', platform: 'facebook' as const };
const ACCOUNT_IG = { id: 'acct-ig-001', platform: 'instagram' as const };
const ACCOUNT_TH = { id: 'acct-th-001', platform: 'threads' as const };

const VARIANT_THREADS = {
  content: 'Hai semua, tau gak sih kalau tidur cukup itu...',
  pattern_used: 'curiosityGap',
  hook_type: 'curiosity',
  ai_score: 8,
  composite_score: 7.5,
  rank: 1,
  reasoning: 'High novelty',
};

const VARIANT_FB = {
  ...VARIANT_THREADS,
  content: 'Fakta menarik tentang produktivitas...',
  rank: 1,
};

const REAL_MEDIA_URL = 'https://cdn.example.com/generated/2026-08-14/abc123.jpg';

function makeFetchMock(opts: {
  researchOk?: boolean;
  generateVariants?: typeof VARIANT_THREADS[];
  learningProcessed?: number;
  persistPostId?: string;
  imagePublicUrl?: string | null;
} = {}) {
  const {
    researchOk = true,
    generateVariants = [VARIANT_THREADS],
    learningProcessed = 2,
    persistPostId = 'post-uuid-123',
    imagePublicUrl = REAL_MEDIA_URL,
  } = opts;

  return vi.fn(async (url: string, init?: RequestInit) => {
    const urlStr = url.toString();
    const body = init?.body ? JSON.parse(init.body as string) : {};

    if (urlStr.includes('/api/v1/content/research')) {
      if (!researchOk) throw new Error('research network error');
      return new Response(JSON.stringify({ patterns: [] }), { status: 200 });
    }
    if (urlStr.includes('/api/v1/content/generate')) {
      return new Response(
        JSON.stringify({ variants: generateVariants, best: generateVariants[0] }),
        { status: 200 },
      );
    }
    if (urlStr.includes('/api/v1/generate-image')) {
      if (imagePublicUrl === null) {
        return new Response(JSON.stringify({ error: 'generation_failed' }), { status: 500 });
      }
      return new Response(
        JSON.stringify({ public_url: imagePublicUrl, media_id: 'generated/path.jpg' }),
        { status: 201 },
      );
    }
    if (urlStr.includes('/api/v1/posts')) {
      if (body.media_type === 'text' && body.account_id === 'acct-ig-001') {
        return new Response(
          JSON.stringify({ error: 'instagram_requires_media' }),
          { status: 400 },
        );
      }
      return new Response(
        JSON.stringify({ post: { id: persistPostId } }),
        { status: 201 },
      );
    }
    if (urlStr.includes('/api/v1/learning')) {
      return new Response(JSON.stringify({ processed: learningProcessed }), { status: 200 });
    }
    throw new Error('Unexpected fetch: ' + urlStr);
  });
}

// ---------------------------------------------------------------------------
// Existing tests — dry_run=true
// ---------------------------------------------------------------------------

describe('runOrchestrationCycle — dry_run=true', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = makeFetchMock();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns dryRun=true and never calls /api/v1/posts or /api/v1/learning', async () => {
    const opts: OrchestratorOptions = {
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: true,
      livePublish: false,
      accounts: [ACCOUNT_TH],
    };
    const result = await runOrchestrationCycle(opts);

    expect(result.dryRun).toBe(true);
    expect(result.draftsCreated).toBe(0);
    expect(result.draftsQueued).toBe(0);
    expect(result.metricsProcessed).toBe(0);

    const calledUrls = fetchSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(calledUrls.some((u: string) => u.includes('/posts'))).toBe(false);
    expect(calledUrls.some((u: string) => u.includes('/learning'))).toBe(false);
  });

  it('calls research and generate in dry_run mode', async () => {
    const opts: OrchestratorOptions = {
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: true,
      livePublish: false,
      accounts: [ACCOUNT_TH],
    };
    await runOrchestrationCycle(opts);
    const calledUrls = fetchSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(calledUrls.some((u: string) => u.includes('/content/research'))).toBe(true);
    expect(calledUrls.some((u: string) => u.includes('/content/generate'))).toBe(true);
  });

  it('Threads draft passes QC without media in dry_run', async () => {
    const opts: OrchestratorOptions = {
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: true,
      livePublish: false,
      accounts: [ACCOUNT_TH],
    };
    const result = await runOrchestrationCycle(opts);
    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0].qcPassed).toBe(true);
    expect(result.draftsRejected).toBe(0);
  });

  it('Facebook draft fails QC without media URL (no TEXT_TEST)', async () => {
    const opts: OrchestratorOptions = {
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: true,
      livePublish: false,
      accounts: [ACCOUNT_FB],
      topic: 'produktivitas',
    };
    const result = await runOrchestrationCycle(opts);
    expect(result.drafts).toHaveLength(1);
    expect(result.drafts[0].qcPassed).toBe(false);
    expect(result.drafts[0].qcReason).toMatch(/Facebook/);
    expect(result.draftsRejected).toBe(1);
  });

  it('Instagram draft fails QC without media URL', async () => {
    const opts: OrchestratorOptions = {
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: true,
      livePublish: false,
      accounts: [ACCOUNT_IG],
    };
    const result = await runOrchestrationCycle(opts);
    expect(result.drafts[0].qcPassed).toBe(false);
    expect(result.drafts[0].qcReason).toMatch(/Instagram/);
  });

  it('handles empty generate response gracefully', async () => {
    fetchSpy = makeFetchMock({ generateVariants: [] });
    vi.stubGlobal('fetch', fetchSpy);
    const opts: OrchestratorOptions = {
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: true,
      livePublish: false,
      accounts: [ACCOUNT_TH],
    };
    const result = await runOrchestrationCycle(opts);
    expect(result.drafts).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('records non-fatal research errors without aborting cycle', async () => {
    fetchSpy = makeFetchMock({ researchOk: false });
    vi.stubGlobal('fetch', fetchSpy);
    const opts: OrchestratorOptions = {
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: true,
      livePublish: false,
      accounts: [ACCOUNT_TH],
    };
    const result = await runOrchestrationCycle(opts);
    expect(result.errors.some((e: string) => e.includes('[research]'))).toBe(true);
    expect(result.drafts).toHaveLength(1);
  });

  it('processes multiple accounts independently', async () => {
    const opts: OrchestratorOptions = {
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: true,
      livePublish: false,
      accounts: [ACCOUNT_TH, ACCOUNT_TH],
    };
    const result = await runOrchestrationCycle(opts);
    expect(result.drafts).toHaveLength(2);
  });

  it('includes durationMs in result', async () => {
    const opts: OrchestratorOptions = {
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: true,
      livePublish: false,
      accounts: [ACCOUNT_TH],
    };
    const result = await runOrchestrationCycle(opts);
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Existing tests — dry_run=false, livePublish=false (draft mode)
// ---------------------------------------------------------------------------

describe('runOrchestrationCycle — dry_run=false, livePublish=false', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = makeFetchMock();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls /api/v1/learning and counts metricsProcessed', async () => {
    const opts: OrchestratorOptions = {
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: false,
      livePublish: false,
      accounts: [ACCOUNT_TH],
    };
    const result = await runOrchestrationCycle(opts);
    expect(result.metricsProcessed).toBe(2);
    const calledUrls = fetchSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(calledUrls.some((u: string) => u.includes('/learning'))).toBe(true);
  });

  it('Threads draft is persisted as draft (QC passes, not dry_run)', async () => {
    const opts: OrchestratorOptions = {
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: false,
      livePublish: false,
      accounts: [ACCOUNT_TH],
    };
    const result = await runOrchestrationCycle(opts);
    expect(result.draftsCreated).toBe(1);
    expect(result.drafts[0].persisted).toBe(true);
    expect(result.drafts[0].published).toBe(false);
    expect(result.drafts[0].postId).toBe('post-uuid-123');
    // publish_now must be false in draft mode
    const postCall = fetchSpy.mock.calls.find((c: unknown[]) =>
      String(c[0]).includes('/api/v1/posts'),
    );
    expect(postCall).toBeDefined();
    const sentBody = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(sentBody.publish_now).toBe(false);
  });

  it('Facebook draft is NOT persisted (QC fails, no media)', async () => {
    const opts: OrchestratorOptions = {
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: false,
      livePublish: false,
      accounts: [ACCOUNT_FB],
    };
    const result = await runOrchestrationCycle(opts);
    expect(result.draftsCreated).toBe(0);
    expect(result.draftsRejected).toBe(1);
    expect(result.drafts[0].persisted).toBe(false);
    const calledUrls = fetchSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(calledUrls.filter((u: string) => u.includes('/posts'))).toHaveLength(0);
  });

  it('persist errors are non-fatal and recorded in errors array', async () => {
    const failFetch = vi.fn(async (url: string) => {
      const u = url.toString();
      if (u.includes('/content/research'))
        return new Response(JSON.stringify({}), { status: 200 });
      if (u.includes('/content/generate'))
        return new Response(
          JSON.stringify({ variants: [VARIANT_THREADS], best: VARIANT_THREADS }),
          { status: 200 },
        );
      if (u.includes('/posts'))
        return new Response(JSON.stringify({ error: 'db_error' }), { status: 500 });
      if (u.includes('/learning'))
        return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
      throw new Error('unexpected: ' + u);
    });
    vi.stubGlobal('fetch', failFetch);

    const opts: OrchestratorOptions = {
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: false,
      livePublish: false,
      accounts: [ACCOUNT_TH],
    };
    const result = await runOrchestrationCycle(opts);
    expect(result.drafts[0].persisted).toBe(false);
    expect(result.errors.some((e: string) => e.includes('[persist]'))).toBe(true);
    expect(result.draftsCreated).toBe(0);
  });

  it('idempotency keys are stable (same day, same account, same rank)', async () => {
    const opts: OrchestratorOptions = {
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: true,
      livePublish: false,
      accounts: [ACCOUNT_TH, ACCOUNT_TH],
    };
    const result = await runOrchestrationCycle(opts);
    expect(result.drafts[0].idempotencyKey).toBe(result.drafts[1].idempotencyKey);
  });

  it('never sets draftsQueued > 0 in draft mode', async () => {
    const opts: OrchestratorOptions = {
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: false,
      livePublish: false,
      accounts: [ACCOUNT_TH, ACCOUNT_FB, ACCOUNT_IG],
    };
    const result = await runOrchestrationCycle(opts);
    expect(result.draftsQueued).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// NEW: live flag guard tests
// ---------------------------------------------------------------------------

describe('runOrchestrationCycle — live flag guard', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('livePublish=true with dryRun=true is silently ignored (effectiveLive=false)', async () => {
    const fetchSpy = makeFetchMock();
    vi.stubGlobal('fetch', fetchSpy);

    const opts: OrchestratorOptions = {
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: true,
      livePublish: true, // should be ignored because dryRun=true
      accounts: [ACCOUNT_TH],
    };
    const result = await runOrchestrationCycle(opts);
    expect(result.livePublish).toBe(false);
    expect(result.draftsQueued).toBe(0);
    const calledUrls = fetchSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(calledUrls.some((u: string) => u.includes('/posts'))).toBe(false);
    expect(calledUrls.some((u: string) => u.includes('/generate-image'))).toBe(false);
  });

  it('livePublish=false never calls generate-image even in non-dry-run', async () => {
    const fetchSpy = makeFetchMock();
    vi.stubGlobal('fetch', fetchSpy);

    const opts: OrchestratorOptions = {
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: false,
      livePublish: false,
      accounts: [ACCOUNT_FB],
    };
    await runOrchestrationCycle(opts);
    const calledUrls = fetchSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(calledUrls.some((u: string) => u.includes('/generate-image'))).toBe(false);
  });

  it('result.livePublish reflects effective state, not opts.livePublish', async () => {
    const fetchSpy = makeFetchMock();
    vi.stubGlobal('fetch', fetchSpy);

    // livePublish=true but dryRun=true => effectiveLive=false
    const result = await runOrchestrationCycle({
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: true,
      livePublish: true,
      accounts: [ACCOUNT_TH],
    });
    expect(result.livePublish).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// NEW: Threads live publish
// ---------------------------------------------------------------------------

describe('runOrchestrationCycle — Threads live publish', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('Threads live: persists with publish_now=true and increments draftsQueued', async () => {
    const fetchSpy = makeFetchMock();
    vi.stubGlobal('fetch', fetchSpy);

    const opts: OrchestratorOptions = {
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: false,
      livePublish: true,
      accounts: [ACCOUNT_TH],
    };
    const result = await runOrchestrationCycle(opts);

    expect(result.livePublish).toBe(true);
    expect(result.draftsQueued).toBe(1);
    expect(result.drafts[0].published).toBe(true);
    expect(result.drafts[0].persisted).toBe(true);
    expect(result.drafts[0].qcPassed).toBe(true);

    // Verify publish_now=true was sent to /api/v1/posts
    const postCall = fetchSpy.mock.calls.find((c: unknown[]) =>
      String(c[0]).includes('/api/v1/posts'),
    );
    expect(postCall).toBeDefined();
    const sentBody = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(sentBody.publish_now).toBe(true);
  });

  it('Threads live: does NOT call generate-image (text platform)', async () => {
    const fetchSpy = makeFetchMock();
    vi.stubGlobal('fetch', fetchSpy);

    await runOrchestrationCycle({
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: false,
      livePublish: true,
      accounts: [ACCOUNT_TH],
    });

    const calledUrls = fetchSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(calledUrls.some((u: string) => u.includes('/generate-image'))).toBe(false);
  });

  it('Threads live: no media_url sent (text post)', async () => {
    const fetchSpy = makeFetchMock();
    vi.stubGlobal('fetch', fetchSpy);

    await runOrchestrationCycle({
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: false,
      livePublish: true,
      accounts: [ACCOUNT_TH],
    });

    const postCall = fetchSpy.mock.calls.find((c: unknown[]) =>
      String(c[0]).includes('/api/v1/posts'),
    );
    const sentBody = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(sentBody.media_url).toBeUndefined();
    expect(sentBody.media_type).toBe('text');
  });
});

// ---------------------------------------------------------------------------
// NEW: FB/IG no-media rejection in live mode
// ---------------------------------------------------------------------------

describe('runOrchestrationCycle — FB/IG live: no-media rejection', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('FB live: calls generate-image and passes media_url to /api/v1/posts', async () => {
    const fetchSpy = makeFetchMock({ generateVariants: [VARIANT_FB] });
    vi.stubGlobal('fetch', fetchSpy);

    const opts: OrchestratorOptions = {
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: false,
      livePublish: true,
      accounts: [ACCOUNT_FB],
    };
    const result = await runOrchestrationCycle(opts);

    expect(result.livePublish).toBe(true);
    expect(result.drafts[0].qcPassed).toBe(true);
    expect(result.drafts[0].mediaUrl).toBe(REAL_MEDIA_URL);
    expect(result.draftsCreated).toBe(1);
    expect(result.draftsQueued).toBe(1);

    const postCall = fetchSpy.mock.calls.find((c: unknown[]) =>
      String(c[0]).includes('/api/v1/posts'),
    );
    const sentBody = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(sentBody.media_url).toBe(REAL_MEDIA_URL);
    expect(sentBody.publish_now).toBe(true);
  });

  it('IG live: calls generate-image and passes media_url to /api/v1/posts', async () => {
    const fetchSpy = makeFetchMock({ generateVariants: [VARIANT_FB] });
    vi.stubGlobal('fetch', fetchSpy);

    const result = await runOrchestrationCycle({
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: false,
      livePublish: true,
      accounts: [ACCOUNT_IG],
    });

    expect(result.drafts[0].qcPassed).toBe(true);
    expect(result.drafts[0].mediaUrl).toBe(REAL_MEDIA_URL);
    expect(result.draftsQueued).toBe(1);
  });

  it('FB live: generate-image failure -> QC rejects, no /posts call, error recorded', async () => {
    const fetchSpy = makeFetchMock({ generateVariants: [VARIANT_FB], imagePublicUrl: null });
    vi.stubGlobal('fetch', fetchSpy);

    const result = await runOrchestrationCycle({
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: false,
      livePublish: true,
      accounts: [ACCOUNT_FB],
    });

    // mediaUrl is null => QC fails => no post created
    expect(result.drafts[0].qcPassed).toBe(false);
    expect(result.draftsCreated).toBe(0);
    expect(result.draftsQueued).toBe(0);
    expect(result.errors.some((e: string) => e.includes('[media]'))).toBe(true);
    const calledUrls = fetchSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(calledUrls.some((u: string) => u.includes('/api/v1/posts'))).toBe(false);
  });

  it('IG live: generate-image failure -> QC rejects, no /posts call', async () => {
    const fetchSpy = makeFetchMock({ generateVariants: [VARIANT_FB], imagePublicUrl: null });
    vi.stubGlobal('fetch', fetchSpy);

    const result = await runOrchestrationCycle({
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: false,
      livePublish: true,
      accounts: [ACCOUNT_IG],
    });

    expect(result.drafts[0].qcPassed).toBe(false);
    expect(result.draftsQueued).toBe(0);
    expect(result.errors.some((e: string) => e.includes('[media]'))).toBe(true);
  });

  it('FB/IG without livePublish still fails QC (no media acquired in draft mode)', async () => {
    const fetchSpy = makeFetchMock({ generateVariants: [VARIANT_FB] });
    vi.stubGlobal('fetch', fetchSpy);

    const result = await runOrchestrationCycle({
      baseUrl: 'http://localhost:3000',
      secret: 'test-secret',
      dryRun: false,
      livePublish: false,
      accounts: [ACCOUNT_FB, ACCOUNT_IG],
    });

    expect(result.drafts.every(d => !d.qcPassed)).toBe(true);
    expect(result.draftsRejected).toBe(2);
    const calledUrls = fetchSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(calledUrls.some((u: string) => u.includes('/generate-image'))).toBe(false);
  });
});
