import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { decryptToken, encryptToken } from '@/lib/server/token-crypto';
import { authorizeMachine } from '@/lib/server/api-auth';
import { NextRequest } from 'next/server';

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';
const OWNER_USER_ID = process.env.HERMES_OWNER_USER_ID!;

export async function POST(request: NextRequest) {
  const denied = authorizeMachine(request);
  if (denied) return denied;

  const db = getSupabaseAdmin();

  // Get FB page account
  const { data: fbAccount } = await db
    .from('accounts')
    .select('account_id, access_token_encrypted')
    .eq('platform', 'facebook')
    .single();

  if (!fbAccount?.access_token_encrypted) {
    return NextResponse.json({ error: 'no_facebook_token' }, { status: 400 });
  }

  const pageToken = decryptToken(fbAccount.access_token_encrypted);
  const pageId = fbAccount.account_id;

  // Fetch IG business account linked to FB page
  const igUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}`);
  igUrl.searchParams.set('fields', 'instagram_business_account{id,name,username}');
  igUrl.searchParams.set('access_token', pageToken);

  const igRes = await fetch(igUrl.toString());
  const igData = await igRes.json() as {
    instagram_business_account?: { id: string; name?: string; username?: string };
    error?: { message: string };
  };

  if (igData.error) {
    return NextResponse.json({ error: 'graph_error', message: igData.error.message }, { status: 502 });
  }

  const igAccount = igData.instagram_business_account;
  if (!igAccount?.id) {
    return NextResponse.json({ error: 'no_ig_linked', message: 'Facebook Page has no linked Instagram Business Account', page_id: pageId }, { status: 404 });
  }

  // Save IG account using FB page token
  const encryptedToken = encryptToken(pageToken);
  await db.from('accounts').upsert({
    user_id: OWNER_USER_ID,
    platform: 'instagram',
    account_id: igAccount.id,
    account_name: igAccount.username || igAccount.name || igAccount.id,
    access_token_encrypted: encryptedToken,
    is_active: true,
    token_last_validated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,platform,account_id' });

  return NextResponse.json({
    linked: true,
    ig_id: igAccount.id,
    ig_username: igAccount.username,
    page_id: pageId,
  });
}
