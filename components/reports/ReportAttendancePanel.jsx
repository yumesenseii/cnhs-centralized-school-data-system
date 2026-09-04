"use client";

import Link from "next/link";
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
    <div className="flex h-[200px] flex-col items-center justify-center gap-2 px-4 text-center text-xs text-slate-400">
      <p>No SF2 attendance data for the selected filters.</p>
      <Link
        href="/teacher/attendance"
        className="font-semibold text-cnhs-green-dark hover:underline"
      >
        Open Attendance Monitoring →
      </Link>
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
      label: "Avg ADA",
      value:
        attendance?.avgAda == null && attendance?.monthlyAttendanceRate == null
          ? "—"
          : attendance?.avgAda != null
            ? String(attendance.avgAda)
            : `${attendance.monthlyAttendanceRate}%`,
      hint: "From submitted SF2",
    },
    {
      label: "Avg PA",
      value: attendance?.avgPa == null ? "—" : `${attendance.avgPa}%`,
      hint: "Percentage of attendance",
    },
    {
      label: "Total absences",
      value: String(attendance?.totalAbsences ?? attendance?.absentTotal ?? 0),
    },
    {
      label: "Flagged months",
      value: String(
        attendance?.flaggedCount ?? attendance?.nearThresholdCount ?? 0
      ),
      hint: "Low PA / NLS / 5c",
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
            {item.hint ? (
              <p className="mt-0.5 text-[10px] text-slate-400">{item.hint}</p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-3">
        <h3 className="text-sm font-semibold text-slate-800">
          PA by month
        </h3>
        <p className="mt-0.5 text-[10px] text-slate-400">
          SF2 percentage of attendance · your sections
        </p>
        <div className="mt-3">
          {!hasChart ? (
            <EmptyChart />
          ) : (
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#246f54"
                    strokeWidth={2}
                    dot={{ r: 3 }}
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
