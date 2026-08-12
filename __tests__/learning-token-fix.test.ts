import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Unit tests for learning route token handling
// Verifies that:
//   1. access_token_encrypted is selected (not legacy access_token)
//   2. decryptToken is called with the encrypted value
//   3. 404 is returned when access_token_encrypted is missing
//   4. plaintext token is never returned in any response
// ---------------------------------------------------------------------------

// Mock token-crypto so we don't need TOKEN_ENCRYPTION_KEY in test env
vi.mock('@/lib/server/token-crypto', () => ({
  decryptToken: vi.fn((val: string) => `decrypted:${val}`),
  encryptToken: vi.fn((val: string) => `encrypted:${val}`),
}));

// Mutable mock state — reset per test
let mockSingleImpl: () => Promise<unknown> = async () => ({ data: null, error: null });

// Reusable no-op chain — typed as any to avoid fighting TS structural inference on deep mock shapes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeChain(): any {
  return {
    select: () => makeChain(),
    eq: () => makeChain(),
    not: () => makeChain(),
    lte: () => makeChain(),
    maybeSingle: async () => ({ data: null, error: null }),
    single: () => mockSingleImpl(),
    order: async () => ({ data: [], error: null }),
    update: () => makeChain(),
    upsert: () => makeChain(),
    insert: () => Promise.resolve({ error: null }),
  };
}

// Track which columns were selected for the accounts query
let capturedSelectCols: string[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFrom = vi.fn((_table: string): any => ({
  ...makeChain(),
  select: (cols?: string) => {
    if (cols) capturedSelectCols.push(cols);
    return {
      ...makeChain(),
      eq: () => ({
        ...makeChain(),
        single: () => mockSingleImpl(),
      }),
    };
  },
}));

vi.mock('@/lib/server/supabase-admin', () => ({
  getSupabaseAdmin: () => ({ from: mockFrom }),
}));

// Mock api-auth — allow all requests through
vi.mock('@/lib/server/api-auth', () => ({
  authorizeMachine: vi.fn(() => null),
  authorizeWorker: vi.fn(() => null),
}));

import { decryptToken } from '@/lib/server/token-crypto';

// Helper: build a minimal NextRequest-like object
function makeRequest(body: Record<string, unknown>) {
  return {
    json: async () => body,
    headers: { get: () => 'Bearer test-secret' },
  } as unknown as import('next/server').NextRequest;
}

describe('learning route — token field selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedSelectCols = [];
    mockSingleImpl = async () => ({ data: null, error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 404 when account row has no access_token_encrypted', async () => {
    mockSingleImpl = async () => ({
      data: { id: 'acct-1', account_id: 'meta-1', platform: 'threads', access_token_encrypted: null },
      error: null,
    });

    const { POST } = await import('@/app/api/v1/learning/route');
    const req = makeRequest({ account_id: '879bedfa-f217-41c6-9abf-29c75ebac0e1' });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('account_not_found_or_no_token');
  });

  it('returns 404 when account row is null', async () => {
    mockSingleImpl = async () => ({ data: null, error: null });

    const { POST } = await import('@/app/api/v1/learning/route');
    const req = makeRequest({ account_id: '879bedfa-f217-41c6-9abf-29c75ebac0e1' });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe('account_not_found_or_no_token');
  });

  it('calls decryptToken with access_token_encrypted value', async () => {
    const encryptedVal = 'v1.someiv.sometag.someciphertext';

    mockSingleImpl = async () => ({
      data: {
        id: '879bedfa-f217-41c6-9abf-29c75ebac0e1',
        account_id: 'threads-meta-id',
        platform: 'threads',
        access_token_encrypted: encryptedVal,
      },
      error: null,
    });

    const { POST } = await import('@/app/api/v1/learning/route');
    const req = makeRequest({ account_id: '879bedfa-f217-41c6-9abf-29c75ebac0e1' });
    await POST(req);

    expect(decryptToken).toHaveBeenCalledWith(encryptedVal);
    expect(decryptToken).toHaveBeenCalledTimes(1);
  });

  it('never selects legacy access_token field', async () => {
    mockSingleImpl = async () => ({ data: null, error: null });

    const { POST } = await import('@/app/api/v1/learning/route');
    const req = makeRequest({ account_id: '879bedfa-f217-41c6-9abf-29c75ebac0e1' });
    await POST(req);

    // capturedSelectCols[0] is the accounts query column list
    const accountsSelectArg = capturedSelectCols[0] ?? '';
    expect(accountsSelectArg).toContain('access_token_encrypted');
    // Must NOT include bare access_token as a standalone field
    const fields = accountsSelectArg.split(',').map((s: string) => s.trim());
    expect(fields).not.toContain('access_token');
  });

  it('returns 400 when account_id is missing', async () => {
    const { POST } = await import('@/app/api/v1/learning/route');
    const req = makeRequest({});
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('account_id_required');
  });

  it('response body never contains plaintext token', async () => {
    mockSingleImpl = async () => ({
      data: {
        id: '879bedfa-f217-41c6-9abf-29c75ebac0e1',
        account_id: 'threads-meta-id',
        platform: 'threads',
        access_token_encrypted: 'v1.iv.tag.cipher',
      },
      error: null,
    });

    const { POST } = await import('@/app/api/v1/learning/route');
    const req = makeRequest({ account_id: '879bedfa-f217-41c6-9abf-29c75ebac0e1' });
    const res = await POST(req);
    const bodyText = await res.text();

    // decryptToken mock returns `decrypted:v1.iv.tag.cipher` — must not appear in response
    expect(bodyText).not.toContain('decrypted:');
    expect(bodyText).not.toContain('v1.iv.tag.cipher');
  });
});
