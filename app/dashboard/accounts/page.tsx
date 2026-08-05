'use client';

import React, { useState, useEffect } from 'react';
import ConnectAccountModal from '@/components/dashboard/ConnectAccountModal';

const platformConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactElement }> = {
  instagram: {
    label: 'Instagram',
    color: '#e1306c',
    bg: '#3d0a1f',
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
  username: string;
  status: string;
  followers?: number;
  posts?: number;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetch('/api/accounts/list')
      .then(r => r.json())
      .then(data => { setAccounts(data.accounts || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const platformInfo = (platform: string) => platformConfig[platform] || {
    label: platform,
    color: '#6b7280',
    bg: '#1a1a1a',
    icon: null,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Connected Accounts</h2>
          <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Manage your social media accounts</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Add Account
        </button>
      </div>

      {/* Platform Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Object.entries(platformConfig).map(([key, cfg]) => (
          <div key={key} className="rounded-2xl p-5 flex flex-col gap-3" style={{ backgroundColor: '#111111', border: '1px solid #1f1f1f' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                {cfg.icon}
              </div>
              <div>
                <p className="font-semibold text-white text-sm">{cfg.label}</p>
                <p className="text-xs" style={{ color: '#6b7280' }}>Not connected</p>
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="w-full py-2 rounded-xl text-xs font-medium transition-all"
              style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}22` }}
            >
              Connect {cfg.label}
            </button>
          </div>
        ))}
      </div>

      {/* Account List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: '#6366f1', borderTopColor: 'transparent' }}/>
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-2xl p-10 flex flex-col items-center justify-center text-center" style={{ backgroundColor: '#111111', border: '1px dashed #2a2a2a' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#1e1b4b' }}>
            <svg width="28" height="28" fill="none" stroke="#6366f1" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <p className="text-white font-semibold">No accounts connected</p>
          <p className="text-sm mt-1 mb-5" style={{ color: '#6b7280' }}>Connect your social accounts to start scheduling</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            Connect Account
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => {
            const cfg = platformInfo(account.platform);
            return (
              <div key={account.id} className="rounded-2xl p-4 flex items-center gap-4" style={{ backgroundColor: '#111111', border: '1px solid #1f1f1f' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                  {cfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm">@{account.username}</p>
                  <p className="text-xs" style={{ color: '#6b7280' }}>{cfg.label}</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: '#064e3b', color: '#10b981' }}>
                  Connected
                </span>
              </div>
            );
          })}
        </div>
      )}

      {showModal && <ConnectAccountModal isOpen={showModal} onClose={() => setShowModal(false)} onConnect={() => setShowModal(false)} />}
    </div>
  );
}
