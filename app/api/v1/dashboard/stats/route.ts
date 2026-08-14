import { NextRequest, NextResponse } from 'next/server';
import { authorizeMachine } from '@/lib/server/api-auth';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const denied = authorizeMachine(request);
  if (denied) return denied;

  const db = getSupabaseAdmin();

  const [
    { count: totalPosts },
    { count: scheduledPosts },
    { count: publishedPosts },
    { count: totalAccounts },
  ] = await Promise.all([
    db.from('posts').select('*', { count: 'exact', head: true }),
    db.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'scheduled'),
    db.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    db.from('accounts').select('*', { count: 'exact', head: true }).eq('is_active', true),
  ]);

  // Posts created in last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: weekPosts } = await db
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', sevenDaysAgo);

  return NextResponse.json({
    total_posts: totalPosts ?? 0,
    scheduled_posts: scheduledPosts ?? 0,
    published_posts: publishedPosts ?? 0,
    total_accounts: totalAccounts ?? 0,
    posts_this_week: weekPosts ?? 0,
  });
}
