import { createHmac } from 'crypto';

const VERSION = process.env.META_GRAPH_VERSION || 'v19.0';
const INSTAGRAM_GRAPH = `https://graph.instagram.com/${VERSION}`;
const THREADS_GRAPH = `https://graph.threads.net/${VERSION}`;
const FACEBOOK_GRAPH = `https://graph.facebook.com/${VERSION}`;

function addToken(url: URL, token: string): URL {
  url.searchParams.set('access_token', token);
  const secret = process.env.META_APP_SECRET || process.env.IG_APP_SECRET || process.env.THREADS_APP_SECRET;
  if (secret) {
    url.searchParams.set('appsecret_proof', createHmac('sha256', secret).update(token).digest('hex'));
  }
  return url;
}

async function metaFetch(url: URL, options: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url.toString(), options);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Meta API error (${res.status}): ${text.slice(0, 300)}`);
  }
  return JSON.parse(text);
}

export async function createInstagramContainer(input: {
  token: string;
  accountId: string;
  caption?: string;
  mediaUrl?: string | null;
  mediaType: 'image' | 'video';
}): Promise<string> {
  const url = addToken(new URL(`${INSTAGRAM_GRAPH}/${input.accountId}/media`), input.token);
  const body = new URLSearchParams();
  if (input.mediaType === 'image') {
    body.set('image_url', input.mediaUrl || '');
    if (input.caption) body.set('caption', input.caption);
  } else {
    body.set('media_type', 'REELS');
    body.set('video_url', input.mediaUrl || '');
    if (input.caption) body.set('caption', input.caption);
  }
  const data = await metaFetch(url, { method: 'POST', body }) as Record<string, unknown>;
  if (!data.id) throw new Error(`Instagram container creation failed: ${JSON.stringify(data)}`);
  return data.id as string;
}

export async function getInstagramContainerStatus(token: string, containerId: string): Promise<Record<string, unknown>> {
  const url = addToken(new URL(`${INSTAGRAM_GRAPH}/${containerId}`), token);
  url.searchParams.set('fields', 'status_code,status,error_message');
  return await metaFetch(url) as Record<string, unknown>;
}

export async function publishInstagramContainer(token: string, accountId: string, containerId: string): Promise<string> {
  const url = addToken(new URL(`${INSTAGRAM_GRAPH}/${accountId}/media_publish`), token);
  const data = await metaFetch(url, { method: 'POST', body: new URLSearchParams({ creation_id: containerId }) }) as Record<string, unknown>;
  if (!data.id) throw new Error(`Instagram publish failed: ${JSON.stringify(data)}`);
  return data.id as string;
}

export async function createThreadsContainer(input: {
  token: string;
  accountId: string;
  text?: string;
  mediaUrl?: string | null;
  mediaType?: 'text' | 'image' | 'video';
  replyToId?: string;
}): Promise<string> {
  const url = addToken(new URL(`${THREADS_GRAPH}/${input.accountId}/threads`), input.token);
  const body = new URLSearchParams();
  const mt = input.mediaType || (input.mediaUrl ? 'image' : 'text');
  if (mt === 'text') {
    body.set('media_type', 'TEXT');
    if (input.text) body.set('text', input.text);
  } else if (mt === 'image') {
    body.set('media_type', 'IMAGE');
    body.set('image_url', input.mediaUrl || '');
    if (input.text) body.set('text', input.text);
  } else if (mt === 'video') {
    body.set('media_type', 'VIDEO');
    body.set('video_url', input.mediaUrl || '');
    if (input.text) body.set('text', input.text);
  }
  if (input.replyToId) body.set('reply_to_id', input.replyToId);
  const data = await metaFetch(url, { method: 'POST', body }) as Record<string, unknown>;
  if (!data.id) throw new Error(`Threads container creation failed: ${JSON.stringify(data)}`);
  return data.id as string;
}

export async function getThreadsContainerStatus(token: string, containerId: string): Promise<Record<string, unknown>> {
  const url = addToken(new URL(`${THREADS_GRAPH}/${containerId}`), token);
  url.searchParams.set('fields', 'status,error_message');
  return await metaFetch(url) as Record<string, unknown>;
}

export async function publishThreadsContainer(token: string, accountId: string, containerId: string): Promise<string> {
  const url = addToken(new URL(`${THREADS_GRAPH}/${accountId}/threads_publish`), token);
  const data = await metaFetch(url, { method: 'POST', body: new URLSearchParams({ creation_id: containerId }) }) as Record<string, unknown>;
  if (!data.id) throw new Error(`Threads publish failed: ${JSON.stringify(data)}`);
  return data.id as string;
}

export async function replyToThreadsPost(input: {
  token: string;
  accountId: string;
  replyToId: string;
  text: string;
}): Promise<{ containerId: string; postId: string }> {
  const containerId = await createThreadsContainer({
    token: input.token,
    accountId: input.accountId,
    text: input.text,
    mediaType: 'text',
    replyToId: input.replyToId,
  });

  const url = addToken(new URL(`${THREADS_GRAPH}/${input.accountId}/threads_publish`), input.token);
  const data = await metaFetch(url, { method: 'POST', body: new URLSearchParams({ creation_id: containerId }) }) as Record<string, unknown>;
  return { containerId, postId: data.id as string };
}

export async function publishFacebookPost(input: {
  token: string;
  pageId: string;
  message: string;
  published?: boolean;
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

export async function publishFacebookVideo(input: {
  token: string;
  pageId: string;
  description: string;
  videoUrl: string;
  published?: boolean;
}): Promise<string> {
  const url = addToken(new URL(`${FACEBOOK_GRAPH}/${input.pageId}/videos`), input.token);
  const body = new URLSearchParams({
    description: input.description,
    file_url: input.videoUrl,
  });
  if (input.published === false) body.set('published', 'false');
  const data = await metaFetch(url, { method: 'POST', body }) as Record<string, unknown>;
  if (!data.id) throw new Error(`Facebook video publish failed: ${JSON.stringify(data)}`);
  return data.id as string;
}

export async function getPermalink(platform: 'instagram' | 'threads' | 'facebook', token: string, postId: string): Promise<string | null> {
  const base = platform === 'threads' ? THREADS_GRAPH : platform === 'instagram' ? INSTAGRAM_GRAPH : FACEBOOK_GRAPH;
  const url = addToken(new URL(`${base}/${postId}`), token);
  url.searchParams.set('fields', 'id,permalink,permalink_url');
  const data = await metaFetch(url) as Record<string, unknown>;
  return (data.permalink_url as string) || (data.permalink as string) || null;
}
