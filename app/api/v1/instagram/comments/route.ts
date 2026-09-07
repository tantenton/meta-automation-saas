import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authorizeMachine } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { decryptToken } from '@/lib/server/token-crypto';
import { getInstagramComments, replyToInstagramComment } from '@/lib/meta-api/comments';

const querySchema = z.object({
  account_id: z.string().uuid().default('b7d117a0-9daf-4b5c-97a0-b08b7044f178'), // default officialmindcast
  limit: z.coerce.number().min(1).max(20).default(5),
});

const replySchema = z.object({
  account_id: z.string().uuid().default('b7d117a0-9daf-4b5c-97a0-b08b7044f178'),
  comment_id: z.string().min(1),
  message: z.string().min(1).max(1000),
});

/**
 * GET /api/v1/instagram/comments?account_id=...
 * Mengambil daftar komentar terbaru di postingan Reels Instagram officialmindcast
 */
export async function GET(request: NextRequest) {
  const denied = authorizeMachine(request);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.parse({
      account_id: searchParams.get('account_id') || undefined,
      limit: searchParams.get('limit') || undefined,
    });

    const db = getSupabaseAdmin();
    const { data: account, error: accError } = await db
      .from('accounts')
      .select('*')
      .eq('id', parsed.account_id)
      .single();

    if (accError || !account || !account.is_active) {
      return NextResponse.json({ error: 'account_not_found_or_inactive' }, { status: 404 });
    }

    const accessToken = decryptToken(account.access_token_encrypted);

    // Ambil postingan reels yang sudah published
    const { data: posts, error: postsError } = await db
      .from('posts')
      .select('id, content, meta_media_id, meta_post_id, permalink, published_at')
      .eq('account_id', parsed.account_id)
      .eq('status', 'published')
      .not('meta_media_id', 'is', null)
      .order('published_at', { ascending: false })
      .limit(parsed.limit);

    if (postsError) throw postsError;

    const results = [];
    for (const post of posts || []) {
      const mediaId = post.meta_media_id;
      try {
        const commentsData = await getInstagramComments(accessToken, mediaId);
        results.push({
          post_id: post.id,
          meta_media_id: mediaId,
          post_caption: post.content,
          permalink: post.permalink,
          comments: commentsData.data || [],
        });
      } catch (err) {
        results.push({
          post_id: post.id,
          meta_media_id: mediaId,
          post_caption: post.content,
          error: String(err),
          comments: [],
        });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json({ error: 'fetch_ig_comments_failed', message: String(error) }, { status: 500 });
  }
}

/**
 * POST /api/v1/instagram/comments
 * Mengirim balasan ke komentar Instagram
 */
export async function POST(request: NextRequest) {
  const denied = authorizeMachine(request);
  if (denied) return denied;

  try {
    const input = replySchema.parse(await request.json());
    const db = getSupabaseAdmin();

    const { data: account, error: accError } = await db
      .from('accounts')
      .select('*')
      .eq('id', input.account_id)
      .single();

    if (accError || !account || !account.is_active) {
      return NextResponse.json({ error: 'account_not_found_or_inactive' }, { status: 404 });
    }

    const accessToken = decryptToken(account.access_token_encrypted);
    const replyResult = await replyToInstagramComment(accessToken, input.comment_id, input.message);

    return NextResponse.json({
      success: true,
      comment_id: input.comment_id,
      reply_id: replyResult.id,
      message: input.message,
    });
  } catch (error) {
    return NextResponse.json({ error: 'reply_ig_comment_failed', message: String(error) }, { status: 500 });
  }
}
