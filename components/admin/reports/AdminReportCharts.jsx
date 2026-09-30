"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function ChartCard({ title, subtitle, children }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] dark:border-white/5 dark:bg-[var(--card)] dark:shadow-none">
      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
      {subtitle ? (
        <p className="mt-1 text-[10px] text-slate-400">{subtitle}</p>
      ) : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--foreground)",
};

function EmptyChart() {
  return (
    <div className="flex h-[200px] items-center justify-center text-xs text-slate-400">
      No chart data for the selected filters.
    </div>
  );
}

export default function AdminReportCharts({
  charts,
  hideAttendance = false,
  hideEmpty = false,
}) {
  const risk = charts?.riskDistribution ?? [];
  const performance = charts?.performanceBySubject ?? [];
  const intervention = charts?.interventionMix ?? [];
  const lessonPlans = charts?.lessonPlanStatus ?? [];
  const attendance = charts?.attendanceByMonth ?? [];

  const hasRisk = risk.some((row) => row.value > 0);
  const hasPerformance = performance.length > 0;
  const hasIntervention = intervention.some((row) => row.value > 0);
  const hasLessonPlans = lessonPlans.some((row) => row.value > 0);
  const hasAttendance = !hideAttendance && attendance.length > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {hasRisk || !hideEmpty ? (
          <ChartCard
            title="Academic Risk Distribution"
            subtitle="Categorized from electronic class record (ECR) subject grades"
          >
            {!hasRisk ? (
              <EmptyChart />
            ) : (
              <div className="grid min-h-[210px] grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_130px]">
                <div className="h-[190px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={risk}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={74}
                        paddingAngle={2}
                        stroke="var(--card)"
                        strokeWidth={3}
                      >
                        {risk.map((item) => (
                          <Cell key={item.name} fill={item.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="space-y-2.5">
                  {risk.map((item) => (
                    <li key={item.name} className="flex items-start gap-2">
                      <span
                        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs leading-4">
                        <span className="block font-medium text-slate-500">
                          {item.name}
                        </span>
                        <span
                          className="font-semibold"
                          style={{ color: item.color }}
                        >
                          {item.value} ({item.percent}%)
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </ChartCard>
        ) : null}

        {hasPerformance || !hideEmpty ? (
          <ChartCard
            title="Average Grade by Learning Area"
            subtitle="Class subject averages across enrolled sections"
          >
            {!hasPerformance ? (
              <EmptyChart />
            ) : (
              <div className="h-[210px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={performance}
                    margin={{ top: 16, right: 8, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke="#f1f5f9"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="subject"
                      tickLine={false}
                      axisLine={{ stroke: "#e2e8f0" }}
                      tick={{ fontSize: 10, fill: "#64748b" }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      width={28}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(27, 94, 67, 0.05)" }}
                      contentStyle={tooltipStyle}
                      formatter={(value) => [`${value}`, "Average Grade"]}
                    />
                    <Bar
                      dataKey="average"
                      fill="#1b5e43"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={44}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        ) : null}
      </div>

      {!hideAttendance ? (
        <ChartCard
          title="Attendance by month"
          subtitle="Uploaded SF2 percentage of attendance"
        >
          {!hasAttendance ? (
            <EmptyChart />
          ) : (
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={attendance}
                  margin={{ top: 12, right: 12, left: -12, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke="var(--border)"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    width={32}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [`${value}%`, "Attendance rate"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#246f54"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#246f54" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      ) : null}
    </div>
  );
}
