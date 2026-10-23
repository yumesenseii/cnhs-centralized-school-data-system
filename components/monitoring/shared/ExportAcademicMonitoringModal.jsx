"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2, X, CheckCircle2 } from "lucide-react";
import AnimatedModal from "@/components/shared/AnimatedModal";
import {
  exportAcademicMonitoringPdf,
  exportAcademicMonitoringExcel,
} from "@/lib/reports/academicMonitoringExport";
import { useAppToast } from "@/components/shared/AppToast";
import { cn } from "@/lib/utils";

export default function ExportAcademicMonitoringModal({
  open = false,
  onClose,
  role = "teacher",
  teacherName = "Teacher",
  schoolYear = "SY 2026-2027",
  quarter = "Quarter 1",
  gradeLevel = "All Grades",
  sectionName = "All Sections",
  scopeLabel = null,
  learners = [],
  classSummaries = [],
  summaryCounts = null,
}) {
  const [format, setFormat] = useState("pdf"); // "pdf" | "excel"
  const [generating, setGenerating] = useState(false);
  const { showToast } = useAppToast();

  const totalLearners = learners?.length || 0;
  const resolvedScope =
    scopeLabel ||
    (sectionName && sectionName !== "All Sections"
      ? `${gradeLevel !== "All Grades" ? gradeLevel + " - " : ""}${sectionName}`
      : role === "principal"
      ? "School-Wide Consolidated"
      : "Assigned Subject Classes");

  async function handleExport() {
    if (generating) return;
    setGenerating(true);

    try {
      const payload = {
        role,
        teacherName,
        schoolYear,
        quarter,
        gradeLevel,
        sectionName,
        scopeLabel: resolvedScope,
        learners,
        classSummaries,
        summaryCounts,
        generatedAt: new Date(),
      };

      if (format === "excel") {
        await exportAcademicMonitoringExcel(payload);
        showToast({
          title: "Excel report downloaded",
          description: `Academic monitoring workbook exported for ${resolvedScope}.`,
          type: "success",
        });
      } else {
        exportAcademicMonitoringPdf(payload);
        showToast({
          title: "PDF report downloaded",
          description: `Academic monitoring summary PDF exported for ${resolvedScope}.`,
          type: "success",
        });
      }

      onClose?.();
    } catch (err) {
      console.error("[AcademicMonitoringExport] Error generating report:", err);
      showToast({
        title: "Export failed",
        description: err.message || "Failed to generate monitoring report. Please try again.",
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
      labelledBy="export-academic-monitoring-title"
      zClassName="z-[110]"
      panelClassName="w-[min(28rem,94vw)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[var(--card)]"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cnhs-green-soft text-cnhs-green-dark dark:bg-cnhs-green/20 dark:text-cnhs-green">
            <Download size={16} />
          </div>
          <div>
            <h2
              id="export-academic-monitoring-title"
              className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100"
            >
              Export Academic Monitoring Report
            </h2>
            <p className="text-[11px] text-slate-500">
              Download official performance and risk data
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
              <span className="font-semibold">{quarter}</span>
            </div>
            <div className="col-span-2">
              <span className="text-[11px] text-slate-400">Scope: </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{resolvedScope}</span>
            </div>
            <div className="col-span-2 flex items-center justify-between border-t border-slate-200/60 pt-2 text-[11px] dark:border-white/5">
              <span className="text-slate-500">Monitored Records:</span>
              <span className="rounded-full bg-cnhs-green/15 px-2 py-0.5 font-bold text-cnhs-green-dark dark:text-cnhs-green">
                {totalLearners} {totalLearners === 1 ? "Learner" : "Learners"}
              </span>
            </div>
          </div>
        </div>

        {/* Format Chooser */}
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
                Official PDF (.pdf)
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                A4 portrait with DepEd letterhead & signatory lines
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
                Excel Sheet (.xlsx)
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                Multi-sheet workbook with summary & roster
              </p>
            </button>
          </div>
        </div>

        <p className="text-[10px] leading-relaxed text-slate-400">
          Official DepEd risk bands (&lt;75 High, 75–84.99 Moderate, ≥85 Low) are derived strictly from finalized records. Incomplete curricula are designated as Pending Evidence.
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3 dark:border-white/5 dark:bg-white/[0.02]">
        <button
          type="button"
          onClick={onClose}
          disabled={generating}
          className="inline-flex h-9 cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-transparent dark:text-slate-300"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={generating || totalLearners === 0}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-cnhs-green-dark px-4 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-cnhs-green disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generating ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              <span>Generating…</span>
            </>
          ) : (
            <>
              <Download size={13} />
              <span>Export {format.toUpperCase()}</span>
            </>
          )}
        </button>
      </div>
    </AnimatedModal>
  );
}
