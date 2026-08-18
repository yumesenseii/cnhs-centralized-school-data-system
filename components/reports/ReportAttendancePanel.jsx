"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function EmptyChart() {
  return (
    <div className="flex h-[200px] items-center justify-center text-xs text-slate-400">
      No SF2 attendance data for the selected filters.
    </div>
  );
}

/**
 * SF2-only attendance module body. Explicitly separate from academic risk.
 */
export default function ReportAttendancePanel({
  attendance = null,
  chartData = [],
}) {
  const hasChart = Array.isArray(chartData) && chartData.length > 0;

  const metrics = [
    {
      label: "Monthly attendance rate",
      value:
        attendance?.monthlyAttendanceRate == null
          ? "—"
          : `${attendance.monthlyAttendanceRate}%`,
    },
    {
      label: "Near 20% absence",
      value: String(attendance?.nearThresholdCount ?? 0),
    },
    {
      label: "Present days (total)",
      value: String(attendance?.presentTotal ?? 0),
    },
    {
      label: "Absent days (total)",
      value: String(attendance?.absentTotal ?? 0),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {metrics.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-100 bg-white px-3 py-2.5"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
              {item.label}
            </p>
            <p className="mt-1 text-[16px] font-semibold text-slate-800">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-3">
        <h3 className="text-sm font-semibold text-slate-800">
          Attendance rate by month
        </h3>
        <p className="mt-0.5 text-[10px] text-slate-400">SF2 monthly trend</p>
        <div className="mt-3">
          {!hasChart ? (
            <EmptyChart />
          ) : (
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 12, right: 12, left: -12, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke="#eef2f7"
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
                    contentStyle={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(value) => [`${value}%`, "Attendance rate"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#2f7d5f"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#2f7d5f" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
