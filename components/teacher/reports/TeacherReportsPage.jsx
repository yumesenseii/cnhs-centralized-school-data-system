"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
} from "lucide-react";
import MobileNavSheet from "@/components/layout/MobileNavSheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import ClassReportsTable from "@/components/teacher/reports/ClassReportsTable";
import ReportCharts from "@/components/teacher/reports/ReportCharts";
import ReportPreviewModal from "@/components/teacher/reports/ReportPreviewModal";
import ReportAttendancePanel from "@/components/reports/ReportAttendancePanel";
import ReportByClassGrid from "@/components/reports/ReportByClassGrid";
import ReportClassPerformanceSummary from "@/components/reports/ReportClassPerformanceSummary";
import ReportInsightCallout from "@/components/reports/ReportInsightCallout";
import ReportKpiStrip from "@/components/reports/ReportKpiStrip";
import ReportModule from "@/components/reports/ReportModule";
import ReportSubmissionsPanel from "@/components/reports/ReportSubmissionsPanel";
import { useTeacherReports } from "@/hooks/teacher/useTeacherReports";
import {
  PASSING_GRADE,
  QUARTER_OPTIONS,
  REPORT_FILTER_ALL,
} from "@/lib/teacher/reportsConstants";
import {
  exportClassPerformanceSystemReport,
  exportSingleClassReportExcel,
  exportTeacherReportsExcel,
  exportTeacherReportsPdf,
} from "@/lib/teacher/reportsExport";
import { passingRateFromGrades } from "@/lib/teacher/reportsCalculations";
import { getSectionAttendanceAnalytics } from "@/lib/supabase/queries/attendance";
import { MONTH_LABELS } from "@/lib/attendance/constants";

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
  const [systemClassId, setSystemClassId] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [sf2Attendance, setSf2Attendance] = useState(null);
  const [sf2ChartData, setSf2ChartData] = useState([]);
  const [sf2Loading, setSf2Loading] = useState(false);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!exportOpen) return undefined;
    function onDocClick() {
      setExportOpen(false);
    }
    window.setTimeout(() => {
      document.addEventListener("click", onDocClick);
    }, 0);
    return () => document.removeEventListener("click", onDocClick);
  }, [exportOpen]);

  useEffect(() => {
    if (!classReports.length) {
      setSystemClassId("");
      return;
    }
    if (!systemClassId || !classReports.some((r) => r.id === systemClassId)) {
      setSystemClassId(classReports[0].id);
    }
  }, [classReports, systemClassId]);

  useEffect(() => {
    let cancelled = false;

    async function loadSf2() {
      if (!schoolYear) {
        setSf2Attendance(null);
        setSf2ChartData([]);
        return;
      }

      setSf2Loading(true);
      try {
        const result = await getSectionAttendanceAnalytics({
          schoolYear,
          month: null,
          sectionId: null,
        });
        if (cancelled) return;

        if (result.error || !result.data?.hasData) {
          setSf2Attendance(null);
          setSf2ChartData([]);
          return;
        }

        const sectionKeys = new Set();
        for (const row of classReports) {
          const sectionName = String(row.sectionName || "")
            .trim()
            .toLowerCase();
          const gradeSection = String(row.gradeSection || row.section || "")
            .trim()
            .toLowerCase();
          if (sectionName) sectionKeys.add(sectionName);
          if (gradeSection) {
            sectionKeys.add(gradeSection);
            const afterDot = gradeSection.split("·").pop()?.trim();
            if (afterDot) sectionKeys.add(afterDot);
            const afterGrade = gradeSection.replace(/^grade\s*\d+\s*/i, "").trim();
            if (afterGrade) sectionKeys.add(afterGrade);
          }
        }

        const rows = (result.data.rows ?? []).filter((row) => {
          if (!sectionKeys.size) return true;
          const name = String(row.sectionName || "")
            .trim()
            .toLowerCase();
          if (!name) return false;
          if (sectionKeys.has(name)) return true;
          for (const key of sectionKeys) {
            if (key.includes(name) || name.includes(key)) return true;
          }
          return false;
        });

        if (!rows.length) {
          setSf2Attendance(null);
          setSf2ChartData([]);
          return;
        }

        const avg = (getter) => {
          const vals = rows
            .map(getter)
            .filter((n) => n != null && Number.isFinite(Number(n)))
            .map(Number);
          if (!vals.length) return null;
          return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
        };
        const sum = (getter) =>
          rows.reduce((acc, row) => acc + (Number(getter(row)) || 0), 0);

        const flagged = rows.filter(
          (r) =>
            r.fiveConsecutive > 0 ||
            r.nls > 0 ||
            r.transferredOut > 0 ||
            (r.pa != null && r.pa < 90)
        );

        setSf2Attendance({
          avgAda: avg((r) => r.ada),
          avgPa: avg((r) => r.pa),
          totalAbsences: sum((r) => r.absences),
          flaggedCount: flagged.length,
        });

        const byMonth = new Map();
        for (const row of rows) {
          const key = Number(row.month);
          if (!Number.isFinite(key)) continue;
          const bucket = byMonth.get(key) || { pas: [], count: 0 };
          if (row.pa != null && Number.isFinite(Number(row.pa))) {
            bucket.pas.push(Number(row.pa));
          }
          bucket.count += 1;
          byMonth.set(key, bucket);
        }

        const chart = [...byMonth.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([month, bucket]) => ({
            name: MONTH_LABELS[month - 1] || `M${month}`,
            rate:
              bucket.pas.length > 0
                ? Math.round(
                    (bucket.pas.reduce((a, b) => a + b, 0) / bucket.pas.length) *
                      10
                  ) / 10
                : null,
          }))
          .filter((point) => point.rate != null);

        setSf2ChartData(chart);
      } catch {
        if (!cancelled) {
          setSf2Attendance(null);
          setSf2ChartData([]);
        }
      } finally {
        if (!cancelled) setSf2Loading(false);
      }
    }

    loadSf2();
    return () => {
      cancelled = true;
    };
  }, [schoolYear, classReports]);

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

  const gradedShare = useMemo(() => {
    const grades = classReports
      .flatMap((row) => row.subjectGrades || [])
      .map((g) => Number(g))
      .filter((n) => Number.isFinite(n));
    if (!grades.length) return null;
    const passingCount = grades.filter((g) => g >= PASSING_GRADE).length;
    return {
      gradedCount: grades.length,
      passingCount,
      failingCount: grades.length - passingCount,
    };
  }, [classReports]);

  const performanceInsight = useMemo(() => {
    if (!classReports.length) {
      return { text: null, actionLabel: null, actionKind: null, target: null };
    }

    let weakest = null;
    let weakestPass = Infinity;
    for (const row of classReports) {
      const pass = passingRateFromGrades(row.subjectGrades);
      if (pass == null) continue;
      if (pass < weakestPass) {
        weakestPass = pass;
        weakest = row;
      }
    }

    const aral = Number(summary?.aralScreeningCount ?? 0);
    const remedial = Number(summary?.classroomRemedialCount ?? 0);

    if (weakest && weakestPass < PASSING_GRADE) {
      const section = weakest.gradeSection || weakest.section || "class";
      return {
        text: `${quarterLabel}: ${weakest.subject} · ${section} needs attention (${weakestPass}% passing).`,
        actionLabel: "Open Breakdown",
        actionKind: "tab",
        target: "breakdown",
      };
    }

    if (aral > 0 || remedial > 0) {
      return {
        text: `${quarterLabel}: ${aral} ARAL · ${remedial} classroom remedial — review Breakdown for follow-up.`,
        actionLabel: "Open Breakdown",
        actionKind: "tab",
        target: "breakdown",
      };
    }

    if (
      summary?.passingRate != null &&
      Number(summary.passingRate) >= PASSING_GRADE
    ) {
      return {
        text: `${quarterLabel}: Classes look on track for this filter.`,
        actionLabel:
          classReports.length === 1 ? "Generate class report" : null,
        actionKind: classReports.length === 1 ? "generate" : null,
        target: classReports[0] ?? null,
      };
    }

    return { text: null, actionLabel: null, actionKind: null, target: null };
  }, [classReports, quarterLabel, summary]);

  function openPreview(classReport) {
    setPreview(getPreview(classReport));
    setPreviewOpen(true);
  }

  function handleGenerateSystemReport(classReport) {
    const row =
      classReport ||
      classReports.find((item) => item.id === systemClassId) ||
      null;
    if (!row) {
      setToast("Select a class to generate a system report.");
      return;
    }
    try {
      exportClassPerformanceSystemReport({
        classReport: row,
        teacherName,
        schoolYear,
        quarter: quarterLabel,
      });
      setToast(
        `Report opened for ${row.subject} · ${
          row.gradeSection || row.section
        }. Use Print → Save as PDF.`
      );
      setPerfTab("by-class");
    } catch (err) {
      setToast(err?.message ?? "Unable to generate system report.");
    }
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

  const fieldSelectClassName =
    "mt-1 h-9 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 outline-none hover:bg-slate-50 focus:border-cnhs-green-dark";
  const fieldLabelClassName =
    "text-[10px] font-medium uppercase tracking-[0.04em] text-slate-400";

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
              Filter your classes, then generate a report for one class you
              handle.
            </p>
          </div>

          <MobileNavSheet
            ariaLabel="Open teacher menu"
            title="Teacher navigation"
          >
            {(close) => <TeacherSidebar mobile onNavigate={close} />}
          </MobileNavSheet>
        </div>
      </header>

      <section className="mb-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <label className="block min-w-0">
            <span className={fieldLabelClassName}>School year</span>
            <select
              value={schoolYear}
              onChange={(event) => setSchoolYear(event.target.value)}
              className={fieldSelectClassName}
            >
              {schoolYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className="block min-w-0">
            <span className={fieldLabelClassName}>Term</span>
            <select
              value={String(quarter)}
              onChange={(event) => setQuarter(event.target.value)}
              className={fieldSelectClassName}
            >
              {QUARTER_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block min-w-0">
            <span className={fieldLabelClassName}>Subject</span>
            <select
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className={fieldSelectClassName}
            >
              <option value={REPORT_FILTER_ALL}>All subjects</option>
              {subjects.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block min-w-0">
            <span className={fieldLabelClassName}>Section</span>
            <select
              value={section}
              onChange={(event) => setSection(event.target.value)}
              className={fieldSelectClassName}
            >
              <option value={REPORT_FILTER_ALL}>All sections</option>
              {sections.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-col gap-2.5 border-t border-slate-200/70 pt-3 sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1">
            <span className={fieldLabelClassName}>Class for report</span>
            <select
              value={systemClassId}
              onChange={(event) => setSystemClassId(event.target.value)}
              disabled={loading || !classReports.length}
              className={fieldSelectClassName}
            >
              {!classReports.length ? (
                <option value="">No classes</option>
              ) : (
                classReports.map((row) => (
                  <option key={row.id} value={row.id}>
                    {(row.gradeSection || row.section) ?? "Class"} ·{" "}
                    {row.subject}
                  </option>
                ))
              )}
            </select>
          </label>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => handleGenerateSystemReport()}
              disabled={loading || !systemClassId}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-4 text-[12px] font-semibold text-white transition-colors hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FileText size={14} />
              Generate report
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExportOpen((open) => !open);
                }}
                disabled={loading}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download size={14} />
                Export
              </button>
              {exportOpen ? (
                <div
                  className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setExportOpen(false);
                      handleExportPdf();
                    }}
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Download size={12} className="text-red-500" />
                    PDF (all classes)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExportOpen(false);
                      handleExportExcel();
                    }}
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <FileSpreadsheet
                      size={12}
                      className="text-cnhs-green-dark"
                    />
                    Excel (all classes)
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

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
      ) : (
        <div className="space-y-4">
          <ReportKpiStrip items={kpiItems} />

          <ReportModule
            title="My Class Performance"
            subtitle="Academic rates · charts · class cards · generate a report per class"
            icon={<BarChart3 size={16} strokeWidth={1.8} />}
            open={perfOpen}
            onOpenChange={setPerfOpen}
            tabs={PERF_TABS}
            activeTab={perfTab}
            onTabChange={setPerfTab}
            accent="green"
            footer={
              <ReportInsightCallout
                text={performanceInsight.text}
                actionLabel={performanceInsight.actionLabel}
                onAction={
                  performanceInsight.actionKind === "tab"
                    ? () => setPerfTab(performanceInsight.target)
                    : performanceInsight.actionKind === "generate"
                      ? () =>
                          handleGenerateSystemReport(performanceInsight.target)
                      : undefined
                }
              />
            }
          >
            {perfTab === "summary" ? (
              <ReportClassPerformanceSummary
                summary={summary}
                gradedShare={gradedShare}
              />
            ) : null}
            {perfTab === "charts" ? <ReportCharts charts={charts} /> : null}
            {perfTab === "by-class" ? (
              <ReportByClassGrid
                reports={classReports}
                onDetails={openPreview}
                onGenerateSystemReport={handleGenerateSystemReport}
                mapRow={(row) => {
                  const pass = passingRateFromGrades(row.subjectGrades);
                  return {
                    id: row.id,
                    title: row.section ?? row.gradeSection ?? "Section",
                    subtitle: row.subject,
                    metric: row.averageGrade ?? "—",
                    metricLabel: `${row.students ?? 0} learners`,
                    passingRate: pass == null ? undefined : `${pass}%`,
                    needsLabel:
                      row.aralEligible === false
                        ? "Not ARAL-eligible subject"
                        : `${row.aralScreening ?? 0} ARAL · ${
                            row.classroomRemedialRecommended
                              ? "remedial"
                              : "ok"
                          }`,
                  };
                }}
              />
            ) : null}
            {perfTab === "breakdown" ? (
              <ClassReportsTable
                reports={classReports}
                onPreview={openPreview}
                onExport={handleRowExport}
                onGenerateSystemReport={handleGenerateSystemReport}
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
            subtitle="Monthly class summaries · submit via Attendance Monitoring"
            icon={<CalendarDays size={16} strokeWidth={1.8} />}
            open={attendanceOpen}
            onOpenChange={setAttendanceOpen}
            accent="sky"
          >
            {sf2Loading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
                <Loader2 size={14} className="animate-spin" />
                Loading SF2 attendance…
              </div>
            ) : (
              <ReportAttendancePanel
                attendance={sf2Attendance}
                chartData={sf2ChartData}
              />
            )}
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
