"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookOpen,
  CalendarDays,
  Download,
  FileSpreadsheet,
  Layers3,
  Loader2,
  Menu,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import ClassReportsTable from "@/components/teacher/reports/ClassReportsTable";
import ReportCards from "@/components/teacher/reports/ReportCards";
import ReportCharts from "@/components/teacher/reports/ReportCharts";
import ReportPreviewModal from "@/components/teacher/reports/ReportPreviewModal";
import ReportSummaryCards from "@/components/teacher/reports/ReportSummaryCards";
import { useTeacherReports } from "@/hooks/teacher/useTeacherReports";
import { SIDEBAR_SHEET_CLASS } from "@/lib/constants/layout";
import {
  QUARTER_OPTIONS,
  REPORT_FILTER_ALL,
} from "@/lib/teacher/reportsConstants";
import {
  exportSingleClassReportExcel,
  exportTeacherReportsExcel,
  exportTeacherReportsPdf,
} from "@/lib/teacher/reportsExport";

function ReportsSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`summary-skel-${index}`}
            className="h-[132px] animate-pulse rounded-xl border border-slate-100 bg-slate-100/80"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`card-skel-${index}`}
            className="h-[180px] animate-pulse rounded-xl border border-slate-100 bg-slate-100/80"
          />
        ))}
      </div>
      <div className="h-[280px] animate-pulse rounded-xl border border-slate-100 bg-slate-100/80" />
    </div>
  );
}

export default function TeacherReportsPage() {
  const {
    loading,
    error,
    teacherName,
    summary,
    summaryCards,
    reportCards,
    classReports,
    charts,
    schoolYear,
    quarter,
    quarterLabel,
    subject,
    section,
    schoolYears,
    subjects,
    sections,
    setSchoolYear,
    setQuarter,
    setSubject,
    setSection,
    getPreview,
  } = useTeacherReports();

  const [menuOpen, setMenuOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function openPreview(classReport) {
    setPreview(getPreview(classReport));
    setPreviewOpen(true);
  }

  function handleViewReport(card) {
    if (classReports[0]) {
      openPreview(classReports[0]);
      setToast(`Opened ${card.title}.`);
      return;
    }
    setToast("No class report available for the selected filters.");
  }

  function handleExportPdf() {
    try {
      exportTeacherReportsPdf({
        teacherName,
        schoolYear,
        quarter: quarterLabel,
        summary,
        classReports,
        charts,
      });
      setToast("PDF export opened. Use Print → Save as PDF.");
    } catch (err) {
      setToast(err?.message ?? "Unable to export PDF.");
    }
  }

  async function handleExportExcel() {
    try {
      await exportTeacherReportsExcel({
        classReports,
        summary,
        charts,
        teacherName,
        schoolYear,
        quarter: quarterLabel,
      });
      setToast("Excel export downloaded.");
    } catch (err) {
      setToast(err?.message ?? "Unable to export Excel.");
    }
  }

  async function handleRowExport(row) {
    try {
      await exportSingleClassReportExcel(row);
      setToast(`Exported Excel for ${row.subject}.`);
    } catch (err) {
      setToast(err?.message ?? "Unable to export class report.");
    }
  }

  const selectClassName =
    "h-8 cursor-pointer rounded-full border border-slate-200 bg-white pl-8 pr-7 text-[11px] font-medium text-slate-600 shadow-sm outline-none hover:bg-slate-50 focus:border-cnhs-green";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <header className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-medium text-slate-400">
              <Link href="/teacher/dashboard" className="hover:text-slate-600">
                Home
              </Link>
              <span className="text-slate-300"> &gt; </span>
              <span className="font-semibold text-slate-600">Reports</span>
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-800 sm:text-[22px]">
              Reports
            </h1>
            <p className="mt-1 max-w-xl text-[12px] text-slate-500">
              Review your class reports, intervention recommendations, lesson plan submissions,
              and academic performance.
            </p>
          </div>

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger
              render={
                <button
                  type="button"
                  aria-label="Open teacher menu"
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
                />
              }
            >
              <Menu size={18} />
            </SheetTrigger>
            <SheetContent
              side="left"
              showCloseButton={false}
              className={SIDEBAR_SHEET_CLASS}
            >
              <SheetTitle className="sr-only">Teacher navigation</SheetTitle>
              <TeacherSidebar mobile onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <label className="relative">
            <span className="sr-only">School Year</span>
            <CalendarDays
              size={12}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <select
              value={schoolYear}
              onChange={(event) => setSchoolYear(event.target.value)}
              className={selectClassName}
            >
              {schoolYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className="relative">
            <span className="sr-only">Quarter</span>
            <Layers3
              size={12}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <select
              value={String(quarter)}
              onChange={(event) => setQuarter(event.target.value)}
              className={selectClassName}
            >
              {QUARTER_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="relative">
            <span className="sr-only">Subject</span>
            <BookOpen
              size={12}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <select
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className={selectClassName}
            >
              <option value={REPORT_FILTER_ALL}>All Subjects</option>
              {subjects.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="relative">
            <span className="sr-only">Section</span>
            <Layers3
              size={12}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <select
              value={section}
              onChange={(event) => setSection(event.target.value)}
              className={selectClassName}
            >
              <option value={REPORT_FILTER_ALL}>All Sections</option>
              {sections.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={loading}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-red-600 shadow-sm transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download size={12} />
            Export PDF
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={loading}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FileSpreadsheet size={12} />
            Export Excel
          </button>
        </div>
      </header>

      {toast ? (
        <div className="mb-4 rounded-xl border border-green-100 bg-green-50 px-3 py-2.5 text-[12px] font-medium text-cnhs-green-dark">
          {toast}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            Loading report data…
          </div>
          <ReportsSkeleton />
        </div>
      ) : !classReports.length && !error ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
          <p className="text-sm font-semibold text-slate-800">No reports available</p>
          <p className="mt-2 text-xs text-slate-500">
            No assigned classes match the selected school year, quarter, subject, or section.
          </p>
        </div>
      ) : (
        <>
          <ReportSummaryCards cards={summaryCards} />

          <div className="mt-4">
            <ReportCards cards={reportCards} onView={handleViewReport} />
          </div>

          <div className="mt-4">
            <ReportCharts charts={charts} />
          </div>

          <div className="mt-4">
            <ClassReportsTable
              reports={classReports}
              onPreview={openPreview}
              onExport={handleRowExport}
            />
          </div>
        </>
      )}

      <ReportPreviewModal
        open={previewOpen}
        preview={preview}
        onClose={() => setPreviewOpen(false)}
        onExport={() => {
          if (!preview?.id) return;
          const row = classReports.find((item) => item.id === preview.id);
          if (row) {
            try {
              exportTeacherReportsPdf({
                teacherName,
                schoolYear,
                quarter: quarterLabel,
                summary: {
                  totalClasses: 1,
                  totalStudents: row.students,
                  aralScreeningCount: row.aralScreening,
                  classroomRemedialCount: row.classroomRemedialRecommended ? 1 : 0,
                  averageClassGrade: row.averageGradeValue ?? row.averageGrade,
                  monitoringCompletionRate: 0,
                },
                classReports: [row],
                charts,
              });
              setToast("PDF export opened for class preview.");
            } catch (err) {
              setToast(err?.message ?? "Unable to export PDF.");
            }
          }
        }}
      />
    </motion.div>
  );
}
