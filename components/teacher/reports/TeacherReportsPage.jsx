"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  Layers3,
  Loader2,
} from "lucide-react";
import AppSelect from "@/components/shared/AppSelect";
import MobileNavSheet from "@/components/layout/MobileNavSheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import ClassReportsTable from "@/components/teacher/reports/ClassReportsTable";
import ReportCharts from "@/components/teacher/reports/ReportCharts";
import ReportPreviewModal from "@/components/teacher/reports/ReportPreviewModal";
import ReportAttendancePanel from "@/components/reports/ReportAttendancePanel";
import ClassFolderLibrary from "@/components/reports/ClassFolderLibrary";
import ReportClassPerformanceSummary from "@/components/reports/ReportClassPerformanceSummary";
import ReportInsightCallout from "@/components/reports/ReportInsightCallout";
import ReportKpiStrip from "@/components/reports/ReportKpiStrip";
import ReportModule from "@/components/reports/ReportModule";
import ReportSubmissionsPanel from "@/components/reports/ReportSubmissionsPanel";
import { AnimatedBanner } from "@/components/shared/AnimatedFeedback";
import { useAppToast } from "@/components/shared/AppToast";
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
import { cn } from "@/lib/utils";

const PERF_TABS = [
  { id: "summary", label: "Summary" },
  { id: "charts", label: "Charts" },
  { id: "by-class", label: "By Class" },
  { id: "breakdown", label: "Breakdown" },
];

const EMPTY_SF2_CHART = [];

function sameSf2Attendance(prev, next) {
  if (prev === next) return true;
  if (!prev || !next) return prev == null && next == null;
  return (
    prev.avgAda === next.avgAda &&
    prev.avgPa === next.avgPa &&
    prev.totalAbsences === next.totalAbsences &&
    prev.flaggedCount === next.flaggedCount
  );
}

function sameSf2Chart(prev, next) {
  if (prev === next) return true;
  if (!Array.isArray(prev) || !Array.isArray(next)) return false;
  if (prev.length !== next.length) return false;
  return prev.every(
    (point, i) => point.name === next[i].name && point.rate === next[i].rate
  );
}

function sf2SectionKeyFromReports(reports = []) {
  const keys = new Set();
  for (const row of reports) {
    const sectionName = String(row.sectionName || "")
      .trim()
      .toLowerCase();
    const gradeSection = String(row.gradeSection || row.section || "")
      .trim()
      .toLowerCase();
    if (sectionName) keys.add(sectionName);
    if (gradeSection) {
      keys.add(gradeSection);
      const afterDot = gradeSection.split("·").pop()?.trim();
      if (afterDot) keys.add(afterDot);
      const afterGrade = gradeSection.replace(/^grade\s*\d+\s*/i, "").trim();
      if (afterGrade) keys.add(afterGrade);
    }
  }
  return [...keys].sort().join("|");
}

function ReportsSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[72px] animate-pulse rounded-xl border border-slate-100 bg-slate-50 dark:border-white/5 dark:bg-white/5"
          />
        ))}
      </div>
      <div className="h-[220px] animate-pulse rounded-2xl border border-slate-100 bg-slate-50 dark:border-white/5 dark:bg-white/5" />
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
  const { showToast } = useAppToast();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [perfOpen, setPerfOpen] = useState(true);
  const [perfTab, setPerfTab] = useState("summary");
  const [subsOpen, setSubsOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [systemClassId, setSystemClassId] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [sf2Attendance, setSf2Attendance] = useState(null);
  const [sf2ChartData, setSf2ChartData] = useState([]);
  const [sf2Loading, setSf2Loading] = useState(false);

  const sf2SectionKey = useMemo(
    () => sf2SectionKeyFromReports(classReports),
    [classReports]
  );

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
      setSystemClassId((current) => (current === "" ? current : ""));
      return;
    }
    const firstId = classReports[0].id;
    setSystemClassId((current) => {
      if (current && classReports.some((row) => row.id === current)) {
        return current;
      }
      return firstId;
    });
  }, [classReports]);

  useEffect(() => {
    let cancelled = false;

    function clearSf2() {
      setSf2Attendance((prev) => (prev == null ? prev : null));
      setSf2ChartData((prev) =>
        sameSf2Chart(prev, EMPTY_SF2_CHART) ? prev : EMPTY_SF2_CHART
      );
    }

    async function loadSf2() {
      if (!schoolYear) {
        clearSf2();
        return;
      }

      setSf2Loading((prev) => (prev ? prev : true));
      try {
        const result = await getSectionAttendanceAnalytics({
          schoolYear,
          month: null,
          sectionId: null,
        });
        if (cancelled) return;

        if (result.error || !result.data?.hasData) {
          clearSf2();
          return;
        }

        const sectionKeys = new Set(
          sf2SectionKey ? sf2SectionKey.split("|") : []
        );

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
          clearSf2();
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

        const nextAttendance = {
          avgAda: avg((r) => r.ada),
          avgPa: avg((r) => r.pa),
          totalAbsences: sum((r) => r.absences),
          flaggedCount: flagged.length,
        };

        setSf2Attendance((prev) =>
          sameSf2Attendance(prev, nextAttendance) ? prev : nextAttendance
        );

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

        setSf2ChartData((prev) => (sameSf2Chart(prev, chart) ? prev : chart));
      } catch {
        if (!cancelled) clearSf2();
      } finally {
        if (!cancelled) {
          setSf2Loading((prev) => (prev ? false : prev));
        }
      }
    }

    loadSf2();
    return () => {
      cancelled = true;
    };
  }, [schoolYear, sf2SectionKey]);

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
        tone:
          summary?.passingRate != null && Number(summary.passingRate) < 75
            ? "orange"
            : "green",
      },
      {
        id: "aral",
        label: "At-risk / ARAL",
        value: aral,
        hint: `${summary?.classroomRemedialCount ?? 0} classroom remedial`,
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
      showToast("Select a class to generate a system report.");
      return;
    }
    try {
      exportClassPerformanceSystemReport({
        classReport: row,
        preview: getPreview(row),
        teacherName,
        schoolYear,
        quarter: quarterLabel,
      });
      showToast(
        `Report downloaded for ${row.subject} · ${
          row.gradeSection || row.section
        }.`
      );
      setPerfTab("by-class");
    } catch (err) {
      showToast(err?.message ?? "Unable to generate system report.");
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
      showToast("Report downloaded.");
    } catch (err) {
      showToast(err?.message ?? "Unable to export PDF.");
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
      showToast("Excel export downloaded.");
    } catch (err) {
      showToast(err?.message ?? "Unable to export Excel.");
    }
  }

  async function handleRowExport(row) {
    try {
      await exportSingleClassReportExcel(row);
      showToast(`Exported Excel for ${row.subject}.`);
    } catch (err) {
      showToast(err?.message ?? "Unable to export class report.");
    }
  }

  const fieldLabelClassName =
    "text-[10px] font-medium uppercase tracking-[0.04em] text-slate-400";

  const perfSubtitle = [
    schoolYear
      ? /^sy\b/i.test(String(schoolYear))
        ? schoolYear
        : `SY ${schoolYear}`
      : null,
    quarterLabel || null,
    classReports.length
      ? `${classReports.length} class${classReports.length === 1 ? "" : "es"}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <header className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
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
            <p className="mt-0.5 text-xs text-slate-500">
              Class performance, interventions, and attendance summaries for
              your sections.
            </p>
          </div>
          <MobileNavSheet
            ariaLabel="Open teacher menu"
            title="Teacher navigation"
          >
            {(close) => <TeacherSidebar mobile onNavigate={close} />}
          </MobileNavSheet>
        </div>

        <div className="flex w-full min-w-0 flex-nowrap items-center gap-2 sm:w-auto sm:justify-end">
          <div className="flex flex-nowrap items-center gap-2">
            <AppSelect
              label="School Year"
              value={schoolYear}
              onChange={setSchoolYear}
              options={schoolYears}
              icon={CalendarDays}
              size="pill"
              align="end"
              className="w-[168px] shrink-0"
            />
            <AppSelect
              label="Term"
              value={String(quarter)}
              onChange={setQuarter}
              options={QUARTER_OPTIONS}
              icon={Layers3}
              size="pill"
              align="end"
              className="w-[132px] shrink-0"
            />
          </div>
          <div className="relative ml-auto">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExportOpen((open) => !open);
              }}
              disabled={loading}
              className={cn(
                "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-[var(--card)] dark:text-slate-300 dark:hover:bg-white/5"
              )}
            >
              <Download size={13} />
              Export
            </button>
            {exportOpen ? (
              <div
                className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-[var(--card)]"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    setExportOpen(false);
                    handleExportPdf();
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/6"
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
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/6"
                >
                  <FileSpreadsheet size={12} className="text-cnhs-green-dark" />
                  Excel (all classes)
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section className="mb-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-[0_4px_12px_rgba(15,23,42,0.03)] dark:border-white/5 dark:bg-[var(--card)] dark:shadow-none">
        <div className="flex flex-wrap items-end gap-2">
          <div className="block min-w-[140px] flex-1">
            <span className={fieldLabelClassName}>Subject</span>
            <AppSelect
              label="Subject"
              value={subject}
              onChange={setSubject}
              options={[
                { value: REPORT_FILTER_ALL, label: "All subjects" },
                ...subjects.map((item) => ({ value: item, label: item })),
              ]}
              size="field"
              className="mt-1"
              triggerClassName="h-8 rounded-lg px-2 text-[12px] font-semibold text-slate-700"
            />
          </div>

          <div className="block min-w-[140px] flex-1">
            <span className={fieldLabelClassName}>Section</span>
            <AppSelect
              label="Section"
              value={section}
              onChange={setSection}
              options={[
                { value: REPORT_FILTER_ALL, label: "All sections" },
                ...sections.map((item) => ({ value: item, label: item })),
              ]}
              size="field"
              className="mt-1"
              triggerClassName="h-8 rounded-lg px-2 text-[12px] font-semibold text-slate-700"
            />
          </div>

          <div className="block min-w-[180px] flex-[1.4]">
            <span className={fieldLabelClassName}>Class for report</span>
            <AppSelect
              label="Class for report"
              value={systemClassId}
              onChange={setSystemClassId}
              disabled={loading || !classReports.length}
              options={
                !classReports.length
                  ? [{ value: "", label: "No classes" }]
                  : classReports.map((row) => ({
                      value: row.id,
                      label: `${(row.gradeSection || row.section) ?? "Class"} · ${row.subject}`,
                    }))
              }
              size="field"
              className="mt-1"
              triggerClassName="h-8 rounded-lg px-2 text-[12px] font-semibold text-slate-700"
            />
          </div>

          <button
            type="button"
            onClick={() => handleGenerateSystemReport()}
            disabled={loading || !systemClassId}
            className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white transition-colors hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FileText size={13} />
            Generate report
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Pick a class, then generate. School year and term are above.
        </p>
      </section>

      <AnimatedBanner
        message={error}
        tone="error"
        className="mb-4 text-sm font-medium"
      />

      {loading ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 py-2 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            Loading report data…
          </div>
          <ReportsSkeleton />
        </div>
      ) : (
        <div className="space-y-3">
          <ReportKpiStrip items={kpiItems} />

          <ReportModule
            title="My Class Performance"
            subtitle={perfSubtitle || undefined}
            open={perfOpen}
            onOpenChange={setPerfOpen}
            tabs={PERF_TABS}
            activeTab={perfTab}
            onTabChange={setPerfTab}
          >
            {perfTab === "summary" ? (
              <div className="space-y-3">
                {performanceInsight.text ? (
                  <ReportInsightCallout
                    text={performanceInsight.text}
                    actionLabel={performanceInsight.actionLabel}
                    onAction={
                      performanceInsight.actionKind === "tab"
                        ? () => setPerfTab(performanceInsight.target)
                        : performanceInsight.actionKind === "generate"
                          ? () =>
                              handleGenerateSystemReport(
                                performanceInsight.target
                              )
                          : undefined
                    }
                  />
                ) : null}
                <ReportClassPerformanceSummary
                  summary={summary}
                  gradedShare={gradedShare}
                />
              </div>
            ) : null}
            {perfTab === "charts" ? <ReportCharts charts={charts} /> : null}
            {perfTab === "by-class" ? (
              <ClassFolderLibrary
                reports={classReports}
                onDetails={openPreview}
                onGenerateSystemReport={handleGenerateSystemReport}
                groupMultiTerm={!quarter || quarter === "all"}
                searchPlaceholder="Search classes by name or subject…"
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
            subtitle="Lesson plans and monitoring progress"
            open={subsOpen}
            onOpenChange={setSubsOpen}
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
            open={attendanceOpen}
            onOpenChange={setAttendanceOpen}
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
                monitoringHref="/teacher/attendance"
                showSf2Archive
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
              exportClassPerformanceSystemReport({
                classReport: row,
                preview,
                teacherName,
                schoolYear,
                quarter: quarterLabel,
                generatedAt: preview.generatedAt
                  ? new Date(preview.generatedAt)
                  : new Date(),
              });
              showToast("Report downloaded for class preview.");
            } catch (err) {
              showToast(err?.message ?? "Unable to export PDF.");
            }
          }
        }}
      />
    </motion.div>
  );
}
