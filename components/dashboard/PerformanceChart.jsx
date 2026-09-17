"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function PerformanceChart({ data }) {
  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 6, left: -28, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="grade"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            dy={6}
          />
          <YAxis
            domain={[0, 100]}
            tickLine={false}
            axisLine={false}
            tick={false}
            width={28}
          />
          <Tooltip
            cursor={{ fill: "rgba(82, 183, 136, 0.06)" }}
            contentStyle={{
              border: "1px solid var(--border)",
              backgroundColor: "var(--card)",
              color: "var(--card-foreground)",
              borderRadius: 12,
              boxShadow: "0 12px 28px rgba(15, 23, 42, 0.08)",
              fontSize: 12,
            }}
            formatter={(value) => [`${value}%`, "Average"]}
          />
          <Bar dataKey="average" fill="#40916c" radius={[10, 10, 0, 0]} maxBarSize={96} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
