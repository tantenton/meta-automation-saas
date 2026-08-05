// Meta Graph API OAuth Handler
import { cookies } from 'next/headers';
import { SupabaseClient } from '@supabase/supabase-js';

// Meta OAuth Configuration
const META_APP_ID = process.env.META_APP_ID;
const META_APP_SECRET = process.env.META_APP_SECRET;
const META_REDIRECT_URI = process.env.META_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/meta';

export interface MetaTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
}

export interface MetaUser {
  id: string;
  name: string;
  email?: string;
  picture?: {
    data: {
      url: string;
      height: number;
      width: number;
    };
  };
}

/**
 * Generate OAuth URL for Meta Login
 */
export function generateOAuthUrl(state: string): string {
  const url = new URL('https://www.facebook.com/v19.0/dialog/oauth');
  url.searchParams.set('client_id', META_APP_ID || '');
  url.searchParams.set('redirect_uri', META_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'email,public_profile,instagram_basic,instagram_content_publish,threads_basic,threads_content_publish,pages_show_list');
  return url.toString();
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(code: string): Promise<MetaTokens> {
  const url = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
  url.searchParams.set('client_id', META_APP_ID || '');
  url.searchParams.set('client_secret', META_APP_SECRET || '');
  url.searchParams.set('redirect_uri', META_REDIRECT_URI);
  url.searchParams.set('code', code);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Meta token exchange failed: ${res.statusText}`);

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    tokenType: data.token_type,
  };
}

/**
 * Get long-lived access token (60 days)
 */
export async function getLongLivedToken(shortLivedToken: string): Promise<MetaTokens> {
  const url = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', META_APP_ID || '');
  url.searchParams.set('client_secret', META_APP_SECRET || '');
  url.searchParams.set('fb_exchange_token', shortLivedToken);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Failed to exchange for long-lived token');

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    tokenType: data.token_type,
  };
}

/**
 * Refresh access token
 */
export async function refreshToken(refreshToken: string): Promise<MetaTokens> {
  const url = new URL('https://graph.facebook.com/v19.0/oauth/access_token');
  url.searchParams.set('grant_type', 'refresh_token');
  url.searchParams.set('refresh_token', refreshToken);
  url.searchParams.set('client_id', META_APP_ID || '');
  url.searchParams.set('client_secret', META_APP_SECRET || '');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Failed to refresh token');

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    tokenType: data.token_type,
  };
}

/**
 * Get user info from Meta
 */
export async function getMetaUser(accessToken: string): Promise<MetaUser> {
  const url = new URL('https://graph.facebook.com/v19.0/me');
  url.searchParams.set('fields', 'id,name,email,picture');
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Failed to fetch user info');

  return await res.json();
}

/**
 * Get Instagram Business account from Meta user
 */
export async function getInstagramAccount(accessToken: string, userId: string): Promise<{ id: string; username: string } | null> {
  const url = new URL(`https://graph.facebook.com/v19.0/${userId}`);
  url.searchParams.set('fields', 'instagram_business_account{id,username,media_count,followers_count,follows_count,profile_picture_url,biography}');
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    // User might not have Instagram account
    return null;
  }

  const data = await res.json();
  return data.instagram_business_account;
}

/**
 * Get Instagram media list (for scheduling preview)
 */
export async function getInstagramMedia(accessToken: string, instagramUserId: string, limit: number = 10): Promise<{
  data: {
    id: string;
    caption: string;
    media_type: string;
    media_url: string;
    thumbnail_url?: string;
    permalink: string;
    timestamp: string;
  }[];
  paging?: {
    cursors: {
      before: string;
      after: string;
    };
    next?: string;
  };
}> {
  const url = new URL(`https://graph.facebook.com/v19.0/${instagramUserId}/media`);
  url.searchParams.set('fields', 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp');
  url.searchParams.set('limit', limit.toString());
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Failed to fetch Instagram media');

  return await res.json();
}

/**
 * Publish image post to Instagram
 */
export async function publishInstagramImage(
  accessToken: string,
  instagramUserId: string,
  imageUrl: string,
  caption: string
): Promise<{ id: string }> {
  const url = new URL(`https://graph.facebook.com/v19.0/${instagramUserId}/media`);
  url.searchParams.set('access_token', accessToken);

  const body = {
    image_url: imageUrl,
    caption: caption,
    media_type: 'IMAGE',
  };

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Instagram publish failed: ${error.error.message}`);
  }

  const data = await res.json();
  return data;
}

/**
 * Create container for Instagram video post
 */
export async function createVideoContainer(
  accessToken: string,
  instagramUserId: string,
  videoUrl: string,
  caption: string
): Promise<{ id: string }> {
  const url = new URL(`https://graph.facebook.com/v19.0/${instagramUserId}/media`);
  url.searchParams.set('access_token', accessToken);

  const body = {
    video_url: videoUrl,
    caption: caption,
    media_type: 'VIDEO',
  };

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Video container creation failed: ${error.error.message}`);
  }

  return await res.json();
}

/**
 * Publish video container to Instagram
 */
export async function publishVideoContainer(
  accessToken: string,
  instagramUserId: string,
  creationId: string
): Promise<{ id: string }> {
  const url = new URL(`https://graph.facebook.com/v19.0/${instagramUserId}/media_publish`);
  url.searchParams.set('access_token', accessToken);

  const body = {
    creation_id: creationId,
  };

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Video publish failed: ${error.error.message}`);
  }

  return await res.json();
}

/**
 * Publish post to Threads
 */
export async function publishToThreads(
  accessToken: string,
  threadsUserId: string,
  text: string,
  mediaUrl?: string
): Promise<{ id: string }> {
  const url = new URL(`https://graph.facebook.com/v19.0/${threadsUserId}/threads`);
  url.searchParams.set('access_token', accessToken);

  const body: { text?: string; media_url?: string } = { text };
  if (mediaUrl) {
    body.media_url = mediaUrl;
  }

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(`Threads publish failed: ${error.error.message}`);
  }

  return await res.json();
}
