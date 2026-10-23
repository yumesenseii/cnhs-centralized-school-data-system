"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Loader2,
  RotateCcw,
  X,
  AlertTriangle,
  BookOpen,
} from "lucide-react";
import AnimatedModal from "@/components/shared/AnimatedModal";
import { formatTeacherReadingConcern } from "@/lib/monitoring/aralLearnerAggregation";
import { cn } from "@/lib/utils";

function formatGradeDisplay(grade) {
  if (grade === null || grade === undefined) return "—";
  const n = Number(grade);
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : String(grade);
}

/**
 * Centered Principal review modal for an ARAL reading referral.
 * Simple, non-technical layout:
 * - Learner
 * - Subject
 * - Current Grade (low grade triggers review)
 * - Teacher's Reading Concern / Reason
 * [ Approve for Assessment ]
 * [ Return to Teacher ] (reveals note field when clicked)
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
  const [returning, setReturning] = useState(false);

  if (!learner) return null;

  const subjects =
    learner.identifiedSubjects?.length
      ? learner.identifiedSubjects
      : (learner.subjects ?? []).map((subject) => ({
          subject,
          grade: null,
        }));

  const primarySubject = subjects[0]?.subject || learner.subject || learner.language || "English";
  const primaryGrade = subjects[0]?.grade ?? learner.classSubjectGrade ?? learner.academic_grade ?? null;
  const teacherConcern = formatTeacherReadingConcern(learner);

  const canApprove = (learner.displayStatus === "submitted" || learner.status === "submitted");

  const handleReturnClick = () => {
    if (!returning) {
      setReturning(true);
      return;
    }
    onReturn?.();
  };

  const handleClose = () => {
    setReturning(false);
    onClose?.();
  };

  return (
    <AnimatedModal
      open={Boolean(learner)}
      onClose={handleClose}
      labelledBy="aral-review-title"
    >
      <div className="w-[min(540px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[var(--card)]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-5 py-4 dark:border-white/5">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cnhs-green-dark">
              <BookOpen size={11} />
              Review Reading Referral
            </span>
            <h2
              id="aral-review-title"
              className="mt-1 truncate text-lg font-bold text-slate-900 dark:text-slate-100"
            >
              {learner.name}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              LRN: <span className="font-semibold">{learner.studentNumber || learner.lrn || "—"}</span>
              {learner.gradeSection ? ` · ${learner.gradeSection}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close review"
            className="shrink-0 cursor-pointer rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-5 text-xs">
          {/* 1. Subject & Trigger Grade */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-white/5 dark:bg-white/[0.02]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Subject
              </span>
              <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                {primarySubject}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-white/5 dark:bg-white/[0.02]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Current Grade
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {formatGradeDisplay(primaryGrade)}
                </span>
                <span className="text-[10px] text-amber-700 dark:text-amber-400">
                  (Triggered teacher review)
                </span>
              </div>
            </div>
          </div>

          {/* 2. Teacher's Reading Concern / Reason */}
          <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-3.5 dark:border-sky-900/30 dark:bg-sky-950/20">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-300">
              <AlertTriangle size={12} className="text-sky-600" />
              Teacher&apos;s Reading Concern / Reason
            </div>
            <p className="mt-1.5 text-xs font-medium leading-relaxed text-slate-800 dark:text-slate-200">
              {teacherConcern}
            </p>
          </div>

          {/* 3. Return Note Field (Only if Return to Teacher is clicked) */}
          {returning && !locked ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 dark:border-amber-900/40 dark:bg-amber-950/20">
              <label
                htmlFor="return-note-input"
                className="block text-[11px] font-bold text-amber-900 dark:text-amber-200"
              >
                Reason for Returning to Teacher
              </label>
              <p className="mt-0.5 text-[10px] text-amber-800/80 dark:text-amber-300/80">
                Provide instructions or reason for returning this referral.
              </p>
              <textarea
                id="return-note-input"
                value={note}
                onChange={(e) => onNoteChange?.(e.target.value)}
                placeholder="e.g. Please verify recent reading progress check..."
                rows={3}
                autoFocus
                className="mt-2 w-full rounded-lg border border-amber-300 bg-white p-2.5 text-xs text-slate-800 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 dark:border-amber-800 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
          ) : null}

          {!canApprove && !locked ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
              <span className="font-semibold">Awaiting Teacher Review:</span> This learner was flagged by academic screening, but the teacher has not yet submitted an official ARAL referral. Approval is restricted until the referral is submitted.
            </div>
          ) : null}

          {locked ? (
            <div className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-center text-xs font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
              ✓ Approved for Assessment
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3.5 dark:border-white/5">
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-9 cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
          >
            Cancel
          </button>

          {!locked ? (
            <div className="flex items-center gap-2">
              {returning ? (
                <>
                  <button
                    type="button"
                    onClick={() => setReturning(false)}
                    className="inline-flex h-9 cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleReturnClick}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-cnhs-orange px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#c95b12] active:scale-95 disabled:opacity-50"
                  >
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                    Confirm Return
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleReturnClick}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-cnhs-orange/30 bg-cnhs-orange-soft px-3.5 text-xs font-semibold text-cnhs-orange transition hover:bg-cnhs-orange/15 active:scale-95 disabled:opacity-50"
                  >
                    <RotateCcw size={13} />
                    Return to Teacher
                  </button>
                  <button
                    type="button"
                    disabled={busy || !canApprove}
                    onClick={onApprove}
                    title={!canApprove ? "Referral must be submitted by teacher before principal approval" : undefined}
                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-cnhs-green-dark px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#246f54] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    Approve for Assessment
                  </button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </AnimatedModal>
  );
}
