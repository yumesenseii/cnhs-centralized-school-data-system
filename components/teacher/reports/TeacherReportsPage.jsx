"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Layers3,
  Loader2,
} from "lucide-react";
import MobileNavSheet from "@/components/layout/MobileNavSheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import ClassReportsTable from "@/components/teacher/reports/ClassReportsTable";
import ReportCharts from "@/components/teacher/reports/ReportCharts";
import ReportPreviewModal from "@/components/teacher/reports/ReportPreviewModal";
import ReportAttendancePanel from "@/components/reports/ReportAttendancePanel";
import ReportByClassGrid from "@/components/reports/ReportByClassGrid";
import ReportInsightCallout from "@/components/reports/ReportInsightCallout";
import ReportKpiStrip from "@/components/reports/ReportKpiStrip";
import ReportModule from "@/components/reports/ReportModule";
import ReportSubmissionsPanel from "@/components/reports/ReportSubmissionsPanel";
import ReportSummaryMetrics from "@/components/reports/ReportSummaryMetrics";
import { useTeacherReports } from "@/hooks/teacher/useTeacherReports";
import { buildReportInsight } from "@/lib/reports/buildReportInsight";
import {
  QUARTER_OPTIONS,
  REPORT_FILTER_ALL,
} from "@/lib/teacher/reportsConstants";
import {
  exportSingleClassReportExcel,
  exportTeacherReportsExcel,
  exportTeacherReportsPdf,
} from "@/lib/teacher/reportsExport";

const PERF_TABS = [
  { id: "summary", label: "Summary" },
  { id: "charts", label: "Charts" },
  { id: "by-class", label: "By Class" },
  { id: "breakdown", label: "Breakdown" },
];

function ReportsSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={`summary-skel-${index}`}
            className="h-[110px] animate-pulse rounded-2xl border border-slate-100 bg-slate-100/80"
          />
        ))}
      </div>
      <div className="h-[280px] animate-pulse rounded-2xl border border-slate-100 bg-slate-100/80" />
      <div className="h-[120px] animate-pulse rounded-2xl border border-slate-100 bg-slate-100/80" />
    </div>
  );
}

export default function TeacherReportsPage() {
  const router = useRouter();
  const {
    loading,
    error,
    teacherName,
    summary,
    lessonSummary,
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

  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [toast, setToast] = useState("");
  const [perfOpen, setPerfOpen] = useState(true);
  const [perfTab, setPerfTab] = useState("summary");
  const [subsOpen, setSubsOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const kpiItems = useMemo(() => {
    const avg =
      summary?.averageClassGrade == null
        ? "—"
        : String(summary.averageClassGrade);
    const pass =
      summary?.passingRate == null ? "—" : `${summary.passingRate}%`;
    const aral = summary?.aralScreeningCount ?? 0;

    return [
      {
        id: "learners",
        label: "Learners",
        value: summary?.totalStudents ?? 0,
        hint: `${summary?.totalClasses ?? 0} classes in scope`,
        tone: "green",
      },
      {
        id: "avg",
        label: "Avg grade",
        value: avg,
        hint: "Class average · filtered",
        tone: "slate",
      },
      {
        id: "passing",
        label: "Passing rate",
        value: pass,
        hint: "Graded entries ≥ 75",
        tone: "green",
      },
      {
        id: "aral",
        label: "At-risk / ARAL",
        value: aral,
        hint: `${summary?.classroomRemedialCount ?? 0} classroom remedial`,
        badge: aral > 0 ? "Follow-up" : undefined,
        tone: aral > 0 ? "orange" : "green",
      },
    ];
  }, [summary]);

  const insight = useMemo(
    () =>
      buildReportInsight({
        termLabel: quarterLabel,
        summary,
        lessonSummary,
        scope: "teacher",
      }),
    [quarterLabel, summary, lessonSummary]
  );

  const summaryRows = useMemo(
    () => [
      ["Total classes", summary?.totalClasses],
      ["Total learners", summary?.totalStudents],
      [
        "Average class grade",
        summary?.averageClassGrade == null
          ? "—"
          : String(summary.averageClassGrade),
      ],
      [
        "Passing rate",
        summary?.passingRate == null ? "—" : `${summary.passingRate}%`,
      ],
      ["Highest performing subject", summary?.highestSubject],
      ["Lowest performing subject", summary?.lowestSubject],
      ["ARAL learners", summary?.aralScreeningCount],
      ["Classroom remedial", summary?.classroomRemedialCount],
      [
        "Monitoring completion",
        summary?.monitoringCompletionRate == null
          ? "—"
          : `${summary.monitoringCompletionRate}%`,
      ],
      ["Learners under monitoring", summary?.learnersUnderMonitoring],
    ],
    [summary]
  );

  function openPreview(classReport) {
    setPreview(getPreview(classReport));
    setPreviewOpen(true);
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
              Review your class reports, intervention recommendations, lesson
              plan submissions, and academic performance.
            </p>
          </div>

          <MobileNavSheet
            ariaLabel="Open teacher menu"
            title="Teacher navigation"
          >
            {(close) => <TeacherSidebar mobile onNavigate={close} />}
          </MobileNavSheet>
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
            <span className="sr-only">Term</span>
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
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
          <p className="text-sm font-semibold text-slate-800">
            No reports available
          </p>
          <p className="mt-2 text-xs text-slate-500">
            No assigned classes match the selected school year, term, subject,
            or section.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <ReportKpiStrip items={kpiItems} />

          <ReportModule
            title="My Class Performance"
            subtitle="Academic rates · charts · class cards · detailed breakdown"
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
                title="Class summary · read-only"
                rows={summaryRows}
              />
            ) : null}
            {perfTab === "charts" ? <ReportCharts charts={charts} /> : null}
            {perfTab === "by-class" ? (
              <ReportByClassGrid
                reports={classReports}
                onDetails={openPreview}
                mapRow={(row) => ({
                  id: row.id,
                  title: row.section ?? row.gradeSection ?? "Section",
                  subtitle: row.subject,
                  metric: row.averageGrade ?? "—",
                  metricLabel: `${row.students ?? 0} learners`,
                  needsLabel:
                    row.aralEligible === false
                      ? "Not ARAL-eligible subject"
                      : `${row.aralScreening ?? 0} ARAL · ${
                          row.classroomRemedialRecommended ? "remedial" : "ok"
                        }`,
                })}
              />
            ) : null}
            {perfTab === "breakdown" ? (
              <ClassReportsTable
                reports={classReports}
                onPreview={openPreview}
                onExport={handleRowExport}
              />
            ) : null}
          </ReportModule>

          <ReportModule
            title="Submissions & follow-up"
            subtitle="Lesson plans · monitoring progress"
            icon={<ClipboardList size={16} strokeWidth={1.8} />}
            open={subsOpen}
            onOpenChange={setSubsOpen}
            accent="orange"
          >
            <ReportSubmissionsPanel
              lessonSummary={lessonSummary}
              summary={summary}
              actionLabel="Open Lesson Plans"
              onLessonPlanAction={() =>
                router.push("/teacher/lesson-plans")
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
            <ReportAttendancePanel attendance={null} chartData={[]} />
          </ReportModule>
        </div>
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
                  classroomRemedialCount: row.classroomRemedialRecommended
                    ? 1
                    : 0,
                  averageClassGrade:
                    row.averageGradeValue ?? row.averageGrade,
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
