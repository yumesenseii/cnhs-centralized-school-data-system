"use client";

import { useState } from "react";
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
import LessonInformation from "@/components/lesson-plan/LessonInformation";
import LessonPreview from "@/components/lesson-plan/LessonPreview";
import LessonRemarksSidePanel from "@/components/lesson-plan/LessonRemarksSidePanel";
import AnimatedModal from "@/components/shared/AnimatedModal";
import { AnimatedBanner } from "@/components/shared/AnimatedFeedback";
import {
  createPopulatedDocxFile,
} from "@/lib/lesson-plan/docxExport";
import { cn } from "@/lib/utils";

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
}) {
  const [resubmitModalOpen, setResubmitModalOpen] = useState(false);
  const [resubmitMode, setResubmitMode] = useState("in-system"); // "in-system" | "upload"
  const [selectedFile, setSelectedFile] = useState(null);
  const [revisionNote, setRevisionNote] = useState("");
  const [resubmitError, setResubmitError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [editedDocumentHtml, setEditedDocumentHtml] = useState("");
  const [selectedRemarkId, setSelectedRemarkId] = useState(null);

  const canResubmit = plan?.canResubmit || plan?.status === "Needs Revision";
  const isApproved = plan?.isApproved || plan?.status === "Approved";
  const sectionRemarks = Array.isArray(plan?.sectionRemarks)
    ? plan.sectionRemarks
    : [];

  const openRevisionRemarks = sectionRemarks.filter(
    (r) => r.severity === "Needs Revision" && r.status !== "resolved"
  );

  function handleOpenResubmitModal() {
    setSelectedFile(null);
    setRevisionNote("");
    setResubmitError("");
    setResubmitMode(editedDocumentHtml ? "in-system" : "upload");
    setResubmitModalOpen(true);
  }

  async function handleConfirmResubmit() {
    let fileToUpload = selectedFile;

    if (resubmitMode === "in-system") {
      if (!editedDocumentHtml) {
        setResubmitError("Please edit and save the document first, or upload an updated file.");
        return;
      }
      try {
        fileToUpload = await createPopulatedDocxFile(
          {
            ...plan,
            editedHtml: editedDocumentHtml,
          },
          plan.fileName || "Lesson_Plan.docx"
        );
      } catch (err) {
        setResubmitError("Failed to prepare updated lesson plan document.");
        return;
      }
    } else if (!selectedFile) {
      setResubmitError("Please choose a lesson plan file to upload.");
      return;
    }

    setResubmitError("");
    const result = await onResubmit?.({
      id: plan.id,
      file: fileToUpload,
      previousFilePath: plan.filePath,
      schoolYear: plan.schoolYear,
      revisionNote: revisionNote.trim() || null,
    });

    if (!result?.ok) {
      setResubmitError(
        result?.error?.message ?? "Failed to resubmit lesson plan."
      );
      return;
    }

    setResubmitModalOpen(false);
  }

  function handleSelectRemark(remOrId) {
    const id = typeof remOrId === "object" && remOrId !== null ? remOrId.id : remOrId;
    setSelectedRemarkId(id);
    if (!sidePanelOpen) {
      setSidePanelOpen(true);
    }
  }

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
          {/* Clean Unified Header */}
          <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-3 dark:border-white/5 dark:bg-[var(--card)]">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="break-words text-sm font-bold tracking-tight text-slate-900 sm:text-base dark:text-slate-100">
                  {plan.lessonTitle}
                </h2>
                <StatusBadge value={plan.status} />
                {editedDocumentHtml ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    <Sparkles size={10} /> Edited
                  </span>
                ) : null}
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
                <span>Comments ({sectionRemarks.length})</span>
                {openRevisionRemarks.length > 0 ? (
                  <span className="rounded-full bg-red-600 px-1.5 py-0.2 text-[9px] font-bold text-white">
                    {openRevisionRemarks.length}
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
            <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-xs dark:border-amber-900/40 dark:bg-amber-950/30">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                  <AlertCircle size={15} className="shrink-0 text-amber-700 dark:text-amber-400" />
                  <span className="font-semibold">
                    Returned for Revision:
                  </span>
                  <span>
                    You can edit the document directly below or upload an updated file.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenResubmitModal}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-orange px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-[#d47828]"
                >
                  <Upload size={12} />
                  Resubmit Revised Plan
                </button>
              </div>
            </div>
          ) : null}

          {/* Body: Side-by-Side Document + Google Docs-style Comments Panel */}
          <div className="flex min-h-0 flex-1 gap-3 overflow-hidden p-4 sm:p-5">
            {/* Left: Document Canvas with Collapsible Information Header */}
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="space-y-3">
                <LessonInformation lesson={plan} />
                <LessonPreview
                  lesson={{
                    ...plan,
                    fileType: plan.fileType,
                    fileName: plan.fileName,
                  }}
                  fileUrl={fileUrl}
                  remarks={sectionRemarks}
                  selectedRemarkId={selectedRemarkId}
                  onSelectRemark={handleSelectRemark}
                  readOnly={false}
                  allowEdit={true}
                  onSaveEdits={(html) => setEditedDocumentHtml(html)}
                />
              </div>
            </div>

            {/* Right: Side-Along Comments & History Panel */}
            {sidePanelOpen ? (
              <LessonRemarksSidePanel
                open={sidePanelOpen}
                onClose={() => setSidePanelOpen(false)}
                remarks={sectionRemarks}
                timeline={plan?.timeline || []}
                selectedRemarkId={selectedRemarkId}
                onSelectRemark={handleSelectRemark}
                readOnly={true}
                reviewerName={plan?.reviewedBy || "Principal"}
              />
            ) : null}
          </div>

          <AnimatedBanner message={resubmitError} tone="error" className="mx-5 mb-2 text-xs font-normal" />
          <AnimatedBanner message={deleteError} tone="error" className="mx-5 mb-2 text-xs font-normal" />

          {/* Footer Actions Matching Principal Layout */}
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
                  disabled={deleting || resubmitting}
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
                    disabled={resubmitting || deleting}
                    onClick={handleOpenResubmitModal}
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-orange px-3.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#d47828] disabled:opacity-50"
                  >
                    {resubmitting ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Upload size={13} />
                    )}
                    {resubmitting ? "Resubmitting..." : "Resubmit Revised Plan"}
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
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  <RotateCcw size={16} />
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Resubmit Revised Lesson Plan
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setResubmitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Submission Source Selector */}
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  How would you like to resubmit?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setResubmitMode("in-system")}
                    disabled={!editedDocumentHtml}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition",
                      resubmitMode === "in-system"
                        ? "border-cnhs-green bg-cnhs-green/10 text-cnhs-green-dark dark:border-cnhs-green dark:bg-cnhs-green/20 dark:text-cnhs-green"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                    )}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <Sparkles size={13} />
                      <span>Submit Current Edits</span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {editedDocumentHtml
                        ? "✓ Your edited document is ready"
                        : "No edits made in the viewer yet"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResubmitMode("upload")}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition",
                      resubmitMode === "upload"
                        ? "border-cnhs-green bg-cnhs-green/10 text-cnhs-green-dark dark:border-cnhs-green dark:bg-cnhs-green/20 dark:text-cnhs-green"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                    )}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <Upload size={13} />
                      <span>Upload from Device</span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Choose a file from your device
                    </span>
                  </button>
                </div>
              </div>

              {/* In-system confirmation card */}
              {resubmitMode === "in-system" ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <div className="flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-300">
                    <FileCheck size={16} />
                    <span>Your edited lesson plan will be submitted to the Principal.</span>
                  </div>
                  <p className="mt-1 text-[11px] text-emerald-800 dark:text-emerald-400">
                    Your changes will be saved into the updated lesson plan and sent to the Principal for review.
                  </p>
                </div>
              ) : (
                /* File input */
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Revised File (.pdf, .doc, .docx) *
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 outline-none file:mr-2 file:rounded-md file:border-0 file:bg-cnhs-green-dark file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                  />
                  {selectedFile ? (
                    <p className="mt-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      ✓ Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </p>
                  ) : null}
                </div>
              )}

              {/* Revision summary note */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Teacher's Note (Optional)
                </label>
                <textarea
                  rows={3}
                  value={revisionNote}
                  onChange={(e) => setRevisionNote(e.target.value)}
                  placeholder="e.g., Updated the learning activities in Procedures and revised the exercise examples."
                  className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-cnhs-green dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>

              <AnimatedBanner message={resubmitError} tone="error" className="text-xs" />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-white/5">
              <button
                type="button"
                onClick={() => setResubmitModalOpen(false)}
                disabled={resubmitting}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResubmit}
                disabled={
                  resubmitting ||
                  (resubmitMode === "in-system" ? !editedDocumentHtml : !selectedFile)
                }
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#246f54] disabled:opacity-50"
              >
                {resubmitting ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={13} />
                )}
                Submit to Principal
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AnimatedModal>
  );
}
