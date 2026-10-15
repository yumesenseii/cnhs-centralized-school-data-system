"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertCircle, ChevronRight, User } from "lucide-react";
import { buildClassSupportSummary } from "@/lib/monitoring/gradeTrajectoryForecaster";

export default function LearnersNeedingAttentionCard({
  classItem = {},
  students = [],
  currentTerm = 1,
  onViewAllLearners,
}) {
  const summary = useMemo(() => {
    return buildClassSupportSummary(classItem, students, currentTerm);
  }, [classItem, students, currentTerm]);

  const topLearners = summary.topAttentionLearners;
  const totalNeedingAttention = summary.needsAttentionCount;

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-white/[0.02]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
            <AlertCircle size={15} />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Learners Needing Attention
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {totalNeedingAttention > 0
                ? `Showing first ${topLearners.length} of ${totalNeedingAttention} learners requiring teacher review`
                : "No learners currently flagged for attention"}
            </p>
          </div>
        </div>
      </div>

      {/* List or Table */}
      {topLearners.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
          All learners are currently meeting academic expectations.
        </div>
      ) : (
        <div className="mt-2 divide-y divide-slate-100 dark:divide-white/5">
          {topLearners.map((student) => {
            const grade = student.currentGrade;

            return (
              <div
                key={student.id}
                className="flex items-center justify-between py-2.5 gap-3"
              >
                {/* Learner Info */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200">
                    {student.initials || <User size={13} />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                      {student.name}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      LRN: {student.studentNumber || "—"}
                    </p>
                  </div>
                </div>

                {/* Current Grade */}
                <div className="text-center px-2">
                  <span className="inline-block rounded-md bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300">
                    {grade ?? "—"}
                  </span>
                </div>

                {/* Review Action */}
                <div>
                  <Link
                    href={`/teacher/my-classes/${classItem.id}/students/${student.id}`}
                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
                  >
                    <span>Review</span>
                    <ChevronRight size={12} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {totalNeedingAttention > 0 && onViewAllLearners && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-slate-500">
          <span className="text-[11px] text-slate-400">
            {totalNeedingAttention} total learners needing attention
          </span>
          <button
            type="button"
            onClick={onViewAllLearners}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#246f54] hover:underline cursor-pointer dark:text-emerald-400"
          >
            <span>View All {totalNeedingAttention} Learners</span>
            <ChevronRight size={13} />
          </button>
        </div>
      )}
    </section>
  );
}
