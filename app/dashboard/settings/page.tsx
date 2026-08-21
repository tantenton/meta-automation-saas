'use client';

import { useState, useEffect } from 'react';

interface HealthStatus {
  ok: boolean;
  service: string;
  configured: boolean;
  database: string;
  missing?: string[];
  database_error?: string;
  time?: string;
}

export default function SettingsPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/health')
      .then(r => r.json())
      .then(data => { setHealth(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://meta-automation-saas.vercel.app';

  const oauthEndpoints = [
    { platform: 'Facebook', url: `${appUrl}/api/oauth/facebook/callback`, key: 'fb' },
    { platform: 'Instagram', url: `${appUrl}/api/oauth/instagram/callback`, key: 'ig' },
    { platform: 'Threads', url: `${appUrl}/api/oauth/threads/callback`, key: 'threads' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">System Settings & Diagnostics</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Environment configuration, Meta OAuth redirect URIs, and backend health status.
        </p>
      </div>

      {/* Health Overview */}
      <div className="rounded-2xl border border-white/10 bg-[#111113] p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Backend Health & Database</h3>
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${health?.ok ? 'bg-emerald-400 ring-4 ring-emerald-400/20' : 'bg-amber-400 ring-4 ring-amber-400/20'}`} />
            <span className="text-xs font-medium text-zinc-300">
              {loading ? 'Checking...' : health?.ok ? 'All Systems Operational' : 'Action Required'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <p className="text-xs text-zinc-500 font-medium">Database Status</p>
            <p className={`mt-1 text-sm font-semibold capitalize ${health?.database === 'ok' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {health?.database || 'Unknown'}
            </p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <p className="text-xs text-zinc-500 font-medium">Service Architecture</p>
            <p className="mt-1 text-sm font-semibold text-indigo-400">
              Next.js 16 + Meta Graph API
            </p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <p className="text-xs text-zinc-500 font-medium">Token Storage Security</p>
            <p className="mt-1 text-sm font-semibold text-emerald-400">
              AES-256-GCM Encrypted
            </p>
          </div>
        </div>

        {health?.missing && health.missing.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
            <p className="text-xs font-semibold text-amber-400 mb-1">Missing Environment Variables on Vercel:</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {health.missing.map(m => (
                <span key={m} className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-mono text-amber-300">
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Meta OAuth Callbacks */}
      <div className="rounded-2xl border border-white/10 bg-[#111113] p-6 shadow-xl space-y-4">
        <div>
          <h3 className="font-semibold text-white">Meta Developer App OAuth Redirect URIs</h3>
          <p className="text-xs text-zinc-400 mt-1">
            Copy these exact redirect URIs into your Meta Developer App (Facebook Login & Instagram API settings):
          </p>
        </div>

        <div className="space-y-3">
          {oauthEndpoints.map(ep => (
            <div key={ep.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium text-zinc-400">{ep.platform} Redirect URI</span>
                <p className="text-xs font-mono text-indigo-300 truncate mt-0.5">{ep.url}</p>
              </div>
              <button
                onClick={() => copyToClipboard(ep.url, ep.key)}
                className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition"
              >
                {copied === ep.key ? '✓ Copied' : 'Copy URL'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Multi-Agent / Automation Integration */}
      <div className="rounded-2xl border border-white/10 bg-[#111113] p-6 shadow-xl space-y-4">
        <h3 className="font-semibold text-white">Multi-Agent & Fleet Access (Hermes & Antigravity)</h3>
        <p className="text-xs text-zinc-400">
          Machine workers and bots interact with this SaaS instance via secured Bearer tokens:
        </p>

        <div className="space-y-2 text-xs font-mono text-zinc-300 bg-[#09090b] rounded-xl p-4 border border-white/5">
          <p className="text-zinc-500"># Publish / Schedule Worker</p>
          <p>POST /api/v1/posts</p>
          <p className="text-zinc-500 mt-2"># Live Worker Execution</p>
          <p>POST /api/v1/scheduler/run</p>
          <p className="text-zinc-500 mt-2"># Automated Threads Reply</p>
          <p>POST /api/v1/threads-auto-reply</p>
        </div>
      </div>
    </div>
  );
}
