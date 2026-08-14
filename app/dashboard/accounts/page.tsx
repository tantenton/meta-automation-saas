import Link from 'next/link';
import { getDashboardAccounts } from '@/lib/server/dashboard-data';

export const dynamic = 'force-dynamic';

const platforms = [
  { id: 'instagram', label: 'Instagram', color: '#e1306c' },
  { id: 'threads', label: 'Threads', color: '#ffffff' },
  { id: 'facebook', label: 'Facebook', color: '#1877f2' },
];

export default async function AccountsPage() {
  let accounts: Awaited<ReturnType<typeof getDashboardAccounts>> = [];
  let error: string | null = null;
  try {
    accounts = await getDashboardAccounts();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Connected accounts</h2>
          <p className="mt-1 text-sm text-zinc-500">Live account records and token health from Supabase.</p>
        </div>
        <Link href="/dashboard/accounts?refresh=1" className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800">Refresh data</Link>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-200">
          Failed to load accounts. Check `/api/v1/health` and Supabase environment.
          <div className="mt-1 text-xs text-red-400">{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {platforms.map((platform) => {
          const connected = accounts.filter((account) => account.platform === platform.id && account.is_active);
          return (
            <div key={platform.id} className="rounded-2xl border border-zinc-800 bg-[#111] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{platform.label}</p>
                  <p className="mt-1 text-xs text-zinc-500">{connected.length ? `${connected.length} active account${connected.length > 1 ? 's' : ''}` : 'Not connected'}</p>
                </div>
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: connected.length ? '#10b981' : '#3f3f46', boxShadow: connected.length ? '0 0 16px #10b981' : undefined }} />
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-zinc-900">
                <div className="h-full rounded-full" style={{ width: connected.length ? '100%' : '0%', backgroundColor: platform.color }} />
              </div>
            </div>
          );
        })}
      </div>

      <section className="rounded-2xl border border-zinc-800 bg-[#111] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">Account registry</h3>
            <p className="text-xs text-zinc-500">Secrets are never exposed in this view.</p>
          </div>
          <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-400">{accounts.length} total</span>
        </div>

        {!accounts.length ? (
          <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center">
            <p className="font-medium text-white">No accounts stored yet</p>
            <p className="mt-1 text-sm text-zinc-500">Connect Instagram or Threads through the secure API/OAuth setup.</p>
            <p className="mt-4 text-xs text-zinc-600">The previous Connect button was cosmetic; it has been removed until OAuth is actually wired.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => {
              const expired = account.token_expires_at ? new Date(account.token_expires_at).getTime() <= Date.now() : false;
              const platform = platforms.find((item) => item.id === account.platform);
              return (
                <div key={account.id} className="grid gap-4 rounded-xl border border-zinc-800 bg-black/20 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: platform?.color ?? '#71717a' }} />
                      <p className="truncate text-sm font-medium text-white">{account.account_name || account.account_id}</p>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">{account.platform} · ID {account.account_id}</p>
                    <p className="mt-1 text-xs text-zinc-600">Followers: {account.follower_count ?? 0} · Added {new Date(account.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs ${account.is_active ? 'bg-emerald-950 text-emerald-300' : 'bg-zinc-900 text-zinc-500'}`}>{account.is_active ? 'Active' : 'Disabled'}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs ${expired ? 'bg-red-950 text-red-300' : 'bg-indigo-950 text-indigo-300'}`}>{expired ? 'Token expired' : account.token_expires_at ? `Token until ${new Date(account.token_expires_at).toLocaleDateString()}` : 'Expiry unknown'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
