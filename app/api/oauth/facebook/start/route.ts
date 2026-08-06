import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

const FB_APP_ID = process.env.META_APP_ID!;
const REDIRECT_URI = process.env.META_FACEBOOK_REDIRECT_URI!;
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';

// Minimum permissions for Facebook Page organic posting only
const SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
].join(',');

export async function GET() {
  if (!FB_APP_ID || !REDIRECT_URI) {
    return NextResponse.json(
      { error: 'server_misconfigured', message: 'META_APP_ID or META_FACEBOOK_REDIRECT_URI not set' },
      { status: 503 }
    );
  }

  // Generate cryptographically random state
  const state = randomBytes(32).toString('hex');

  // Build Meta OAuth URL
  const authUrl = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  authUrl.searchParams.set('client_id', FB_APP_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', SCOPES);

  // Redirect to Meta OAuth with state stored in secure cookie
  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set('fb_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  return response;
}
