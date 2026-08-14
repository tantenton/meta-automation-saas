import Link from 'next/link';
import { getDashboardSummary } from '@/lib/server/dashboard-data';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let data: Awaited<ReturnType<typeof getDashboardSummary>> | null = null;
  let error: string | null = null;
  try {
    data = await getDashboardSummary();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const stats = [
    { label: 'Total Posts', value: data?.totalPosts ?? '—', change: data ? `+${data.weekPosts} this week` : 'Database unavailable', color: '#6366f1', bg: '#1e1b4b' },
    { label: 'Scheduled', value: data?.scheduled ?? '—', change: 'Next 7 days', color: '#8b5cf6', bg: '#1e1a38' },
    { label: 'Published', value: data?.published ?? '—', change: 'All time', color: '#10b981', bg: '#064e3b' },
    { label: 'Accounts', value: data?.accounts ?? '—', change: 'Active connections', color: '#f59e0b', bg: '#451a03' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Operations overview</h2>
          <p className="mt-1 text-sm text-zinc-500">Live data from Supabase. No placeholder metrics.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${error ? 'bg-red-950 text-red-300' : 'bg-emerald-950 text-emerald-300'}`}>
          {error ? 'Database issue' : 'Live'}
        </span>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">
          Dashboard data could not be loaded. Check `/api/v1/health` and Supabase configuration.
          <div className="mt-1 text-xs text-red-400">{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-zinc-800 bg-[#111] p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-400">{stat.label}</span>
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: stat.color, boxShadow: `0 0 18px ${stat.color}` }} />
            </div>
            <p className="mt-5 text-3xl font-bold text-white">{stat.value}</p>
            <p className="mt-1 text-xs text-zinc-500">{stat.change}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_.6fr]">
        <section className="rounded-2xl border border-zinc-800 bg-[#111] p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">Recent jobs</h3>
              <p className="text-xs text-zinc-500">Latest publish and scheduling activity</p>
            </div>
            <Link href="/dashboard/posts" className="text-xs font-medium text-indigo-400 hover:text-indigo-300">View all</Link>
          </div>
          {!data?.recentPosts.length ? (
            <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">No post jobs yet.</div>
          ) : (
            <div className="space-y-2">
              {data.recentPosts.map((post) => (
                <div key={post.id} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-black/20 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-200">{post.content}</p>
                    <p className="mt-1 text-xs text-zinc-600">{post.accounts?.platform ?? 'unknown'} · {new Date(post.created_at).toLocaleString()}</p>
                  </div>
                  <span className="rounded-full bg-zinc-900 px-2.5 py-1 text-xs capitalize text-zinc-300">{post.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-[#111] p-5">
          <h3 className="font-semibold text-white">Quick actions</h3>
          <div className="mt-4 space-y-3">
            <Link href="/dashboard/posts" className="block rounded-xl border border-indigo-900 bg-indigo-950/40 p-4 hover:bg-indigo-950/60">
              <p className="text-sm font-medium text-indigo-200">Create or schedule post</p>
              <p className="mt-1 text-xs text-indigo-400">Use real accounts and job queue</p>
            </Link>
            <Link href="/dashboard/accounts" className="block rounded-xl border border-violet-900 bg-violet-950/40 p-4 hover:bg-violet-950/60">
              <p className="text-sm font-medium text-violet-200">Manage connected accounts</p>
              <p className="mt-1 text-xs text-violet-400">Check token and connection state</p>
            </Link>
            <Link href="/dashboard/analytics" className="block rounded-xl border border-emerald-900 bg-emerald-950/40 p-4 hover:bg-emerald-950/60">
              <p className="text-sm font-medium text-emerald-200">Open analytics</p>
              <p className="mt-1 text-xs text-emerald-400">Review real performance data</p>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
