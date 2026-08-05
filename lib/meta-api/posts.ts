// Meta Graph API Posts Handler
import { getMetaUser, getInstagramAccount, publishInstagramImage, publishVideoContainer, createVideoContainer, getInstagramMedia } from './auth';
import { refreshAccessToken } from './token-refresh';

export interface ScheduledPost {
  id: string;
  userId: string;
  platform: 'instagram' | 'threads';
  content: string;
  mediaUrl?: string;
  scheduledAt: string;
  status: 'scheduled' | 'published' | 'failed';
}

export interface PostStats {
  reach: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

/**
 * Publish scheduled post to Instagram
 */
export async function publishInstagramPost(
  accessToken: string,
  instagramUserId: string,
  content: string,
  mediaUrl?: string,
  mediaType: 'image' | 'video' = 'image'
): Promise<{ id: string }> {
  if (mediaType === 'image') {
    return await publishInstagramImage(accessToken, instagramUserId, mediaUrl || '', content);
  } else {
    // Create container first
    const container = await createVideoContainer(accessToken, instagramUserId, mediaUrl || '', content);
    // Then publish container
    return await publishVideoContainer(accessToken, instagramUserId, container.id);
  }
}

/**
 * Schedule a post (create in DB, actual publish handled by cron worker)
 */
export async function schedulePost(
  supabase: any,
  userId: string,
  accountId: string,
  content: string,
  mediaUrl?: string,
  scheduledAt?: string
): Promise<{ id: string; status: string }> {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      account_id: accountId,
      content,
      media_url: mediaUrl ? [mediaUrl] : [],
      status: scheduledAt ? 'scheduled' : 'draft',
      scheduled_at: scheduledAt || null,
    })
    .select('id, status')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get posts list for an account
 */
export async function getPosts(
  supabase: any,
  accountId: string,
  limit: number = 20,
  offset: number = 0
): Promise<{ posts: any[]; total: number }> {
  const { data, error, count } = await supabase
    .from('posts')
    .select('*', { count: 'exact' })
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return { posts: data || [], total: count || 0 };
}

/**
 * Get Instagram media for calendar view
 */
export async function getInstagramCalendar(
  accessToken: string,
  instagramUserId: string,
  limit: number = 10
) {
  try {
    return await getInstagramMedia(accessToken, instagramUserId, limit);
  } catch (error) {
    console.error('Failed to fetch Instagram media:', error);
    return { data: [] };
  }
}

/**
 * Get post analytics from Meta
 */
export async function getPostAnalytics(
  accessToken: string,
  postId: string
): Promise<PostStats> {
  const url = new URL(`https://graph.facebook.com/v19.0/${postId}/insights`);
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('metric', 'reach,impressions,likes,comments,shares,saves');

  const res = await fetch(url.toString());
  if (!res.ok) return { reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0, saves: 0 };

  const data = await res.json();
  const stats: PostStats = { reach: 0, impressions: 0, likes: 0, comments: 0, shares: 0, saves: 0 };

  data.data.forEach((item: any) => {
    if (item.values[0]) {
      stats[item.name as keyof PostStats] = item.values[0].value || 0;
    }
  });

  return stats;
}

/**
 * Get account analytics (followers, engagement)
 */
export async function getAccountAnalytics(
  accessToken: string,
  instagramUserId: string
): Promise<{
  followers: number;
  engagementRate: number;
  avgLikes: number;
  avgComments: number;
}> {
  // Get user info for follower count
  const userUrl = new URL(`https://graph.facebook.com/v19.0/${instagramUserId}`);
  userUrl.searchParams.set('fields', 'followers_count,media_count');
  userUrl.searchParams.set('access_token', accessToken);

  const userRes = await fetch(userUrl.toString());
  if (!userRes.ok) {
    return { followers: 0, engagementRate: 0, avgLikes: 0, avgComments: 0 };
  }

  const userData = await userRes.json();

  // Get recent media for engagement stats
  const mediaRes = await getInstagramMedia(accessToken, instagramUserId, 10);
  const media = mediaRes.data || [];

  let totalLikes = 0;
  let totalComments = 0;

  for (const m of media) {
    const engagement = await getPostAnalytics(accessToken, m.id);
    totalLikes += engagement.likes;
    totalComments += engagement.comments;
  }

  const avgLikes = media.length ? Math.round(totalLikes / media.length) : 0;
  const avgComments = media.length ? Math.round(totalComments / media.length) : 0;
  const engagementRate = userData.followers_count && userData.followers_count > 0
    ? ((avgLikes + avgComments) / userData.followers_count) * 100
    : 0;

  return {
    followers: userData.followers_count || 0,
    engagementRate: Math.round(engagementRate * 100) / 100,
    avgLikes,
    avgComments,
  };
}

/**
 * Handle 429 rate limit errors
 */
export class RateLimitError extends Error {
  constructor(message: string, public retryAfter: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error instanceof RateLimitError) {
        lastError = error;
        await new Promise(resolve => setTimeout(resolve, error.retryAfter * 1000));
        continue;
      }
      if (error.message?.includes('429')) {
        const retryAfter = parseInt(error.headers?.['retry-after'] || '60');
        lastError = new RateLimitError(error.message, retryAfter);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('Rate limit retry exhausted');
}
