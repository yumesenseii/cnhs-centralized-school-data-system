"use client";

import { useMemo } from "react";
import { CheckCircle2, AlertCircle, Eye, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildClassSupportSummary } from "@/lib/monitoring/gradeTrajectoryForecaster";

export default function ClassSupportCard({
  classItem = {},
  students = [],
  currentTerm = 1,
  onReviewLearners,
}) {
  const summary = useMemo(() => {
    return buildClassSupportSummary(classItem, students, currentTerm);
  }, [classItem, students, currentTerm]);

  const isLanguage = summary.isLanguageSubject;

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-white/[0.02]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100 dark:border-white/5">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Class Support
          </h2>
          <p className="mt-1 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200">
            {summary.directionText}
          </p>
        </div>
      </div>

      {/* 3 Categories: Doing Well, Needs Monitoring, Needs Attention */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* 1. Doing Well */}
        <div className="flex flex-col items-start p-3 rounded-xl border border-slate-100 bg-emerald-50/40 dark:border-white/5 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              Doing Well
            </span>
            <CheckCircle2 size={14} className="text-emerald-600" />
          </div>
          <p className="mt-1.5 text-xl font-bold text-slate-900 dark:text-white">
            {summary.doingWellCount}
            <span className="ml-1 text-xs font-normal text-slate-500">learners</span>
          </p>
        </div>

        {/* 2. Needs Monitoring */}
        <div className="flex flex-col items-start p-3 rounded-xl border border-slate-100 bg-amber-50/40 dark:border-white/5 dark:bg-amber-950/20">
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              Needs Monitoring
            </span>
            <Eye size={14} className="text-amber-600" />
          </div>
          <p className="mt-1.5 text-xl font-bold text-slate-900 dark:text-white">
            {summary.needsMonitoringCount}
            <span className="ml-1 text-xs font-normal text-slate-500">learners</span>
          </p>
        </div>

        {/* 3. Needs Attention */}
        <div className="flex flex-col items-start p-3 rounded-xl border border-slate-100 bg-red-50/40 dark:border-white/5 dark:bg-red-950/20">
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-semibold text-red-800 dark:text-red-300">
              Needs Attention
            </span>
            <AlertCircle size={14} className="text-red-600" />
          </div>
          <p className="mt-1.5 text-xl font-bold text-slate-900 dark:text-white">
            {summary.needsAttentionCount}
            <span className="ml-1 text-xs font-normal text-slate-500">learners</span>
          </p>
        </div>
      </div>

      {/* Non-language Subject Next Steps */}
      {!isLanguage && summary.needsAttentionCount > 0 && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 border border-slate-100 dark:bg-white/[0.03] dark:border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
          <div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {summary.needsAttentionCount} learner{summary.needsAttentionCount === 1 ? "" : "s"} need teacher review.
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              After review, choose to Continue Monitoring or Start Class Remedial.
            </p>
          </div>
          {onReviewLearners && (
            <button
              type="button"
              onClick={onReviewLearners}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer shrink-0 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
            >
              <span>Review Learners</span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
