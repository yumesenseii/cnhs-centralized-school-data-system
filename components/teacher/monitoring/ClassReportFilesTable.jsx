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
  "Not for HT": "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
  "Sent to HT": aralApprovalStyles[ARAL_APPROVAL_STATUS.SUBMITTED],
  "For your review": aralApprovalStyles[ARAL_APPROVAL_STATUS.SUBMITTED],
  "—": "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
};

/**
 * Planning & Research–style class report file cabinet.
 */
export default function ClassReportFilesTable({
  files = [],
  totalCount,
  emptyMessage = "No files to display.",
  onView,
  onEdit,
  onSubmitToHt,
  submittingFileId = "",
  showHtActions = true,
  showHtHint = true,
}) {
  const total = typeof totalCount === "number" ? totalCount : files.length;
  const hasNotForHt = files.some(
    (f) => f.htLabel === "Not for HT" || f.htStatus === "Not applicable"
  );

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-[12px] font-medium text-slate-500">
          Showing {files.length} of {total}{" "}
          {total === 1 ? "file" : "files"}
        </p>
        {showHtHint ? (
          <p className="mt-1 text-[12px] text-slate-400">
            HT receives Eng/Fil class reports after you Send to HT
            {hasNotForHt
              ? " · Other subjects show “Not for HT”."
              : "."}
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[880px] w-full border-collapse text-left">
          <thead className="bg-slate-50/80">
            <tr>
              {["File name", "Type", "Modified", "Uploaded by", "HT status", "Actions"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 last:text-right"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {files.length === 0 ? (
              <tr className="border-t border-slate-100">
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-slate-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              files.map((file) => {
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
                        <p className="text-[12px] text-slate-500">
                          {file.learnerCount} learners · {file.failingCount}{" "}
                          failing ·{" "}
                          {file.moderateCount ?? file.atRiskCount ?? 0}{" "}
                          moderate · {file.passingCount} passing
                          {file.quarterLabel
                            ? ` · ${file.quarterLabel}`
                            : ""}
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
                          "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold",
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
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onView?.(file)}
                        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 active:scale-95"
                      >
                        <Eye size={13} />
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit?.(file)}
                        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 active:scale-95"
                      >
                        <Pencil size={13} />
                        Edit
                      </button>
                      {canSubmit ? (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => onSubmitToHt?.(file)}
                          title="Submit ARAL recommendations in this file for School Principal review"
                          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 text-[12px] font-semibold text-amber-900 shadow-xs transition-colors hover:bg-amber-100 active:scale-95 disabled:opacity-50"
                        >
                          {submitting ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Send size={13} />
                          )}
                          Send to HT
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
