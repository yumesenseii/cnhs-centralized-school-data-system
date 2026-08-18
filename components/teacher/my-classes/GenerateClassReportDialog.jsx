"use client";

import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, X } from "lucide-react";
import {
  REPORT_TERM_ALL,
  REPORT_TERM_OPTIONS,
} from "@/lib/monitoring/classReportFiles";
import { VIEW_MODAL_BACKDROP } from "@/lib/ui/viewModal";
import { cn } from "@/lib/utils";

/**
 * Simple term picker before creating Academic Monitoring class report files.
 */
export default function GenerateClassReportDialog({
  open,
  classItem,
  onClose,
  onConfirm,
  confirming = false,
}) {
  const defaultTerm = useMemo(() => {
    const q = Number(classItem?.quarterNumber);
    if (Number.isFinite(q) && q >= 1 && q <= 4) return q;
    return 1;
  }, [classItem?.quarterNumber, classItem?.id]);

  const [selected, setSelected] = useState(defaultTerm);

  useEffect(() => {
    if (open) setSelected(defaultTerm);
  }, [open, defaultTerm]);

  if (!open || !classItem) return null;

  const options = [
    ...REPORT_TERM_OPTIONS,
    { value: REPORT_TERM_ALL, label: "All Terms (one file per term)" },
  ];

  return (
    <div
      className={VIEW_MODAL_BACKDROP}
      role="dialog"
      aria-modal="true"
      aria-labelledby="generate-report-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !confirming) onClose?.();
      }}
    >
      <div className="relative z-10 w-[min(440px,94vw)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Academic Monitoring
            </p>
            <h2
              id="generate-report-title"
              className="mt-1 text-[16px] font-semibold tracking-tight text-slate-900"
            >
              Generate class report
            </h2>
            <p className="mt-1 text-[12px] text-slate-500">
              {classItem.subject} · {classItem.gradeSection}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={confirming}
            onClick={onClose}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </header>

        <div className="space-y-3 px-5 py-4">
          <p className="text-[12px] leading-relaxed text-slate-600">
            Choose which term to classify. Risk and Failing / Moderate / Passing
            use <strong className="font-semibold text-slate-800">only that
            term&apos;s grade</strong>. Empty later terms are ignored (e.g.
            Term 1 season).
          </p>

          <fieldset className="space-y-1.5">
            <legend className="sr-only">Report term</legend>
            {options.map((opt) => {
              const active = selected === opt.value;
              return (
                <label
                  key={String(opt.value)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                    active
                      ? "border-cnhs-green-dark/40 bg-green-50/80"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  )}
                >
                  <input
                    type="radio"
                    name="report-term"
                    value={String(opt.value)}
                    checked={active}
                    onChange={() => setSelected(opt.value)}
                    className="h-4 w-4 accent-cnhs-green-dark"
                  />
                  <span className="text-[13px] font-medium text-slate-800">
                    {opt.label}
                  </span>
                </label>
              );
            })}
          </fieldset>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            disabled={confirming}
            onClick={onClose}
            className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={confirming}
            onClick={() => onConfirm?.(selected)}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3.5 text-[12px] font-semibold text-white hover:bg-[#246f54] disabled:opacity-50"
          >
            <FileSpreadsheet size={14} />
            {confirming ? "Generating…" : "Generate"}
          </button>
        </footer>
      </div>
    </div>
  );
}
