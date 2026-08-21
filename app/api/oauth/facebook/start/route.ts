import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

const FB_APP_ID = process.env.META_APP_ID!;
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';

// Minimum permissions for Facebook Page organic posting only
const SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
].join(',');

export async function GET(request: Request) {
  const host = request.headers.get('host') || 'meta-automation-saas.vercel.app';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const APP_URL = process.env.APP_URL || `${protocol}://${host}`;
  const REDIRECT_URI = process.env.META_FACEBOOK_REDIRECT_URI || `${APP_URL}/api/oauth/facebook/callback`;

  if (!FB_APP_ID) {
    return NextResponse.json(
      { error: 'server_misconfigured', message: 'META_APP_ID is not set in environment' },
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

