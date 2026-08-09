import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';

const IG_APP_ID = process.env.IG_APP_ID!;
const REDIRECT_URI = process.env.IG_REDIRECT_URI!;

export async function GET() {
  if (!IG_APP_ID || !REDIRECT_URI) {
    return NextResponse.json({ error: 'server_misconfigured', message: 'IG_APP_ID or IG_REDIRECT_URI not set' }, { status: 503 });
  }

  const state = randomBytes(16).toString('hex');
  const cookieStore = await cookies();
  cookieStore.set('ig_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  const url = new URL('https://api.instagram.com/oauth/authorize');
  url.searchParams.set('client_id', IG_APP_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('scope', 'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_comments');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);

  console.log('[ig-start] oauth_redirect_initiated=true');
  return NextResponse.redirect(url.toString());
}
