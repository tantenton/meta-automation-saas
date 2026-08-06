import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { encryptToken } from '@/lib/server/token-crypto';

const FB_APP_ID = process.env.META_APP_ID!;
const FB_APP_SECRET = process.env.META_APP_SECRET!;
const REDIRECT_URI = process.env.META_FACEBOOK_REDIRECT_URI!;
const APP_URL = process.env.APP_URL || 'https://meta-automation-saas.vercel.app';
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';
const OWNER_USER_ID = process.env.HERMES_OWNER_USER_ID!;

const SUCCESS_URL = `${APP_URL}/settings/integrations/facebook?status=connected`;
const ERROR_URL = `${APP_URL}/settings/integrations/facebook?status=error`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Detect Meta OAuth errors
  const oauthError = searchParams.get('error');
  const oauthErrorDesc = searchParams.get('error_description');
  if (oauthError) {
    console.error('[fb-callback] OAuth error:', oauthError, oauthErrorDesc);
    return NextResponse.redirect(`${ERROR_URL}&reason=${encodeURIComponent(oauthError)}`);
  }

  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // Validate state against cookie
  const cookieState = request.cookies.get('fb_oauth_state')?.value;
  if (!state || !cookieState || state !== cookieState) {
    console.error('[fb-callback] State mismatch or missing');
    return NextResponse.redirect(`${ERROR_URL}&reason=state_mismatch`);
  }

  if (!code) {
    return NextResponse.redirect(`${ERROR_URL}&reason=no_code`);
  }

  try {
    // Exchange authorization code for short-lived user access token
    const tokenUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
    tokenUrl.searchParams.set('client_id', FB_APP_ID);
    tokenUrl.searchParams.set('client_secret', FB_APP_SECRET);
    tokenUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    tokenUrl.searchParams.set('code', code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json() as Record<string, unknown>;
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[fb-callback] Token exchange failed:', tokenData);
      return NextResponse.redirect(`${ERROR_URL}&reason=token_exchange_failed`);
    }

    const shortToken = tokenData.access_token as string;

    // Exchange for long-lived user token (~60 days)
    const longUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
    longUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longUrl.searchParams.set('client_id', FB_APP_ID);
    longUrl.searchParams.set('client_secret', FB_APP_SECRET);
    longUrl.searchParams.set('fb_exchange_token', shortToken);

    const longRes = await fetch(longUrl.toString());
    const longData = await longRes.json() as Record<string, unknown>;
    if (!longRes.ok || !longData.access_token) {
      console.error('[fb-callback] Long-lived token exchange failed');
      return NextResponse.redirect(`${ERROR_URL}&reason=long_token_failed`);
    }

    const userLongToken = longData.access_token as string;

    // Fetch Pages accessible by this user
    const pagesUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`);
    pagesUrl.searchParams.set('fields', 'id,name,access_token,category,tasks');
    pagesUrl.searchParams.set('access_token', userLongToken);

    const pagesRes = await fetch(pagesUrl.toString());
    const pagesData = await pagesRes.json() as { data?: Array<{ id: string; name: string; access_token: string; category?: string }> };
    const pages = pagesData.data || [];

    // Save each Page as an account
    const db = getSupabaseAdmin();
    for (const page of pages) {
      const encryptedToken = encryptToken(page.access_token);
      await db.from('accounts').upsert({
        user_id: OWNER_USER_ID,
        platform: 'facebook',
        account_id: page.id,
        account_name: page.name,
        access_token_encrypted: encryptedToken,
        is_active: true,
        token_last_validated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,platform,account_id' });
    }

    // Clear state cookie
    const response = NextResponse.redirect(SUCCESS_URL);
    response.cookies.set('fb_oauth_state', '', { maxAge: 0, path: '/' });
    return response;

  } catch (err) {
    console.error('[fb-callback] Unexpected error:', err instanceof Error ? err.message : String(err));
    return NextResponse.redirect(`${ERROR_URL}&reason=internal_error`);
  }
}
