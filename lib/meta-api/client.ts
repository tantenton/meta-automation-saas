const VERSION = process.env.META_GRAPH_VERSION || 'v23.0';
const FACEBOOK_GRAPH = `https://graph.facebook.com/${VERSION}`;
// Threads API uses v1.0 regardless of META_GRAPH_VERSION
const THREADS_GRAPH = 'https://graph.threads.net/v1.0';

export class MetaApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) {
    super(message);
    this.name = 'MetaApiError';
  }
}

async function metaFetch(url: URL, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  const text = await response.text();
  let data: Record<string, unknown> | null = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!response.ok || (data as Record<string, unknown>)?.error) {
    const err = (data as Record<string, unknown>)?.error as Record<string, unknown> | undefined;
    const message = (err?.message as string) || `Meta API request failed (${response.status})`;
    throw new MetaApiError(message, response.status, data);
  }
  return data;
}

function addToken(url: URL, token: string) {
  url.searchParams.set('access_token', token);
  return url;
}

export async function validateMetaToken(platform: 'instagram' | 'threads', token: string): Promise<Record<string, unknown>> {
  if (platform === 'threads') {
    // Threads API does not use versioned endpoints for /me
    const url = addToken(new URL('https://graph.threads.net/me'), token);
    url.searchParams.set('fields', 'id,username');
    return metaFetch(url) as Promise<Record<string, unknown>>;
  }
  // Instagram Route A — uses graph.instagram.com
  const url = addToken(new URL('https://graph.instagram.com/v21.0/me'), token);
  url.searchParams.set('fields', 'id,username,account_type,name');
  return metaFetch(url) as Promise<Record<string, unknown>>;
}

export async function createInstagramContainer(input: {
  token: string; accountId: string; caption: string; mediaUrl: string; mediaType: 'image' | 'video';
}): Promise<string> {
  const url = addToken(new URL(`${FACEBOOK_GRAPH}/${input.accountId}/media`), input.token);
  const body = new URLSearchParams({ caption: input.caption });
  if (input.mediaType === 'video') {
    body.set('media_type', 'REELS');
    body.set('video_url', input.mediaUrl);
  } else {
    body.set('image_url', input.mediaUrl);
  }
  const data = await metaFetch(url, { method: 'POST', body }) as Record<string, unknown>;
  return data.id as string;
}

export async function getInstagramContainerStatus(token: string, containerId: string): Promise<Record<string, unknown>> {
  const url = addToken(new URL(`${FACEBOOK_GRAPH}/${containerId}`), token);
  url.searchParams.set('fields', 'status_code,status');
  return metaFetch(url) as Promise<Record<string, unknown>>;
}

export async function publishInstagramContainer(token: string, accountId: string, containerId: string): Promise<string> {
  const url = addToken(new URL(`${FACEBOOK_GRAPH}/${accountId}/media_publish`), token);
  const data = await metaFetch(url, { method: 'POST', body: new URLSearchParams({ creation_id: containerId }) }) as Record<string, unknown>;
  return data.id as string;
}

export async function createThreadsContainer(input: {
  token: string; accountId: string; text: string; mediaUrl?: string | null; mediaType: 'text' | 'image' | 'video';
  replyToId?: string; // if set, creates a reply to the given post/container ID
}): Promise<string> {
  const url = addToken(new URL(`${THREADS_GRAPH}/${input.accountId}/threads`), input.token);
  const body = new URLSearchParams({ text: input.text, media_type: input.mediaType.toUpperCase() });
  if (input.mediaType === 'image' && input.mediaUrl) body.set('image_url', input.mediaUrl);
  if (input.mediaType === 'video' && input.mediaUrl) body.set('video_url', input.mediaUrl);
  if (input.replyToId) body.set('reply_to_id', input.replyToId);
  const data = await metaFetch(url, { method: 'POST', body }) as Record<string, unknown>;
  return data.id as string;
}

export async function getThreadsContainerStatus(token: string, containerId: string): Promise<Record<string, unknown>> {
  const url = addToken(new URL(`${THREADS_GRAPH}/${containerId}`), token);
  url.searchParams.set('fields', 'id,status,error_message');
  return metaFetch(url) as Promise<Record<string, unknown>>;
}

export async function publishThreadsContainer(token: string, accountId: string, containerId: string): Promise<string> {
  const url = addToken(new URL(`${THREADS_GRAPH}/${accountId}/threads_publish`), token);
  const data = await metaFetch(url, { method: 'POST', body: new URLSearchParams({ creation_id: containerId }) }) as Record<string, unknown>;
  return data.id as string;
}

export async function getThreadsReplies(token: string, postId: string, fields = 'id,text,username,timestamp,has_replies'): Promise<Record<string, unknown>> {
  const url = addToken(new URL(`${THREADS_GRAPH}/${postId}/replies`), token);
  url.searchParams.set('fields', fields);
  return metaFetch(url) as Promise<Record<string, unknown>>;
}

export async function getThreadsConversation(token: string, postId: string, fields = 'id,text,username,timestamp,has_replies,replied_to'): Promise<Record<string, unknown>> {
  const url = addToken(new URL(`${THREADS_GRAPH}/${postId}/conversation`), token);
  url.searchParams.set('fields', fields);
  return metaFetch(url) as Promise<Record<string, unknown>>;
}

export async function replyToThreadsPost(input: {
  token: string; accountId: string; text: string; replyToId: string;
}): Promise<{ containerId: string; postId: string }> {
  // Create container as reply
  const containerId = await createThreadsContainer({
    token: input.token,
    accountId: input.accountId,
    text: input.text,
    mediaType: 'text',
    replyToId: input.replyToId,
  });
  // Publish the reply container
  const url = addToken(new URL(`${THREADS_GRAPH}/${input.accountId}/threads_publish`), input.token);
  const data = await metaFetch(url, { method: 'POST', body: new URLSearchParams({ creation_id: containerId }) }) as Record<string, unknown>;
  return { containerId, postId: data.id as string };
}

export async function publishFacebookPost(input: {
  token: string;
  pageId: string;
  message: string;
  published?: boolean; // false = draft
  link?: string;
}): Promise<string> {
  const url = addToken(new URL(`${FACEBOOK_GRAPH}/${input.pageId}/feed`), input.token);
  const body = new URLSearchParams({ message: input.message });
  if (input.published === false) body.set('published', 'false');
  if (input.link) body.set('link', input.link);
  const data = await metaFetch(url, { method: 'POST', body }) as Record<string, unknown>;
  if (!data.id) throw new Error(`Facebook post failed: ${JSON.stringify(data)}`);
  return data.id as string;
}

export async function getPermalink(platform: 'instagram' | 'threads' | 'facebook', token: string, postId: string): Promise<string | null> {
  const base = platform === 'threads' ? THREADS_GRAPH : FACEBOOK_GRAPH;
  const url = addToken(new URL(`${base}/${postId}`), token);
  url.searchParams.set('fields', 'id,permalink');
  const data = await metaFetch(url) as Record<string, unknown>;
  return (data.permalink as string) || null;
}
