"use client";

import { CheckCircle2, Clock, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { termLabel } from "@/lib/academic/termLabels";

export default function QuarterProgressTracker({
  classItem = {},
  allTermGradeRows = [],
  currentQuarter = 1,
  onSelectQuarter,
  onUploadQuarter,
}) {
  const terms = [1, 2, 3, 4];

  // Group grades by quarter
  const quarterStats = terms.map((q) => {
    const rows = (allTermGradeRows ?? []).filter((r) => Number(r.quarter) === q);
    const hasGrades = rows.length > 0;
    const grades = rows.map((r) => Number(r.final_grade)).filter((g) => Number.isFinite(g));
    const avg =
      grades.length > 0
        ? Math.round((grades.reduce((s, g) => s + g, 0) / grades.length) * 10) / 10
        : null;
    const passed = grades.filter((g) => g >= 75).length;

    return {
      quarter: q,
      label: q === 4 ? "Final Term" : termLabel(q),
      hasGrades,
      count: rows.length,
      average: avg,
      passed,
      isCurrent: q === Number(currentQuarter),
    };
  });

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-white/[0.02]">
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-cnhs-green-dark" />
          <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
            Quarterly Grading Progress
          </h3>
        </div>
        <span className="text-[10.5px] font-medium text-slate-400">
          {String(classItem.schoolYear || "2026-2027").startsWith("SY")
            ? classItem.schoolYear
            : `SY ${classItem.schoolYear || "2026-2027"}`}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {quarterStats.map((item) => (
          <button
            key={item.quarter}
            type="button"
            onClick={() => onSelectQuarter?.(item.quarter)}
            className={cn(
              "flex flex-col items-start p-2.5 rounded-xl border text-left transition cursor-pointer relative",
              item.isCurrent
                ? "border-cnhs-green-dark bg-cnhs-green-soft/50 ring-2 ring-cnhs-green-dark/20 dark:bg-emerald-950/20"
                : item.hasGrades
                ? "border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.01]"
                : "border-dashed border-slate-200 bg-slate-50/50 hover:bg-slate-50 dark:border-white/5 dark:bg-white/[0.01]"
            )}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                {item.label}
              </span>
              {item.hasGrades ? (
                <CheckCircle2 size={13} className="text-cnhs-green-dark" />
              ) : (
                <Clock size={13} className="text-slate-400" />
              )}
            </div>

            {item.hasGrades ? (
              <div className="mt-1.5">
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  Avg: {item.average ?? "—"}
                </p>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                  {item.passed} / {item.count} Passed
                </p>
              </div>
            ) : (
              <div className="mt-2">
                <span className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-400">
                  Pending Grades
                </span>
              </div>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
