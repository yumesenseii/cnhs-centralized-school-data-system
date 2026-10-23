"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2, X, CheckCircle2 } from "lucide-react";
import AnimatedModal from "@/components/shared/AnimatedModal";
import {
  exportAcademicRecordsPdf,
  exportAcademicRecordsExcel,
} from "@/lib/admin/academicRecordsExport";
import { useAppToast } from "@/components/shared/AppToast";
import { cn } from "@/lib/utils";

export default function ExportAcademicRecordsModal({
  open = false,
  onClose,
  schoolYear = "SY 2026-2027",
  quarter = "Quarter 1",
  periodLabel = "",
  classTitle = "",
  teacherName = "Subject Teacher",
  students = [],
  classes = [],
  summaryCards = [],
}) {
  const [format, setFormat] = useState("pdf"); // "pdf" | "excel"
  const [generating, setGenerating] = useState(false);
  const { showToast } = useAppToast();

  const totalLearners =
    students?.length > 0
      ? students.length
      : (classes ?? []).reduce((acc, c) => acc + (c.students?.length || 0), 0);

  const resolvedScope = classTitle || "All Classes & Sections";

  async function handleExport() {
    if (generating) return;
    setGenerating(true);

    try {
      const payload = {
        students,
        classes,
        summaryCards,
        schoolYear,
        quarter,
        periodLabel,
        classTitle,
        teacherName,
        generatedAt: new Date(),
      };

      if (format === "excel") {
        await exportAcademicRecordsExcel(payload);
        showToast({
          title: "Excel report downloaded",
          description: `Academic records spreadsheet downloaded for ${resolvedScope}.`,
          type: "success",
        });
      } else {
        exportAcademicRecordsPdf(payload);
        showToast({
          title: "PDF report downloaded",
          description: `Academic records and quarterly grade summary PDF exported for ${resolvedScope}.`,
          type: "success",
        });
      }

      onClose?.();
    } catch (err) {
      console.error("[AcademicRecordsExport] Error generating report:", err);
      showToast({
        title: "Export failed",
        description: err.message || "Failed to generate academic records report. Please try again.",
        type: "error",
      });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <AnimatedModal
      open={open}
      onClose={generating ? undefined : onClose}
      labelledBy="export-academic-records-title"
      zClassName="z-[110]"
      panelClassName="w-[min(28rem,94vw)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[var(--card)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cnhs-green-soft text-cnhs-green-dark dark:bg-cnhs-green/20 dark:text-cnhs-green">
            <Download size={16} />
          </div>
          <div>
            <h2
              id="export-academic-records-title"
              className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100"
            >
              Export Academic Records
            </h2>
            <p className="text-[11px] text-slate-500">
              Download quarterly grades & class performance summary
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={generating}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-40 dark:hover:bg-white/5"
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-4 px-5 py-4">
        {/* Scope Context Card */}
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-[12px] dark:border-white/5 dark:bg-white/[0.02]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Export Scope & Context
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
            <div>
              <span className="text-[11px] text-slate-400">School Year: </span>
              <span className="font-semibold">{schoolYear}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400">Term: </span>
              <span className="font-semibold">{quarter || periodLabel || "All Terms"}</span>
            </div>
            <div className="col-span-2">
              <span className="text-[11px] text-slate-400">Scope / Class: </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{resolvedScope}</span>
            </div>
            <div className="col-span-2 flex items-center justify-between border-t border-slate-200/60 pt-2 text-[11px] dark:border-white/5">
              <span className="text-slate-500">Enrolled Records:</span>
              <span className="rounded-full bg-cnhs-green/15 px-2 py-0.5 font-bold text-cnhs-green-dark dark:text-cnhs-green">
                {totalLearners} {totalLearners === 1 ? "Learner" : "Learners"}
              </span>
            </div>
          </div>
        </div>

        {/* Format Selector */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Select Output Format
          </label>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormat("pdf")}
              disabled={generating}
              className={cn(
                "flex cursor-pointer flex-col items-start rounded-xl border p-3 text-left transition-all",
                format === "pdf"
                  ? "border-cnhs-green bg-cnhs-green-soft/40 shadow-xs ring-2 ring-cnhs-green/20 dark:bg-cnhs-green/10"
                  : "border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:hover:bg-white/[0.02]"
              )}
            >
              <div className="flex w-full items-center justify-between">
                <FileText
                  size={20}
                  className={format === "pdf" ? "text-cnhs-green-dark dark:text-cnhs-green" : "text-slate-400"}
                />
                {format === "pdf" ? (
                  <CheckCircle2 size={15} className="text-cnhs-green-dark dark:text-cnhs-green" />
                ) : null}
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                Printable PDF (.pdf)
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                A4 portrait with DepEd letterhead & grades table
              </p>
            </button>

            <button
              type="button"
              onClick={() => setFormat("excel")}
              disabled={generating}
              className={cn(
                "flex cursor-pointer flex-col items-start rounded-xl border p-3 text-left transition-all",
                format === "excel"
                  ? "border-emerald-600 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-600/20 dark:bg-emerald-950/20"
                  : "border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:hover:bg-white/[0.02]"
              )}
            >
              <div className="flex w-full items-center justify-between">
                <FileSpreadsheet
                  size={20}
                  className={format === "excel" ? "text-emerald-700 dark:text-emerald-400" : "text-slate-400"}
                />
                {format === "excel" ? (
                  <CheckCircle2 size={15} className="text-emerald-700 dark:text-emerald-400" />
                ) : null}
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                Official Excel (.xlsx)
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                Multi-tab report cover and detailed class list
              </p>
            </button>
          </div>
        </div>

        {/* DepEd Standards Disclaimer */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-2.5 text-[11px] text-slate-700 dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-300">
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            DepEd Grading Descriptors
          </p>
          <p className="mt-0.5 leading-relaxed text-slate-500 dark:text-slate-400">
            Grades are derived strictly from authorized electronic class records. 75 and above indicates passing competency.
          </p>
        </div>
      </div>

      {/* Modal Actions */}
      <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3 dark:border-white/5 dark:bg-white/[0.02]">
        <button
          type="button"
          onClick={onClose}
          disabled={generating}
          className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-white/5"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={generating || totalLearners === 0}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-cnhs-green-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generating ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              <span>Generating…</span>
            </>
          ) : (
            <>
              <Download size={14} />
              <span>Download {format.toUpperCase()}</span>
            </>
          )}
        </button>
      </div>
    </AnimatedModal>
  );
}
