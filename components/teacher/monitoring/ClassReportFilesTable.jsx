"use client";

import {
  Eye,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Send,
} from "lucide-react";
import { Pill, avatarTones } from "@/components/teacher/monitoring/shared";
import {
  ARAL_APPROVAL_STATUS,
  aralApprovalStyles,
} from "@/lib/monitoring/aralApproval";
import { cn } from "@/lib/utils";

const htStyles = {
  ...aralApprovalStyles,
  Draft: aralApprovalStyles[ARAL_APPROVAL_STATUS.SUGGESTED],
  "Not applicable": "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
  "—": "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
};

/**
 * Planning & Research–style class report file cabinet.
 */
export default function ClassReportFilesTable({
  files = [],
  totalCount,
  onView,
  onEdit,
  onSubmitToHt,
  submittingFileId = "",
  showHtActions = true,
}) {
  const total = typeof totalCount === "number" ? totalCount : files.length;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-[12px] font-medium text-slate-500">
          Showing {files.length} of {total}{" "}
          {total === 1 ? "file" : "files"}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[880px] w-full border-collapse text-left">
          <thead>
            <tr>
              {["File name", "Type", "Modified", "Uploaded by", "HT status", "Actions"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {files.map((file) => {
              const submitting = submittingFileId === file.id;
              const canSubmit =
                showHtActions &&
                file.aralEligible &&
                file.htMeta?.aralCount > 0 &&
                file.htStatus !== ARAL_APPROVAL_STATUS.APPROVED &&
                file.htStatus !== ARAL_APPROVAL_STATUS.SUBMITTED;

              return (
                <tr
                  key={file.id}
                  className="border-t border-slate-100 transition-colors hover:bg-slate-50/60"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-cnhs-green-dark">
                        <FileSpreadsheet size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-slate-800">
                          {file.fileName}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {file.learnerCount} learners · {file.passingCount}{" "}
                          passing · {file.failingCount} failing
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] font-semibold text-emerald-700">
                      Excel
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] font-medium text-slate-600">
                    {file.modifiedLabel}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold",
                          avatarTones.green
                        )}
                      >
                        {file.uploadedByInitials}
                      </span>
                      <span className="text-[12px] font-medium text-slate-700">
                        {file.uploadedBy}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Pill value={file.htLabel} styles={htStyles} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onView?.(file)}
                        className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Eye size={11} />
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit?.(file)}
                        className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-cnhs-green-dark/30 bg-white px-2.5 text-[10px] font-semibold text-cnhs-green-dark transition-colors hover:bg-green-50"
                      >
                        <Pencil size={11} />
                        Edit
                      </button>
                      {canSubmit ? (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => onSubmitToHt?.(file)}
                          title="Submit ARAL recommendations in this file for Head Teacher review"
                          className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 text-[10px] font-semibold text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-50"
                        >
                          {submitting ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <Send size={11} />
                          )}
                          Send to HT
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {files.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-slate-500">
          No class report files match your filters.
        </div>
      ) : null}
    </section>
  );
}
