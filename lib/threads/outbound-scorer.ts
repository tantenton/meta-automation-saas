/**
 * outbound-scorer.ts
 *
 * Scores Threads discovery candidates on four axes:
 *  - relevance   [0,1]: topic match against persona weights
 *  - freshness   [0,1]: how recent the post is (decay over 72h)
 *  - saturation  [0,1]: inverse of reply/engagement density (lower = less crowded)
 *  - safety      boolean: reject politics/toxic/spam/attacks/generic
 *
 * Final composite score = weighted sum of three numeric axes (safety gate first).
 */

import { scoreRelevance, type PersonaWeights } from './persona-weights';

export interface CandidatePost {
  id: string;
  text: string;
  username: string;
  permalink: string | null;
  timestamp: string | null;     // ISO-8601
  reply_count?: number | null;
  like_count?: number | null;
}

export interface ScoredCandidate extends CandidatePost {
  scores: {
    relevance: number;
    freshness: number;
    saturation: number;
    composite: number;
  };
  safe: boolean;
  skip_reason?: string;
}

// ---------------------------------------------------------------------------
// Safety blocklist — keyword-level; AI does deeper filtering at comment draft
// ---------------------------------------------------------------------------

const BLOCKLIST_PATTERNS: RegExp[] = [
  // politics / government / elections
  /\b(politik|pilpres|pilkada|pemilu|capres|partai|prabowo|jokowi|anies|ganjar|pdip|golkar|gerindra)\b/i,
  // religion / SARA attacks
  /\b(kafir|murtad|sesat|haram|halal debate|SARA)\b/i,
  // scam / MLM / spam
  /\b(judi|slot|togel|gacor|maxwin|cuan tanpa modal|passive income \d{3}|binary option|forex signal)\b/i,
  // toxic / attacks
  /\b(bangsat|anjing|babi|tai|goblok|idiot|bodoh banget|stupid|hate|racist)\b/i,
  // medical advice
  /\b(obat|diagnos|penyakit|kanker|covid|vaksin|dokter|resep|dosis)\b/i,
  // financial advice specific
  /\b(beli saham|short saham|target harga|hold saham|cut loss|saham [A-Z]{4})\b/i,
  // generic engagement bait
  /^(setuju|agree|nice|keren|bagus|mantap|lfl|f4f|follow back|l4l)[.!?\s]*$/i,
];

const GENERIC_COMMENT_PATTERNS: RegExp[] = [
  /^(keren|nice|good|bagus|mantap|setuju|agreed?|wow|amazing|luar biasa)[!.?\s]*$/i,
  /^follow (me|back|for follow)[!.?\s]*/i,
  /^\d+[kK]?\s*(likes?|followers?)/i,
];

export function isSafe(text: string): { safe: boolean; reason?: string } {
  const t = text.trim();

  for (const re of BLOCKLIST_PATTERNS) {
    if (re.test(t)) return { safe: false, reason: `blocklist:${re.source.slice(0, 40)}` };
  }

  for (const re of GENERIC_COMMENT_PATTERNS) {
    if (re.test(t)) return { safe: false, reason: 'generic_bait' };
  }

  // Too short to be meaningful
  if (t.replace(/[^a-zA-Z\u00C0-\u024F\u0100-\u017E]/g, '').length < 8) {
    return { safe: false, reason: 'too_short' };
  }

  return { safe: true };
}

// ---------------------------------------------------------------------------
// Freshness: linear decay, full score within 6h, zero at 72h
// ---------------------------------------------------------------------------

export function scoreFreshness(timestampIso: string | null): number {
  if (!timestampIso) return 0.5; // unknown — mid score
  const ageMs = Date.now() - new Date(timestampIso).getTime();
  const ageH = ageMs / (1000 * 60 * 60);
  if (ageH <= 6) return 1.0;
  if (ageH >= 72) return 0.0;
  return Math.round((1 - (ageH - 6) / 66) * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Saturation: inverse engagement density (high replies = already crowded)
// ---------------------------------------------------------------------------

export function scoreSaturation(replyCount: number | null | undefined): number {
  const r = replyCount ?? 0;
  if (r <= 5) return 1.0;
  if (r >= 100) return 0.0;
  return Math.round((1 - (r - 5) / 95) * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Composite scoring
// ---------------------------------------------------------------------------

const WEIGHTS = {
  relevance: 0.50,
  freshness: 0.30,
  saturation: 0.20,
};

export function scoreCandidate(
  candidate: CandidatePost,
  personaWeights: PersonaWeights,
): ScoredCandidate {
  const safetyCheck = isSafe(candidate.text);

  if (!safetyCheck.safe) {
    return {
      ...candidate,
      scores: { relevance: 0, freshness: 0, saturation: 0, composite: 0 },
      safe: false,
      skip_reason: safetyCheck.reason,
    };
  }

  const relevance = scoreRelevance(candidate.text, personaWeights);
  const freshness = scoreFreshness(candidate.timestamp);
  const saturation = scoreSaturation(candidate.reply_count);

  const composite = Math.round(
    (relevance * WEIGHTS.relevance +
      freshness * WEIGHTS.freshness +
      saturation * WEIGHTS.saturation) * 1000
  ) / 1000;

  return {
    ...candidate,
    scores: { relevance, freshness, saturation, composite },
    safe: true,
  };
}

/**
 * Score and sort a list of candidates. Returns only safe ones above minScore,
 * sorted by composite descending. Deduplicates by post ID.
 */
export function rankCandidates(
  candidates: CandidatePost[],
  personaWeights: PersonaWeights,
  minScore = 0.20,
): ScoredCandidate[] {
  const seen = new Set<string>();
  const scored: ScoredCandidate[] = [];

  for (const c of candidates) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    const s = scoreCandidate(c, personaWeights);
    scored.push(s);
  }

  return scored
    .filter(s => s.safe && s.scores.composite >= minScore)
    .sort((a, b) => b.scores.composite - a.scores.composite);
}
