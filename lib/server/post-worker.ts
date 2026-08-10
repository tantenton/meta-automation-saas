import { decryptToken } from './token-crypto';
import { getSupabaseAdmin } from './supabase-admin';
import {
  createInstagramContainer, createThreadsContainer, getInstagramContainerStatus,
  getThreadsContainerStatus, getPermalink, publishInstagramContainer, publishThreadsContainer,
  publishFacebookPost,
} from '@/lib/meta-api/client';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitUntilReady(platform: 'instagram' | 'threads', token: string, containerId: string) {
  const attempts = Number(process.env.META_STATUS_MAX_ATTEMPTS || 24);
  const delay = Number(process.env.META_STATUS_POLL_MS || 5000);
  for (let i = 0; i < attempts; i++) {
    const status = platform === 'instagram'
      ? await getInstagramContainerStatus(token, containerId)
      : await getThreadsContainerStatus(token, containerId);
    const code = String((status.status_code as string) || (status.status as string) || '').toUpperCase();
    if (['FINISHED', 'PUBLISHED'].includes(code)) return status;
    if (['ERROR', 'EXPIRED', 'FAILED'].includes(code)) throw new Error((status.error_message as string) || (status.status as string) || code);
    await sleep(delay);
  }
  throw new Error(`Meta container ${containerId} did not become ready before timeout`);
}

export async function processPost(postId: string) {
  const db = getSupabaseAdmin();
  const { data: post, error } = await db.from('posts').select('*, accounts(*)').eq('id', postId).single();
  if (error || !post) throw new Error('Post not found');
  if (post.status === 'published') return post;
  if (!['queued', 'scheduled', 'retrying', 'failed'].includes(post.status)) throw new Error(`Post status ${post.status} cannot be processed`);

  const account = post.accounts;
  if (!account?.access_token_encrypted) throw new Error('Account token is missing');
  const token = decryptToken(account.access_token_encrypted);
  const mediaUrl = Array.isArray(post.media_url) ? post.media_url[0] : null;
  const mediaType = post.media_type as 'text' | 'image' | 'video';

  const { data: claimed, error: claimError } = await db.from('posts').update({
    status: 'processing', attempts: (post.attempts || 0) + 1, error_message: null, processing_started_at: new Date().toISOString(),
  }).eq('id', post.id).in('status', ['queued', 'scheduled', 'retrying', 'failed']).select('id').maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) throw new Error('Post is already claimed by another worker');
  try {
    let containerId = post.meta_media_id as string | null;
    if (!containerId) {
      if (account.platform === 'facebook') {
        // Facebook Page posting — direct, no container
        const pageId = account.account_id as string;
        const fbPostId = await publishFacebookPost({
          token,
          pageId,
          message: post.content,
          published: true,
        });
        const permalink = await getPermalink('facebook', token, fbPostId).catch(() => null);
        const { data: done, error: updateError } = await db.from('posts').update({
          status: 'published', meta_post_id: fbPostId, permalink,
          published_at: new Date().toISOString(), error_message: null,
        }).eq('id', post.id).select('*').single();
        if (updateError) throw updateError;
        return done;
      }
      containerId = account.platform === 'instagram'
        ? await createInstagramContainer({ token, accountId: account.account_id, caption: post.content, mediaUrl, mediaType: mediaType === 'video' ? 'video' : 'image' })
        : await createThreadsContainer({ token, accountId: account.account_id, text: post.content, mediaUrl, mediaType, replyToId: post.reply_to_id as string | undefined });
      await db.from('posts').update({ meta_media_id: containerId }).eq('id', post.id);
    }

    await waitUntilReady(account.platform, token, containerId);
    const platformPostId = account.platform === 'instagram'
      ? await publishInstagramContainer(token, account.account_id, containerId)
      : await publishThreadsContainer(token, account.account_id, containerId);
    const permalink = await getPermalink(account.platform, token, platformPostId).catch(() => null);
    const { data: done, error: updateError } = await db.from('posts').update({
      status: 'published', meta_post_id: platformPostId, permalink,
      published_at: new Date().toISOString(), error_message: null,
    }).eq('id', post.id).select('*').single();
    if (updateError) throw updateError;
    return done;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const maxAttempts = Number(process.env.POST_MAX_ATTEMPTS || 3);
    const nextStatus = (post.attempts || 0) + 1 < maxAttempts ? 'retrying' : 'failed';
    await db.from('posts').update({ status: nextStatus, error_message: message }).eq('id', post.id);
    throw err;
  }
}

export async function processDuePosts(limit = 5) {
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await db.from('posts').select('id').in('status', ['queued', 'scheduled', 'retrying'])
    .or(`scheduled_at.is.null,scheduled_at.lte.${now}`).order('created_at', { ascending: true }).limit(limit);
  if (error) throw error;
  const results = [];
  for (const row of data || []) {
    try { results.push({ id: row.id, ok: true, post: await processPost(row.id) }); }
    catch (error) { results.push({ id: row.id, ok: false, error: error instanceof Error ? error.message : String(error) }); }
  }
  return results;
}
