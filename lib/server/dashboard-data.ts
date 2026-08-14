import 'server-only';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export type DashboardAccount = {
  id: string;
  platform: string;
  account_id: string;
  account_name: string | null;
  is_active: boolean;
  follower_count: number | null;
  token_expires_at: string | null;
  created_at: string;
};

export type DashboardPost = {
  id: string;
  account_id: string;
  content: string;
  media_url: string[] | null;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  permalink: string | null;
  created_at: string;
  accounts: { platform: string; account_name: string | null } | null;
};

export async function getDashboardAccounts(): Promise<DashboardAccount[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('accounts')
    .select('id,platform,account_id,account_name,is_active,follower_count,token_expires_at,created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`accounts_query_failed: ${error.message}`);
  return (data ?? []) as DashboardAccount[];
}

export async function getDashboardPosts(limit = 20): Promise<DashboardPost[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('posts')
    .select('id,account_id,content,media_url,status,scheduled_at,published_at,permalink,created_at,accounts(platform,account_name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`posts_query_failed: ${error.message}`);
  return (data ?? []) as unknown as DashboardPost[];
}

export async function getDashboardSummary() {
  const db = getSupabaseAdmin();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const [accounts, allPosts, published, scheduled, weekPosts, recentPosts] = await Promise.all([
    db.from('accounts').select('*', { count: 'exact', head: true }).eq('is_active', true),
    db.from('posts').select('*', { count: 'exact', head: true }),
    db.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    db.from('posts').select('*', { count: 'exact', head: true }).in('status', ['queued', 'scheduled']).lte('scheduled_at', sevenDaysAhead),
    db.from('posts').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    getDashboardPosts(6),
  ]);

  const firstError = [accounts.error, allPosts.error, published.error, scheduled.error, weekPosts.error].find(Boolean);
  if (firstError) throw new Error(`dashboard_summary_failed: ${firstError.message}`);

  return {
    accounts: accounts.count ?? 0,
    totalPosts: allPosts.count ?? 0,
    published: published.count ?? 0,
    scheduled: scheduled.count ?? 0,
    weekPosts: weekPosts.count ?? 0,
    recentPosts,
  };
}
