"use client";

import {
  Eye,
  FileBarChart,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

const statusStyles = {
  saved: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  progress: "bg-sky-50 text-sky-700 ring-sky-100",
  draft: "bg-slate-100 text-slate-500 ring-slate-200",
  ready: "bg-violet-50 text-violet-700 ring-violet-100",
};

const typeStyles = {
  weekly: "text-emerald-700",
  assessment: "text-sky-700",
  report: "text-violet-700",
};

/**
 * ARAL section file cabinet table (Academic Monitoring style).
 */
export default function AralSectionFilesTable({
  files = [],
  onView,
  onUpload,
  onToolbarUpload,
  onGenerateReport,
  uploadingFileId = "",
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <p className="text-[12px] font-medium text-slate-500">
          Showing {files.length} {files.length === 1 ? "file" : "files"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {onGenerateReport ? (
            <button
              type="button"
              onClick={onGenerateReport}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 text-[11px] font-semibold text-violet-800 hover:bg-violet-100"
            >
              <FileBarChart size={12} />
              Generate Report
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToolbarUpload}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white hover:bg-[#246f54]"
          >
            <Upload size={12} />
            Upload file
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[880px] w-full border-collapse text-left">
          <thead>
            <tr>
              {["File name", "Type", "Modified", "Status", "Actions"].map(
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
              const uploading = uploadingFileId === file.id;
              const canReupload = file.canUpload && file.hasUpload;

              return (
                <tr
                  key={file.id}
                  className="border-t border-slate-100 transition-colors hover:bg-slate-50/60"
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => onView?.(file)}
                      className="flex w-full cursor-pointer items-center gap-2.5 text-left"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-cnhs-green-dark">
                        <FileSpreadsheet size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-slate-800">
                          {file.fileName}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {file.subtitle}
                        </p>
                      </div>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "text-[12px] font-semibold",
                        typeStyles[file.typeTone] || "text-slate-700"
                      )}
                    >
                      {file.typeLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] font-medium text-slate-600">
                    {file.modifiedLabel}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                        statusStyles[file.statusTone] || statusStyles.draft
                      )}
                    >
                      {file.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onView?.(file)}
                        className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full bg-cnhs-green-dark px-2.5 text-[10px] font-semibold text-white hover:bg-[#246f54]"
                      >
                        <Eye size={11} />
                        View
                      </button>
                      {canReupload ? (
                        <button
                          type="button"
                          disabled={uploading}
                          onClick={() => onUpload?.(file)}
                          className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {uploading ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <Upload size={11} />
                          )}
                          Re-upload
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
          No files uploaded yet. Use Upload file for the Excel prepared by the
          subject teacher.
        </div>
      ) : null}
    </section>
  );
}
