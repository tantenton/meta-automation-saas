'use client';

import React, { useState, useEffect } from 'react';
import ConnectAccountModal from '@/components/dashboard/ConnectAccountModal';

type PlatformKey = 'instagram' | 'facebook' | 'threads';

const platformConfig: Record<PlatformKey, { label: string; color: string; bg: string; badge: string; icon: React.ReactElement }> = {
  instagram: {
    label: 'Instagram',
    color: '#e1306c',
    bg: '#3d0a1f',
    badge: 'from-yellow-500 via-pink-600 to-purple-600',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
      </svg>
    ),
  },
  facebook: {
    label: 'Facebook',
    color: '#1877f2',
    bg: '#0a1a3d',
    badge: 'bg-blue-600',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  threads: {
    label: 'Threads',
    color: '#ffffff',
    bg: '#1a1a1a',
    badge: 'bg-zinc-800',
    icon: (
      <svg width="20" height="20" viewBox="0 0 192 192" fill="currentColor">
        <path d="M141.537 88.9883C140.71 88.5919 139.87 88.2104 139.019 87.8451C137.537 60.5382 122.616 44.905 97.5619 44.745C97.4484 44.7443 97.3355 44.7443 97.222 44.7443C82.0362 44.7443 69.9171 51.1466 62.7183 62.7456L75.9388 71.1288C81.2283 62.6764 89.6285 60.6708 97.2286 60.6708C97.3051 60.6708 97.3819 60.6708 97.4576 60.6719C106.886 60.7327 114.012 63.7346 118.581 69.5806C121.915 73.8065 124.111 79.6756 125.14 87.0497C118.573 85.9948 111.516 85.6618 104.025 86.063C80.7112 87.3109 65.6543 101.079 66.6799 120.061C67.1995 129.698 71.7851 137.94 79.6252 143.275C86.2628 147.855 94.795 150.088 103.749 149.627C115.714 149.012 124.972 144.581 131.193 136.435C135.912 130.279 138.947 122.369 140.357 112.489C146.044 115.998 150.273 120.77 152.574 126.661C156.55 136.847 156.808 153.797 143.396 167.097C131.588 178.793 117.409 183.964 96.3417 184.12C72.9905 183.943 55.2932 176.363 43.7343 161.595C32.8541 147.658 27.3105 127.35 27.0949 101.333C27.3105 75.3162 32.8541 55.0079 43.7343 41.071C55.2932 26.3031 72.9905 18.7228 96.3417 18.5457C119.865 18.7232 137.771 26.334 149.541 41.1435C155.318 48.4145 159.658 57.5762 162.494 68.3927L178.084 64.2551C174.655 50.5898 169.131 38.8754 161.44 29.3123C146.468 10.7085 125.074 1.17803 96.4203 1C67.891 1.17803 46.4368 10.7373 31.6784 29.4207C18.4731 45.8795 11.7086 68.9842 11.5 98.9998V99.0001V99.0004C11.7086 129.016 18.4731 152.12 31.6784 168.579C46.4368 187.263 67.891 196.822 96.4203 197C125.326 196.818 146.956 187.181 161.71 168.543C175.56 151.014 176.408 129.614 171.164 115.016C167.453 104.838 160.102 96.6711 149.801 91.5817C149.801 91.5817 145.696 89.6947 141.537 88.9883ZM103.353 133.736C95.3618 134.162 87.0261 131.159 84.0017 124.946C82.016 120.876 82.1448 115.028 85.5714 110.86C89.8044 105.722 97.9122 103.113 109.44 103.694C112.968 103.878 116.34 104.284 119.524 104.898C117.875 123.408 111.379 133.29 103.353 133.736Z"/>
      </svg>
    ),
  },
};

interface Account {
  id: string;
  platform: string;
  account_id: string;
  account_name: string;
  profile_picture_url?: string;
  follower_count?: number;
  is_active: boolean;
  token_expires_at?: string;
  created_at: string;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchAccounts = () => {
    setLoading(true);
    fetch('/api/accounts/list')
      .then(r => r.json())
      .then(data => { setAccounts(data.accounts || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchAccounts();

    // Check OAuth return status in URL
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const status = params.get('status');
      const reason = params.get('reason');

      if (status && status.includes('connected')) {
        setToast({ message: `Successfully connected ${status.replace('_connected', '').toUpperCase()} account!`, type: 'success' });
        window.history.replaceState({}, '', '/dashboard/accounts');
      } else if (status && status.includes('error')) {
        setToast({ message: `OAuth Connection Failed: ${reason || status}`, type: 'error' });
        window.history.replaceState({}, '', '/dashboard/accounts');
      }
    }
  }, []);

  const handleDisconnect = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to disconnect @${name}?`)) return;
    try {
      const res = await fetch(`/api/accounts/list?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setToast({ message: `Disconnected @${name}`, type: 'success' });
        fetchAccounts();
      }
    } catch (e) {
      setToast({ message: 'Failed to disconnect account', type: 'error' });
    }
  };

  const startOAuth = (platform: PlatformKey) => {
    window.location.href = `/api/oauth/${platform}/start`;
  };

  const platformInfo = (platform: string) => {
    const key = platform.toLowerCase() as PlatformKey;
    return platformConfig[key] || {
      label: platform,
      color: '#6b7280',
      bg: '#1a1a1a',
      badge: 'bg-zinc-700',
      icon: null,
    };
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
          toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'
        }`}>
          <div className="flex items-center gap-3">
            <span>{toast.type === 'success' ? '✅' : '⚠️'}</span>
            <p className="text-sm font-medium">{toast.message}</p>
          </div>
          <button onClick={() => setToast(null)} className="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Connected Meta Accounts</h2>
          <p className="text-sm text-zinc-400 mt-0.5">Manage your active Instagram, Facebook Pages, and Threads channels</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20 hover:opacity-95 transition cursor-pointer"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Connect Account
        </button>
      </div>

      {/* Direct Connect Quick Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(Object.entries(platformConfig) as [PlatformKey, typeof platformConfig[PlatformKey]][]).map(([key, cfg]) => {
          const connectedCount = accounts.filter(a => a.platform?.toLowerCase() === key).length;
          return (
            <div key={key} className="rounded-2xl p-5 flex flex-col justify-between gap-4 border border-white/10 bg-[#111113] shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                    {cfg.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{cfg.label}</p>
                    <p className="text-xs text-zinc-500">{connectedCount > 0 ? `${connectedCount} Active` : 'Not Connected'}</p>
                  </div>
                </div>
                {connectedCount > 0 && (
                  <span className="h-2 w-2 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20" />
                )}
              </div>
              <button
                onClick={() => startOAuth(key)}
                className="w-full py-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200 hover:text-white"
              >
                Connect {cfg.label}
              </button>
            </div>
          );
        })}
      </div>

      {/* Connected Accounts List */}
      <div className="rounded-2xl border border-white/10 bg-[#111113] p-6 shadow-xl space-y-4">
        <h3 className="font-semibold text-white">Active Authorized Channels ({accounts.length})</h3>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="rounded-xl p-10 flex flex-col items-center justify-center text-center border border-dashed border-white/10 bg-white/[0.01]">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-indigo-500/10 text-indigo-400">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <p className="text-white font-medium text-sm">No accounts connected yet</p>
            <p className="text-xs text-zinc-500 mt-1 mb-4">Connect your Meta Facebook, Instagram, or Threads account to begin scheduling</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer"
            >
              Connect First Account
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account) => {
              const cfg = platformInfo(account.platform);
              return (
                <div key={account.id} className="rounded-xl p-4 flex items-center justify-between gap-4 border border-white/5 bg-white/[0.02] hover:border-white/10 transition">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                      {cfg.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white text-sm truncate">@{account.account_name || account.account_id}</p>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                          Active
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5 capitalize">{account.platform} Channel • ID: {account.account_id}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleDisconnect(account.id, account.account_name || account.account_id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 transition cursor-pointer"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <ConnectAccountModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onConnect={(platform) => startOAuth(platform)}
        />
      )}
    </div>
  );
}
