import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeMachine } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { createThreadsContainer, publishThreadsContainer, getThreadsContainerStatus, getPermalink } from '@/lib/meta-api/client';
import { decryptToken } from '@/lib/server/token-crypto';

const nodeSchema = z.object({
  text: z.string().min(1).max(500),
});

const schema = z.object({
  account_id: z.string().uuid(),
  chain_id: z.string().min(1).max(160),
  nodes: z.array(nodeSchema).min(1).max(10),
  idempotency_key: z.string().min(8).max(200),
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitReady(token: string, containerId: string, maxAttempts = 24, pollMs = 5000) {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getThreadsContainerStatus(token, containerId) as Record<string, unknown>;
    const code = String((status.status_code as string) || (status.status as string) || '').toUpperCase();
    if (['FINISHED', 'PUBLISHED'].includes(code)) return;
    if (['ERROR', 'EXPIRED', 'FAILED'].includes(code)) throw new Error((status.error_message as string) || code);
    await sleep(pollMs);
  }
  throw new Error('Container did not become ready before timeout');
}

export async function POST(request: NextRequest) {
  const denied = authorizeMachine(request); if (denied) return denied;
  try {
    const input = schema.parse(await request.json());
    const db = getSupabaseAdmin();

    // Idempotency check
    const { data: existing } = await db.from('thread_chains').select('*').eq('idempotency_key', input.idempotency_key).maybeSingle();
    if (existing) return NextResponse.json({ chain: existing, idempotent_replay: true });

    // Get account
    const { data: account, error: accErr } = await db.from('accounts').select('*').eq('id', input.account_id).single();
    if (accErr || !account || !account.is_active) return NextResponse.json({ error: 'account_not_found_or_inactive' }, { status: 404 });
    if (account.platform !== 'threads') return NextResponse.json({ error: 'chain_only_supported_for_threads' }, { status: 400 });

    const token = decryptToken(account.access_token_encrypted);

    // Publish chain sequentially
    const published: { index: number; text: string; container_id: string; post_id: string; permalink: string | null; reply_to_id: string | null }[] = [];
    let previousPostId: string | null = null;

    for (let i = 0; i < input.nodes.length; i++) {
      const node = input.nodes[i];
      const containerId = await createThreadsContainer({
        token,
        accountId: account.account_id,
        text: node.text,
        mediaType: 'text',
        replyToId: previousPostId ?? undefined,
      });

      await waitReady(token, containerId);

      const postId = await publishThreadsContainer(token, account.account_id, containerId);
      const permalink = await getPermalink('threads', token, postId).catch(() => null);

      published.push({
        index: i,
        text: node.text,
        container_id: containerId,
        post_id: postId,
        permalink,
        reply_to_id: previousPostId,
      });

      previousPostId = postId;

      // Small delay between replies to avoid rate limits
      if (i < input.nodes.length - 1) await sleep(2000);
    }

    // Save chain record
    const contentHash = createHash('sha256').update(JSON.stringify(input.nodes)).digest('hex');
    const { data: chain, error: chainErr } = await db.from('thread_chains').insert({
      account_id: input.account_id,
      chain_id: input.chain_id,
      idempotency_key: input.idempotency_key,
      content_hash: contentHash,
      nodes: published,
      status: 'published',
      published_at: new Date().toISOString(),
      parent_post_id: published[0]?.post_id ?? null,
      parent_permalink: published[0]?.permalink ?? null,
    }).select('*').single();

    if (chainErr) {
      // table may not exist yet — return result anyway
      return NextResponse.json({ chain: { nodes: published, status: 'published' } }, { status: 201 });
    }

    return NextResponse.json({ chain }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'validation_error', issues: error.issues }, { status: 400 });
    return NextResponse.json({ error: 'chain_publish_failed', message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
