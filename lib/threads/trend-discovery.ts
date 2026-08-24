/**
 * trend-discovery.ts
 *
 * Research-first Threads outbound discovery.
 * NO browser, NO login — only official Threads Graph API + public HTTP (Jina reader).
 *
 * Flow:
 *  1. Fetch own recent 30 posts (Threads API) → infer persona weights
 *  2. Accept caller-supplied trend candidates (keyword/hashtag/username hints)
 *  3. For each candidate username: fetch their recent posts via Threads API
 *     (requires their numeric user_id to be known, stored in outbound_targets)
 *  4. Fall back to Jina public reader for posts from known static usernames
 *  5. Score all discovered posts via outbound-scorer
 *  6. Return ranked, deduped, safe candidates + research_signals
 */

import { inferPersonaWeights, DEFAULT_WEIGHTS, type PersonaWeights } from './persona-weights';
import { rankCandidates, isSafe, type CandidatePost, type ScoredCandidate } from './outbound-scorer';

const THREADS_GRAPH = 'https://graph.threads.net/v1.0';

export interface TrendCandidate {
  username: string;
  user_id?: string | null;    // numeric Threads user ID if known
  category?: string;
  hint_keywords?: string[];   // optional hint to bias relevance
}

export interface ResearchSignal {
  source: 'threads_api' | 'jina_reader' | 'static_fallback';
  username: string;
  posts_found: number;
  fetch_ok: boolean;
  error?: string;
}

export interface DiscoveryResult {
  persona_weights: PersonaWeights;
  research_signals: ResearchSignal[];
  candidates: ScoredCandidate[];
  total_fetched: number;
  total_safe: number;
  total_scored: number;
}

// ---------------------------------------------------------------------------
// Fetch own posts to infer persona weights
// ---------------------------------------------------------------------------

export async function fetchOwnPostTexts(
  token: string,
  accountId: string,
  limit = 30,
): Promise<string[]> {
  try {
    const url = new URL(`${THREADS_GRAPH}/${accountId}/threads`);
    url.searchParams.set('fields', 'id,text,timestamp');
    url.searchParams.set('limit', String(Math.min(limit, 30)));
    url.searchParams.set('access_token', token);

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 10_000);
    const res = await fetch(url.toString(), { signal: ac.signal }).catch(() => null);
    clearTimeout(t);

    if (!res?.ok) return [];
    const data = await res.json() as { data?: { text?: string }[] };
    return (data.data ?? []).map(p => p.text ?? '').filter(Boolean);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Fetch a target user's recent posts via Threads Graph API
// (requires their numeric user_id — can only read public profiles via own token
//  if the user has granted public access; falls back to Jina otherwise)
// ---------------------------------------------------------------------------

async function fetchViaThreadsApi(
  token: string,
  userId: string,
  username: string,
  limit = 10,
): Promise<{ posts: CandidatePost[]; ok: boolean; error?: string }> {
  try {
    const url = new URL(`${THREADS_GRAPH}/${userId}/threads`);
    url.searchParams.set('fields', 'id,text,permalink,timestamp,reply_count,like_count');
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('access_token', token);

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 10_000);
    const res = await fetch(url.toString(), { signal: ac.signal }).catch(() => null);
    clearTimeout(t);

    if (!res?.ok) {
      const errText = res ? await res.text().catch(() => '') : 'timeout';
      return { posts: [], ok: false, error: errText.slice(0, 120) };
    }

    const data = await res.json() as {
      data?: {
        id: string;
        text?: string;
        permalink?: string;
        timestamp?: string;
        reply_count?: number;
        like_count?: number;
      }[];
    };

    const posts: CandidatePost[] = (data.data ?? [])
      .filter(p => p.text && p.text.trim().length >= 10)
      .map(p => ({
        id: p.id,
        text: p.text!.trim(),
        username,
        permalink: p.permalink ?? `https://www.threads.com/@${username}/post/${p.id}`,
        timestamp: p.timestamp ?? null,
        reply_count: p.reply_count ?? null,
        like_count: p.like_count ?? null,
      }));

    return { posts, ok: true };
  } catch (e) {
    return { posts: [], ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// Fallback: fetch via Jina public reader (no auth required)
// ---------------------------------------------------------------------------

async function fetchViaJina(
  username: string,
  limit = 8,
): Promise<{ posts: CandidatePost[]; ok: boolean; error?: string }> {
  try {
    const jinaUrl = `https://r.jina.ai/https://www.threads.com/@${encodeURIComponent(username)}`;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 12_000);
    const res = await fetch(jinaUrl, {
      headers: { Accept: 'text/markdown' },
      signal: ac.signal,
    }).catch(() => null);
    clearTimeout(t);

    if (!res?.ok) {
      return { posts: [], ok: false, error: res ? `HTTP ${res.status}` : 'timeout' };
    }

    const body = await res.text();

    // Extract post shortcodes + text from Jina markdown output
    const posts: CandidatePost[] = [];
    const regex = /https:\/\/www\.threads\.com\/@[^/]+\/post\/([A-Za-z0-9_-]+)[^\n)]*\)?\n+([^\n!\[]{10,500})/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(body)) !== null && posts.length < limit) {
      const id = m[1];
      const text = m[2].trim();
      if (text.length >= 10) {
        posts.push({
          id,
          text,
          username,
          permalink: `https://www.threads.com/@${username}/post/${id}`,
          timestamp: null,
          reply_count: null,
          like_count: null,
        });
      }
    }

    // Fallback block extraction if regex yields nothing
    if (!posts.length) {
      const blocks = body.split(/\n--\n/).slice(1, limit + 1);
      for (let i = 0; i < blocks.length; i++) {
        const text = blocks[i]
          .replace(/!\[.*?\]\(.*?\)/g, '')
          .replace(/\[.*?\]\(.*?\)/g, '')
          .trim();
        if (text.length >= 10) {
          posts.push({
            id: `jina-${username}-${i}`,
            text,
            username,
            permalink: null,
            timestamp: null,
            reply_count: null,
            like_count: null,
          });
        }
      }
    }

    return { posts, ok: true };
  } catch (e) {
    return { posts: [], ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// Main discovery function
// ---------------------------------------------------------------------------

export async function discoverTrendCandidates(opts: {
  token: string;
  accountId: string;
  trendCandidates: TrendCandidate[];
  /** Already-processed post IDs to exclude (dedup with existing outbound_comments) */
  excludePostIds?: Set<string>;
  minScore?: number;
  maxCandidates?: number;
}): Promise<DiscoveryResult> {
  const {
    token,
    accountId,
    trendCandidates,
    excludePostIds = new Set(),
    minScore = 0.20,
    maxCandidates = 50,
  } = opts;

  // Step 1: infer persona weights from own recent posts
  const ownPostTexts = await fetchOwnPostTexts(token, accountId, 30);
  const personaWeights = ownPostTexts.length
    ? inferPersonaWeights(ownPostTexts)
    : { ...DEFAULT_WEIGHTS };

  const signals: ResearchSignal[] = [];
  const allPosts: CandidatePost[] = [];

  // Step 2: fetch posts for each trend candidate
  for (const cand of trendCandidates) {
    let result: { posts: CandidatePost[]; ok: boolean; error?: string };
    let source: ResearchSignal['source'];

    if (cand.user_id) {
      result = await fetchViaThreadsApi(token, cand.user_id, cand.username);
      source = 'threads_api';
    } else {
      result = await fetchViaJina(cand.username);
      source = 'jina_reader';
    }

    signals.push({
      source,
      username: cand.username,
      posts_found: result.posts.length,
      fetch_ok: result.ok,
      error: result.error,
    });

    // Enrich with hint keywords if provided
    if (cand.hint_keywords?.length) {
      for (const p of result.posts) {
        // Append hint keywords to text so scorer considers them
        p.text = `${p.text} [hints: ${cand.hint_keywords.join(' ')}]`;
      }
    }

    allPosts.push(...result.posts);
  }

  // Step 3: exclude already-processed IDs
  const fresh = allPosts.filter(p => !excludePostIds.has(p.id));

  // Step 4: score and rank
  const ranked = rankCandidates(fresh, personaWeights, minScore)
    .slice(0, maxCandidates);

  return {
    persona_weights: personaWeights,
    research_signals: signals,
    candidates: ranked,
    total_fetched: allPosts.length,
    total_safe: ranked.length + fresh.filter(p => !isSafe(p.text).safe).length,
    total_scored: ranked.length,
  };
}

// ---------------------------------------------------------------------------
// Upsert qualified candidates into outbound_targets
// ---------------------------------------------------------------------------

export async function upsertDiscoveredTargets(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  accountId: string,
  candidates: ScoredCandidate[],
): Promise<{ upserted: number; errors: string[] }> {
  const errors: string[] = [];
  let upserted = 0;

  // Deduplicate by username before upsert
  const byUsername = new Map<string, ScoredCandidate>();
  for (const c of candidates) {
    if (!byUsername.has(c.username)) byUsername.set(c.username, c);
  }

  for (const [username, candidate] of byUsername.entries()) {
    try {
      const { error } = await db.from('outbound_targets').upsert(
        {
          account_id: accountId,
          target_username: username,
          category: 'dynamic_discovery',
          is_active: true,
          discovery_score: candidate.scores.composite,
          discovery_source: 'trend_discovery',
          last_scanned_at: new Date().toISOString(),
        },
        { onConflict: 'account_id,target_username' },
      );
      if (error) errors.push(`upsert:${username}: ${error.message}`);
      else upserted++;
    } catch (e) {
      errors.push(`upsert:${username}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { upserted, errors };
}
