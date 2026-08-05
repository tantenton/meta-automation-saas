'use client';

import { useState, useEffect } from 'react';

export const dynamic = 'force-dynamic';

interface Post {
  id: string;
  platform: string;
  caption: string;
  imageUrl?: string;
  scheduledAt: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
}

const platformColors: Record<string, { color: string; bg: string }> = {
  instagram: { color: '#e1306c', bg: '#3d0a1f' },
  facebook: { color: '#1877f2', bg: '#0a1a3d' },
  threads: { color: '#ffffff', bg: '#1a1a1a' },
};

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#9ca3af', bg: '#1f2937' },
  scheduled: { label: 'Scheduled', color: '#f59e0b', bg: '#451a03' },
  published: { label: 'Published', color: '#10b981', bg: '#064e3b' },
  failed: { label: 'Failed', color: '#ef4444', bg: '#450a0a' },
};

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [caption, setCaption] = useState('');
  const [platform, setPlatform] = useState('instagram');
  const [imageUrl, setImageUrl] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tone, setTone] = useState('inspiring');

  useEffect(() => {
    fetch('/api/posts/list')
      .then(r => r.json())
      .then(data => { setPosts(data.posts || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const generateCaption = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, caption, tone }),
      });
      const data = await res.json();
      if (data.caption) setCaption(data.caption);
    } catch (e) {}
    setAiLoading(false);
  };

  const schedulePost = async () => {
    if (!caption || !platform) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/posts/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption, platform, imageUrl, scheduledAt }),
      });
      const data = await res.json();
      if (data.post) {
        setPosts(prev => [data.post, ...prev]);
        setCaption(''); setImageUrl(''); setScheduledAt(''); setShowComposer(false);
      }
    } catch (e) {}
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Posts</h2>
          <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Schedule and manage your content</p>
        </div>
        <button
          onClick={() => setShowComposer(!showComposer)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          New Post
        </button>
      </div>

      {/* Composer */}
      {showComposer && (
        <div className="rounded-2xl p-6 space-y-4" style={{ backgroundColor: '#111111', border: '1px solid #1f1f1f' }}>
          <h3 className="font-semibold text-white">Create Post</h3>

          {/* Platform */}
          <div className="flex gap-2">
            {['instagram', 'facebook', 'threads'].map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
                style={{
                  backgroundColor: platform === p ? (platformColors[p]?.bg || '#1a1a1a') : '#1a1a1a',
                  color: platform === p ? (platformColors[p]?.color || '#fff') : '#6b7280',
                  border: `1px solid ${platform === p ? (platformColors[p]?.color + '44' || '#333') : '#2a2a2a'}`,
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Caption */}
          <div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write your caption..."
              rows={4}
              className="w-full rounded-xl px-4 py-3 text-sm text-white resize-none outline-none"
              style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e5e7eb' }}
            />
            {/* AI Tone + Generate */}
            <div className="flex items-center gap-2 mt-2">
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="flex-1 rounded-lg px-3 py-2 text-xs outline-none"
                style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', color: '#9ca3af' }}
              >
                {['inspiring', 'casual', 'professional', 'humorous', 'witty'].map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
              <button
                onClick={generateCaption}
                disabled={aiLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all"
                style={{ backgroundColor: '#1e1b4b', color: '#818cf8', border: '1px solid #6366f133' }}
              >
                {aiLoading ? (
                  <div className="w-3 h-3 border rounded-full animate-spin" style={{ borderColor: '#818cf8', borderTopColor: 'transparent' }}/>
                ) : (
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/>
                  </svg>
                )}
                AI Caption
              </button>
            </div>
          </div>

          {/* Image URL */}
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="Image URL (optional)"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e5e7eb' }}
          />

          {/* Schedule */}
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', color: '#9ca3af' }}
          />

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowComposer(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium"
              style={{ backgroundColor: '#1a1a1a', color: '#9ca3af' }}
            >
              Cancel
            </button>
            <button
              onClick={schedulePost}
              disabled={!caption || !platform || submitting}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              {submitting ? 'Scheduling...' : scheduledAt ? 'Schedule' : 'Save Draft'}
            </button>
          </div>
        </div>
      )}

      {/* Posts List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: '#6366f1', borderTopColor: 'transparent' }}/>
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl p-10 flex flex-col items-center text-center" style={{ backgroundColor: '#111111', border: '1px dashed #2a2a2a' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#1e1b4b' }}>
            <svg width="28" height="28" fill="none" stroke="#6366f1" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </div>
          <p className="text-white font-semibold">No posts yet</p>
          <p className="text-sm mt-1 mb-5" style={{ color: '#6b7280' }}>Create your first post to get started</p>
          <button
            onClick={() => setShowComposer(true)}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            Create Post
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const plt = platformColors[post.platform] || { color: '#6b7280', bg: '#1a1a1a' };
            const sts = statusConfig[post.status] || statusConfig.draft;
            return (
              <div key={post.id} className="rounded-2xl p-4 flex gap-4" style={{ backgroundColor: '#111111', border: '1px solid #1f1f1f' }}>
                {post.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.imageUrl} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0"/>
                ) : (
                  <div className="w-16 h-16 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: plt.bg }}>
                    <span className="text-xl">{post.platform === 'instagram' ? '📸' : post.platform === 'threads' ? '🧵' : '👥'}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium capitalize" style={{ backgroundColor: plt.bg, color: plt.color }}>
                      {post.platform}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: sts.bg, color: sts.color }}>
                      {sts.label}
                    </span>
                  </div>
                  <p className="text-sm text-white line-clamp-2">{post.caption}</p>
                  {post.scheduledAt && (
                    <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
                      {new Date(post.scheduledAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
