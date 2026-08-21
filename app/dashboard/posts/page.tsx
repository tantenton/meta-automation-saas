'use client';

import { useState, useEffect } from 'react';

export const dynamic = 'force-dynamic';

interface Post {
  id: string;
  platform: string;
  accountName?: string;
  caption: string;
  imageUrl?: string;
  mediaType?: string;
  scheduledAt?: string;
  publishedAt?: string;
  permalink?: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  errorMessage?: string;
  createdAt?: string;
}

interface Account {
  id: string;
  platform: string;
  account_name: string;
  account_id: string;
}

const platformColors: Record<string, { color: string; bg: string }> = {
  instagram: { color: '#e1306c', bg: '#3d0a1f' },
  facebook: { color: '#1877f2', bg: '#0a1a3d' },
  threads: { color: '#ffffff', bg: '#1a1a1a' },
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.1)' },
  scheduled: { label: 'Scheduled', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  published: { label: 'Published', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  failed: { label: 'Failed', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
};

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [caption, setCaption] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [publishNow, setPublishNow] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tone, setTone] = useState('inspiring');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchPosts = () => {
    setLoading(true);
    fetch(`/api/posts/list?status=${filterStatus}`)
      .then(r => r.json())
      .then(data => { setPosts(data.posts || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchPosts();
    // Load accounts
    fetch('/api/accounts/list')
      .then(r => r.json())
      .then(data => {
        const accs = data.accounts || [];
        setAccounts(accs);
        if (accs.length > 0) {
          setSelectedAccountId(accs[0].id);
          setPlatform(accs[0].platform || 'instagram');
        }
      })
      .catch(() => {});
  }, [filterStatus]);

  const generateCaption = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, caption, tone, imageUrl }),
      });
      const data = await res.json();
      if (data.caption) setCaption(data.caption);
    } catch (e) {
      setToast({ message: 'Failed to generate AI caption', type: 'error' });
    }
    setAiLoading(false);
  };

  const handleCreatePost = async () => {
    if (!caption.trim()) {
      setToast({ message: 'Please write a caption first', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/posts/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption,
          platform,
          accountId: selectedAccountId || undefined,
          imageUrl: imageUrl.trim() || undefined,
          scheduledAt: scheduledAt || undefined,
          publishNow,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setToast({ message: data.message || 'Post saved successfully!', type: 'success' });
        setCaption('');
        setImageUrl('');
        setScheduledAt('');
        setPublishNow(false);
        setShowComposer(false);
        fetchPosts();
      } else {
        setToast({ message: data.message || data.error || 'Failed to schedule post', type: 'error' });
      }
    } catch (e) {
      setToast({ message: 'Network error scheduling post', type: 'error' });
    }
    setSubmitting(false);
  };

  const handlePublishNow = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setToast({ message: 'Post published successfully to Meta!', type: 'success' });
        fetchPosts();
      } else {
        setToast({ message: data.message || data.error || 'Publish failed', type: 'error' });
      }
    } catch (e) {
      setToast({ message: 'Error publishing post', type: 'error' });
    }
    setActionLoadingId(null);
  };

  const handleDeletePost = async (id: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setToast({ message: 'Post deleted', type: 'success' });
        fetchPosts();
      }
    } catch (e) {
      setToast({ message: 'Failed to delete post', type: 'error' });
    }
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
          <h2 className="text-2xl font-bold text-white">Content & Post Scheduling</h2>
          <p className="text-sm text-zinc-400 mt-0.5">Compose, generate AI hooks, schedule, and live publish to Meta platforms</p>
        </div>
        <button
          onClick={() => setShowComposer(!showComposer)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20 hover:opacity-95 transition cursor-pointer"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          {showComposer ? 'Close Composer' : 'New Post'}
        </button>
      </div>

      {/* Post Composer */}
      {showComposer && (
        <div className="rounded-2xl p-6 border border-white/10 bg-[#111113] shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="font-semibold text-white">Compose Post</h3>
            <span className="text-xs text-indigo-400 font-medium">Meta Graph Engine</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Account Selector */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Target Account</label>
              {accounts.length > 0 ? (
                <select
                  value={selectedAccountId}
                  onChange={(e) => {
                    setSelectedAccountId(e.target.value);
                    const acc = accounts.find(a => a.id === e.target.value);
                    if (acc) setPlatform(acc.platform);
                  }}
                  className="w-full rounded-xl px-3.5 py-2.5 text-xs bg-[#09090b] border border-white/10 text-white outline-none focus:border-indigo-500"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      @{acc.account_name} ({acc.platform.toUpperCase()})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-amber-400 py-2">No connected accounts yet. Connect one in Accounts tab.</p>
              )}
            </div>

            {/* Platform Manual Select */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Platform</label>
              <div className="flex gap-2">
                {['instagram', 'facebook', 'threads'].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    className={`flex-1 py-2 rounded-xl text-xs font-medium capitalize border transition cursor-pointer ${
                      platform === p
                        ? 'border-indigo-500/80 bg-indigo-500/15 text-white'
                        : 'border-white/5 bg-white/[0.02] text-zinc-400 hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Caption Textarea */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-zinc-400">Post Caption</label>
              <span className="text-[11px] text-zinc-500">{caption.length} characters</span>
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write an engaging caption or topic..."
              rows={4}
              className="w-full rounded-xl px-4 py-3 text-sm text-white resize-none bg-[#09090b] border border-white/10 outline-none focus:border-indigo-500"
            />

            {/* AI Generation Toolbar */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="rounded-lg px-3 py-1.5 text-xs bg-[#09090b] border border-white/10 text-zinc-300 outline-none"
              >
                {['inspiring', 'casual', 'professional', 'humorous', 'witty'].map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)} Tone</option>
                ))}
              </select>

              <button
                type="button"
                onClick={generateCaption}
                disabled={aiLoading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 transition cursor-pointer disabled:opacity-50"
              >
                {aiLoading ? (
                  <div className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>✨</span>
                )}
                Generate AI Hook
              </button>
            </div>
          </div>

          {/* Media URL */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Media Image URL (Public HTTPS)</label>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/photo.jpg (required for Instagram)"
              className="w-full rounded-xl px-4 py-2.5 text-xs bg-[#09090b] border border-white/10 text-white outline-none focus:border-indigo-500"
            />
          </div>

          {/* Schedule Date or Publish Now */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Schedule for Later (Optional)</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                disabled={publishNow}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-xs bg-[#09090b] border border-white/10 text-zinc-300 outline-none disabled:opacity-40"
              />
            </div>

            <div className="flex items-center gap-3 pt-6">
              <label className="flex items-center gap-2 text-xs font-medium text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={publishNow}
                  onChange={(e) => {
                    setPublishNow(e.target.checked);
                    if (e.target.checked) setScheduledAt('');
                  }}
                  className="rounded border-white/20 bg-zinc-800 text-indigo-500 focus:ring-0"
                />
                <span>Publish Immediately to Meta</span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setShowComposer(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-zinc-400 bg-white/5 hover:bg-white/10 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreatePost}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20 hover:opacity-95 transition cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Processing...' : publishNow ? 'Publish to Meta Now' : scheduledAt ? 'Schedule Post' : 'Save as Draft'}
            </button>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        {['all', 'scheduled', 'published', 'draft', 'failed'].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium capitalize transition cursor-pointer ${
              filterStatus === st
                ? 'bg-white/10 text-white font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Posts Feed */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl p-10 flex flex-col items-center text-center border border-dashed border-white/10 bg-[#111113]">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-indigo-500/10 text-indigo-400">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </div>
          <p className="text-white font-medium text-sm">No posts in this view</p>
          <p className="text-xs text-zinc-500 mt-1 mb-4">Create your first automated post or schedule content</p>
          <button
            onClick={() => setShowComposer(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer"
          >
            Create Post
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const plt = platformColors[post.platform?.toLowerCase()] || { color: '#6b7280', bg: '#1a1a1a' };
            const sts = statusConfig[post.status] || statusConfig.draft;
            const isActing = actionLoadingId === post.id;

            return (
              <div key={post.id} className="rounded-2xl p-5 border border-white/10 bg-[#111113] shadow-lg flex flex-col sm:flex-row gap-4 justify-between">
                <div className="flex gap-4 min-w-0 flex-1">
                  {post.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.imageUrl} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0 border border-white/10" />
                  ) : (
                    <div className="w-20 h-20 rounded-xl shrink-0 flex items-center justify-center text-2xl border border-white/5" style={{ backgroundColor: plt.bg }}>
                      {post.platform === 'instagram' ? '📸' : post.platform === 'threads' ? '🧵' : '👥'}
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider" style={{ backgroundColor: plt.bg, color: plt.color }}>
                        {post.platform}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-medium" style={{ backgroundColor: sts.bg, color: sts.color }}>
                        {sts.label}
                      </span>
                      {post.accountName && (
                        <span className="text-xs text-zinc-400">@{post.accountName}</span>
                      )}
                    </div>

                    <p className="text-sm text-zinc-100 whitespace-pre-wrap line-clamp-3">{post.caption}</p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 pt-1">
                      {post.scheduledAt && (
                        <span>⏰ Scheduled: {new Date(post.scheduledAt).toLocaleString()}</span>
                      )}
                      {post.publishedAt && (
                        <span>✅ Published: {new Date(post.publishedAt).toLocaleString()}</span>
                      )}
                      {post.permalink && (
                        <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
                          View on {post.platform} ↗
                        </a>
                      )}
                      {post.errorMessage && (
                        <span className="text-red-400">Error: {post.errorMessage}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex sm:flex-col justify-end items-end gap-2 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-white/5">
                  {post.status !== 'published' && (
                    <button
                      onClick={() => handlePublishNow(post.id)}
                      disabled={isActing}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20 transition cursor-pointer disabled:opacity-50"
                    >
                      {isActing ? 'Publishing...' : 'Publish Now'}
                    </button>
                  )}
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
