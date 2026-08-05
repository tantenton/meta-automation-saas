import AnalyticsChart from "@/components/dashboard/AnalyticsChart";

const stats = [
  {
    label: "Total Reach",
    value: "128.5K",
    change: "+12.5%",
    trend: "up",
  },
  {
    label: "Engagement Rate",
    value: "4.8%",
    change: "+0.8%",
    trend: "up",
  },
  {
    label: "Top Post",
    value: "Product Demo",
    change: "3.2K likes",
    trend: "neutral",
  },
  {
    label: "Followers Growth",
    value: "+2.1K",
    change: "+5.2%",
    trend: "up",
  },
];

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Track your social media performance and engagement metrics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight">{stat.value}</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span
                className={
                  stat.trend === "up"
                    ? "text-emerald-500"
                    : stat.trend === "down"
                      ? "text-rose-500"
                      : "text-muted-foreground"
                }
              >
                {stat.change}
              </span>
              <span className="text-muted-foreground">
                {stat.label === "Top Post" ? "" : "vs last week"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <AnalyticsChart />
    </div>
  );
}
