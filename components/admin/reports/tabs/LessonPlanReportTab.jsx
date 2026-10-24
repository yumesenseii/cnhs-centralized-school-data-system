"use client";

import { useMemo } from "react";
import { CheckCircle2, Clock, AlertTriangle, FileText, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export default function LessonPlanReportTab({
  lessonSummary = {},
  schoolYear = "SY 2026-2027",
  quarter = "",
}) {
  const total = Number(lessonSummary?.total ?? 0);
  const approved = Number(lessonSummary?.approved ?? 0);
  const pending = Number(lessonSummary?.pending ?? 0);
  const needsRevision = Number(lessonSummary?.needsRevision ?? 0);

  const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

  const cards = [
    {
      label: "Total Submitted",
      value: total,
      desc: `Total lesson plans for ${schoolYear}`,
      icon: FileText,
      tone: "text-slate-900 dark:text-slate-100",
    },
    {
      label: "Approved",
      value: approved,
      desc: `${approvalRate}% overall approval rate`,
      icon: CheckCircle2,
      tone: "text-emerald-700 dark:text-emerald-400",
    },
    {
      label: "Pending Review",
      value: pending,
      desc: "Awaiting school head evaluation",
      icon: Clock,
      tone: "text-amber-700 dark:text-amber-400",
    },
    {
      label: "Needs Revision",
      value: needsRevision,
      desc: "Returned with revision notes",
      icon: AlertTriangle,
      tone: "text-rose-700 dark:text-rose-400",
    },
  ];

  const chartData = [
    { status: "Approved", count: approved, fill: "#166534" },
    { status: "Pending Review", count: pending, fill: "#d97706" },
    { status: "Needs Revision", count: needsRevision, fill: "#e11d48" },
  ];

  return (
    <div className="space-y-4">
      {/* 4 SUMMARY CARDS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[var(--card)]"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {card.label}
              </p>
              <card.icon className={`h-4 w-4 ${card.tone} opacity-80`} />
            </div>
            <p className={`mt-2 text-2xl font-bold leading-tight tabular-nums ${card.tone}`}>
              {card.value}
            </p>
            <p className="mt-1 truncate text-[11px] text-slate-500">
              {card.desc}
            </p>
          </div>
        ))}
      </div>

      {/* STATUS DISTRIBUTION & ACTIONS */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* CHART PANEL */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs lg:col-span-2 dark:border-white/10 dark:bg-[var(--card)]">
          <div className="border-b border-slate-100 pb-2.5 dark:border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
              Lesson Plan Evaluation Status
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Breakdown of teacher lesson submissions by current review disposition.
            </p>
          </div>

          <div className="mt-4 h-[220px] w-full">
            {total > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="status"
                    tick={{ fontSize: 11, fill: "#475569" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(val) => [`${val} submissions`, "Count"]}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={36}>
                    {chartData.map((entry) => (
                      <Cell key={entry.status} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                No lesson plan submissions recorded for this term.
              </div>
            )}
          </div>
        </div>

        {/* LATEST SUBMISSION / QUICK REVIEW PANEL */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
          <div>
            <div className="border-b border-slate-100 pb-2.5 dark:border-white/5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                Latest Activity
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Most recently logged lesson plan submission.
              </p>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Lesson Title
                </p>
                <p className="mt-0.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {lessonSummary?.latestTitle || "—"}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Current Status
                </p>
                <p className="mt-0.5 text-xs text-slate-700 dark:text-slate-300">
                  {lessonSummary?.latestStatus || "—"}
                </p>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Submission Date
                </p>
                <p className="mt-0.5 text-xs text-slate-700 dark:text-slate-300">
                  {lessonSummary?.latestDate || "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-3 dark:border-white/5">
            <Link
              href="/admin/lesson-plans"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-medium text-white shadow-xs hover:bg-emerald-900 transition-colors"
            >
              <span>Manage Lesson Plans</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
