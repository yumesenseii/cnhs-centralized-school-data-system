"use client";

import { useEffect, useRef } from "react";
import { X, TrendingUp, BarChart2 } from "lucide-react";
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

const bandTones = {
  outstanding: "bg-emerald-600",
  verySatisfactory: "bg-teal-600",
  satisfactory: "bg-blue-600",
  fairlySatisfactory: "bg-amber-500",
  below75: "bg-red-500",
};

export default function ClassPerformanceModal({
  isOpen = false,
  onClose,
  classItem = {},
  students = [],
  quarterlyAverages = [],
}) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Compute Class Average
  const gradedStudents = students.filter((s) => {
    const g = Number(s.averageGrade);
    return Number.isFinite(g);
  });
  const avgGrades = gradedStudents.map((s) => Number(s.averageGrade));
  const classAverage =
    avgGrades.length > 0
      ? Math.round((avgGrades.reduce((sum, v) => sum + v, 0) / avgGrades.length) * 10) / 10
      : null;

  // Official DepEd grade ranges (No A/B/C/D letter labels)
  const totalGraded = gradedStudents.length || 1;
  const gradeDistribution = [
    {
      range: "90–100",
      descriptor: "Outstanding",
      tone: "outstanding",
      count: gradedStudents.filter((s) => s.averageGrade >= 90).length,
    },
    {
      range: "85–89",
      descriptor: "Very Satisfactory",
      tone: "verySatisfactory",
      count: gradedStudents.filter((s) => s.averageGrade >= 85 && s.averageGrade < 90).length,
    },
    {
      range: "80–84",
      descriptor: "Satisfactory",
      tone: "satisfactory",
      count: gradedStudents.filter((s) => s.averageGrade >= 80 && s.averageGrade < 85).length,
    },
    {
      range: "75–79",
      descriptor: "Fairly Satisfactory",
      tone: "fairlySatisfactory",
      count: gradedStudents.filter((s) => s.averageGrade >= 75 && s.averageGrade < 80).length,
    },
    {
      range: "Below 75",
      descriptor: "Did Not Meet Expectations",
      tone: "below75",
      count: gradedStudents.filter((s) => s.averageGrade < 75).length,
    },
  ].map((b) => ({
    ...b,
    percent: Math.round((b.count / totalGraded) * 100),
  }));

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
    >
      <div
        ref={modalRef}
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl dark:border-white/10 dark:bg-slate-900 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300">
              <BarChart2 size={16} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Class Performance
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {classItem.subject} — {classItem.gradeSection} ({classItem.schoolYear})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition dark:hover:bg-white/10 dark:hover:text-white cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-5">
          {/* Class Average Metric */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 flex items-center justify-between dark:border-white/5 dark:bg-white/[0.02]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Class Average
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                {classAverage !== null ? classAverage : "—"}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500">
                Based on {gradedStudents.length} graded learners
              </span>
            </div>
          </div>

          {/* Average Grade by Term (Bar Chart) */}
          <section className="rounded-xl border border-slate-100 p-4 dark:border-white/5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Average Grade by Term
            </h4>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={quarterlyAverages} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
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
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="average" fill="#246f54" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Grade Distribution */}
          <section className="rounded-xl border border-slate-100 p-4 dark:border-white/5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Grade Distribution
            </h4>
            <ul className="space-y-3">
              {gradeDistribution.map((item) => (
                <li key={item.range}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {item.range}{" "}
                      <span className="font-normal text-slate-400">({item.descriptor})</span>
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {item.count} learners ({item.percent}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                    <div
                      className={cn("h-full rounded-full transition-all", bandTones[item.tone])}
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-slate-100 dark:border-white/5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
