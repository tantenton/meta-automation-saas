import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { encryptToken } from '@/lib/server/token-crypto';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (error) {
    console.error('[tiktok-callback] OAuth Error:', error, errorDescription);
    return NextResponse.redirect(new URL(`/dashboard/accounts?error=${encodeURIComponent(errorDescription || error)}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/dashboard/accounts?error=no_code_provided', request.url));
  }

  const host = request.headers.get('host') || 'meta-automation-saas.vercel.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const APP_URL = process.env.APP_URL || `${protocol}://${host}`;
  const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI || `${APP_URL}/api/oauth/tiktok/callback`;
  const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || 'awtuhkyac9f78d8e';
  const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET || '';

  try {
    // 1. Exchange code for access token
    const tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/';
    const bodyParams = new URLSearchParams({
      client_key: CLIENT_KEY,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    });

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: bodyParams.toString(),
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error && tokenData.error !== 'ok') {
      throw new Error(`Token exchange failed: [${tokenData.error}] ${tokenData.error_description || tokenData.message}`);
    }

    const accessToken = tokenData.access_token || tokenData.data?.access_token;
    const openId = tokenData.open_id || tokenData.data?.open_id;
    const expiresIn = tokenData.expires_in || tokenData.data?.expires_in || 86400;

    // 2. Fetch User Profile Info
    const userUrl = 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username';
    const userRes = await fetch(userUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    const userData = await userRes.json();
    const user = userData.data?.user || {};
    const accountName = user.display_name || user.username || 'mindcast_tiktok';
    const profilePic = user.avatar_url || null;

    // 3. Encrypt and Upsert into Supabase accounts table
    const db = getSupabaseAdmin();
    const encryptedToken = encryptToken(accessToken);
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const { data: existingAccount } = await db
      .from('accounts')
      .select('id')
      .eq('platform', 'tiktok')
      .eq('account_id', openId)
      .maybeSingle();

    if (existingAccount) {
      await db.from('accounts').update({
        account_name: accountName,
        profile_picture_url: profilePic,
        access_token_encrypted: encryptedToken,
        token_expires_at: expiresAt,
        token_last_validated_at: new Date().toISOString(),
        is_active: true,
      }).eq('id', existingAccount.id);
    } else {
      await db.from('accounts').insert({
        platform: 'tiktok',
        account_id: openId,
        account_name: accountName,
        profile_picture_url: profilePic,
        access_token_encrypted: encryptedToken,
        token_expires_at: expiresAt,
        token_last_validated_at: new Date().toISOString(),
        is_active: true,
      });
    }

    console.log('[tiktok-callback] TikTok account connected successfully:', accountName);
    return NextResponse.redirect(new URL('/dashboard/accounts?success=tiktok_connected', request.url));
  } catch (err) {
    console.error('[tiktok-callback] Error connecting TikTok account:', err);
    return NextResponse.redirect(new URL(`/dashboard/accounts?error=${encodeURIComponent(String(err))}`, request.url));
  }
}
