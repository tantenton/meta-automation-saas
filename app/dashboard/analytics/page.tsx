'use client';

import { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface ChartPoint {
  day: string;
  date: string;
  reach: number;
  engagement: number;
}

interface AnalyticsSummary {
  total_reach: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  posts_published: number;
}

interface TopPost {
  post_id: string;
  likes: number;
  reach: number;
  content: string;
  permalink: string | null;
  published_at: string | null;
}

interface AnalyticsData {
  chart_data: ChartPoint[];
  summary: AnalyticsSummary;
  top_posts: TopPost[];
  has_data: boolean;
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: '#1a1a2e', border: '1px solid #2a2a3e' }}>
        <p className="font-semibold text-white mb-1">{label}</p>
        {payload.map((p: TooltipPayloadItem) => (
          <p key={p.name} style={{ color: p.color }}>
            {p.name}: <span className="font-bold text-white">{p.value.toLocaleString()}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsPage() {
  const [activeMetric, setActiveMetric] = useState<'reach' | 'engagement'>('reach');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/analytics/summary')
      .then(r => r.json())
      .then((d: AnalyticsData) => { setData(d); setLoading(false); })
      .catch((e: unknown) => { setError(String(e)); setLoading(false); });
  }, []);

  const metricConfig = {
    reach: { label: 'Reach', color: '#6366f1' },
    engagement: { label: 'Engagement', color: '#8b5cf6' },
  };

  const summary = data?.summary;
  const engagementRate = summary && summary.total_reach > 0
    ? ((summary.total_likes + summary.total_comments + summary.total_shares) / summary.total_reach * 100).toFixed(1)
    : '0.0';

  const statCards = [
    { label: 'Total Reach', value: summary ? summary.total_reach.toLocaleString() : '\u2014', color: '#6366f1' },
    { label: 'Engagement Rate', value: engagementRate + '%', color: '#8b5cf6' },
    { label: 'Total Likes', value: summary ? summary.total_likes.toLocaleString() : '\u2014', color: '#10b981' },
    { label: 'Posts Published', value: summary ? String(summary.posts_published) : '\u2014', color: '#f59e0b' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Analytics</h2>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Track your social media performance</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="rounded-2xl p-4" style={{ backgroundColor: '#111111', border: '1px solid #1f1f1f' }}>
            <p className="text-xs mb-2" style={{ color: '#6b7280' }}>{stat.label}</p>
            <p className="text-2xl font-bold text-white">{loading ? '\u2026' : stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl p-6" style={{ backgroundColor: '#111111', border: '1px solid #1f1f1f' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold text-white">Performance \u2014 Last 7 Days</h3>
            <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>
              {data?.has_data ? 'Live data from Supabase analytics' : 'No analytics data yet \u2014 publish posts to see metrics'}
            </p>
          </div>
          <div className="flex gap-2">
            {(Object.keys(metricConfig) as Array<keyof typeof metricConfig>).map((key) => (
              <button
                key={key}
                onClick={() => setActiveMetric(key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: activeMetric === key ? metricConfig[key].color + '22' : '#1a1a1a',
                  color: activeMetric === key ? metricConfig[key].color : '#6b7280',
                  border: '1px solid ' + (activeMetric === key ? metricConfig[key].color + '44' : '#2a2a2a'),
                }}
              >
                {metricConfig[key].label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center" style={{ height: 280 }}>
            <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: '#6366f1', borderTopColor: 'transparent' }}/>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center text-sm" style={{ height: 280, color: '#ef4444' }}>
            Failed to load analytics
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data?.chart_data ?? []}>
              <defs>
                <linearGradient id="colorGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={metricConfig[activeMetric].color} stopOpacity={0.2}/>
                  <stop offset="95%" stopColor={metricConfig[activeMetric].color} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1f1f2e" strokeDasharray="3 3" vertical={false}/>
              <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false}/>
              <Tooltip content={<CustomTooltip />}/>
              <Area
                type="monotone"
                dataKey={activeMetric}
                stroke={metricConfig[activeMetric].color}
                strokeWidth={2.5}
                fill="url(#colorGrad)"
                dot={false}
                activeDot={{ r: 5, fill: metricConfig[activeMetric].color }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-2xl p-6" style={{ backgroundColor: '#111111', border: '1px solid #1f1f1f' }}>
        <h3 className="font-semibold text-white mb-4">Top Posts</h3>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: '#6366f1', borderTopColor: 'transparent' }}/>
          </div>
        ) : data?.top_posts?.length ? (
          <div className="space-y-3">
            {data.top_posts.map((post) => (
              <div key={post.post_id} className="flex items-start gap-3 py-3" style={{ borderBottom: '1px solid #1f1f1f' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white line-clamp-2">{post.content || '(no caption)'}</p>
                  {post.permalink && (
                    <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="text-xs mt-1 hover:underline" style={{ color: '#6366f1' }}>
                      View post &#x2197;
                    </a>
                  )}
                </div>
                <div className="flex gap-3 text-xs flex-shrink-0" style={{ color: '#9ca3af' }}>
                  <span>&#x1F44D; {post.likes}</span>
                  <span>&#x1F441; {post.reach}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: '#1e1b4b' }}>
              <svg width="24" height="24" fill="none" stroke="#6366f1" strokeWidth="1.5" viewBox="0 0 24 24">
                <path d="M18 20V10M12 20V4M6 20v-6"/>
              </svg>
            </div>
            <p className="text-sm text-white font-medium">No posts yet</p>
            <p className="text-xs mt-1" style={{ color: '#6b7280' }}>Publish posts to see performance data</p>
          </div>
        )}
      </div>
    </div>
  );
}
