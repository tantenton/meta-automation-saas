import { NextRequest, NextResponse } from 'next/server';
import { authorizeMachine } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';
import { decryptToken, encryptToken } from '@/lib/server/token-crypto';

const THREADS_GRAPH = 'https://graph.threads.net';
const FACEBOOK_GRAPH = 'https://graph.facebook.com/v23.0';
const INSTAGRAM_GRAPH = 'https://graph.instagram.com';

async function refreshThreadsToken(token: string): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const res = await fetch(`${THREADS_GRAPH}/refresh_access_token?grant_type=th_refresh_token&access_token=${token}`);
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function refreshFacebookToken(token: string): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const appId = process.env.META_APP_ID!;
    const appSecret = process.env.META_APP_SECRET!;
    const res = await fetch(`${FACEBOOK_GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${token}`);
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function refreshInstagramToken(token: string): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const res = await fetch(`${INSTAGRAM_GRAPH}/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`);
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  const denied = authorizeMachine(request); if (denied) return denied;
  const db = getSupabaseAdmin();

  // Get all active accounts
  const { data: accounts } = await db.from('accounts')
    .select('*')
    .eq('is_active', true)
    .in('platform', ['threads', 'facebook', 'instagram']);

  if (!accounts?.length) return NextResponse.json({ message: 'no_accounts', refreshed: 0 });

  const results = [];
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  for (const account of accounts) {
    const expiresAt = account.token_expires_at ? new Date(account.token_expires_at) : new Date(now.getTime() + 1000); // treat null as expired
    const needsRefresh = !account.token_expires_at || expiresAt <= sevenDaysFromNow;

    if (!needsRefresh) {
      results.push({ id: account.id, platform: account.platform, username: account.account_name, status: 'ok', expires_at: expiresAt?.toISOString() });
      continue;
    }

    try {
      const token = decryptToken(account.access_token_encrypted);
      let refreshed = null;

      if (account.platform === 'threads') {
        refreshed = await refreshThreadsToken(token);
      } else if (account.platform === 'facebook') {
        refreshed = await refreshFacebookToken(token);
      } else if (account.platform === 'instagram') {
        refreshed = await refreshInstagramToken(token);
      }

      if (!refreshed) {
        results.push({ id: account.id, platform: account.platform, username: account.account_name, status: 'refresh_failed' });
        continue;
      }

      const newExpiresAt = new Date(now.getTime() + (refreshed.expires_in || 5184000) * 1000).toISOString();
      const encryptedToken = encryptToken(refreshed.access_token);

      await db.from('accounts').update({
        access_token_encrypted: encryptedToken,
        token_expires_at: newExpiresAt,
        token_last_validated_at: now.toISOString(),
      }).eq('id', account.id);

      results.push({
        id: account.id,
        platform: account.platform,
        username: account.account_name,
        status: 'refreshed',
        expires_at: newExpiresAt,
      });
    } catch (err) {
      results.push({ id: account.id, platform: account.platform, username: account.account_name, status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  const refreshed = results.filter(r => r.status === 'refreshed').length;
  const failed = results.filter(r => r.status === 'refresh_failed' || r.status === 'error').length;

  return NextResponse.json({ refreshed, failed, total: results.length, results });
}
