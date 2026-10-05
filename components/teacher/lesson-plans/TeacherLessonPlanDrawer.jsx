"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileCheck,
  Loader2,
  Maximize2,
  MessageSquare,
  Minimize2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import StatusBadge from "@/components/lesson-plan/StatusBadge";
import LessonPreview from "@/components/lesson-plan/LessonPreview";
import LessonRemarksSidePanel from "@/components/lesson-plan/LessonRemarksSidePanel";
import AnimatedModal from "@/components/shared/AnimatedModal";
import { AnimatedBanner } from "@/components/shared/AnimatedFeedback";
import {
  getLessonPlanEvents,
  saveLessonPlanSectionRemarks,
} from "@/lib/supabase/queries/lessonPlans";
import { cn } from "@/lib/utils";

const VALID_FILE_EXTENSIONS = [".pdf", ".doc", ".docx"];

function formatEventTimestamp(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    return d.toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return String(isoString);
  }
}

/**
 * Build rich revision timeline (Revision 1 -> Submitted, Needs Revision; Revision 2 -> Resubmitted, Pending Review)
 */
function buildRevisionTimeline(events = [], plan = null) {
  if (!plan) return [];

  if (Array.isArray(events) && events.length > 0) {
    const sorted = [...events].sort(
      (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
    );

    let revNumber = 1;
    const history = [];

    for (let i = 0; i < sorted.length; i++) {
      const ev = sorted[i];
      const type = ev.event_type;

      if (type === "Resubmitted") {
        revNumber += 1;
      }

      let label = type;
      if (type === "Needs Revision" || type === "Returned for Revision") {
        label = "Needs Revision";
      }

      history.push({
        id: ev.id || `event-${i}`,
        revision: `Revision ${revNumber}`,
        label,
        date: formatEventTimestamp(ev.created_at),
        actor:
          ev.actor_name ||
          (ev.actor_role === "teacher"
            ? plan.teacher || "Teacher"
            : plan.reviewedBy || "Principal"),
        role: ev.actor_role,
        note: ev.remarks || null,
      });
    }

    const last = history[history.length - 1];
    if (last?.label === "Resubmitted" && plan.status === "Pending Review") {
      history.push({
        id: "active-pending-review",
        revision: `Revision ${revNumber}`,
        label: "Pending Review",
        date: "Awaiting Principal Review",
        actor: "Principal",
        role: "admin",
        note: "Submitted for review.",
      });
    }

    return history;
  }

  // Fallback if no event records exist
  const fallback = [];
  fallback.push({
    id: "rev-1-submitted",
    revision: "Revision 1",
    label: "Submitted",
    date: formatEventTimestamp(plan.raw?.submitted_at || plan.lastUpdated),
    actor: plan.teacher || "Teacher",
    role: "teacher",
    note: plan.fileName ? `File: ${plan.fileName}` : null,
  });

  if (plan.status === "Needs Revision") {
    fallback.push({
      id: "rev-1-needs-rev",
      revision: "Revision 1",
      label: "Needs Revision",
      date: formatEventTimestamp(plan.raw?.reviewed_at || plan.lastUpdated),
      actor: plan.reviewedBy || "Principal",
      role: "admin",
      note: plan.remarks || "Returned for revision.",
    });
  } else if (plan.status === "Pending Review") {
    fallback.push({
      id: "rev-1-pending",
      revision: "Revision 1",
      label: "Pending Review",
      date: formatEventTimestamp(plan.lastUpdated),
      actor: "Principal",
      role: "admin",
      note: "Awaiting Principal Review.",
    });
  } else if (plan.status === "Approved") {
    fallback.push({
      id: "rev-1-approved",
      revision: "Revision 1",
      label: "Approved",
      date: formatEventTimestamp(plan.raw?.reviewed_at || plan.lastUpdated),
      actor: plan.reviewedBy || "Principal",
      role: "admin",
      note: plan.remarks || "Lesson plan approved.",
    });
  }

  return fallback;
}

export default function TeacherLessonPlanDrawer({
  open,
  plan,
  fileUrl,
  loadingUrl = false,
  resubmitting = false,
  deleting = false,
  onClose,
  onDownload,
  onResubmit,
  onDelete,
  onUpdateRemarks,
}) {
  const [resubmitModalOpen, setResubmitModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [revisionNote, setRevisionNote] = useState("");
  const [resubmitError, setResubmitError] = useState("");
  const [showUnresolvedPrompt, setShowUnresolvedPrompt] = useState(false);
  const [submittingRevised, setSubmittingRevised] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [selectedRemarkId, setSelectedRemarkId] = useState(null);
  const [events, setEvents] = useState([]);
  const [localRemarks, setLocalRemarks] = useState([]);

  // Synchronize remarks from plan with localStorage applied cache
  useEffect(() => {
    const rawRemarks = Array.isArray(plan?.sectionRemarks) ? plan.sectionRemarks : [];
    if (!plan?.id) {
      setLocalRemarks(rawRemarks);
      return;
    }

    try {
      const cached = localStorage.getItem(`cnhs_applied_lp_${plan.id}`);
      if (cached) {
        const appliedSet = new Set(JSON.parse(cached));
        const merged = rawRemarks.map((rem) => {
          if (appliedSet.has(String(rem.id))) {
            return { ...rem, status: "applied" };
          }
          return rem;
        });
        setLocalRemarks(merged);
        return;
      }
    } catch {
      // ignore localStorage errors
    }

    setLocalRemarks(rawRemarks);
  }, [plan?.sectionRemarks, plan?.id]);

  // Load audit / timeline events
  useEffect(() => {
    if (!open || !plan?.id) return;
    let isMounted = true;
    getLessonPlanEvents(plan.id).then((res) => {
      if (isMounted && Array.isArray(res?.data)) {
        setEvents(res.data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [open, plan?.id, plan?.status]);

  const canResubmit = plan?.canResubmit || plan?.status === "Needs Revision";
  const isApproved = plan?.isApproved || plan?.status === "Approved";

  // Unresolved revision comments (Needs Revision and not applied or resolved)
  const openRevisionRemarks = useMemo(() => {
    return localRemarks.filter(
      (r) =>
        (r.severity === "Needs Revision" || !r.severity) &&
        r.status !== "applied" &&
        r.status !== "resolved"
    );
  }, [localRemarks]);

  const timeline = useMemo(() => {
    return buildRevisionTimeline(events, plan);
  }, [events, plan]);

  // Toggle "Applied" state on a comment
  async function handleToggleApplyRemark(remarkId) {
    if (!plan?.id) return;
    const updated = localRemarks.map((rem) => {
      if (String(rem.id) === String(remarkId)) {
        const currentlyApplied = rem.status === "applied";
        return {
          ...rem,
          status: currentlyApplied ? "open" : "applied",
          appliedAt: currentlyApplied ? null : new Date().toISOString(),
        };
      }
      return rem;
    });

    setLocalRemarks(updated);
    onUpdateRemarks?.(updated);

    try {
      const appliedIds = updated
        .filter((r) => r.status === "applied")
        .map((r) => String(r.id));
      localStorage.setItem(`cnhs_applied_lp_${plan.id}`, JSON.stringify(appliedIds));
    } catch {
      // ignore
    }

    try {
      await saveLessonPlanSectionRemarks({
        id: plan.id,
        sectionRemarks: updated,
      });
    } catch (err) {
      console.warn("[TeacherLessonPlanDrawer] failed saving applied status:", err);
    }
  }

  function handleOpenResubmitModal() {
    setSelectedFile(null);
    setRevisionNote("");
    setResubmitError("");
    setShowUnresolvedPrompt(false);
    setSubmittingRevised(false);
    setResubmitModalOpen(true);
  }

  // Resubmit execution
  async function executeResubmit(bypassUnresolved = false) {
    if (!selectedFile) {
      setResubmitError("Please choose a revised lesson plan file to upload.");
      return;
    }

    const ext = "." + selectedFile.name.split(".").pop().toLowerCase();
    if (!VALID_FILE_EXTENSIONS.includes(ext)) {
      setResubmitError("Invalid file type. Please upload a PDF (.pdf) or Word document (.docx, .doc).");
      return;
    }

    // Check if unresolved comments remain
    if (openRevisionRemarks.length > 0 && !bypassUnresolved) {
      setShowUnresolvedPrompt(true);
      return;
    }

    setShowUnresolvedPrompt(false);
    setResubmitError("");
    setSubmittingRevised(true);

    try {
      const result = await onResubmit?.({
        id: plan.id,
        file: selectedFile,
        previousFilePath: plan.filePath,
        schoolYear: plan.schoolYear,
        revisionNote: revisionNote.trim() || null,
      });

      if (!result?.ok) {
        const errMessage = result?.error?.message;
        setResubmitError(
          errMessage && !errMessage.includes("schema cache")
            ? errMessage
            : "Unable to submit the revised lesson plan. Please try again."
        );
        setSubmittingRevised(false);
        return;
      }

      // Refresh events
      getLessonPlanEvents(plan.id).then((res) => {
        if (Array.isArray(res?.data)) setEvents(res.data);
      });

      setSubmittingRevised(false);
      setResubmitModalOpen(false);
    } catch (err) {
      console.error("[TeacherLessonPlanDrawer] resubmit failed:", err);
      setResubmitError("Unable to submit the revised lesson plan. Please try again.");
      setSubmittingRevised(false);
    }
  }

  function handleSelectRemark(remOrId) {
    const id = typeof remOrId === "object" && remOrId !== null ? remOrId.id : remOrId;
    setSelectedRemarkId(id);
    if (!sidePanelOpen) {
      setSidePanelOpen(true);
    }
  }

  const isProcessing = submittingRevised || resubmitting;

  return (
    <AnimatedModal
      open={open && Boolean(plan)}
      onClose={onClose}
      panelClassName={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-200 dark:border-white/10 dark:bg-[var(--card)]",
        expanded
          ? "h-[98vh] w-[98vw] max-w-none"
          : "h-[min(90vh,890px)] w-[min(1360px,96vw)]"
      )}
    >
      {plan ? (
        <>
          {/* Header */}
          <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-3 dark:border-white/5 dark:bg-[var(--card)]">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="break-words text-sm font-bold tracking-tight text-slate-900 sm:text-base dark:text-slate-100">
                  {plan.lessonTitle}
                </h2>
                <StatusBadge value={plan.status} />
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                {plan.teacher || "Subject Teacher"} · {plan.subject || plan.learningArea} · {plan.gradeSection}
                {plan.trackingNumber ? ` · ${plan.trackingNumber}` : ""}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
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
                <span>Comments ({localRemarks.length})</span>
                {openRevisionRemarks.length > 0 ? (
                  <span className="rounded-full bg-red-600 px-1.5 py-0.2 text-[9px] font-bold text-white">
                    {openRevisionRemarks.length} pending
                  </span>
                ) : localRemarks.length > 0 ? (
                  <span className="rounded-full bg-emerald-600 px-1.5 py-0.2 text-[9px] font-bold text-white">
                    ✓ All addressed
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
                aria-label="Close"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>
          </header>

          {/* Needs Revision Top Banner if applicable */}
          {canResubmit ? (
            <div className="shrink-0 border-b border-red-200 bg-red-50/90 px-5 py-2.5 text-xs dark:border-red-900/40 dark:bg-red-950/30">
              <div className="flex items-center gap-2 text-red-900 dark:text-red-200">
                <AlertCircle size={15} className="shrink-0 text-red-700 dark:text-red-400" />
                <span className="font-bold">
                  Returned for Revision:
                </span>
                <span className="text-red-800 dark:text-red-300">
                  {openRevisionRemarks.length > 0
                    ? `Please review comments (${openRevisionRemarks.length} pending) and submit your revised lesson plan below.`
                    : "Comments have been addressed. You may now submit your revised plan to the Principal below."}
                </span>
              </div>
            </div>
          ) : null}

          {/* Body: Left Scrollspy Nav + Center Scrollable Doc + Right Comments & History */}
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div className="min-h-0 flex-1 overflow-hidden">
              <LessonPreview
                lesson={{
                  ...plan,
                  fileType: plan.fileType,
                  fileName: plan.fileName,
                }}
                fileUrl={fileUrl}
                remarks={localRemarks}
                selectedRemarkId={selectedRemarkId}
                onSelectRemark={handleSelectRemark}
                readOnly={true}
              />
            </div>

            {/* Right: Comments & History Side Panel */}
            {sidePanelOpen ? (
              <div className="hidden sm:flex shrink-0 border-l border-slate-200/80 bg-slate-50/40 dark:border-white/5 dark:bg-white/[0.02]">
                <LessonRemarksSidePanel
                  open={sidePanelOpen}
                  onClose={() => setSidePanelOpen(false)}
                  remarks={localRemarks}
                  timeline={timeline}
                  selectedRemarkId={selectedRemarkId}
                  onSelectRemark={handleSelectRemark}
                  onToggleApply={handleToggleApplyRemark}
                  readOnly={true}
                  reviewerName={plan?.reviewedBy || "Principal"}
                />
              </div>
            ) : null}
          </div>

          <AnimatedBanner message={resubmitError} tone="error" className="mx-5 mb-2 text-xs font-normal" />
          <AnimatedBanner message={deleteError} tone="error" className="mx-5 mb-2 text-xs font-normal" />

          {/* Footer Actions */}
          <footer className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 dark:border-white/5 dark:bg-[var(--card)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
                  <ShieldCheck size={14} className="text-cnhs-green" />
                  <span>Reviewer:</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    {plan?.reviewedBy || "Principal"}
                  </span>
                </div>
                {openRevisionRemarks.length > 0 ? (
                  <span className="rounded bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700 dark:bg-red-950/60 dark:text-red-300">
                    ⚠️ {openRevisionRemarks.length} revision required
                  </span>
                ) : isApproved ? (
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                    ✓ Officially Approved
                  </span>
                ) : (
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    Status: {plan?.status}
                  </span>
                )}
                {plan?.remarks ? (
                  <span
                    className="truncate max-w-[280px] rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-white/10 dark:text-slate-300"
                    title={plan.remarks}
                  >
                    Note: {plan.remarks}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={deleting || isProcessing}
                  onClick={async () => {
                    setDeleteError("");
                    const result = await onDelete?.(plan);
                    if (result && result.ok === false) {
                      setDeleteError(
                        result.error?.message ?? "Failed to delete lesson plan."
                      );
                    }
                  }}
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/40 dark:bg-white/5 dark:text-red-400"
                >
                  {deleting ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                  {deleting ? "Deleting..." : "Delete"}
                </button>
                {canResubmit ? (
                  <button
                    type="button"
                    disabled={isProcessing || deleting}
                    onClick={handleOpenResubmitModal}
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#246f54] disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Upload size={13} />
                    )}
                    {isProcessing ? "Submitting..." : "Resubmit Revised Plan"}
                  </button>
                ) : null}
              </div>
            </div>
          </footer>
        </>
      ) : null}

      {/* Resubmission Modal */}
      {resubmitModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[var(--card)]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <RotateCcw size={16} />
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Resubmit Revised Lesson Plan
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isProcessing) setResubmitModalOpen(false);
                }}
                disabled={isProcessing}
                className="text-slate-400 hover:text-slate-600 disabled:opacity-50 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* File input */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Revised File
                </label>
                <p className="text-[10px] text-slate-400">PDF, DOC, DOCX</p>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  disabled={isProcessing}
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setSelectedFile(f);
                    setShowUnresolvedPrompt(false);
                    setResubmitError("");
                  }}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 outline-none file:mr-2 file:rounded-md file:border-0 file:bg-cnhs-green-dark file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-white disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                />
                {selectedFile ? (
                  <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-2 text-xs text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-200">
                    <p className="font-semibold">Selected file:</p>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-[10.5px] text-emerald-700 dark:text-emerald-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : null}
              </div>

              {/* Revision note */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Teacher's Note
                </label>
                <p className="text-[10px] text-slate-400">Optional message for Principal</p>
                <textarea
                  rows={3}
                  value={revisionNote}
                  disabled={isProcessing}
                  onChange={(e) => setRevisionNote(e.target.value)}
                  placeholder="e.g., Addressed remarks on learning flow and updated formative assessment items."
                  className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-cnhs-green disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>

              {/* Unresolved Comments Confirmation Prompt */}
              {showUnresolvedPrompt ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-xs dark:border-amber-900/50 dark:bg-amber-950/40">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="flex-1">
                      <p className="font-bold text-amber-900 dark:text-amber-200">
                        Some review comments are still unresolved.
                      </p>
                      <p className="mt-0.5 text-[11px] text-amber-800 dark:text-amber-300">
                        There are {openRevisionRemarks.length} pending review comments. Do you want to submit the revised lesson plan anyway?
                      </p>
                      <div className="mt-2.5 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => executeResubmit(true)}
                          className="rounded-lg bg-cnhs-green-dark px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-[#246f54] disabled:opacity-50 cursor-pointer"
                        >
                          Continue Submission
                        </button>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => {
                            setResubmitModalOpen(false);
                            setSidePanelOpen(true);
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                        >
                          Review Comments
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Status / Error Message Area */}
              <AnimatedBanner message={resubmitError} tone="error" className="text-xs" />
            </div>

            {/* Modal Actions */}
            <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-white/5">
              <button
                type="button"
                onClick={() => setResubmitModalOpen(false)}
                disabled={isProcessing}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-white/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeResubmit(false)}
                disabled={isProcessing || !selectedFile}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#246f54] disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Submitting revised plan...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} />
                    <span>Submit to Principal</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AnimatedModal>
  );
}
