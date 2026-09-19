"use client";

import { useEffect, useState } from "react";
import AnimatedModal from "@/components/shared/AnimatedModal";
import {
  ADMIN_REPORT_EXPORT_OPTIONS,
  ADMIN_REPORT_EXPORT_SECTIONS,
} from "@/lib/admin/reportsExport";
import { cn } from "@/lib/utils";

/**
 * Compact chooser for school PDF / Excel export (not a report builder).
 */
export default function ExportSchoolReportModal({
  open,
  format = "pdf",
  schoolYear = "",
  termLabel = "All Terms",
  busy = false,
  onClose,
  onConfirm,
}) {
  const [sections, setSections] = useState({ ...ADMIN_REPORT_EXPORT_SECTIONS });

  useEffect(() => {
    if (open) {
      setSections({ ...ADMIN_REPORT_EXPORT_SECTIONS });
    }
  }, [open, format]);

  const selectedCount = Object.values(sections).filter(Boolean).length;
  const formatLabel = format === "excel" ? "Excel" : "PDF";

  function toggle(id) {
    setSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <AnimatedModal
      open={open}
      onClose={onClose}
      labelledBy="export-school-report-title"
      zClassName="z-[100]"
      panelClassName="w-[min(24rem,94vw)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[var(--card)]"
    >
      <div className="px-5 pb-3 pt-5">
        <h2
          id="export-school-report-title"
          className="text-[16px] font-semibold tracking-tight text-slate-900 dark:text-slate-100"
        >
          Export school report
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
          {schoolYear || "—"} · {termLabel} · {formatLabel}
        </p>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
          Include
        </p>
        <ul className="mt-2 space-y-2">
          {ADMIN_REPORT_EXPORT_OPTIONS.map((opt) => {
            const checked = Boolean(sections[opt.id]);
            return (
              <li key={opt.id}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
                    checked
                      ? "border-cnhs-green/40 bg-cnhs-green-soft/50 dark:bg-cnhs-green-soft"
                      : "border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:hover:bg-white/[0.03]"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(opt.id)}
                    disabled={busy}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cnhs-green-dark accent-cnhs-green-dark"
                  />
                  <span className="text-[12px] font-medium leading-snug text-slate-700 dark:text-slate-200">
                    {opt.label}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
          Grades from class records. Attendance from Morning and Afternoon
          marks.
        </p>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-white/5 dark:bg-white/[0.02]">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-transparent dark:text-slate-200"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || selectedCount === 0}
          onClick={() => onConfirm?.(sections)}
          className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-cnhs-green-dark px-3.5 text-[12px] font-semibold text-white hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Preparing…" : "Download"}
        </button>
      </div>
    </AnimatedModal>
  );
}
