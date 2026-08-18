"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Layers3,
  Loader2,
} from "lucide-react";
import Header from "@/components/layout/Header";
import AdminReportCharts from "@/components/admin/reports/AdminReportCharts";
import ClassReportsTable from "@/components/admin/reports/ClassReportsTable";
import ReportPreviewModal from "@/components/admin/reports/ReportPreviewModal";
import ReportAttendancePanel from "@/components/reports/ReportAttendancePanel";
import ClassFolderLibrary from "@/components/reports/ClassFolderLibrary";
import ReportInsightCallout from "@/components/reports/ReportInsightCallout";
import ReportKpiStrip from "@/components/reports/ReportKpiStrip";
import ReportModule from "@/components/reports/ReportModule";
import ReportSubmissionsPanel from "@/components/reports/ReportSubmissionsPanel";
import ReportSummaryMetrics from "@/components/reports/ReportSummaryMetrics";
import { useAdminReports } from "@/hooks/admin/useAdminReports";
import { buildReportInsight } from "@/lib/reports/buildReportInsight";
import {
  exportAdminClassReportPdf,
  exportAdminReportsExcel,
  exportAdminReportsPdf,
} from "@/lib/admin/reportsExport";

const selectClass =
  "h-8 cursor-pointer rounded-lg border border-slate-200 bg-white pl-8 pr-7 text-[11px] font-medium text-slate-600 outline-none hover:bg-slate-50 focus:border-cnhs-green";

const PERF_TABS = [
  { id: "summary", label: "Summary" },
  { id: "charts", label: "Charts" },
  { id: "by-class", label: "By Class" },
  { id: "breakdown", label: "Breakdown" },
];

export default function AdminReportsPage() {
  const router = useRouter();
  const {
    loading,
    error,
    schoolYear,
    quarter,
    schoolYears,
    quarters,
    quickStats,
    classReports,
    charts,
    summary,
    lessonSummary,
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
  const [perfOpen, setPerfOpen] = useState(true);
  const [perfTab, setPerfTab] = useState("summary");
  const [subsOpen, setSubsOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);

  const quarterLabel = useMemo(() => {
    if (!quarter) return "All Terms";
    const match = quarters.find((item) => item.value === quarter);
    return match?.label || `Term ${quarter}`;
  }, [quarter, quarters]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const kpiItems = useMemo(() => {
    const byId = Object.fromEntries(
      (quickStats ?? []).map((stat) => [stat.id, stat])
    );

    return [
      {
        id: "classes",
        label: "Classes",
        value: byId.classes?.value ?? schoolSummary?.totalLearners ?? 0,
        hint: `${schoolSummary?.totalLearners ?? summary?.totalStudents ?? 0} learners`,
        tone: "green",
      },
      {
        id: "at-risk",
        label: "At-risk learners",
        value: byId["at-risk"]?.value ?? schoolSummary?.atRisk ?? 0,
        hint: "High + moderate risk · ECR grades",
        badge:
          (byId["at-risk"]?.value ?? schoolSummary?.atRisk ?? 0) > 0
            ? "Attention"
            : undefined,
        tone:
          (byId["at-risk"]?.value ?? schoolSummary?.atRisk ?? 0) > 0
            ? "orange"
            : "green",
      },
      {
        id: "aral",
        label: "ARAL learners",
        value: byId.intervention?.value ?? schoolSummary?.aralScreening ?? 0,
        hint: "Screening recommended",
        tone: "blue",
      },
      {
        id: "pending",
        label: "LP pending",
        value: byId.pending?.value ?? lessonSummary?.pending ?? 0,
        hint: "Awaiting HT / admin review",
        badge:
          (byId.pending?.value ?? lessonSummary?.pending ?? 0) > 0
            ? "Review"
            : undefined,
        tone:
          (byId.pending?.value ?? lessonSummary?.pending ?? 0) > 0
            ? "red"
            : "green",
      },
    ];
  }, [quickStats, schoolSummary, summary, lessonSummary]);

  const insight = useMemo(
    () =>
      buildReportInsight({
        termLabel: quarterLabel,
        summary,
        schoolSummary,
        lessonSummary,
        scope: "admin",
      }),
    [quarterLabel, summary, schoolSummary, lessonSummary]
  );

  const summaryRows = useMemo(
    () => [
      ["Overall school average", schoolSummary?.overallAverage],
      ["Total learners", schoolSummary?.totalLearners],
      ["Total at-risk learners", schoolSummary?.atRisk],
      ["ARAL learners", schoolSummary?.aralScreening],
      ["Classroom remediation", schoolSummary?.classroomRemediation],
      ["Monitoring completion rate", schoolSummary?.monitoringCompletionRate],
      ["Lesson plans approved", schoolSummary?.lessonPlansApproved],
      [
        "Academic records validated",
        schoolSummary?.academicRecordsValidated,
      ],
      [
        "Passing rate",
        summary?.passingRate == null ? "—" : `${summary.passingRate}%`,
      ],
      ["Lowest performing subject", summary?.lowestSubject],
    ],
    [schoolSummary, summary]
  );

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
              <span className="sr-only">Term</span>
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
        <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-10 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin" />
          Loading live reports…
        </div>
      ) : (
        <div className="space-y-4">
          <ReportKpiStrip items={kpiItems} />

          <ReportModule
            title="School Performance"
            subtitle="Risk · performance · interventions · class drill-down"
            icon={<BarChart3 size={16} strokeWidth={1.8} />}
            open={perfOpen}
            onOpenChange={setPerfOpen}
            tabs={PERF_TABS}
            activeTab={perfTab}
            onTabChange={setPerfTab}
            accent="green"
            footer={<ReportInsightCallout text={insight} />}
          >
            {perfTab === "summary" ? (
              <ReportSummaryMetrics
                title="School summary · read-only"
                rows={summaryRows}
              />
            ) : null}
            {perfTab === "charts" ? (
              <AdminReportCharts charts={charts} hideAttendance />
            ) : null}
            {perfTab === "by-class" ? (
              <ClassFolderLibrary
                reports={classReports}
                onDetails={openPreview}
                onExport={handleRowExportPdf}
                groupMultiTerm={!quarter}
              />
            ) : null}
            {perfTab === "breakdown" ? (
              <ClassReportsTable
                reports={classReports}
                onPreview={openPreview}
                onExport={handleRowExportPdf}
                onExportAll={handleExportAllExcel}
              />
            ) : null}
          </ReportModule>

          <ReportModule
            title="Submissions & review"
            subtitle="Lesson plan queue · monitoring follow-up"
            icon={<ClipboardList size={16} strokeWidth={1.8} />}
            open={subsOpen}
            onOpenChange={setSubsOpen}
            accent="orange"
          >
            <ReportSubmissionsPanel
              lessonSummary={lessonSummary}
              summary={summary}
              actionLabel="Open Lesson Plan Review"
              onLessonPlanAction={() =>
                router.push("/lesson-plan-review")
              }
            />
          </ReportModule>

          <ReportModule
            title="Attendance (SF2)"
            subtitle="Monthly attendance"
            icon={<CalendarDays size={16} strokeWidth={1.8} />}
            open={attendanceOpen}
            onOpenChange={setAttendanceOpen}
            accent="sky"
          >
            <ReportAttendancePanel
              attendance={attendance}
              chartData={charts?.attendanceByMonth ?? []}
            />
          </ReportModule>
        </div>
      )}

      <ReportPreviewModal
        open={previewOpen}
        preview={preview}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewClassId(null);
        }}
        onExport={handlePreviewExport}
      />
    </motion.div>
  );
}
