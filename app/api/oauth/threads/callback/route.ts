import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { encryptToken } from '@/lib/server/token-crypto';

const THREADS_APP_ID = process.env.THREADS_APP_ID || process.env.META_APP_ID || '2078424476129562';
const THREADS_APP_SECRET = process.env.THREADS_APP_SECRET || process.env.META_APP_SECRET!;
const OWNER_USER_ID = process.env.HERMES_OWNER_USER_ID || '00000000-0000-0000-0000-000000000000';

export async function GET(request: NextRequest) {
  const host = request.headers.get('host') || 'meta-automation-saas.vercel.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const APP_URL = process.env.APP_URL || `${protocol}://${host}`;
  const REDIRECT_URI = process.env.THREADS_REDIRECT_URI || `${APP_URL}/api/oauth/threads/callback`;

  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    const desc = searchParams.get('error_description') || error;
    return NextResponse.redirect(`${APP_URL}/dashboard/accounts?status=threads_error&reason=${encodeURIComponent(desc)}`);
  }

  // Validate state
  const cookieStore = await cookies();
  const savedState = cookieStore.get('threads_oauth_state')?.value;
  if (!state || !savedState || state !== savedState) {
    return NextResponse.redirect(`${APP_URL}/dashboard/accounts?status=threads_error&reason=state_mismatch`);
  }
  cookieStore.delete('threads_oauth_state');

  if (!code) {
    return NextResponse.redirect(`${APP_URL}/dashboard/accounts?status=threads_error&reason=no_code`);
  }

  try {
    // Exchange code for short-lived token
    const tokenRes = await fetch('https://graph.threads.net/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: THREADS_APP_ID,
        client_secret: THREADS_APP_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        code,
      }),
    });
    if (!tokenRes.ok) throw new Error(`Token exchange failed: ${await tokenRes.text()}`);
    const tokenData = await tokenRes.json() as { access_token: string; user_id: string };

    // Exchange for long-lived token (60 days)
    const llRes = await fetch(
      `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${THREADS_APP_SECRET}&access_token=${tokenData.access_token}`
    );
    if (!llRes.ok) throw new Error(`Long-lived token exchange failed: ${await llRes.text()}`);
    const llData = await llRes.json() as { access_token: string; expires_in: number };

    // Get user info
    const meRes = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${llData.access_token}`);
    if (!meRes.ok) throw new Error(`Failed to fetch user: ${await meRes.text()}`);
    const me = await meRes.json() as { id: string; username: string };

    const db = getSupabaseAdmin();
    const encryptedToken = encryptToken(llData.access_token);
    const expiresAt = new Date(Date.now() + llData.expires_in * 1000).toISOString();

    // Upsert account
    const { error: upsertErr } = await db.from('accounts').upsert({
      user_id: OWNER_USER_ID,
      platform: 'threads',
      account_id: me.id,
      account_name: me.username,
      access_token_encrypted: encryptedToken,
      token_expires_at: expiresAt,
      token_last_validated_at: new Date().toISOString(),
      is_active: true,
    }, { onConflict: 'user_id,platform,account_id' });

    if (upsertErr) throw new Error(`DB upsert failed: ${upsertErr.message}`);

    return NextResponse.redirect(`${APP_URL}/dashboard/accounts?status=threads_connected`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Threads OAuth error:', msg);
    return NextResponse.redirect(`${APP_URL}/dashboard/accounts?status=threads_error&reason=${encodeURIComponent(msg)}`);
  }
}

