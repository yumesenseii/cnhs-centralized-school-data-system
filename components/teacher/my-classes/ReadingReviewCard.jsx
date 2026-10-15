"use client";

import { BookOpen, ArrowRight } from "lucide-react";

export default function ReadingReviewCard({ onReviewLearners }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-white/[0.02]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
            <BookOpen size={16} />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Reading Review
            </h2>
            <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
              Some learners with academic concerns may need closer reading review. Confirm whether the concern is reading-related before recommending ARAL assessment.
            </p>
          </div>
        </div>

        {onReviewLearners && (
          <button
            type="button"
            onClick={onReviewLearners}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer shrink-0 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
          >
            <span>Review Learners</span>
            <ArrowRight size={13} />
          </button>
        )}
      </div>
    </section>
  );
}
