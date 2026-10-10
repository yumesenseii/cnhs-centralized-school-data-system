"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { gradeEntriesFrom } from "@/components/ui/dashboard-1";

const BAR_COLORS = ["#0b6b3f", "#12935a", "#34b171", "#7ccba1"];

export default function EnrollmentByGradeChart({ data }) {
  const entries = gradeEntriesFrom(data).filter((entry) => entry.total != null);
  const chartData = entries.map((entry, index) => ({
    grade: `Grade ${entry.grade}`,
    total: entry.total,
    fill: BAR_COLORS[index % BAR_COLORS.length],
  }));

  if (!chartData.length) {
    return (
      <p className="py-10 text-center text-xs text-slate-400">Not available</p>
    );
  }

  return (
    <div className="h-[240px] w-full sm:h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 8, left: -18, bottom: 0 }}
        >
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="grade"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "#64748b" }}
            dy={6}
          />
          <YAxis tickLine={false} axisLine={false} tick={false} width={28} />
          <Tooltip
            cursor={{ fill: "rgba(11, 107, 63, 0.06)" }}
            contentStyle={{
              border: "1px solid #e2e8f0",
              backgroundColor: "#ffffff",
              borderRadius: 12,
              boxShadow: "0 12px 28px rgba(15, 23, 42, 0.08)",
              fontSize: 12,
            }}
            formatter={(value) => [`${value} learners`, "Enrolled"]}
          />
          <Bar dataKey="total" radius={[10, 10, 0, 0]} maxBarSize={72}>
            {chartData.map((entry) => (
              <Cell key={entry.grade} fill={entry.fill} />
            ))}
            <LabelList
              dataKey="total"
              position="top"
              style={{ fontSize: 12, fontWeight: 700, fill: "#123d2c" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
