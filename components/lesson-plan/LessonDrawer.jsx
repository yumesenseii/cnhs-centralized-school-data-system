"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCheck,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCcw,
  X,
} from "lucide-react";
import LessonInformation from "@/components/lesson-plan/LessonInformation";
import LessonPreview from "@/components/lesson-plan/LessonPreview";
import StatusBadge from "@/components/lesson-plan/StatusBadge";
import AnimatedModal from "@/components/shared/AnimatedModal";
import { AnimatedBanner } from "@/components/shared/AnimatedFeedback";
import { getLessonPlanSignedUrl } from "@/lib/supabase/queries/lessonPlans";

export default function LessonDrawer({
  open,
  lesson,
  onClose,
  onSubmitDecision,
  onOpenedPending,
}) {
  const [fileUrl, setFileUrl] = useState(null);
  const [decision, setDecision] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const markedUnderReviewRef = useRef(null);

  useEffect(() => {
    if (!open) setExpanded(false);
  }, [open]);

  useEffect(() => {
    let active = true;

    async function loadUrl() {
      if (!open || !lesson?.filePath) {
        setFileUrl(null);
        return;
      }
      const signed = await getLessonPlanSignedUrl(lesson.filePath);
      if (!active) return;
      setFileUrl(signed.data);
    }

    setDecision(null);
    setRemarks(lesson?.remarks || "");
    setError("");
    loadUrl();

    return () => {
      active = false;
    };
  }, [open, lesson]);

  useEffect(() => {
    if (!open || !lesson?.id) return;

    const isPending =
      lesson.dbStatus === "Pending Review" || lesson.status === "Pending";

    if (!isPending) {
      markedUnderReviewRef.current = null;
      return;
    }

    if (markedUnderReviewRef.current === lesson.id) return;

    markedUnderReviewRef.current = lesson.id;
    onOpenedPending?.(lesson);
  }, [open, lesson, onOpenedPending]);

  async function handleDecision(nextStatus) {
    if (!lesson) return;
    if (nextStatus === "Needs Revision" && !remarks.trim()) {
      setError("Remarks are required when requesting revision.");
      setDecision("Needs Revision");
      return;
    }

    setSubmitting(true);
    setError("");
    setDecision(nextStatus);

    const result = await onSubmitDecision?.({
      id: lesson.id,
      status: nextStatus,
      remarks: remarks.trim() || null,
    });
    setSubmitting(false);

    if (!result?.ok) {
      setError(result?.error?.message ?? "Failed to save decision.");
      return;
    }

    onClose?.();
  }

  const metaLine = [lesson?.schoolYear, lesson?.quarter]
    .filter(Boolean)
    .join(" · ");

  return (
    <AnimatedModal
      open={open && Boolean(lesson)}
      onClose={submitting ? undefined : onClose}
      closeOnBackdrop={!submitting}
      closeOnEscape={!submitting}
      panelClassName={`flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/5 dark:bg-[var(--card)] ${
        expanded
          ? "h-[96vh] w-[98vw]"
          : "h-[min(85vh,780px)] w-[min(1180px,96vw)]"
      }`}
    >
      {lesson ? (
        <>
          {/* Header — same chrome family as class-report HT modal */}
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-3.5 dark:border-white/5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="break-words text-[17px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  {lesson.lessonTitle}
                </h2>
                <StatusBadge value={lesson.status} />
              </div>
              <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
                {lesson.teacher} · {lesson.learningArea} · {lesson.gradeSection}
                {lesson.trackingNumber
                  ? ` · ${lesson.trackingNumber}`
                  : ""}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                aria-label={expanded ? "Exit full screen" : "Expand"}
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
              >
                {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                aria-label="Close review"
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          {/* Body — lesson content only (no sticky actions) */}
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <LessonInformation lesson={lesson} />
            <LessonPreview lesson={lesson} fileUrl={fileUrl} />
            <AnimatedBanner message={error} tone="error" className="text-sm" />
          </div>

          {/* Footer — Head Teacher review block (mirrors class-report HT chrome) */}
          <div className="sticky bottom-0 shrink-0 border-t border-slate-200 bg-white px-5 py-3 dark:border-white/5 dark:bg-[var(--card)]">
            <p className="mb-2 text-[12px] font-semibold text-slate-800 dark:text-slate-100">
              Head Teacher review
            </p>
            <label>
              <span className="sr-only">Review remarks</span>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Required when requesting revision. Optional notes for approval."
                disabled={submitting}
                className="mb-2 w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-cnhs-green disabled:opacity-60 dark:border-white/5 dark:bg-white/[0.03] dark:text-slate-200 dark:placeholder:text-slate-500"
              />
            </label>
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleDecision("Approved")}
                disabled={submitting}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[12px] font-semibold text-white hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && decision === "Approved" ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <CheckCheck size={13} />
                )}
                Approve
              </button>
              <button
                type="button"
                onClick={() => handleDecision("Needs Revision")}
                disabled={submitting}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-orange px-3 text-[12px] font-semibold text-white hover:bg-[#d47828] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && decision === "Needs Revision" ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <RotateCcw size={13} />
                )}
                Needs Revision
              </button>
            </div>
          </div>

          <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3 dark:border-white/5 dark:bg-[var(--card)]">
            <span className="text-[11px] text-slate-400">
              {metaLine || "Lesson plan review"}
            </span>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/5 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
            >
              Close
            </button>
          </footer>
        </>
      ) : null}
    </AnimatedModal>
  );
}
