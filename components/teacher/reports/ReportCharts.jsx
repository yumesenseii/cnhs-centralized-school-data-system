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
  const gwaRisk = charts?.gwaRiskDistribution ?? [];
  const bySubject = charts?.averageGradePerSubject ?? [];
  const monitoring = charts?.monitoringProgress ?? [];
  const termTrends = charts?.termTrends ?? [];

  const hasPerformance = performance.some((row) => row.value > 0);
  const hasGwaRisk = gwaRisk.some((row) => row.value > 0);
  const hasSubjects = bySubject.length > 0;
  const hasMonitoring = monitoring.some((row) => row.value > 0);
  const hasTermTrends = termTrends.some((row) => row.gradedLearners > 0 || row.averageGrade !== null);

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-5 border-y border-slate-200 py-3 dark:border-white/10 xl:grid-cols-2">
      {/* 1. MULTI-TERM ACADEMIC TRENDS */}
      <ChartCard
        title="Academic Performance Trends (Terms 1–3)"
        subtitle="Average grade and passing rates across terms"
      >
        {!hasTermTrends ? (
          <EmptyChart />
        ) : (
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={termTrends} margin={{ top: 18, right: 16, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="term"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#64748b" }}
                />
                <YAxis
                  domain={[60, 100]}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  width={32}
                />
                <Tooltip
                  cursor={{ fill: "rgba(22, 101, 52, 0.05)" }}
                  contentStyle={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(val, name) => [
                    name === "averageGrade" ? `${val || "—"}` : `${val}%`,
                    name === "averageGrade" ? "Average Grade" : "Passing Rate",
                  ]}
                />
                <Bar dataKey="averageGrade" fill="#166534" radius={[6, 6, 0, 0]} maxBarSize={44} name="averageGrade" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      {/* 2. PUBLISHED GWA RISK DISTRIBUTION */}
      <ChartCard
        title="Published GWA Risk Distribution"
        subtitle="Learners categorized by complete published GWA records"
      >
        {!hasGwaRisk ? (
          <EmptyChart />
        ) : (
          <div className="grid min-h-[220px] grid-cols-1 items-center gap-4 sm:grid-cols-[1fr_150px]">
            <div className="h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={gwaRisk}
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
                    {gwaRisk.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(val) => [`${val} learners`, "Count"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2.5">
              {gwaRisk.map((item) => (
                <li key={item.name} className="flex items-start gap-2">
                  <span
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                    aria-hidden="true"
                  />
                  <span className="text-xs leading-4">
                    <span className="block font-medium text-slate-500">{item.name}</span>
                    <span className="font-semibold" style={{ color: item.color }}>
                      {item.value} ({item.percent}%)
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
