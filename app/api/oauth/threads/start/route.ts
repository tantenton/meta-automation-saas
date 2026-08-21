import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';

const THREADS_APP_ID = process.env.THREADS_APP_ID || process.env.META_APP_ID || '2078424476129562';

export async function GET(request: Request) {
  const host = request.headers.get('host') || 'meta-automation-saas.vercel.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const APP_URL = process.env.APP_URL || `${protocol}://${host}`;
  const REDIRECT_URI = process.env.THREADS_REDIRECT_URI || `${APP_URL}/api/oauth/threads/callback`;

  const state = randomBytes(16).toString('hex');
  const cookieStore = await cookies();
  cookieStore.set('threads_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  const url = new URL('https://threads.net/oauth/authorize');
  url.searchParams.set('client_id', THREADS_APP_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('scope', 'threads_basic,threads_content_publish,threads_manage_replies,threads_read_replies,threads_profile_discovery');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);

  return NextResponse.redirect(url.toString());
}

