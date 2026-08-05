"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Mock data for 7 days of post engagement
const mockData = [
  { day: "Mon", engagement: 120, reach: 850 },
  { day: "Tue", engagement: 180, reach: 1200 },
  { day: "Wed", engagement: 220, reach: 1500 },
  { day: "Thu", engagement: 195, reach: 1350 },
  { day: "Fri", engagement: 250, reach: 1800 },
  { day: "Sat", engagement: 310, reach: 2200 },
  { day: "Sun", engagement: 280, reach: 2000 },
];

export default function AnalyticsChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-medium">Post Engagement Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={mockData}>
            <defs>
              <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
            <XAxis dataKey="day" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                borderRadius: "0.375rem",
                color: "#f3f4f6",
              }}
            />
            <Area
              type="monotone"
              dataKey="engagement"
              stroke="#818cf8"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorEngagement)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
