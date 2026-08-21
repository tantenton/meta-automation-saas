import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { encryptToken } from '@/lib/server/token-crypto';

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';

export async function GET(request: NextRequest) {
  const host = request.headers.get('host') || 'meta-automation-saas.vercel.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const APP_URL = process.env.APP_URL || `${protocol}://${host}`;
  const REDIRECT_URI = process.env.IG_REDIRECT_URI || `${APP_URL}/api/oauth/instagram/callback`;
  const IG_APP_ID = process.env.IG_APP_ID || process.env.META_APP_ID!;
  const IG_APP_SECRET = process.env.IG_APP_SECRET || process.env.META_APP_SECRET!;
  const OWNER_USER_ID = process.env.HERMES_OWNER_USER_ID || '00000000-0000-0000-0000-000000000000';

  const SUCCESS_URL = `${APP_URL}/dashboard/accounts?status=ig_connected`;
  const ERROR_URL = `${APP_URL}/dashboard/accounts?status=ig_error`;

  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');


  console.log('[ig-callback] oauth_code_received=' + Boolean(code));

  if (error) {
    console.error('[ig-callback] oauth_error=' + error);
    return NextResponse.redirect(`${ERROR_URL}&reason=${encodeURIComponent(error)}`);
  }

  // Validate state
  const cookieStore = await cookies();
  const savedState = cookieStore.get('ig_oauth_state')?.value;
  if (!state || !savedState || state !== savedState) {
    console.error('[ig-callback] state_mismatch state_present=' + Boolean(state) + ' cookie_present=' + Boolean(savedState));
    return NextResponse.redirect(`${ERROR_URL}&reason=state_mismatch`);
  }
  cookieStore.delete('ig_oauth_state');

  if (!code) {
    return NextResponse.redirect(`${ERROR_URL}&reason=no_code`);
  }

  try {
    // A. Exchange code for short-lived token
    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: IG_APP_ID,
        client_secret: IG_APP_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        code,
      }),
    });
    const tokenData = await tokenRes.json() as { access_token?: string; user_id?: string; error_message?: string };
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[ig-callback] user_token_received=false error=' + JSON.stringify({ error: tokenData.error_message }));
      return NextResponse.redirect(`${ERROR_URL}&reason=token_exchange_failed`);
    }
    console.log('[ig-callback] user_token_received=true');

    // B. Exchange for long-lived token (60 days)
    const llRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${IG_APP_SECRET}&access_token=${tokenData.access_token}`
    );
    const llData = await llRes.json() as { access_token?: string; expires_in?: number; error?: { message: string } };
    if (!llRes.ok || !llData.access_token) {
      console.error('[ig-callback] long_token_failed error=' + JSON.stringify(llData.error));
      return NextResponse.redirect(`${ERROR_URL}&reason=long_token_failed`);
    }

    const longToken = llData.access_token;
    const expiresAt = new Date(Date.now() + (llData.expires_in || 5184000) * 1000).toISOString();

    // C. Get IG user info
    const meRes = await fetch(`https://graph.instagram.com/${GRAPH_VERSION}/me?fields=id,username&access_token=${longToken}`);
    const me = await meRes.json() as { id?: string; username?: string; error?: { message: string } };
    if (!meRes.ok || !me.id) {
      console.error('[ig-callback] me_fetch_failed error=' + JSON.stringify(me.error));
      return NextResponse.redirect(`${ERROR_URL}&reason=me_fetch_failed`);
    }

    console.log('[ig-callback] ig_user_id=' + me.id + ' username=' + me.username);

    // D. Save IG account — completely independent of Facebook Page
    const db = getSupabaseAdmin();
    const encryptedToken = encryptToken(longToken);

    console.log('[ig-callback] db_write_attempted=true provider=instagram account_id=' + me.id);
    const { error: upsertErr } = await db.from('accounts').upsert({
      user_id: OWNER_USER_ID,
      platform: 'instagram',
      account_id: me.id,
      account_name: me.username || me.id,
      access_token_encrypted: encryptedToken,
      token_expires_at: expiresAt,
      token_last_validated_at: new Date().toISOString(),
      is_active: true,
    }, { onConflict: 'user_id,platform,account_id' });

    if (upsertErr) {
      console.error('[ig-callback] db_write_success=false error=' + upsertErr.message);
      return NextResponse.redirect(`${ERROR_URL}&reason=db_error`);
    }

    console.log('[ig-callback] db_write_success=true provider=instagram account_id=' + me.id);
    return NextResponse.redirect(SUCCESS_URL);

  } catch (err) {
    console.error('[ig-callback] unexpected_error=' + (err instanceof Error ? err.message : String(err)));
    return NextResponse.redirect(`${ERROR_URL}&reason=internal_error`);
  }
}
