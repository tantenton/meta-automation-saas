'use client';

import { usePathname } from 'next/navigation';

const breadcrumbs: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/posts': 'Posts',
  '/dashboard/accounts': 'Accounts',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/settings': 'Settings',
};

export default function Header({ onMenuOpen }: { onMenuOpen: () => void }) {
  const pathname = usePathname();
  const title = breadcrumbs[pathname] || 'Dashboard';

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#09090b]/90 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={onMenuOpen} aria-label="Open navigation" className="shrink-0 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-zinc-300 hover:bg-white/[0.07] lg:hidden">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-white sm:text-lg">{title}</h1>
            <p className="hidden text-xs text-zinc-500 sm:block">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1.5 text-[11px] font-medium text-emerald-300 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            System online
          </div>
          <button aria-label="Notifications" className="relative rounded-xl p-2.5 text-zinc-400 hover:bg-white/[0.05] hover:text-white">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-indigo-400 ring-2 ring-[#09090b]" />
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white shadow-lg shadow-indigo-500/20">B</div>
        </div>
      </div>
    </header>
  );
}
