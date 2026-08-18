"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCheck, Loader2, Maximize2, Minimize2, RotateCcw, X } from "lucide-react";
import LessonInformation from "@/components/lesson-plan/LessonInformation";
import LessonPreview from "@/components/lesson-plan/LessonPreview";
import StatusBadge from "@/components/lesson-plan/StatusBadge";
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

  if (!open || !lesson) return null;

  async function handleDecision(nextStatus) {
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-3 backdrop-blur-[1px] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Lesson plan review"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`relative z-10 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl ${
          expanded
            ? "h-[96vh] w-[98vw]"
            : "h-[min(82vh,720px)] w-[min(1180px,96vw)]"
        }`}
      >
        <div className="shrink-0 border-b border-slate-200 px-5 py-3.5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400">
                Lesson Plan Review · {lesson.trackingNumber || lesson.id}
              </p>
              <h2 className="mt-1 break-words text-lg font-semibold leading-6 tracking-[-0.03em] text-slate-900">
                {lesson.lessonTitle}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {lesson.teacher} · {lesson.learningArea} · {lesson.gradeSection}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <StatusBadge value={lesson.status} />
              <button
                type="button"
                aria-label={expanded ? "Exit full screen" : "Expand"}
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close review"
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <LessonInformation lesson={lesson} />
          <LessonPreview lesson={lesson} fileUrl={fileUrl} />

          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
              Remarks
            </h3>
            <label>
              <span className="sr-only">Review remarks</span>
              <textarea
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Required when requesting revision. Optional notes for approval."
                className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:border-cnhs-green"
              />
            </label>
          </section>

          {error ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-white px-5 py-3">
          <button
            type="button"
            onClick={() => handleDecision("Approved")}
            disabled={submitting}
            className="inline-flex h-10 min-w-[168px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-cnhs-green-dark px-4 text-sm font-semibold text-white transition-colors hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting && decision === "Approved" ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <CheckCheck size={18} />
            )}
            Approve
          </button>
          <button
            type="button"
            onClick={() => handleDecision("Needs Revision")}
            disabled={submitting}
            className="inline-flex h-10 min-w-[168px] cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-red-500 bg-white px-4 text-sm font-semibold text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting && decision === "Needs Revision" ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <RotateCcw size={18} />
            )}
            Needs Revision
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-10 min-w-[168px] cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
