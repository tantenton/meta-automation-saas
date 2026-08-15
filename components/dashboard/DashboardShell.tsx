'use client';

import { useState } from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <Sidebar mobileOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      {menuOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className="min-h-screen lg:pl-64">
        <Header onMenuOpen={() => setMenuOpen(true)} />
        <main className="mx-auto w-full max-w-[1600px] px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">
          {children}
        </main>
      </div>
    </div>
  );
}
