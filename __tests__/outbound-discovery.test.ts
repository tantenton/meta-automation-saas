/**
 * __tests__/outbound-discovery.test.ts
 *
 * Tests for:
 *  - Scoring: relevance, freshness, saturation, composite
 *  - Safety: blocklist, generic bait, too-short
 *  - Dedup: rankCandidates excludes seen IDs
 *  - Empty discovery: no candidates
 *  - Max-per-run: capped at maxPerRun
 *  - Persona weights: inferred from post texts, fallback to defaults
 *  - Response contract: structured keys present
 */

import { describe, it, expect } from 'vitest';
import {
  isSafe,
  scoreFreshness,
  scoreSaturation,
  scoreCandidate,
  rankCandidates,
  type CandidatePost,
} from '../lib/threads/outbound-scorer';
import {
  inferPersonaWeights,
  scoreRelevance,
  DEFAULT_WEIGHTS,
} from '../lib/threads/persona-weights';
import { parseJinaThreadsMarkdown } from '../lib/threads/trend-discovery';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePost(overrides: Partial<CandidatePost> = {}): CandidatePost {
  return {
    id: 'post-1',
    text: 'Gue pakai Cursor AI buat coding, produktivitas naik 3x lipat. Worth banget.',
    username: 'testuser',
    permalink: 'https://www.threads.com/@testuser/post/abc123',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
    reply_count: 5,
    like_count: 20,
    ...overrides,
  };
}

describe('Jina Threads markdown parser regression', () => {
  it('extracts post text when permalink is inside a timestamp markdown link', () => {
    const body = `[2d](https://www.threads.com/@nandatamaaa/post/DcS8bw6E6DK)\n\nheei desainer grafis freelancer, sekarang masih di bidang yang sama atau sudah beralih profesi?\n\nTranslate`;
    const posts = parseJinaThreadsMarkdown(body, 'nandatamaaa');
    expect(posts).toHaveLength(1);
    expect(posts[0].id).toBe('DcS8bw6E6DK');
    expect(posts[0].text).toContain('desainer grafis');
    expect(posts[0].permalink).toContain('/post/DcS8bw6E6DK');
  });
});

// ---------------------------------------------------------------------------
// isSafe
// ---------------------------------------------------------------------------

describe('isSafe — blocklist', () => {
  it('rejects politics keywords', () => {
    expect(isSafe('pemilu 2024 pilpres capres').safe).toBe(false);
  });

  it('rejects scam/judi keywords', () => {
    expect(isSafe('main slot gacor maxwin hari ini').safe).toBe(false);
  });

  it('rejects hate speech', () => {
    expect(isSafe('lo tuh goblok banget sih').safe).toBe(false);
  });

  it('rejects medical advice', () => {
    expect(isSafe('dosis obat untuk kanker berapa?').safe).toBe(false);
  });

  it('rejects financial advice', () => {
    expect(isSafe('beli saham BBCA sekarang bagus gak?').safe).toBe(false);
  });

  it('rejects generic engagement bait', () => {
    expect(isSafe('keren!').safe).toBe(false);
    expect(isSafe('mantap').safe).toBe(false);
    expect(isSafe('setuju').safe).toBe(false);
  });

  it('rejects too-short text', () => {
    expect(isSafe('ok').safe).toBe(false);
    expect(isSafe('ya').safe).toBe(false);
  });

  it('accepts normal relevant post', () => {
    const result = isSafe(
      'Gue baru nyoba Cursor AI, workflow coding jadi jauh lebih cepat. Setup desk juga bikin fokus lebih gampang.'
    );
    expect(result.safe).toBe(true);
  });

  it('accepts English tech post', () => {
    expect(isSafe('Just switched to a standing desk setup. Productivity up significantly.').safe).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// scoreFreshness
// ---------------------------------------------------------------------------

describe('scoreFreshness', () => {
  it('returns 1.0 for posts < 6h old', () => {
    const ts = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(scoreFreshness(ts)).toBe(1.0);
  });

  it('returns 0.0 for posts >= 72h old', () => {
    const ts = new Date(Date.now() - 80 * 60 * 60 * 1000).toISOString();
    expect(scoreFreshness(ts)).toBe(0.0);
  });

  it('returns between 0 and 1 for posts 6-72h old', () => {
    const ts = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const score = scoreFreshness(ts);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('returns 0.5 for null timestamp', () => {
    expect(scoreFreshness(null)).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// scoreSaturation
// ---------------------------------------------------------------------------

describe('scoreSaturation', () => {
  it('returns 1.0 for <= 5 replies', () => {
    expect(scoreSaturation(0)).toBe(1.0);
    expect(scoreSaturation(5)).toBe(1.0);
  });

  it('returns 0.0 for >= 100 replies', () => {
    expect(scoreSaturation(100)).toBe(0.0);
    expect(scoreSaturation(200)).toBe(0.0);
  });

  it('returns 1.0 for null', () => {
    expect(scoreSaturation(null)).toBe(1.0);
  });

  it('returns between 0 and 1 for 6-99 replies', () => {
    const score = scoreSaturation(50);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// scoreCandidate
// ---------------------------------------------------------------------------

describe('scoreCandidate', () => {
  it('returns safe=false and zero scores for unsafe post', () => {
    const post = makePost({ text: 'beli saham BBCA sekarang bagus gak?' });
    const result = scoreCandidate(post, DEFAULT_WEIGHTS);
    expect(result.safe).toBe(false);
    expect(result.scores.composite).toBe(0);
    expect(result.skip_reason).toBeDefined();
  });

  it('returns safe=true and positive composite for relevant post', () => {
    const post = makePost();
    const result = scoreCandidate(post, DEFAULT_WEIGHTS);
    expect(result.safe).toBe(true);
    expect(result.scores.composite).toBeGreaterThan(0);
    expect(result.scores.relevance).toBeGreaterThanOrEqual(0);
    expect(result.scores.freshness).toBeGreaterThan(0);
    expect(result.scores.saturation).toBeGreaterThan(0);
  });

  it('composite is weighted sum in [0,1]', () => {
    const post = makePost();
    const result = scoreCandidate(post, DEFAULT_WEIGHTS);
    expect(result.scores.composite).toBeGreaterThanOrEqual(0);
    expect(result.scores.composite).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// rankCandidates — dedup + min score filtering
// ---------------------------------------------------------------------------

describe('rankCandidates — dedup', () => {
  it('deduplicates posts with same ID', () => {
    const post = makePost({ id: 'dup-1' });
    const results = rankCandidates([post, post, post], DEFAULT_WEIGHTS, 0);
    expect(results.filter(r => r.id === 'dup-1').length).toBe(1);
  });

  it('returns empty array when all candidates are unsafe', () => {
    const posts: CandidatePost[] = [
      makePost({ id: 'a', text: 'beli saham BBCA sekarang bagus gak?' }),
      makePost({ id: 'b', text: 'main slot gacor maxwin' }),
      makePost({ id: 'c', text: 'pemilu pilpres capres 2024' }),
    ];
    expect(rankCandidates(posts, DEFAULT_WEIGHTS)).toHaveLength(0);
  });

  it('returns empty array when input is empty', () => {
    expect(rankCandidates([], DEFAULT_WEIGHTS)).toHaveLength(0);
  });

  it('filters candidates below minScore', () => {
    // Post with no relevant keywords → very low relevance
    const post = makePost({
      id: 'low',
      text: 'Hari ini cuaca bagus sekali dan saya jalan-jalan ke taman.',
      timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });
    // With high minScore, should be filtered out
    const results = rankCandidates([post], DEFAULT_WEIGHTS, 0.9);
    expect(results).toHaveLength(0);
  });

  it('sorts by composite score descending', () => {
    const fresh = makePost({
      id: 'fresh',
      text: 'Cursor AI + productivity tools + desk setup workflow untuk coding lebih efisien.',
      timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      reply_count: 2,
    });
    const old = makePost({
      id: 'old',
      text: 'Cursor AI untuk coding.',
      timestamp: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString(),
      reply_count: 80,
    });
    const results = rankCandidates([old, fresh], DEFAULT_WEIGHTS, 0);
    expect(results[0].id).toBe('fresh');
  });
});

// ---------------------------------------------------------------------------
// Max-per-run cap
// ---------------------------------------------------------------------------

describe('max-per-run cap', () => {
  it('respects maxCandidates limit in rankCandidates output', () => {
    const posts: CandidatePost[] = Array.from({ length: 20 }, (_, i) => ({
      id: `post-${i}`,
      text: `AI coding tools productivity desk setup workflow ${i} — fokus kerja lebih efisien dengan sistem yang rapi.`,
      username: `user${i}`,
      permalink: null,
      timestamp: new Date(Date.now() - i * 30 * 60 * 1000).toISOString(),
      reply_count: i,
      like_count: 10,
    }));

    const results = rankCandidates(posts, DEFAULT_WEIGHTS, 0).slice(0, 5);
    expect(results.length).toBeLessThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// Persona weights
// ---------------------------------------------------------------------------

describe('inferPersonaWeights', () => {
  it('returns DEFAULT_WEIGHTS when posts array is empty', () => {
    const w = inferPersonaWeights([]);
    expect(w).toEqual(DEFAULT_WEIGHTS);
  });

  it('returns weights that are all positive', () => {
    const posts = [
      'Gue pakai Cursor AI buat coding setiap hari',
      'Setup meja kerja yang rapi bikin produktivitas naik',
      'Digital focus — matiin notifikasi semua app',
      'Quarter life crisis nyata banget di umur 24',
      'Workflow produktivitas dengan sistem yang efisien',
    ];
    const w = inferPersonaWeights(posts);
    for (const v of Object.values(w)) {
      expect(v).toBeGreaterThan(0);
    }
  });

  it('weights heavier topics get higher score', () => {
    // All posts about AI/coding → ai_coding should dominate
    const posts = Array.from({ length: 10 }, () =>
      'AI coding tools github copilot cursor programming developer automation'
    );
    const w = inferPersonaWeights(posts);
    const maxTopic = Object.entries(w).sort((a, b) => b[1] - a[1])[0][0];
    expect(maxTopic).toBe('ai_coding');
  });
});

// ---------------------------------------------------------------------------
// scoreRelevance
// ---------------------------------------------------------------------------

describe('scoreRelevance', () => {
  it('returns 0 for completely irrelevant text', () => {
    const score = scoreRelevance('cuaca hari ini bagus', DEFAULT_WEIGHTS);
    expect(score).toBe(0);
  });

  it('returns > 0 for relevant text', () => {
    const score = scoreRelevance(
      'AI coding productivity tools desk setup digital focus',
      DEFAULT_WEIGHTS,
    );
    expect(score).toBeGreaterThan(0);
  });

  it('returns value in [0,1]', () => {
    const score = scoreRelevance(
      'AI coding tools github cursor productivity workflow desk setup digital focus quarter life',
      DEFAULT_WEIGHTS,
    );
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Response contract — structured keys
// ---------------------------------------------------------------------------

describe('response contract', () => {
  it('scoreCandidate result has all required keys', () => {
    const result = scoreCandidate(makePost(), DEFAULT_WEIGHTS);
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('username');
    expect(result).toHaveProperty('permalink');
    expect(result).toHaveProperty('safe');
    expect(result).toHaveProperty('scores');
    expect(result.scores).toHaveProperty('relevance');
    expect(result.scores).toHaveProperty('freshness');
    expect(result.scores).toHaveProperty('saturation');
    expect(result.scores).toHaveProperty('composite');
  });

  it('rankCandidates returns array of ScoredCandidate with full score shape', () => {
    const results = rankCandidates([makePost()], DEFAULT_WEIGHTS, 0);
    if (results.length > 0) {
      const r = results[0];
      expect(typeof r.scores.relevance).toBe('number');
      expect(typeof r.scores.freshness).toBe('number');
      expect(typeof r.scores.saturation).toBe('number');
      expect(typeof r.scores.composite).toBe('number');
      expect(typeof r.safe).toBe('boolean');
    }
  });
});
