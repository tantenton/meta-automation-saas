// lib/meta-api/comments.ts
// Graph API helpers for Instagram and Facebook comment fetching and replying.
// Instagram: uses graph.instagram.com (Route A / instagram_business_manage_comments)
// Facebook:  uses graph.facebook.com  (pages_manage_engagement + page access token)

const VERSION = process.env.META_GRAPH_VERSION || 'v23.0';
const FB_GRAPH = `https://graph.facebook.com/${VERSION}`;
const IG_GRAPH = `https://graph.instagram.com/${VERSION}`;

export interface RawComment {
  id: string;
  text?: string;
  message?: string; // FB uses "message" field
  username?: string;
  from?: { id: string; name: string }; // FB
  timestamp: string;
  parent_id?: string;
}

export interface CommentPage {
  data: RawComment[];
  paging?: { cursors?: { after?: string }; next?: string };
}

// ─── Instagram ───────────────────────────────────────────────────────────────

/**
 * Fetch comments on an Instagram media object.
 * Requires: instagram_business_manage_comments permission.
 */
export async function getInstagramComments(
  token: string,
  mediaId: string,
): Promise<CommentPage> {
  const url = new URL(`${IG_GRAPH}/${mediaId}/comments`);
  url.searchParams.set('fields', 'id,text,username,timestamp,parent_id');
  url.searchParams.set('access_token', token);
  url.searchParams.set('limit', '50');
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`IG comments fetch failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<CommentPage>;
}

/**
 * Reply to an Instagram comment.
 * POST /{comment-id}/replies with message param.
 */
export async function replyToInstagramComment(
  token: string,
  commentId: string,
  message: string,
): Promise<{ id: string }> {
  const url = new URL(`${IG_GRAPH}/${commentId}/replies`);
  const body = new URLSearchParams({ message, access_token: token });
  const res = await fetch(url, { method: 'POST', body, cache: 'no-store' });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`IG reply failed (${res.status}): ${errBody.slice(0, 200)}`);
  }
  return res.json() as Promise<{ id: string }>;
}

/**
 * Fetch recent Instagram media IDs for an account.
 */
export async function getInstagramRecentMedia(
  token: string,
  igUserId: string,
  limit = 10,
): Promise<{ id: string; caption?: string; timestamp: string }[]> {
  const url = new URL(`${IG_GRAPH}/${igUserId}/media`);
  url.searchParams.set('fields', 'id,caption,timestamp');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('access_token', token);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return [];
  const data = (await res.json()) as { data?: { id: string; caption?: string; timestamp: string }[] };
  return data.data ?? [];
}

// ─── Facebook ────────────────────────────────────────────────────────────────

/**
 * Fetch comments on a Facebook post.
 * Requires: pages_manage_engagement + Page access token.
 */
export async function getFacebookComments(
  token: string,
  postId: string,
): Promise<CommentPage> {
  const url = new URL(`${FB_GRAPH}/${postId}/comments`);
  url.searchParams.set('fields', 'id,message,from,timestamp');
  url.searchParams.set('access_token', token);
  url.searchParams.set('limit', '50');
  url.searchParams.set('filter', 'stream'); // top-level + replies
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`FB comments fetch failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<CommentPage>;
}

/**
 * Reply to a Facebook comment.
 * POST /{comment-id}/comments with message param.
 */
export async function replyToFacebookComment(
  token: string,
  commentId: string,
  message: string,
): Promise<{ id: string }> {
  const url = new URL(`${FB_GRAPH}/${commentId}/comments`);
  const body = new URLSearchParams({ message, access_token: token });
  const res = await fetch(url, { method: 'POST', body, cache: 'no-store' });
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`FB reply failed (${res.status}): ${errBody.slice(0, 200)}`);
  }
  return res.json() as Promise<{ id: string }>;
}

/**
 * Fetch recent Facebook Page posts.
 */
export async function getFacebookRecentPosts(
  token: string,
  pageId: string,
  limit = 10,
): Promise<{ id: string; message?: string; created_time: string }[]> {
  const url = new URL(`${FB_GRAPH}/${pageId}/posts`);
  url.searchParams.set('fields', 'id,message,created_time');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('access_token', token);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return [];
  const data = (await res.json()) as { data?: { id: string; message?: string; created_time: string }[] };
  return data.data ?? [];
}
