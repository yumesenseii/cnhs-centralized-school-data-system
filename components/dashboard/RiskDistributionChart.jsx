"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export default function RiskDistributionChart({ data }) {
  return (
    <div className="grid min-h-[220px] grid-cols-1 items-center gap-4 sm:grid-cols-[1fr_130px]">
      <div className="h-[200px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={82}
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
                boxShadow: "0 12px 28px rgba(15, 23, 42, 0.08)",
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
              <span className="font-semibold text-slate-700">{item.value}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
