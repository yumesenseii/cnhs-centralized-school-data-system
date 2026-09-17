"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export default function RiskDistributionChart({ data }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <h3 className="text-sm font-semibold text-slate-900">Risk Distribution</h3>
      <div className="mt-2 grid min-h-[200px] grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_110px]">
        <div className="h-[170px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={68}
                paddingAngle={2}
                stroke="var(--card)"
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

        <ul className="space-y-2.5">
          {data.map((item) => (
            <li key={item.name} className="flex items-start gap-2">
              <span
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span className="text-[11px] leading-4">
                <span className="block font-medium text-slate-500">{item.name}</span>
                <span className="font-semibold text-slate-700">{item.value}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
