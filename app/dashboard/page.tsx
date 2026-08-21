import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export const dynamic = 'force-dynamic';

async function getDashboardData() {
  try {
    const db = getSupabaseAdmin();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: totalPosts },
      { count: scheduledPosts },
      { count: publishedPosts },
      { count: totalAccounts },
      { count: weekPosts },
      { data: recentPosts },
      { data: connectedAccounts },
    ] = await Promise.all([
      db.from('posts').select('*', { count: 'exact', head: true }),
      db.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'scheduled'),
      db.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'published'),
      db.from('accounts').select('*', { count: 'exact', head: true }).eq('is_active', true),
      db.from('posts').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
      db.from('posts').select('id, content, status, scheduled_at, published_at, permalink, accounts(platform, account_name)').order('created_at', { ascending: false }).limit(4),
      db.from('accounts').select('id, platform, account_name, is_active').eq('is_active', true).limit(3),
    ]);

    return {
      stats: {
        totalPosts: totalPosts ?? 0,
        scheduledPosts: scheduledPosts ?? 0,
        publishedPosts: publishedPosts ?? 0,
        totalAccounts: totalAccounts ?? 0,
        weekPosts: weekPosts ?? 0,
      },
      recentPosts: recentPosts || [],
      connectedAccounts: connectedAccounts || [],
      isConfigured: true,
    };
  } catch (e) {
    return {
      stats: { totalPosts: 0, scheduledPosts: 0, publishedPosts: 0, totalAccounts: 0, weekPosts: 0 },
      recentPosts: [],
      connectedAccounts: [],
      isConfigured: false,
    };
  }
}

const quickActions = [
  { label: 'Schedule Post', href: '/dashboard/posts', desc: 'Create, draft or live-publish to Meta', color: '#6366f1' },
  { label: 'Connect Accounts', href: '/dashboard/accounts', desc: 'Link Instagram, Facebook or Threads', color: '#8b5cf6' },
  { label: 'View Analytics', href: '/dashboard/analytics', desc: 'Engagement metrics & reach charts', color: '#10b981' },
  { label: 'System Settings', href: '/dashboard/settings', desc: 'OAuth redirect URIs & diagnostics', color: '#f59e0b' },
];

export default async function DashboardPage() {
  const { stats, recentPosts, connectedAccounts, isConfigured } = await getDashboardData();

  const statCards = [
    {
      label: 'Total Posts',
      value: String(stats.totalPosts),
      change: `+${stats.weekPosts} this week`,
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      ),
      color: '#6366f1',
      bg: 'rgba(99, 102, 241, 0.12)',
    },
    {
      label: 'Scheduled',
      value: String(stats.scheduledPosts),
      change: 'Active in queue',
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ),
      color: '#8b5cf6',
      bg: 'rgba(139, 92, 246, 0.12)',
    },
    {
      label: 'Published',
      value: String(stats.publishedPosts),
      change: 'Live on Meta',
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ),
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.12)',
    },
    {
      label: 'Active Accounts',
      value: String(stats.totalAccounts),
      change: 'Authorized channels',
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.12)',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Meta Automation Control Center</h2>
          <p className="mt-1 text-sm text-zinc-400">
            BirruLabs autonomous multi-platform organic publisher and engagement hub.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/posts"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20 hover:opacity-95 transition"
          >
            + Create New Post
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl p-5 border border-white/10 bg-[#111113] shadow-lg flex flex-col justify-between gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">{stat.label}</span>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: stat.bg, color: stat.color }}>
                {stat.icon}
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-white tracking-tight">{stat.value}</p>
              <p className="text-[11px] mt-1 text-zinc-500">{stat.change}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-3 uppercase tracking-wider text-[11px]">Quick Management</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-2xl p-5 border border-white/10 bg-[#111113] hover:border-white/20 hover:bg-[#161619] transition-all flex flex-col gap-2 shadow-lg group"
            >
              <div className="w-2 h-2 rounded-full mb-1" style={{ backgroundColor: action.color }} />
              <p className="font-semibold text-white text-sm group-hover:text-indigo-300 transition">{action.label}</p>
              <p className="text-xs text-zinc-400">{action.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Connected Accounts & Recent Posts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Posts Column */}
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-[#111113] p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="font-semibold text-white">Recent Content Queue</h3>
            <Link href="/dashboard/posts" className="text-xs text-indigo-400 hover:underline">
              View All Posts →
            </Link>
          </div>

          {recentPosts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-zinc-400">No scheduled or published posts yet.</p>
              <Link href="/dashboard/posts" className="inline-block mt-3 px-3.5 py-1.5 rounded-lg text-xs font-medium text-indigo-300 bg-indigo-500/10 border border-indigo-500/20">
                Compose Post
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentPosts.map((p: any) => {
                const acc = Array.isArray(p.accounts) ? p.accounts[0] : p.accounts;
                return (
                  <div key={p.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-white/5 text-zinc-300">
                          {acc?.platform || 'Post'}
                        </span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                          p.status === 'published' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {p.status}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-200 truncate mt-1.5">{p.content}</p>
                    </div>
                    {p.permalink && (
                      <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-indigo-400 hover:underline">
                        View ↗
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Authorized Channels Summary */}
        <div className="rounded-2xl border border-white/10 bg-[#111113] p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="font-semibold text-white">Channel Fleet</h3>
            <Link href="/dashboard/accounts" className="text-xs text-indigo-400 hover:underline">
              Manage →
            </Link>
          </div>

          {connectedAccounts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-zinc-400 mb-3">No channels connected yet.</p>
              <Link href="/dashboard/accounts" className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700">
                Connect Channel
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {connectedAccounts.map((acc: any) => (
                <div key={acc.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">@{acc.account_name}</p>
                      <p className="text-[10px] text-zinc-500 capitalize">{acc.platform}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-medium">Ready</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
