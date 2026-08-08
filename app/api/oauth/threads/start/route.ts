import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';

const THREADS_APP_ID = process.env.THREADS_APP_ID || '2078424476129562';
const REDIRECT_URI = 'https://meta-automation-saas.vercel.app/api/oauth/threads/callback';

export async function GET() {
  const state = randomBytes(16).toString('hex');
  const cookieStore = await cookies();
  cookieStore.set('threads_oauth_state', state, {
    httpOnly: true,
    secure: true,
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
