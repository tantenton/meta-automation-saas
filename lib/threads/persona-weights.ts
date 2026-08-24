/**
 * persona-weights.ts
 *
 * Infers Birru's persona topic weights from the latest 30 published posts.
 * Topics: ai_coding, productivity, desk_setup, digital_focus, quarter_life
 *
 * No AI call needed — pure keyword matching against post text.
 * Called before discovery to weight/score incoming trend candidates.
 */

export interface PersonaWeights {
  ai_coding: number;
  productivity: number;
  desk_setup: number;
  digital_focus: number;
  quarter_life: number;
}

export const DEFAULT_WEIGHTS: PersonaWeights = {
  ai_coding: 0.25,
  productivity: 0.25,
  desk_setup: 0.15,
  digital_focus: 0.20,
  quarter_life: 0.15,
};

const TOPIC_KEYWORDS: Record<keyof PersonaWeights, string[]> = {
  ai_coding: [
    'ai', 'artificial intelligence', 'coding', 'code', 'programming', 'developer',
    'github', 'cursor', 'copilot', 'llm', 'chatgpt', 'claude', 'gemini',
    'automation', 'script', 'python', 'javascript', 'typescript', 'api',
    'tools', 'software', 'tech', 'teknologi', 'koding', 'ngoding',
  ],
  productivity: [
    'produktif', 'productivity', 'kerja', 'work', 'workflow', 'fokus', 'focus',
    'time management', 'jadwal', 'schedule', 'habit', 'kebiasaan', 'sistem',
    'system', 'todo', 'task', 'project', 'efisien', 'efficient', 'output',
    'deep work', 'pomodoro', 'second brain', 'notion', 'obsidian',
  ],
  desk_setup: [
    'desk', 'setup', 'meja', 'monitor', 'keyboard', 'mouse', 'chair', 'kursi',
    'headphone', 'earphone', 'speaker', 'microphone', 'webcam', 'lamp', 'lampu',
    'standing desk', 'ergonomic', 'workspace', 'workstation', 'battlestation',
    'peripheral', 'cable management', 'rapi', 'minimalis', 'minimalist',
  ],
  digital_focus: [
    'distraksi', 'distraction', 'dopamine', 'scrolling', 'sosmed', 'social media',
    'phone', 'hp', 'smartphone', 'screen time', 'digital detox', 'notifikasi',
    'notification', 'app', 'aplikasi', 'brain rot', 'attention', 'perhatian',
    'present', 'mindful', 'intentional', 'offline', 'screen', 'layar',
  ],
  quarter_life: [
    'quarter life', 'quarterlife', '20an', '20-an', '25', '24', '23', '22',
    'fresh graduate', 'karir', 'career', 'salary', 'gaji', 'uang', 'money',
    'investasi', 'nabung', 'saving', 'cost of living', 'kos', 'apartemen',
    'generasi', 'gen z', 'millennial', 'adulting', 'dewasa', 'mandiri',
    'hidup sendiri', 'hustle', 'side income', 'freelance', 'economic pressure',
  ],
};

/**
 * Count keyword hits for a topic in a post text (case-insensitive).
 */
function countHits(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0);
}

/**
 * Infer persona weights from an array of post texts (max 30).
 * Falls back to DEFAULT_WEIGHTS when posts array is empty.
 */
export function inferPersonaWeights(postTexts: string[]): PersonaWeights {
  const posts = postTexts.slice(0, 30);
  if (!posts.length) return { ...DEFAULT_WEIGHTS };

  const raw: PersonaWeights = {
    ai_coding: 0,
    productivity: 0,
    desk_setup: 0,
    digital_focus: 0,
    quarter_life: 0,
  };

  for (const text of posts) {
    for (const topic of Object.keys(raw) as (keyof PersonaWeights)[]) {
      raw[topic] += countHits(text, TOPIC_KEYWORDS[topic]);
    }
  }

  // Sum of all raw scores
  const total = Object.values(raw).reduce((a, b) => a + b, 0);

  if (total === 0) return { ...DEFAULT_WEIGHTS };

  // Normalise to weights that sum to 1; floor at 0.05 per topic
  const weights = {} as PersonaWeights;
  const MIN_WEIGHT = 0.05;
  let remaining = 1.0;
  const topics = Object.keys(raw) as (keyof PersonaWeights)[];

  // First pass: proportional
  for (const t of topics) {
    weights[t] = Math.max(MIN_WEIGHT, raw[t] / total);
  }

  // Re-normalise after floor
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  remaining = sum;
  for (const t of topics) {
    weights[t] = Math.round((weights[t] / remaining) * 1000) / 1000;
  }

  return weights;
}

/**
 * Compute a relevance score [0,1] for a candidate text against persona weights.
 * Higher weight topics contribute more to the final score.
 */
export function scoreRelevance(candidateText: string, weights: PersonaWeights): number {
  let score = 0;
  const topics = Object.keys(weights) as (keyof PersonaWeights)[];

  for (const topic of topics) {
    const hits = Math.min(countHits(candidateText, TOPIC_KEYWORDS[topic]), 5);
    score += (hits / 5) * weights[topic];
  }

  // Clamp to [0,1]
  return Math.min(1, Math.round(score * 1000) / 1000);
}
