"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingDown, Award, Calendar, CheckCircle2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const COMPARISON_DATA = [
  {
    category: "ARAL Basic Tier",
    sy2526: 129,
    sy2627: 80,
    change: "-38.0%",
    status: "Improved",
  },
  {
    category: "ARAL Plus Tier",
    sy2526: 86,
    sy2627: 60,
    change: "-30.2%",
    status: "Improved",
  },
  {
    category: "Classroom Remedial",
    sy2526: 105,
    sy2627: 90,
    change: "-14.3%",
    status: "Improved",
  },
  {
    category: "Total At-Risk",
    sy2526: 215,
    sy2627: 140,
    change: "-34.9%",
    status: "Improved",
  },
];

const tooltipStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  fontSize: "12px",
  boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
};

export default function MultiYearCaseloadTrendCard() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-[var(--card)]">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-cnhs-green-dark">
              <TrendingDown size={16} />
            </span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Year-over-Year Intervention Caseload Trend (SY 2025–2026 vs SY 2026–2027)
            </h3>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Official CNHS historical comparison tracking caseload reduction and learner recovery over consecutive school years.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-cnhs-green-dark ring-1 ring-emerald-200">
            <TrendingDown size={12} />
            -34.9% ARAL Caseload
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700">
            84.8% Promotion Rate
          </span>
        </div>
      </div>

      {/* Visual Chart & Highlights Grid */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
        {/* Comparative Bar Chart */}
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={COMPARISON_DATA}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="category"
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(val, name) => [
                  `${val} learners`,
                  name === "sy2526" ? "SY 2025–2026 (Benchmark)" : "SY 2026–2027 (Current)",
                ]}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: 8, fontSize: 11 }}
                formatter={(value) =>
                  value === "sy2526"
                    ? "SY 2025–2026 (Baseline: 215)"
                    : "SY 2026–2027 (Current: 140)"
                }
              />
              <Bar
                dataKey="sy2526"
                name="sy2526"
                fill="#94a3b8"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
              <Bar
                dataKey="sy2627"
                name="sy2627"
                fill="#1b5e43"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Breakdown Card */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-[11px] dark:border-white/5 dark:bg-white/[0.02]">
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-100">
              Intervention Impact Summary
            </p>
            <div className="mt-2.5 space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">ARAL Basic Tier</span>
                <span className="font-bold text-slate-800">
                  129 <span className="text-slate-400">→</span> 80{" "}
                  <span className="text-emerald-700 font-semibold">(-38%)</span>
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">ARAL Plus Tier</span>
                <span className="font-bold text-slate-800">
                  86 <span className="text-slate-400">→</span> 60{" "}
                  <span className="text-emerald-700 font-semibold">(-30%)</span>
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                <span className="text-slate-500">Classroom Remedial</span>
                <span className="font-bold text-slate-800">
                  105 <span className="text-slate-400">→</span> 90{" "}
                  <span className="text-emerald-700 font-semibold">(-14%)</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Promotion / Exit Rate</span>
                <span className="font-bold text-emerald-700">
                  81.4% <span className="text-slate-400">→</span> 84.8%
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/50 p-2 text-[10px] text-emerald-900">
            <p className="font-semibold">DepEd Administrative Insight:</p>
            <p className="mt-0.5 text-emerald-800">
              Targeted reading/numeracy sessions under RA 12028 reduced the high-risk cohort by 75 learners across two academic cycles.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
