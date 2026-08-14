import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/server/supabase-admin';

export const dynamic = 'force-dynamic';

async function getDashboardStats() {
  try {
    const db = getSupabaseAdmin();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: totalPosts },
      { count: scheduledPosts },
      { count: publishedPosts },
      { count: totalAccounts },
      { count: weekPosts },
    ] = await Promise.all([
      db.from('posts').select('*', { count: 'exact', head: true }),
      db.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'scheduled'),
      db.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'published'),
      db.from('accounts').select('*', { count: 'exact', head: true }).eq('is_active', true),
      db.from('posts').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    ]);

    return {
      totalPosts: totalPosts ?? 0,
      scheduledPosts: scheduledPosts ?? 0,
      publishedPosts: publishedPosts ?? 0,
      totalAccounts: totalAccounts ?? 0,
      weekPosts: weekPosts ?? 0,
    };
  } catch {
    return { totalPosts: 0, scheduledPosts: 0, publishedPosts: 0, totalAccounts: 0, weekPosts: 0 };
  }
}

const quickActions = [
  { label: 'Schedule Post', href: '/dashboard/posts', desc: 'Create and schedule a new post', color: '#6366f1' },
  { label: 'Connect Account', href: '/dashboard/accounts', desc: 'Link Instagram, Facebook or Threads', color: '#8b5cf6' },
  { label: 'View Analytics', href: '/dashboard/analytics', desc: 'See your engagement metrics', color: '#10b981' },
];

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  const statCards = [
    {
      label: 'Total Posts',
      value: String(stats.totalPosts),
      change: `+${stats.weekPosts} this week`,
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      ),
      color: '#6366f1',
      bg: '#1e1b4b',
    },
    {
      label: 'Scheduled',
      value: String(stats.scheduledPosts),
      change: 'Next 7 days',
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ),
      color: '#8b5cf6',
      bg: '#1e1a38',
    },
    {
      label: 'Published',
      value: String(stats.publishedPosts),
      change: 'All time',
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ),
      color: '#10b981',
      bg: '#064e3b',
    },
    {
      label: 'Accounts',
      value: String(stats.totalAccounts),
      change: 'Connected',
      icon: (
        <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
      color: '#f59e0b',
      bg: '#451a03',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">Welcome back 👋</h2>
        <p className="mt-1 text-sm" style={{ color: '#6b7280' }}>
          Here&apos;s what&apos;s happening with your social accounts today.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl p-5 flex flex-col gap-3"
            style={{ backgroundColor: '#111111', border: '1px solid #1f1f1f' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: '#9ca3af' }}>{stat.label}</span>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: stat.bg, color: stat.color }}>
                {stat.icon}
              </div>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">{stat.value}</p>
              <p className="text-xs mt-1" style={{ color: '#6b7280' }}>{stat.change}</p>
            </div>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-base font-semibold text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-2xl p-5 flex flex-col gap-2 transition-all hover:scale-[1.02]"
              style={{ backgroundColor: '#111111', border: '1px solid #1f1f1f' }}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: action.color }} />
              <p className="font-semibold text-white text-sm">{action.label}</p>
              <p className="text-xs" style={{ color: '#6b7280' }}>{action.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {stats.totalAccounts === 0 && (
        <div
          className="rounded-2xl p-10 flex flex-col items-center justify-center text-center"
          style={{ backgroundColor: '#111111', border: '1px dashed #2a2a2a' }}
        >
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#1e1b4b' }}>
            <svg width="28" height="28" fill="none" stroke="#6366f1" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </div>
          <p className="text-white font-semibold">No activity yet</p>
          <p className="text-sm mt-1 mb-5" style={{ color: '#6b7280' }}>
            Connect your social accounts and start scheduling posts
          </p>
          <Link
            href="/dashboard/accounts"
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            Connect Account
          </Link>
        </div>
      )}
    </div>
  );
}
