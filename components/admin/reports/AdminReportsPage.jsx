"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  CalendarDays,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Layers3,
  Loader2,
  Printer,
} from "lucide-react";
import AppSelect from "@/components/shared/AppSelect";
import Header from "@/components/layout/Header";
import PageHelp from "@/components/shared/PageHelp";
import TabSwitchPanel from "@/components/shared/TabSwitchPanel";
import AdminReportCharts from "@/components/admin/reports/AdminReportCharts";
import ReportPreviewModal from "@/components/admin/reports/ReportPreviewModal";
import ExportSchoolReportModal from "@/components/admin/reports/ExportSchoolReportModal";
import ReportAttendancePanel from "@/components/reports/ReportAttendancePanel";
import ClassFolderLibrary from "@/components/reports/ClassFolderLibrary";
import ReportKpiStrip from "@/components/reports/ReportKpiStrip";
import ReportSummaryMetrics from "@/components/reports/ReportSummaryMetrics";
import AdminReportsOverviewExtras from "@/components/admin/reports/AdminReportsOverviewExtras";
import { useAppToast } from "@/components/shared/AppToast";
import { useAdminReports } from "@/hooks/admin/useAdminReports";
import {
  buildDailyAttendanceExportSummary,
  exportAdminClassReportPdf,
  exportAdminMeetingBriefPdf,
  exportAdminReportsExcel,
  exportAdminReportsPdf,
} from "@/lib/admin/reportsExport";
import { getSchoolDailyMonth } from "@/lib/supabase/queries/attendanceDaily";
import { todayIsoDateManila } from "@/lib/attendance/sf2Daily";
import { cn } from "@/lib/utils";

const PAGE_TABS = [
  { id: "overview", label: "Overview" },
  { id: "classes", label: "Classes" },
  { id: "attendance", label: "Attendance" },
];

const MONITORING_TAB_IDS = new Set([
  "received",
  "approve",
  "facilitators",
  "progress",
  "students",
]);

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
    overviewActionCounts,
    overviewHotspots,
    overviewMonitoringHealth,
    setSchoolYear,
    setQuarter,
    refresh,
    getPreview,
  } = useAdminReports();
  const { showToast } = useAppToast();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewClassId, setPreviewClassId] = useState(null);
  const [pageTab, setPageTab] = useState("overview");
  const [daily, setDaily] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("pdf");
  const [exportBusy, setExportBusy] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const downloadMenuRef = useRef(null);

  useEffect(() => {
    if (!downloadMenuOpen) return undefined;
    function onPointerDown(event) {
      if (!downloadMenuRef.current?.contains(event.target)) {
        setDownloadMenuOpen(false);
      }
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setDownloadMenuOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [downloadMenuOpen]);

  const currentMonth = String(Number(todayIsoDateManila().slice(5, 7)));

  useEffect(() => {
    if (!schoolYear) {
      setDaily(null);
      return;
    }
    let cancelled = false;
    getSchoolDailyMonth({
      schoolYear,
      month: currentMonth,
    }).then((result) => {
      if (cancelled) return;
      setDaily(result.error ? null : result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [schoolYear, currentMonth]);

  const quarterLabel = useMemo(() => {
    if (!quarter) return "All Terms";
    const match = quarters.find((item) => item.value === quarter);
    return match?.label || `Term ${quarter}`;
  }, [quarter, quarters]);

  const kpiItems = useMemo(() => {
    const byId = Object.fromEntries(
      (quickStats ?? []).map((stat) => [stat.id, stat])
    );
    const learners =
      byId.learners?.value ?? schoolSummary?.totalLearners ?? 0;
    const atRisk = byId["at-risk"]?.value ?? schoolSummary?.atRisk ?? 0;
    const aral =
      byId.intervention?.value ?? schoolSummary?.aralScreening ?? 0;
    const remedial =
      byId.remedial?.value ??
      schoolSummary?.classroomRemedial ??
      schoolSummary?.classroomRemediation ??
      0;

    return [
      {
        id: "learners",
        label: "Learners",
        value: learners,
        hint: "Unique learners from class records",
        tone: "green",
      },
      {
        id: "at-risk",
        label: "At-risk learners",
        value: atRisk,
        hint: "ARAL Learners and Classroom remedial",
        tone: Number(atRisk) > 0 ? "orange" : "green",
      },
      {
        id: "aral",
        label: "ARAL Learners",
        value: aral,
        hint: "English or Filipino below 75",
        tone: Number(aral) > 0 ? "blue" : "green",
      },
      {
        id: "remedial",
        label: "Classroom remedial",
        value: remedial,
        hint: "Other subjects needing support",
        tone: Number(remedial) > 0 ? "orange" : "green",
      },
    ];
  }, [quickStats, schoolSummary]);

  const extraRows = useMemo(
    () => [
      [
        "Passing rate",
        summary?.passingRate == null ? "—" : `${summary.passingRate}%`,
      ],
      ["Lowest performing subject", summary?.lowestSubject ?? "—"],
      ["Lesson plans approved", schoolSummary?.lessonPlansApproved ?? 0],
      ["Lesson plans pending", lessonSummary?.pending ?? 0],
    ],
    [summary, schoolSummary, lessonSummary]
  );

  function goMonitoring(tab) {
    const safe = MONITORING_TAB_IDS.has(tab) ? tab : "received";
    router.push(`/monitoring?tab=${safe}`);
  }

  function openPreview(classReport) {
    const live = getPreview(classReport?.id);
    if (!live) {
      showToast("No live preview available for this class yet.");
      return;
    }
    setPreview(live);
    setPreviewClassId(classReport?.id ?? null);
    setPreviewOpen(true);
  }

  function openPreviewById(classId) {
    const row = classReports.find((item) => item.id === classId);
    if (row) {
      openPreview(row);
      return;
    }
    setPageTab("classes");
  }

  const dailyExportSummary = useMemo(
    () => buildDailyAttendanceExportSummary(daily),
    [daily]
  );

  const exportContext = useMemo(
    () => ({
      schoolYear,
      quarter: quarterLabel,
      summary,
      schoolSummary: {
        ...schoolSummary,
        lpPending: lessonSummary?.pending ?? schoolSummary?.lpPending,
      },
      classReports,
      charts,
      dailyAttendance: dailyExportSummary,
      supportSections: overviewHotspots?.sections ?? [],
      actionCounts: overviewActionCounts,
      lessonSummary,
    }),
    [
      schoolYear,
      quarterLabel,
      summary,
      schoolSummary,
      lessonSummary,
      classReports,
      charts,
      dailyExportSummary,
      overviewHotspots,
      overviewActionCounts,
    ]
  );

  function openExportChooser(format) {
    setExportFormat(format);
    setExportOpen(true);
  }

  async function handleExportConfirm(sections) {
    setExportBusy(true);
    try {
      if (exportFormat === "excel") {
        await exportAdminReportsExcel({
          ...exportContext,
          sections,
          attendance: null,
        });
        showToast("Excel downloaded.");
      } else {
        exportAdminReportsPdf({
          ...exportContext,
          sections,
          attendance: null,
        });
        showToast("PDF downloaded.");
      }
      setExportOpen(false);
    } catch (err) {
      showToast(err?.message ?? "Unable to export.");
    } finally {
      setExportBusy(false);
    }
  }

  function handlePrintForMeeting() {
    try {
      exportAdminMeetingBriefPdf(exportContext);
      showToast("Meeting brief PDF downloaded.");
    } catch (err) {
      showToast(err?.message ?? "Unable to prepare meeting brief.");
    }
  }

  function handleRowExportPdf(row) {
    try {
      exportAdminClassReportPdf({
        classReport: row,
        schoolYear,
        quarter: quarterLabel,
      });
      showToast(`Report downloaded for ${row.className}.`);
    } catch (err) {
      showToast(err?.message ?? "Unable to export class PDF.");
    }
  }

  function handlePreviewExport() {
    const row = classReports.find((item) => item.id === previewClassId);
    if (!row) {
      openExportChooser("pdf");
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
        description="Summary of grades, learners needing support, lesson plans, and attendance."
        controls={
          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <PageHelp
                summary="School summary of grades, learners needing support, lesson plans, and attendance for the selected school year and term."
                steps={[
                  "Choose the school year and term, then review the learner counts at the top.",
                  "Overview shows items that need your attention, learner monitoring, sections and classes needing support, and this month’s attendance.",
                  "Use Download for a meeting brief, PDF, or Excel. PDF and Excel let you choose what to include.",
                  "Classes shows reports by grade and section.",
                  "Attendance shows Morning and Afternoon attendance recorded by advisers.",
                  "ARAL Learners are those below 75 in English or Filipino. Classroom remedial covers other subjects needing support.",
                ]}
              />
              <AppSelect
                label="School Year"
                value={schoolYear}
                onChange={setSchoolYear}
                options={
                  schoolYears.length
                    ? schoolYears
                    : [{ value: "", label: "No school years" }]
                }
                icon={CalendarDays}
                size="pill"
                align="end"
                className="shrink-0"
                triggerClassName="rounded-lg"
              />
              <AppSelect
                label="Term"
                value={quarter}
                onChange={setQuarter}
                options={quarters}
                icon={Layers3}
                size="pill"
                align="end"
                className="shrink-0"
                triggerClassName="rounded-lg"
              />
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => refresh()}
                className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-[var(--card)] dark:text-slate-300 dark:hover:bg-white/5"
              >
                Refresh
              </button>
              <div className="relative" ref={downloadMenuRef}>
                <button
                  type="button"
                  disabled={loading}
                  aria-expanded={downloadMenuOpen}
                  aria-haspopup="menu"
                  onClick={() => setDownloadMenuOpen((open) => !open)}
                  className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white transition-colors hover:bg-[#246f54] disabled:opacity-60"
                >
                  <Download size={12} />
                  Download
                  <ChevronDown
                    size={12}
                    className={cn(
                      "transition-transform",
                      downloadMenuOpen ? "rotate-180" : ""
                    )}
                  />
                </button>
                {downloadMenuOpen ? (
                  <div
                    role="menu"
                    className="absolute right-0 z-40 mt-1.5 w-[13.5rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-[var(--card)]"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setDownloadMenuOpen(false);
                        handlePrintForMeeting();
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                    >
                      <Printer size={13} className="text-cnhs-green-dark" />
                      Print for meeting
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setDownloadMenuOpen(false);
                        openExportChooser("pdf");
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                    >
                      <FileText size={13} className="text-cnhs-green-dark" />
                      Export PDF…
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setDownloadMenuOpen(false);
                        openExportChooser("excel");
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                    >
                      <FileSpreadsheet
                        size={13}
                        className="text-cnhs-green-dark"
                      />
                      Export Excel…
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        }
      />

      {error ? (
        <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[12px] text-red-600 dark:border-red-500/30 dark:bg-red-950/40">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-4 py-10 text-sm text-slate-400 dark:border-white/10 dark:bg-[var(--card)]">
          <Loader2 size={16} className="animate-spin" />
          Loading school summary…
        </div>
      ) : (
        <div className="space-y-3">
          <ReportKpiStrip items={kpiItems} />

          <div className="flex justify-end">
            <div
              role="tablist"
              aria-label="Reports views"
              className="inline-flex max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm dark:border-white/5 dark:bg-[var(--card)]"
            >
              {PAGE_TABS.map((tab) => {
                const active = tab.id === pageTab;
                return (
                  <button
                    key={tab.id}
                    id={`reports-tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls={`reports-panel-${tab.id}`}
                    onClick={() => setPageTab(tab.id)}
                    className={cn(
                      "min-w-max cursor-pointer rounded-md px-3 py-1.5 text-[11px] font-semibold transition-[color,background-color,box-shadow,opacity,transform] duration-160 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cnhs-green/35",
                      active
                        ? "bg-cnhs-green-soft text-cnhs-green-dark dark:bg-cnhs-green/20 dark:text-cnhs-green"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <TabSwitchPanel
            activeKey={pageTab}
            id={`reports-panel-${pageTab}`}
            role="tabpanel"
            aria-labelledby={`reports-tab-${pageTab}`}
          >
            {pageTab === "overview" ? (
              <div className="space-y-3">
                <AdminReportsOverviewExtras
                  schoolYear={schoolYear}
                  quarterLabel={quarterLabel}
                  actionCounts={overviewActionCounts}
                  monitoringHealth={overviewMonitoringHealth}
                  hotspots={overviewHotspots}
                  lessonSummary={lessonSummary}
                  daily={daily}
                  onGoMonitoring={goMonitoring}
                  onGoAttendance={() => router.push("/attendance")}
                  onGoLessonPlans={() => router.push("/lesson-plan-review")}
                  onOpenClassesTab={() => setPageTab("classes")}
                  onPreviewClass={openPreviewById}
                />
                <ReportSummaryMetrics rows={extraRows} />
                <AdminReportCharts charts={charts} hideAttendance hideEmpty />
              </div>
            ) : null}

            {pageTab === "classes" ? (
              <ClassFolderLibrary
                reports={classReports}
                onDetails={openPreview}
                onExport={handleRowExportPdf}
                groupMultiTerm={!quarter}
              />
            ) : null}

            {pageTab === "attendance" ? (
              <ReportAttendancePanel daily={daily} />
            ) : null}
          </TabSwitchPanel>
        </div>
      )}

      <ExportSchoolReportModal
        open={exportOpen}
        format={exportFormat}
        schoolYear={schoolYear}
        termLabel={quarterLabel}
        busy={exportBusy}
        onClose={() => {
          if (!exportBusy) setExportOpen(false);
        }}
        onConfirm={handleExportConfirm}
      />

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
