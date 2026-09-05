import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const host = request.headers.get('host') || 'meta-automation-saas.vercel.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const APP_URL = process.env.APP_URL || `${protocol}://${host}`;
  const REDIRECT_URI = process.env.TIKTOK_REDIRECT_URI || `${APP_URL}/api/oauth/tiktok/callback`;
  const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || 'awtuhkyac9f78d8e';

  const state = randomBytes(16).toString('hex');
  const cookieStore = await cookies();
  cookieStore.set('tiktok_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  const url = new URL('https://www.tiktok.com/v2/auth/authorize/');
  url.searchParams.set('client_key', CLIENT_KEY);
  url.searchParams.set('scope', 'user.info.basic,video.upload,video.publish');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('state', state);

  console.log('[tiktok-start] oauth_redirect_initiated=true client_key=' + CLIENT_KEY);
  return NextResponse.redirect(url.toString());
}
