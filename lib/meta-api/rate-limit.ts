// Rate limit tracking and handling
export interface RateLimitState {
  remaining: number;
  limit: number;
  resetAt: Date;
  retryAfter?: number;
}

export interface RateLimitError extends Error {
  retryAfter: number;
  status: number;
}

export const META_RATE_LIMITS = {
  posts: {
    instagram: 25,  // per day
    threads: 100,   // per day
  },
  api: {
    calls: 200,     // per hour
  },
};

/**
 * Track API rate limits from response headers
 */
export function parseRateLimits(response: Response): RateLimitState {
  const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0');
  const limit = parseInt(response.headers.get('X-RateLimit-Limit') || '0');
  const resetAt = new Date(parseInt(response.headers.get('X-RateLimit-Reset') || '0') * 1000);

  return { remaining, limit, resetAt };
}

/**
 * Check if rate limit is exceeded
 */
export function isRateLimited(state: RateLimitState): boolean {
  return state.remaining <= 0;
}

/**
 * Get wait time until rate limit resets
 */
export function getWaitTime(state: RateLimitState): number {
  const now = new Date();
  const diff = state.resetAt.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / 1000));
}

/**
 * Decorator for auto-retry on rate limit
 */
export async function withRateLimitRetry<T>(
  fn: () => Promise<{ response: Response; data: T }>,
  maxRetries: number = 3,
  defaultRetryAfter: number = 60
): Promise<T> {
  let retryCount = 0;

  while (retryCount < maxRetries) {
    const { response, data } = await fn();

    // Check for 429 rate limit
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '') || defaultRetryAfter;
      retryCount++;
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      continue;
    }

    // Check for other error codes
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return data;
  }

  throw new Error(`Rate limit retry exhausted after ${maxRetries} attempts`);
}

/**
 * Check daily post limit
 */
export function checkPostLimit(
  currentCount: number,
  platform: 'instagram' | 'threads'
): { allowed: boolean; remaining: number; limit: number } {
  const limit = META_RATE_LIMITS.posts[platform];
  const remaining = limit - currentCount;
  return {
    allowed: remaining > 0,
    remaining,
    limit,
  };
}

/**
 * Track post count in local storage for client-side limit
 */
export function trackPostCount(
  platform: 'instagram' | 'threads',
  increment: number = 1
): number {
  if (typeof window === 'undefined') return 0;

  const key = `meta_post_count_${platform}`;
  const today = new Date().toDateString();
  const stored = localStorage.getItem(key);

  if (!stored) {
    localStorage.setItem(key, JSON.stringify({ date: today, count: increment }));
    return increment;
  }

  const data = JSON.parse(stored);
  if (data.date !== today) {
    localStorage.setItem(key, JSON.stringify({ date: today, count: increment }));
    return increment;
  }

  const newCount = data.count + increment;
  localStorage.setItem(key, JSON.stringify({ date: today, count: newCount }));
  return newCount;
}

/**
 * Get current post count for today
 */
export function getPostCount(platform: 'instagram' | 'threads'): number {
  if (typeof window === 'undefined') return 0;

  const key = `meta_post_count_${platform}`;
  const stored = localStorage.getItem(key);
  if (!stored) return 0;

  const data = JSON.parse(stored);
  return data.count || 0;
}
