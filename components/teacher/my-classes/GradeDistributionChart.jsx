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
import { cn } from "@/lib/utils";

const barTones = {
  green: "bg-cnhs-green-dark",
  violet: "bg-violet-500",
  orange: "bg-cnhs-orange",
  red: "bg-red-500",
};

export default function GradeDistributionChart({ data, quarterlyAverages }) {
  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
        <h3 className="text-sm font-semibold text-slate-900">Average Grade by Term</h3>
        <div className="mt-3 h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={quarterlyAverages} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
              <XAxis
                dataKey="quarter"
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
              />
              <YAxis
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="average" fill="#174D37" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
        <h3 className="text-sm font-semibold text-slate-900">Grade Distribution</h3>
        <ul className="mt-4 space-y-3">
          {data.map((item) => (
            <li key={item.label}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-slate-600">{item.label}</span>
                <span className="text-[11px] font-semibold text-slate-700">{item.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn("h-full rounded-full", barTones[item.tone] ?? barTones.green)}
                  style={{ width: `${item.percent}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
