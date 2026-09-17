"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function ChartCard({ title, subtitle, children }) {
  return (
    <section className="min-w-0">
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      {subtitle ? (
        <p className="mt-0.5 text-[10px] text-slate-400">{subtitle}</p>
      ) : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[200px] items-center justify-center text-xs text-slate-400">
      No chart data for the selected filters.
    </div>
  );
}

export default function ReportCharts({ charts }) {
  const performance = charts?.performanceDistribution ?? [];
  const aral = charts?.aralDistribution ?? [];
  const bySubject = charts?.averageGradePerSubject ?? [];
  const monitoring = charts?.monitoringProgress ?? [];

  const hasPerformance = performance.some((row) => row.value > 0);
  const hasAral = aral.some((row) => row.value > 0);
  const hasSubjects = bySubject.length > 0;
  const hasMonitoring = monitoring.some((row) => row.value > 0);

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-5 border-y border-slate-200 py-3 dark:border-white/10 xl:grid-cols-2">
      <ChartCard
        title="Student Performance Distribution"
        subtitle="Grade buckets from recorded subject scores"
      >
        {!hasPerformance ? (
          <EmptyChart />
        ) : (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performance} margin={{ top: 18, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  width={28}
                />
                <Tooltip
                  cursor={{ fill: "rgba(82, 183, 136, 0.06)" }}
                  contentStyle={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={48}>
                  {performance.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <ChartCard
        title="ARAL Learners Distribution"
        subtitle="English and Filipino classes only · recommendation service"
      >
        {!hasAral ? (
          <EmptyChart />
        ) : (
          <div className="grid min-h-[220px] grid-cols-1 items-center gap-4 sm:grid-cols-[1fr_140px]">
            <div className="h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={aral}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={78}
                    paddingAngle={2}
                    stroke="var(--card)"
                    strokeWidth={3}
                  >
                    {aral.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-3">
              {aral.map((item) => (
                <li key={item.name} className="flex items-start gap-2">
                  <span
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                    aria-hidden="true"
                  />
                  <span className="text-xs leading-4">
                    <span className="block font-medium text-slate-500">{item.name}</span>
                    <span className="font-semibold" style={{ color: item.color }}>
                      {item.value}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </ChartCard>

      <ChartCard
        title="Average Grade Per Subject"
        subtitle="Class subject averages for assigned classes"
      >
        {!hasSubjects ? (
          <EmptyChart />
        ) : (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bySubject} margin={{ top: 18, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="subject"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                />
                <YAxis
                  domain={[0, 100]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  width={28}
                />
                <Tooltip
                  cursor={{ fill: "rgba(82, 183, 136, 0.06)" }}
                  contentStyle={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(value) => [`${value}`, "Average"]}
                />
                <Bar
                  dataKey="average"
                  fill="#40916c"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={56}
                  label={{ position: "top", fill: "#64748b", fontSize: 11 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <ChartCard
        title="Monitoring Progress"
        subtitle="Latest monitoring status across enrolled learners"
      >
        {!hasMonitoring ? (
          <EmptyChart />
        ) : (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monitoring} margin={{ top: 18, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  width={28}
                />
                <Tooltip
                  cursor={{ fill: "rgba(82, 183, 136, 0.06)" }}
                  contentStyle={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={40}>
                  {monitoring.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
