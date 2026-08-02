"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Download,
  FileSpreadsheet,
  Layers3,
  Loader2,
} from "lucide-react";
import Header from "@/components/layout/Header";
import AdminReportCharts from "@/components/admin/reports/AdminReportCharts";
import ClassReportsTable from "@/components/admin/reports/ClassReportsTable";
import ReportCards from "@/components/admin/reports/ReportCards";
import ReportPreviewModal from "@/components/admin/reports/ReportPreviewModal";
import ReportSummaryCards from "@/components/admin/reports/ReportSummaryCards";
import { useAdminReports } from "@/hooks/admin/useAdminReports";
import {
  exportAdminClassReportPdf,
  exportAdminReportsExcel,
  exportAdminReportsPdf,
} from "@/lib/admin/reportsExport";

const selectClass =
  "h-8 cursor-pointer rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-[11px] font-medium text-slate-600 outline-none hover:bg-slate-50 focus:border-cnhs-green";

export default function AdminReportsPage() {
  const {
    loading,
    error,
    schoolYear,
    quarter,
    schoolYears,
    quarters,
    quickStats,
    reportCards,
    classReports,
    charts,
    summary,
    schoolSummary,
    attendance,
    setSchoolYear,
    setQuarter,
    refresh,
    getPreview,
  } = useAdminReports();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewClassId, setPreviewClassId] = useState(null);
  const [toast, setToast] = useState("");

  const quarterLabel = useMemo(() => {
    if (!quarter) return "All Terms";
    const match = quarters.find((item) => item.value === quarter);
    return match?.label || `Quarter ${quarter}`;
  }, [quarter, quarters]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function openPreview(classReport) {
    const live = getPreview(classReport?.id);
    if (!live) {
      setToast("No live preview available for this class yet.");
      return;
    }
    setPreview(live);
    setPreviewClassId(classReport?.id ?? null);
    setPreviewOpen(true);
  }

  function handleCardView(card) {
    if (card.id === "academic" || card.id === "intervention") {
      if (classReports[0]) {
        openPreview(classReports[0]);
        return;
      }
    }
    if (card.id === "lesson-plan") {
      setToast("Open Lesson Plan Review for full queue details.");
      return;
    }
    if (card.id === "attendance") {
      setToast(
        "Attendance analytics are shown in the chart below (separate from academic risk)."
      );
      return;
    }
    setToast(`${card.title} summary is shown in the analytics charts.`);
  }

  function handleExportPdf() {
    try {
      exportAdminReportsPdf({
        schoolYear,
        quarter: quarterLabel,
        summary,
        schoolSummary,
        classReports,
        charts,
        attendance,
      });
      setToast("PDF export opened. Use Print → Save as PDF.");
    } catch (err) {
      setToast(err?.message ?? "Unable to export PDF.");
    }
  }

  async function handleExportExcel() {
    try {
      await exportAdminReportsExcel({
        classReports,
        summary,
        schoolSummary,
        charts,
        attendance,
        schoolYear,
        quarter: quarterLabel,
      });
      setToast("Excel export downloaded.");
    } catch (err) {
      setToast(err?.message ?? "Unable to export Excel.");
    }
  }

  function handleRowExportPdf(row) {
    try {
      exportAdminClassReportPdf({
        classReport: row,
        schoolYear,
        quarter: quarterLabel,
      });
      setToast(`PDF opened for ${row.className}. Use Print → Save as PDF.`);
    } catch (err) {
      setToast(err?.message ?? "Unable to export class PDF.");
    }
  }

  async function handleExportAllExcel() {
    try {
      await exportAdminReportsExcel({
        classReports,
        summary,
        schoolSummary,
        charts,
        attendance,
        schoolYear,
        quarter: quarterLabel,
      });
      setToast("Excel export downloaded for all classes.");
    } catch (err) {
      setToast(err?.message ?? "Unable to export Excel.");
    }
  }

  function handlePreviewExport() {
    const row = classReports.find((item) => item.id === previewClassId);
    if (!row) {
      try {
        exportAdminReportsPdf({
          schoolYear,
          quarter: quarterLabel,
          summary,
          schoolSummary,
          classReports,
          charts,
          attendance,
        });
        setToast("PDF export opened. Use Print → Save as PDF.");
      } catch (err) {
        setToast(err?.message ?? "Unable to export PDF.");
      }
      return;
    }
    handleRowExportPdf(row);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <Header
        breadcrumb="Home / Reports"
        title="Reports"
        description="Live academic analytics, intervention mix, lesson plan status, and separate SF2 attendance trends."
        controls={
          <div className="flex flex-nowrap items-center gap-2">
            <label className="relative shrink-0">
              <span className="sr-only">School Year</span>
              <CalendarDays
                size={12}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <select
                value={schoolYear}
                onChange={(e) => setSchoolYear(e.target.value)}
                className={selectClass}
              >
                {!schoolYears.length ? (
                  <option value="">No school years</option>
                ) : null}
                {schoolYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>

            <label className="relative shrink-0">
              <span className="sr-only">Quarter</span>
              <Layers3
                size={12}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <select
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                className={selectClass}
              >
                {quarters.map((item) => (
                  <option key={item.value || "all"} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => refresh()}
              className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={loading}
              className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              <Download size={12} />
              Export PDF
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={loading}
              className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white transition-colors hover:bg-[#246f54] disabled:opacity-60"
            >
              <FileSpreadsheet size={12} />
              Export Excel
            </button>
          </div>
        }
      />

      {toast ? (
        <div className="mb-3 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-[12px] font-medium text-cnhs-green-dark">
          {toast}
        </div>
      ) : null}

      {error ? (
        <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[12px] text-red-600">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-4 py-10 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" />
          Loading live reports…
        </div>
      ) : (
        <>
          <ReportSummaryCards stats={quickStats} />

          <div className="mt-3">
            <AdminReportCharts charts={charts} />
          </div>

          <div className="mt-3">
            <ReportCards cards={reportCards} onView={handleCardView} />
          </div>

          <div className="mt-3">
            <ClassReportsTable
              reports={classReports}
              onPreview={openPreview}
              onExport={handleRowExportPdf}
              onExportAll={handleExportAllExcel}
            />
          </div>
        </>
      )}

      <ReportPreviewModal
        open={previewOpen}
        preview={preview}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewClassId(null);
        }}
        onExport={handlePreviewExport}
        onSaveDraft={() => setToast("Draft save is not available yet.")}
        onFinalize={() => setToast("Finalize is not available yet.")}
      />
    </motion.div>
  );
}
