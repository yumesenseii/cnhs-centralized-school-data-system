"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2, X, CheckCircle2 } from "lucide-react";
import AnimatedModal from "@/components/shared/AnimatedModal";
import {
  exportSchoolDailyPdf,
  exportSchoolDailyExcel,
  exportSectionDailyPdf,
  exportSectionDailyYakalExcel,
  exportSectionDailyExcel,
} from "@/lib/attendance/exportDailyReport";
import { useAppToast } from "@/components/shared/AppToast";
import { cn } from "@/lib/utils";

export default function ExportAttendanceReportModal({
  open = false,
  onClose,
  scope = "school", // "school" | "section"
  schoolYear = "SY 2026-2027",
  monthName = "Month",
  section = null,
  summary = null,
}) {
  const [format, setFormat] = useState("pdf"); // "pdf" | "excel"
  const [generating, setGenerating] = useState(false);
  const { showToast } = useAppToast();

  const isSection = scope === "section" && Boolean(section);
  const resolvedScope = isSection
    ? `Grade ${section?.grade_level ?? "—"} · ${section?.section_name || "Section"}`
    : summary?.scopeLabel || "School-Wide Consolidated";

  const totalSections = summary?.sectionCount ?? summary?.sectionsWithData ?? "—";
  const sessionRateDisplay = summary?.sessionRate != null ? `${Number(summary.sessionRate).toFixed(1)}%` : "—";
  const learnersCount = summary?.learners?.length ?? summary?.enrolled ?? 0;

  async function handleExport() {
    if (generating || !summary) return;
    setGenerating(true);

    try {
      if (isSection) {
        if (format === "excel") {
          // Attempt Yakal-format monthly block, fallback to basic excel
          try {
            await exportSectionDailyYakalExcel({
              section,
              schoolYear,
              months: [{ monthName, summary, section, schoolYear }],
            });
          } catch {
            await exportSectionDailyExcel({
              section,
              schoolYear,
              monthName,
              summary,
            });
          }
          showToast({
            title: "Excel report exported",
            description: `Section attendance spreadsheet downloaded for ${resolvedScope} (${monthName}).`,
            type: "success",
          });
        } else {
          exportSectionDailyPdf({
            section,
            schoolYear,
            monthName,
            summary,
          });
          showToast({
            title: "PDF report opened",
            description: `Printable section attendance report generated for ${resolvedScope}.`,
            type: "success",
          });
        }
      } else {
        // School-wide consolidated
        if (format === "excel") {
          await exportSchoolDailyExcel({
            schoolYear,
            monthName,
            summary,
          });
          showToast({
            title: "Excel summary exported",
            description: `School-wide attendance summary spreadsheet downloaded for ${monthName}.`,
            type: "success",
          });
        } else {
          exportSchoolDailyPdf({
            schoolYear,
            monthName,
            summary,
          });
          showToast({
            title: "PDF summary opened",
            description: `Printable school-wide attendance summary generated for ${monthName}.`,
            type: "success",
          });
        }
      }

      onClose?.();
    } catch (err) {
      console.error("[AttendanceExport] Error generating report:", err);
      showToast({
        title: "Export failed",
        description: err.message || "Failed to generate attendance report. Please try again.",
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
      labelledBy="export-attendance-modal-title"
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
              id="export-attendance-modal-title"
              className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100"
            >
              Export Attendance Report
            </h2>
            <p className="text-[11px] text-slate-500">
              Download working attendance copy & SF2 summaries
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
              <span className="text-[11px] text-slate-400">Month: </span>
              <span className="font-semibold">{monthName}</span>
            </div>
            <div className="col-span-2">
              <span className="text-[11px] text-slate-400">Scope: </span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{resolvedScope}</span>
            </div>
            <div className="col-span-2 flex items-center justify-between border-t border-slate-200/60 pt-2 text-[11px] dark:border-white/5">
              <span className="text-slate-500">
                {isSection ? "Enrolled Learners:" : "Sections / Coverage:"}
              </span>
              <span className="rounded-full bg-cnhs-green/15 px-2 py-0.5 font-bold text-cnhs-green-dark dark:text-cnhs-green">
                {isSection ? `${learnersCount} Learners` : `${totalSections} Sections · ${sessionRateDisplay}`}
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
                Printable PDF
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                DepEd standard print shell with signatory lines
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
                {isSection ? "Yakal monthly layout & learner table" : "School-wide attendance workbook"}
              </p>
            </button>
          </div>
        </div>

        {/* DepEd Standards Disclaimer */}
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-2.5 text-[11px] text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-200">
          <p className="font-semibold text-amber-950 dark:text-amber-100">
            DepEd Transparency Notice
          </p>
          <p className="mt-0.5 leading-relaxed text-amber-800 dark:text-amber-300">
            Generated from daily Morning / Afternoon session records. Working attendance copy; verify and review before certifying official SF2.
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
          disabled={generating || !summary}
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
