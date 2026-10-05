"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCheck,
  FileCheck,
  FileText,
  HelpCircle,
  Loader2,
  Maximize2,
  MessageSquare,
  MessageSquarePlus,
  Minimize2,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import LessonInformation from "@/components/lesson-plan/LessonInformation";
import LessonPreview from "@/components/lesson-plan/LessonPreview";
import AddSectionRemarkModal from "@/components/lesson-plan/AddSectionRemarkModal";
import LessonRemarksSidePanel from "@/components/lesson-plan/LessonRemarksSidePanel";
import StatusBadge from "@/components/lesson-plan/StatusBadge";
import AnimatedModal from "@/components/shared/AnimatedModal";
import { AnimatedBanner } from "@/components/shared/AnimatedFeedback";
import {
  getLessonPlanSignedUrl,
  saveLessonPlanSectionRemarks,
} from "@/lib/supabase/queries/lessonPlans";
import { cn } from "@/lib/utils";

export default function LessonDrawer({
  open,
  lesson,
  onClose,
  onSubmitDecision,
  onOpenedPending,
  reviewerName = "Principal",
}) {
  const [fileUrl, setFileUrl] = useState(null);
  const [decision, setDecision] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [sectionRemarks, setSectionRemarks] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [confirmApproveModal, setConfirmApproveModal] = useState(false);

  // Side-along remarks panel toggle
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [addRemarkModalOpen, setAddRemarkModalOpen] = useState(false);
  const [remarkModalInitialText, setRemarkModalInitialText] = useState("");
  const [selectedRemarkId, setSelectedRemarkId] = useState(null);

  const markedUnderReviewRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setExpanded(false);
      setAddRemarkModalOpen(false);
    }
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
    const loadedRemarks = Array.isArray(lesson?.sectionRemarks)
      ? lesson.sectionRemarks
      : [];
    setSectionRemarks(loadedRemarks);
    setSidePanelOpen(loadedRemarks.length > 0);
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

  // Handle adding section remark
  function handleAddRemark(newRemark) {
    const next = [...sectionRemarks, newRemark];
    setSectionRemarks(next);
    setSidePanelOpen(true);
    setSelectedRemarkId(newRemark.id);
    if (lesson?.id) {
      saveLessonPlanSectionRemarks({ id: lesson.id, sectionRemarks: next });
    }
  }

  // Handle deleting section remark
  function handleDeleteRemark(remarkId) {
    const next = sectionRemarks.filter((r) => r.id !== remarkId);
    setSectionRemarks(next);
    if (selectedRemarkId === remarkId) {
      setSelectedRemarkId(null);
    }
    if (lesson?.id) {
      saveLessonPlanSectionRemarks({ id: lesson.id, sectionRemarks: next });
    }
  }

  // Handle toggling resolve
  function handleToggleResolve(remarkId) {
    const next = sectionRemarks.map((r) =>
      r.id === remarkId
        ? {
            ...r,
            status: r.status === "resolved" ? "open" : "resolved",
            resolvedAt: r.status === "resolved" ? null : new Date().toISOString(),
            resolvedBy: reviewerName,
          }
        : r
    );
    setSectionRemarks(next);
    if (lesson?.id) {
      saveLessonPlanSectionRemarks({ id: lesson.id, sectionRemarks: next });
    }
  }

  // Handle text selection from doc preview
  function handleSelectText(textSnippet) {
    setRemarkModalInitialText(textSnippet);
    setAddRemarkModalOpen(true);
  }

  const openNeedsRevisionCount = sectionRemarks.filter(
    (r) => r.severity === "Needs Revision" && r.status !== "resolved"
  ).length;

  async function handleDecision(nextStatus, bypassConfirmation = false) {
    if (!lesson) return;

    if (
      nextStatus === "Approved" &&
      openNeedsRevisionCount > 0 &&
      !bypassConfirmation
    ) {
      setConfirmApproveModal(true);
      return;
    }

    if (
      nextStatus === "Needs Revision" &&
      !remarks.trim() &&
      sectionRemarks.length === 0
    ) {
      setError("Please provide a remark or add at least one comment specifying the needed revision.");
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
      sectionRemarks,
    });
    setSubmitting(false);

    if (!result?.ok) {
      setError(result?.error?.message ?? "Failed to save decision.");
      return;
    }

    setConfirmApproveModal(false);
    onClose?.();
  }

  return (
    <AnimatedModal
      open={open && Boolean(lesson)}
      onClose={submitting ? undefined : onClose}
      closeOnBackdrop={!submitting}
      closeOnEscape={!submitting}
      panelClassName={`flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[var(--card)] ${
        expanded
          ? "h-[98vh] w-[98vw] max-w-none"
          : "h-[min(90vh,890px)] w-[min(1360px,96vw)]"
      }`}
    >
      {lesson ? (
        <>
          {/* Header */}
          <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-3 dark:border-white/5 dark:bg-[var(--card)]">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="break-words text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {lesson.lessonTitle}
                </h2>
                <StatusBadge value={lesson.status} />
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                {lesson.teacher} · {lesson.learningArea} · {lesson.gradeSection}
                {lesson.trackingNumber ? ` · ${lesson.trackingNumber}` : ""}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {/* Add Comment Button */}
              <button
                type="button"
                onClick={() => {
                  setRemarkModalInitialText("");
                  setAddRemarkModalOpen(true);
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
              >
                <MessageSquarePlus size={13} className="text-amber-600" />
                <span className="hidden sm:inline">Add Comment</span>
              </button>

              {/* Toggle Side-Along Comments Panel Button */}
              <button
                type="button"
                onClick={() => setSidePanelOpen((v) => !v)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition shadow-2xs",
                  sidePanelOpen
                    ? "border-cnhs-green/30 bg-cnhs-green/10 text-cnhs-green-dark dark:border-cnhs-green/40 dark:bg-cnhs-green/20 dark:text-cnhs-green"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                )}
              >
                <MessageSquare size={13} />
                <span>Comments ({sectionRemarks.length})</span>
                {openNeedsRevisionCount > 0 ? (
                  <span className="rounded-full bg-red-600 px-1.5 py-0.2 text-[9px] font-bold text-white">
                    {openNeedsRevisionCount}
                  </span>
                ) : null}
              </button>

              <button
                type="button"
                aria-label={expanded ? "Exit full screen" : "Expand"}
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
              >
                {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                aria-label="Close review"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>
          </header>

          {/* Body: 3-Column Desktop Structure (Left Sticky Nav + Center Scrollable Doc) + (Right Comments) */}
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* Left & Center: Scrollspy Sticky Navigation + Scrollable Document Canvas */}
            <div className="min-h-0 flex-1 overflow-hidden">
              <LessonPreview
                lesson={lesson}
                fileUrl={fileUrl}
                remarks={sectionRemarks}
                selectedRemarkId={selectedRemarkId}
                onSelectRemark={(remIdOrObj) =>
                  setSelectedRemarkId(
                    typeof remIdOrObj === "object" && remIdOrObj !== null
                      ? remIdOrObj.id
                      : remIdOrObj
                  )
                }
                onSelectText={handleSelectText}
                readOnly={false}
              />
            </div>

            {/* Right: Side-Along Comments & History Panel (No backdrop overlay) */}
            {sidePanelOpen ? (
              <div className="hidden sm:flex shrink-0 border-l border-slate-200/80 bg-slate-50/40 dark:border-white/5 dark:bg-white/[0.02]">
                <LessonRemarksSidePanel
                  open={sidePanelOpen}
                  onClose={() => setSidePanelOpen(false)}
                  remarks={sectionRemarks}
                  timeline={lesson?.timeline || []}
                  selectedRemarkId={selectedRemarkId}
                  onSelectRemark={(rem) => setSelectedRemarkId(rem?.id)}
                  onAddNewRemark={() => {
                    setRemarkModalInitialText("");
                    setAddRemarkModalOpen(true);
                  }}
                  onDeleteRemark={handleDeleteRemark}
                  onToggleResolve={handleToggleResolve}
                  reviewerName={reviewerName}
                />
              </div>
            ) : null}
          </div>

          <AnimatedBanner message={error} tone="error" className="mx-5 mb-2 text-xs" />

          {/* Footer: Principal Review Actions */}
          <footer className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 dark:border-white/5 dark:bg-[var(--card)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                  <ShieldCheck size={14} className="text-cnhs-green" />
                  <span>Reviewer:</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    {reviewerName || "Principal"}
                  </span>
                </div>
                {openNeedsRevisionCount > 0 ? (
                  <span className="rounded bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700 dark:bg-red-950/60 dark:text-red-300">
                    ⚠️ {openNeedsRevisionCount} revision required
                  </span>
                ) : sectionRemarks.length > 0 ? (
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                    ✓ All comments noted
                  </span>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => handleDecision("Needs Revision")}
                  disabled={submitting}
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-orange px-3 text-xs font-semibold text-white shadow-sm hover:bg-[#d47828] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting && decision === "Needs Revision" ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <RotateCcw size={13} />
                  )}
                  Return for Revision
                </button>

                <button
                  type="button"
                  onClick={() => handleDecision("Approved")}
                  disabled={submitting}
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting && decision === "Approved" ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <CheckCheck size={13} />
                  )}
                  Approve Lesson Plan
                </button>
              </div>
            </div>
          </footer>
        </>
      ) : null}

      {/* Lightweight Add Remark Modal */}
      <AddSectionRemarkModal
        open={addRemarkModalOpen}
        onClose={() => setAddRemarkModalOpen(false)}
        onSave={handleAddRemark}
        initialText={remarkModalInitialText}
        reviewerName={reviewerName}
      />

      {/* Confirmation Modal when Approving with open revision remarks */}
      {confirmApproveModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[var(--card)]">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <AlertCircle size={20} />
              </span>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Approve with Open Revision Remarks?
                </h4>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  There {openNeedsRevisionCount === 1 ? "is" : "are"}{" "}
                  <strong className="text-amber-700 dark:text-amber-300">
                    {openNeedsRevisionCount} section remark{openNeedsRevisionCount === 1 ? "" : "s"}
                  </strong>{" "}
                  marked as "Needs Revision". Approving will finalize this submission.
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmApproveModal(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
              >
                Back to Review
              </button>
              <button
                type="button"
                onClick={() => handleDecision("Approved", true)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#246f54]"
              >
                <CheckCheck size={13} />
                Yes, Approve Lesson Plan
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AnimatedModal>
  );
}
