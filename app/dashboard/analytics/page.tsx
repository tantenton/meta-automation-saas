'use client';

import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';

const mockData = [
  { day: 'Mon', reach: 1200, engagement: 340, followers: 45 },
  { day: 'Tue', reach: 1900, engagement: 520, followers: 62 },
  { day: 'Wed', reach: 1500, engagement: 410, followers: 38 },
  { day: 'Thu', reach: 2800, engagement: 780, followers: 95 },
  { day: 'Fri', reach: 2200, engagement: 610, followers: 71 },
  { day: 'Sat', reach: 3400, engagement: 940, followers: 118 },
  { day: 'Sun', reach: 2900, engagement: 820, followers: 103 },
];

const stats = [
  { label: 'Total Reach', value: '15,900', change: '+18% vs last week', color: '#6366f1', up: true },
  { label: 'Engagement Rate', value: '4.2%', change: '+0.8% vs last week', color: '#8b5cf6', up: true },
  { label: 'New Followers', value: '532', change: '+12% vs last week', color: '#10b981', up: true },
  { label: 'Posts Published', value: '0', change: 'Connect accounts first', color: '#f59e0b', up: false },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: '#1a1a2e', border: '1px solid #2a2a3e' }}>
        <p className="font-semibold text-white mb-1">{label}</p>
        {payload.map((p: any) => (
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
  const [activeMetric, setActiveMetric] = useState<'reach' | 'engagement' | 'followers'>('reach');

  const metricConfig = {
    reach: { label: 'Reach', color: '#6366f1', gradient: ['#6366f133', '#6366f100'] },
    engagement: { label: 'Engagement', color: '#8b5cf6', gradient: ['#8b5cf633', '#8b5cf600'] },
    followers: { label: 'New Followers', color: '#10b981', gradient: ['#10b98133', '#10b98100'] },
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Analytics</h2>
        <p className="text-sm mt-0.5" style={{ color: '#6b7280' }}>Track your social media performance</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl p-4" style={{ backgroundColor: '#111111', border: '1px solid #1f1f1f' }}>
            <p className="text-xs mb-2" style={{ color: '#6b7280' }}>{stat.label}</p>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs mt-1 flex items-center gap-1" style={{ color: stat.up ? '#10b981' : '#6b7280' }}>
              {stat.up && '↑'} {stat.change}
            </p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-2xl p-6" style={{ backgroundColor: '#111111', border: '1px solid #1f1f1f' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold text-white">Performance — Last 7 Days</h3>
            <p className="text-xs mt-0.5" style={{ color: '#6b7280' }}>Mock data — connect accounts for real metrics</p>
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
                  border: `1px solid ${activeMetric === key ? metricConfig[key].color + '44' : '#2a2a2a'}`,
                }}
              >
                {metricConfig[key].label}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={mockData}>
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
      </div>

      {/* Top Posts placeholder */}
      <div className="rounded-2xl p-6" style={{ backgroundColor: '#111111', border: '1px solid #1f1f1f' }}>
        <h3 className="font-semibold text-white mb-4">Top Posts</h3>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: '#1e1b4b' }}>
            <svg width="24" height="24" fill="none" stroke="#6366f1" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M18 20V10M12 20V4M6 20v-6"/>
            </svg>
          </div>
          <p className="text-sm text-white font-medium">No posts yet</p>
          <p className="text-xs mt-1" style={{ color: '#6b7280' }}>Publish posts to see performance data</p>
        </div>
      </div>
    </div>
  );
}
