"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { MONTH_LABELS } from "@/lib/attendance/constants";
import { monthsWithSavedSessions } from "@/lib/attendance/dailyAnalytics";
import { VIEW_MODAL_BACKDROP } from "@/lib/ui/viewModal";
import { cn } from "@/lib/utils";

export default function DailyExcelMonthModal({
  open,
  summary,
  scope,
  selectedMonth,
  exporting = false,
  confirmLabel = "Continue",
  onScopeChange,
  onSelectedMonthChange,
  onCancel,
  onConfirm,
}) {
  const monthsWithData = monthsWithSavedSessions(summary?.trend);
  const dataMonthSet = new Set(monthsWithData.map((row) => Number(row.month)));
  const thisMonthName = summary?.monthName || "This month";

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape" && !exporting) onCancel?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, exporting, onCancel]);

  if (!open || typeof document === "undefined") return null;

  const canDownload =
    !exporting &&
    (scope === "this_month" ||
      (scope === "one_month" && dataMonthSet.has(Number(selectedMonth))) ||
      (scope === "all_months" && monthsWithData.length > 0));

  return createPortal(
    <div
      className={cn(VIEW_MODAL_BACKDROP, "z-[100]")}
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-excel-month-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !exporting) onCancel?.();
      }}
    >
      <div className="relative z-10 w-[min(26rem,94vw)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-cnhs-green-dark">
              <FileSpreadsheet size={18} />
            </span>
            <div className="min-w-0 pt-0.5">
              <h2
                id="daily-excel-month-title"
                className="text-[16px] font-semibold tracking-tight text-slate-900"
              >
                Export Excel
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
                From saved Morning / Afternoon records. Not official DepEd
                SF2-COMP / Yakal ADA or PA.
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-100 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
              <input
                type="radio"
                name="daily-excel-scope"
                checked={scope === "this_month"}
                onChange={() => onScopeChange("this_month")}
                className="mt-0.5"
              />
              <span>
                This month
                <span className="mt-0.5 block text-[11px] text-slate-500">
                  {thisMonthName}
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-100 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50">
              <input
                type="radio"
                name="daily-excel-scope"
                checked={scope === "one_month"}
                onChange={() => onScopeChange("one_month")}
                className="mt-0.5"
              />
              <span className="min-w-0 flex-1">
                One month
                <select
                  value={selectedMonth || ""}
                  disabled={scope !== "one_month"}
                  onChange={(e) => onSelectedMonthChange(Number(e.target.value))}
                  onClick={() => onScopeChange("one_month")}
                  className="mt-1.5 block h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-[12px] font-semibold text-slate-800 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">Choose a month</option>
                  {MONTH_LABELS.map((label, i) => {
                    const month = i + 1;
                    const hasData = dataMonthSet.has(month);
                    return (
                      <option key={month} value={month} disabled={!hasData}>
                        {label}
                        {hasData ? "" : " (no saved sessions)"}
                      </option>
                    );
                  })}
                </select>
              </span>
            </label>

            <label
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-lg border border-slate-100 px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50",
                !monthsWithData.length && "cursor-not-allowed opacity-60"
              )}
            >
              <input
                type="radio"
                name="daily-excel-scope"
                checked={scope === "all_months"}
                disabled={!monthsWithData.length}
                onChange={() => onScopeChange("all_months")}
                className="mt-0.5"
              />
              <span>
                All months with data
                <span className="mt-0.5 block text-[11px] text-slate-500">
                  {monthsWithData.length
                    ? monthsWithData.map((row) => row.monthName).join(", ")
                    : "No saved sessions yet"}
                </span>
              </span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3">
          <button
            type="button"
            disabled={exporting}
            onClick={onCancel}
            className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canDownload}
            onClick={onConfirm}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3.5 text-[12px] font-semibold text-white hover:bg-[#246f54] disabled:opacity-50"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
