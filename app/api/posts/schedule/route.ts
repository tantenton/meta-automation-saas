import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { processPost } from '@/lib/server/post-worker';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      caption,
      platform,
      accountId,
      imageUrl,
      mediaType = 'image',
      scheduledAt,
      publishNow = false,
    } = body;

    if (!caption || !caption.trim()) {
      return NextResponse.json({ error: 'Caption is required' }, { status: 400 });
    }

    const db = getSupabaseAdmin();
    const ownerId = process.env.HERMES_OWNER_USER_ID || '00000000-0000-0000-0000-000000000000';

    // 1. Resolve target account
    let targetAccountId = accountId;
    if (!targetAccountId) {
      const targetPlatform = platform || 'instagram';
      const { data: accountData } = await db
        .from('accounts')
        .select('id')
        .eq('platform', targetPlatform)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (accountData) {
        targetAccountId = accountData.id;
      }
    }

    if (!targetAccountId) {
      // If still no account, check any active account or return a clear message
      const { data: anyAccount } = await db
        .from('accounts')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (anyAccount) {
        targetAccountId = anyAccount.id;
      } else {
        return NextResponse.json({
          error: 'no_connected_account',
          message: 'Please connect a social media account first before creating posts.',
        }, { status: 400 });
      }
    }

    // 2. Determine initial status
    const initialStatus = publishNow ? 'queued' : scheduledAt ? 'scheduled' : 'draft';
    const mediaUrls = imageUrl ? [imageUrl] : [];

    // 3. Insert post record
    const { data: newPost, error: insertError } = await db
      .from('posts')
      .insert({
        account_id: targetAccountId,
        content: caption.trim(),
        media_url: mediaUrls,
        media_type: mediaType || (imageUrl ? 'image' : 'text'),
        status: initialStatus,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      })
      .select('*, accounts(*)')
      .single();

    if (insertError || !newPost) {
      console.error('[posts/schedule] Insert error:', insertError?.message);
      return NextResponse.json({ error: insertError?.message || 'Failed to save post' }, { status: 500 });
    }

    // 4. If publishNow requested, run worker immediately
    if (publishNow) {
      try {
        const publishedPost = await processPost(newPost.id);
        return NextResponse.json({
          success: true,
          post: publishedPost,
          message: 'Post published successfully to Meta!',
        });
      } catch (pubErr) {
        console.error('[posts/schedule] Live publish error:', pubErr);
        return NextResponse.json({
          success: false,
          post: newPost,
          error: 'publish_failed',
          message: pubErr instanceof Error ? pubErr.message : String(pubErr),
        }, { status: 502 });
      }
    }

    return NextResponse.json({
      success: true,
      post: newPost,
      message: scheduledAt ? 'Post scheduled successfully' : 'Draft saved successfully',
    });
  } catch (err) {
    console.error('[posts/schedule] Unexpected error:', err);
    return NextResponse.json({
      error: 'internal_error',
      message: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
