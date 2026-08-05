'use client';

import { usePathname } from 'next/navigation';

const breadcrumbs: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/posts': 'Posts',
  '/dashboard/accounts': 'Accounts',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/settings': 'Settings',
};

export default function Header() {
  const pathname = usePathname();
  const title = breadcrumbs[pathname] || 'Dashboard';

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b" style={{ backgroundColor: '#0f0f0f', borderColor: '#222' }}>
      <div>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button className="relative p-2 rounded-lg transition-colors" style={{ color: '#9ca3af' }}>
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ backgroundColor: '#6366f1' }}/>
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white cursor-pointer" style={{ backgroundColor: '#6366f1' }}>
          U
        </div>
      </div>
    </header>
  );
}
