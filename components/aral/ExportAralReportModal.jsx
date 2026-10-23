"use client";

import { useState } from "react";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  BookOpen,
  CheckCircle2,
  Layers,
} from "lucide-react";
import AnimatedModal from "@/components/shared/AnimatedModal";
import {
  exportPhilIriReadingPdf,
  exportPhilIriReadingExcel,
} from "@/lib/reports/philIriReportsExport";
import { useAppToast } from "@/components/shared/AppToast";
import { cn } from "@/lib/utils";

export default function ExportAralReportModal({
  open = false,
  onClose,
  schoolYear = "SY 2026-2027",
  period = "BOSY",
  language = "All Languages",
  scopeLabel = "School-wide",
  learners = [],
  form2Data = null,
  form5Data = null,
  teacherName = "",
  initialReportType = "assessment_summary",
  allowFormSelection = true,
}) {
  const [reportType, setReportType] = useState(initialReportType);
  const [format, setFormat] = useState("pdf"); // "pdf" | "excel"
  const [generating, setGenerating] = useState(false);
  const { showToast } = useAppToast();

  const totalCount =
    reportType === "form2"
      ? form2Data?.total?.totalCases ?? learners.length
      : reportType === "form5"
      ? form5Data?.total?.totalScreened ?? learners.length
      : learners.length;

  async function handleExport() {
    if (generating) return;
    setGenerating(true);

    try {
      const payload = {
        learners,
        form2Data,
        form5Data,
        schoolYear,
        period,
        language,
        scopeLabel,
        reportType,
        teacherName,
        generatedBy: teacherName || "CNHS Staff",
      };

      if (format === "excel") {
        await exportPhilIriReadingExcel(payload);
        showToast({
          title: "Excel report downloaded",
          description: `Reading assessment spreadsheet exported for ${scopeLabel}.`,
          type: "success",
        });
      } else {
        exportPhilIriReadingPdf(payload);
        showToast({
          title: "PDF report generated",
          description: `Official Phil-IRI / ARAL report generated for ${scopeLabel}.`,
          type: "success",
        });
      }

      onClose?.();
    } catch (err) {
      console.error("[PhilIriExport] Error generating report:", err);
      showToast({
        title: "Export failed",
        description: err.message || "Failed to generate reading report. Please try again.",
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
      labelledBy="export-aral-report-title"
      zClassName="z-[110]"
      panelClassName="w-[min(30rem,94vw)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[var(--card)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cnhs-green-soft text-cnhs-green-dark dark:bg-cnhs-green/20 dark:text-cnhs-green">
            <BookOpen size={16} />
          </div>
          <div>
            <h2
              id="export-aral-report-title"
              className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100"
            >
              Export Reading Assessment Report
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Official DepEd Phil-IRI & ARAL (RA 12028) standards
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        {/* Scope Context */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3 text-xs dark:border-white/10 dark:bg-white/[0.02]">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-slate-400">School Year:</span>{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {schoolYear}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Assessment Period:</span>{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {period}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Scope:</span>{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {scopeLabel}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Language Area:</span>{" "}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {language}
              </span>
            </div>
          </div>
        </div>

        {/* Report Type Selector */}
        {allowFormSelection && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Report Type
            </label>
            <div className="mt-1.5 grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setReportType("assessment_summary")}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-2.5 text-left text-xs transition-all",
                  reportType === "assessment_summary"
                    ? "border-cnhs-green bg-cnhs-green-soft/40 shadow-xs ring-1 ring-cnhs-green/30 dark:bg-cnhs-green/10"
                    : "border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-transparent"
                )}
              >
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    Assessment & GST Class Roster
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Learner GST scores, reading profiles, and assessment status
                  </p>
                </div>
                {reportType === "assessment_summary" && (
                  <CheckCircle2 size={16} className="text-cnhs-green shrink-0" />
                )}
              </button>

              {form2Data && (
                <button
                  type="button"
                  onClick={() => setReportType("form2")}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-2.5 text-left text-xs transition-all",
                    reportType === "form2"
                      ? "border-cnhs-green bg-cnhs-green-soft/40 shadow-xs ring-1 ring-cnhs-green/30 dark:bg-cnhs-green/10"
                      : "border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-transparent"
                  )}
                >
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      Phil-IRI Form 2 (School Reading Profile)
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Official DepEd grade-level breakdown by GST and Form 3 levels
                    </p>
                  </div>
                  {reportType === "form2" && (
                    <CheckCircle2 size={16} className="text-cnhs-green shrink-0" />
                  )}
                </button>
              )}

              {form5Data && (
                <button
                  type="button"
                  onClick={() => setReportType("form5")}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-2.5 text-left text-xs transition-all",
                    reportType === "form5"
                      ? "border-cnhs-green bg-cnhs-green-soft/40 shadow-xs ring-1 ring-cnhs-green/30 dark:bg-cnhs-green/10"
                      : "border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-transparent"
                  )}
                >
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      Phil-IRI Form 5 (Reading Level Summary)
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Summary report of learners requiring support vs independent
                    </p>
                  </div>
                  {reportType === "form5" && (
                    <CheckCircle2 size={16} className="text-cnhs-green shrink-0" />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setReportType("caseload")}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-2.5 text-left text-xs transition-all",
                  reportType === "caseload"
                    ? "border-cnhs-green bg-cnhs-green-soft/40 shadow-xs ring-1 ring-cnhs-green/30 dark:bg-cnhs-green/10"
                    : "border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-transparent"
                )}
              >
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    ARAL Intervention Caseload (RA 12028)
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Roster of learners under active ARAL intervention with progress outcomes
                  </p>
                </div>
                {reportType === "caseload" && (
                  <CheckCircle2 size={16} className="text-cnhs-green shrink-0" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Format Selector */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Export Format
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
                DepEd letterhead, summary KPIs & signature lines
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
                Executive cover sheet and detailed data rows
              </p>
            </button>
          </div>
        </div>

        {/* DepEd Standards Policy Notice */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-2.5 text-[11px] text-slate-700 dark:border-white/10 dark:bg-white/[0.02] dark:text-slate-300">
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            DepEd Phil-IRI & RA 12028 Legal Safeguards
          </p>
          <p className="mt-0.5 leading-relaxed text-slate-500 dark:text-slate-400">
            Phil-IRI reading profiles (Independent, Instructional, Frustration) are established strictly through official Form 3 reading assessments. Reports carry authorized Cambaog NHS metadata.
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
          disabled={generating}
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
