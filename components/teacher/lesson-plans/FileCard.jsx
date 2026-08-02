"use client";

import { FileText, RefreshCw, Trash2 } from "lucide-react";

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function FileCard({ file, onReplace, onRemove, progress }) {
  if (!file) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-cnhs-green-dark shadow-sm">
          <FileText size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-slate-800">{file.name}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            {formatBytes(file.size)} · {file.extension?.toUpperCase()} · Uploaded{" "}
            {file.uploadedAt}
          </p>

          {typeof progress === "number" && progress < 100 ? (
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-slate-500">
                <span>Uploading...</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-cnhs-green-dark transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[11px] font-medium text-cnhs-green-dark">Upload complete</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onReplace}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
        >
          <RefreshCw size={12} />
          Replace File
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-[11px] font-semibold text-red-600 transition-colors hover:bg-red-50"
        >
          <Trash2 size={12} />
          Remove File
        </button>
      </div>
    </div>
  );
}
