"use client";

import { useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import StatusBadge from "@/components/teacher/lesson-plans/StatusBadge";
import { VIEW_MODAL_BACKDROP, VIEW_MODAL_PANEL } from "@/lib/ui/viewModal";
import { cn } from "@/lib/utils";

function isPdf(plan) {
  const type = String(plan?.fileType || "").toLowerCase();
  const name = String(plan?.fileName || "").toLowerCase();
  return type.includes("pdf") || name.endsWith(".pdf");
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
}) {
  const fileInputRef = useRef(null);
  const [resubmitError, setResubmitError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  if (!open || !plan) return null;

  const canResubmit = plan.canResubmit || plan.status === "Needs Revision";
  const isApproved = plan.isApproved || plan.status === "Approved";

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setResubmitError("");
    const result = await onResubmit?.(plan, file);
    if (!result?.ok) {
      setResubmitError(result?.error?.message ?? "Failed to resubmit lesson plan.");
    }
  }

  return (
    <div
      className={VIEW_MODAL_BACKDROP}
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className={VIEW_MODAL_PANEL}>
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Submission Details
            </p>
            <h2 className="mt-1 truncate text-base font-semibold text-slate-900">
              {plan.lessonTitle}
            </h2>
            <p className="mt-1 text-[12px] text-slate-500">
              {plan.subject} · {plan.gradeSection}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge status={plan.status} />
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-5">
          <dl className="grid grid-cols-2 gap-3 text-[12px] lg:grid-cols-4">
            {[
              ["Tracking No.", plan.trackingNumber],
              ["Week Covered", plan.weekCovered || plan.week],
              ["Term", plan.quarter],
              ["School Year", plan.schoolYear],
              ["Current Status", plan.status],
              ["Submitted", plan.submittedAt || plan.submittedDate],
              ["Reviewed", plan.reviewedAt || plan.reviewedDate || "—"],
              ["Reviewed By", plan.reviewedBy || "—"],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                  {label}
                </dt>
                <dd className="mt-1 break-words font-semibold text-slate-800">
                  {value || "—"}
                </dd>
              </div>
            ))}
            <div className="col-span-2 min-w-0 lg:col-span-4">
              <dt className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                Learning Competency
              </dt>
              <dd className="mt-1 break-words font-medium text-slate-700">
                {plan.learningCompetency || "—"}
              </dd>
            </div>
            <div className="col-span-2 min-w-0 lg:col-span-4">
              <dt className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                Review Remarks
              </dt>
              <dd className="mt-1 break-words font-medium text-slate-700">
                {plan.remarks || "—"}
              </dd>
            </div>
          </dl>

          {Array.isArray(plan.timeline) && plan.timeline.length ? (
            <section>
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Timeline
              </h3>
              <ol className="flex flex-wrap gap-x-4 gap-y-2">
                {plan.timeline.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-2 text-[12px]"
                  >
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        item.done ? "bg-cnhs-green-dark" : "bg-slate-200"
                      )}
                    />
                    <span
                      className={cn(
                        "font-medium",
                        item.done ? "text-slate-800" : "text-slate-400"
                      )}
                    >
                      {item.label}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold text-slate-600">
                <FileText size={14} className="shrink-0 text-slate-400" />
                <span className="truncate" title={plan.fileName}>
                  {plan.fileName}
                </span>
              </div>
              {fileUrl ? (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-cnhs-green-dark"
                >
                  <ExternalLink size={12} />
                  Open
                </a>
              ) : null}
            </div>

            <div
              className={cn(
                "bg-white",
                isPdf(plan) ? "h-[200px]" : "px-4 py-6"
              )}
            >
              {loadingUrl ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  Loading file...
                </div>
              ) : isPdf(plan) && fileUrl ? (
                <iframe
                  title={plan.fileName}
                  src={fileUrl}
                  className="h-full w-full"
                />
              ) : (
                <div className="px-2 text-center">
                  <p
                    className="mx-auto max-w-full break-all text-sm font-semibold text-slate-800"
                    title={plan.fileName}
                  >
                    {plan.fileName}
                  </p>
                  <p className="mt-1 text-[12px] text-slate-500">
                    Preview is available for PDF files. Use Download/Open for
                    DOC/DOCX.
                  </p>
                  {fileUrl ? (
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white"
                    >
                      <Download size={13} />
                      Download / Open
                    </a>
                  ) : null}
                </div>
              )}
            </div>
          </section>

          {isApproved ? (
            <p className="rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-[12px] text-cnhs-green-dark">
              This lesson plan is approved. Editing and resubmission are
              disabled.
            </p>
          ) : null}

          {resubmitError ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[12px] text-red-600">
              {resubmitError}
            </div>
          ) : null}
          {deleteError ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[12px] text-red-600">
              {deleteError}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-4 py-3 sm:px-5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
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
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {deleting ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Trash2 size={13} />
            )}
            {deleting ? "Deleting..." : "Delete"}
          </button>
          <button
            type="button"
            onClick={() => onDownload?.(plan)}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white hover:bg-[#246f54]"
          >
            <Download size={13} />
            Download
          </button>
          {canResubmit ? (
            <button
              type="button"
              disabled={resubmitting || deleting}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-cnhs-orange bg-orange-50 px-3 text-[11px] font-semibold text-cnhs-orange transition-colors hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {resubmitting ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Upload size={13} />
              )}
              {resubmitting ? "Resubmitting..." : "Resubmit Lesson Plan"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
