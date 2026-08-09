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
    console.error('[fb-callback] oauth_error=true reason=' + oauthError, oauthErrorDesc);
    return NextResponse.redirect(`${ERROR_URL}&reason=${encodeURIComponent(oauthError)}`);
  }

  const code = searchParams.get('code');
  const state = searchParams.get('state');

  console.log('[fb-callback] oauth_code_received=' + Boolean(code));

  // Validate state against cookie
  const cookieState = request.cookies.get('fb_oauth_state')?.value;
  if (!state || !cookieState || state !== cookieState) {
    console.error('[fb-callback] state_mismatch state_present=' + Boolean(state) + ' cookie_present=' + Boolean(cookieState));
    return NextResponse.redirect(`${ERROR_URL}&reason=state_mismatch`);
  }

  if (!code) {
    return NextResponse.redirect(`${ERROR_URL}&reason=no_code`);
  }

  try {
    // A. Exchange authorization code for short-lived user access token
    const tokenUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
    tokenUrl.searchParams.set('client_id', FB_APP_ID);
    tokenUrl.searchParams.set('client_secret', FB_APP_SECRET);
    tokenUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    tokenUrl.searchParams.set('code', code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json() as Record<string, unknown>;
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[fb-callback] user_token_received=false', JSON.stringify({ status: tokenRes.status, error: tokenData.error }));
      return NextResponse.redirect(`${ERROR_URL}&reason=token_exchange_failed`);
    }
    console.log('[fb-callback] user_token_received=true');

    const shortToken = tokenData.access_token as string;

    // B. Exchange for long-lived user token (~60 days)
    const longUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
    longUrl.searchParams.set('grant_type', 'fb_exchange_token');
    longUrl.searchParams.set('client_id', FB_APP_ID);
    longUrl.searchParams.set('client_secret', FB_APP_SECRET);
    longUrl.searchParams.set('fb_exchange_token', shortToken);

    const longRes = await fetch(longUrl.toString());
    const longData = await longRes.json() as Record<string, unknown>;
    if (!longRes.ok || !longData.access_token) {
      console.error('[fb-callback] long_token_failed status=' + longRes.status);
      return NextResponse.redirect(`${ERROR_URL}&reason=long_token_failed`);
    }

    const userLongToken = longData.access_token as string;

    // C. Discover accessible Pages
    const pagesUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`);
    pagesUrl.searchParams.set('fields', 'id,name,access_token,category,tasks');
    pagesUrl.searchParams.set('access_token', userLongToken);

    const pagesRes = await fetch(pagesUrl.toString());
    const pagesData = await pagesRes.json() as { data?: Array<{ id: string; name: string; access_token: string; category?: string; tasks?: string[] }> };
    const pages = pagesData.data || [];
    console.log('[fb-callback] page_discovery_success=true page_count=' + pages.length);

    // D. Save each Page — IG is NOT required, instagram_account_id is always optional
    const db = getSupabaseAdmin();
    let savedCount = 0;

    for (const page of pages) {
      // E. Verify page has access token
      if (!page.access_token) {
        console.warn('[fb-callback] page_id=' + page.id + ' no_page_token=true skipping');
        continue;
      }

      const pageFound = page.id === '1239462105921696';
      console.log('[fb-callback] page_found=' + pageFound + ' page_id=' + page.id + ' page_name=' + page.name);

      // F. Encrypt Page Access Token
      const encryptedToken = encryptToken(page.access_token);

      // G. Save Facebook Page integration — instagram_account_id is NULL, that is fine
      console.log('[fb-callback] db_write_attempted=true provider=facebook page_id=' + page.id);
      const { error: upsertError } = await db.from('accounts').upsert({
        user_id: OWNER_USER_ID,
        platform: 'facebook',
        account_id: page.id,
        account_name: page.name,
        access_token_encrypted: encryptedToken,
        is_active: true,
        token_last_validated_at: new Date().toISOString(),
        // instagram_account_id intentionally omitted — independent IG connection handles it
      }, { onConflict: 'user_id,platform,account_id' });

      if (upsertError) {
        console.error('[fb-callback] db_write_success=false page_id=' + page.id + ' error=' + upsertError.message);
      } else {
        savedCount++;
        console.log('[fb-callback] db_write_success=true provider=facebook page_id=' + page.id);
      }
    }

    console.log('[fb-callback] complete saved_pages=' + savedCount);

    // Clear state cookie and redirect to success
    const response = NextResponse.redirect(SUCCESS_URL);
    response.cookies.set('fb_oauth_state', '', { maxAge: 0, path: '/' });
    return response;

  } catch (err) {
    console.error('[fb-callback] unexpected_error=' + (err instanceof Error ? err.message : String(err)));
    return NextResponse.redirect(`${ERROR_URL}&reason=internal_error`);
  }
}
