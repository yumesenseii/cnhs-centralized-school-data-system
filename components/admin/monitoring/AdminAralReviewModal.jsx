"use client";

import {
  CheckCircle2,
  Loader2,
  RotateCcw,
  X,
} from "lucide-react";
import AnimatedModal from "@/components/shared/AnimatedModal";
import { Pill } from "@/components/teacher/monitoring/shared";
import {
  aralApprovalDisplayLabel,
  aralApprovalStyles,
} from "@/lib/monitoring/aralApproval";
import { cn } from "@/lib/utils";

function formatGradeDisplay(grade) {
  if (grade === null || grade === undefined) return "—";
  const n = Number(grade);
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : String(grade);
}

/**
 * Centered Principal review dialog for one ARAL referral.
 * Read-only record view; Approve / Return reuse the panel handlers.
 */
export default function AdminAralReviewModal({
  learner,
  locked = false,
  busy = false,
  note = "",
  onNoteChange,
  onApprove,
  onReturn,
  onClose,
}) {
  const subjects =
    learner?.identifiedSubjects?.length
      ? learner.identifiedSubjects
      : (learner?.subjects ?? []).map((subject) => ({
          subject,
          grade: null,
        }));

  return (
    <AnimatedModal
      open={Boolean(learner)}
      onClose={onClose}
      labelledBy="aral-review-title"
    >
      {learner ? (
        <div className="w-[min(560px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[var(--card)]">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5 dark:border-white/5">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                ARAL Referral Review
              </p>
              <h2
                id="aral-review-title"
                className="mt-0.5 truncate text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                {learner.name}
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                {learner.studentNumber}
                {learner.gradeSection ? ` · ${learner.gradeSection}` : ""}
                {learner.schoolYear ? ` · ${learner.schoolYear}` : ""}
                {learner.quarter ? ` · ${learner.quarter}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close review"
              className="shrink-0 cursor-pointer rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/10"
            >
              <X size={16} />
            </button>
          </div>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto px-4 py-3.5 sm:px-5">
            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Academic reason for referral
              </h3>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {subjects.length ? (
                  subjects.map((entry) => (
                    <span
                      key={entry.subject}
                      className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300"
                    >
                      {entry.subject}
                      <span className="tabular-nums text-slate-600 dark:text-slate-300">
                        {formatGradeDisplay(entry.grade)}
                      </span>
                    </span>
                  ))
                ) : (
                  <span className="text-[12px] text-slate-400">
                    No subject grades attached.
                  </span>
                )}
              </div>
              {learner.reasonLine ? (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {learner.reasonLine}
                </p>
              ) : null}
            </section>

            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Teacher observation
              </h3>
              {locked ? (
                <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600 dark:text-slate-300">
                  {String(note || "").trim() || "No observation recorded."}
                </p>
              ) : (
                <textarea
                  value={note}
                  onChange={(e) => onNoteChange?.(e.target.value)}
                  placeholder="Optional return / review note"
                  rows={2}
                  className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-cnhs-green dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200"
                />
              )}
            </section>

            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Supporting evidence
              </h3>
              <dl className="mt-1.5 space-y-1">
                {subjects.length ? (
                  subjects.map((entry) => (
                    <div
                      key={entry.subject}
                      className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[12px] dark:bg-white/[0.04]"
                    >
                      <dt className="font-medium text-slate-600 dark:text-slate-300">
                        {entry.subject} grade
                      </dt>
                      <dd className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                        {formatGradeDisplay(entry.grade)}
                      </dd>
                    </div>
                  ))
                ) : (
                  <p className="text-[12px] text-slate-400">
                    No evidence attached.
                  </p>
                )}
              </dl>
            </section>

            <section className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-2 dark:bg-white/[0.04]">
              <span className="text-[11px] font-medium text-slate-500">
                Current status
              </span>
              <Pill
                value={aralApprovalDisplayLabel(learner.displayStatus)}
                styles={{
                  ...aralApprovalStyles,
                  [aralApprovalDisplayLabel(learner.displayStatus)]:
                    aralApprovalStyles[learner.displayStatus],
                }}
              />
            </section>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:justify-end sm:px-5 dark:border-white/5">
            {locked ? (
              <span className="text-[11px] font-medium text-slate-400">
                Reviewed
              </span>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onReturn}
                  className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-cnhs-orange/35 bg-cnhs-orange-soft px-4 text-[12px] font-semibold text-cnhs-orange transition-colors hover:bg-cnhs-orange/15 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <RotateCcw size={13} />
                  )}
                  Return to Teacher
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onApprove}
                  className={cn(
                    "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-cnhs-green-dark px-4 text-[12px] font-semibold text-white transition-colors hover:bg-[#246f54] disabled:opacity-50"
                  )}
                >
                  {busy ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={13} />
                  )}
                  Approve for Assessment
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </AnimatedModal>
  );
}
