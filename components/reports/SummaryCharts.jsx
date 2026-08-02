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

export function AcademicPerformanceChart({ data }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <h2 className="text-sm font-semibold text-slate-800">Academic Performance by Grade Level</h2>
      <p className="mt-1 text-[10px] text-slate-400">
        Average grade per grade level · Final Grade / Average SY 2025-2026
      </p>
      <div className="mt-4 h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 18, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="#eef2f7" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="grade"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
            />
            <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={false} width={24} />
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
    </section>
  );
}

export function RiskDistributionChart({ data }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <h2 className="text-sm font-semibold text-slate-800">Risk Distribution</h2>
      <p className="mt-1 text-[10px] text-slate-400">64 total learners · Random Forest classification</p>
      <div className="mt-2 grid min-h-[220px] grid-cols-1 items-center gap-4 sm:grid-cols-[1fr_140px]">
        <div className="h-[190px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={78}
                paddingAngle={2}
                stroke="#ffffff"
                strokeWidth={3}
              >
                {data.map((item) => (
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
          {data.map((item) => (
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
    </section>
  );
}
