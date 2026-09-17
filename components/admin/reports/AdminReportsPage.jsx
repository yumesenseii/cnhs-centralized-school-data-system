"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Download,
  FileSpreadsheet,
  Layers3,
  Loader2,
} from "lucide-react";
import AppSelect from "@/components/shared/AppSelect";
import Header from "@/components/layout/Header";
import PageHelp from "@/components/shared/PageHelp";
import TabSwitchPanel from "@/components/shared/TabSwitchPanel";
import AdminReportCharts from "@/components/admin/reports/AdminReportCharts";
import ReportPreviewModal from "@/components/admin/reports/ReportPreviewModal";
import ReportAttendancePanel from "@/components/reports/ReportAttendancePanel";
import ClassFolderLibrary from "@/components/reports/ClassFolderLibrary";
import ReportKpiStrip from "@/components/reports/ReportKpiStrip";
import ReportSummaryMetrics from "@/components/reports/ReportSummaryMetrics";
import { useAppToast } from "@/components/shared/AppToast";
import { useAdminReports } from "@/hooks/admin/useAdminReports";
import {
  exportAdminClassReportPdf,
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
  const { showToast } = useAppToast();

  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewClassId, setPreviewClassId] = useState(null);
  const [pageTab, setPageTab] = useState("overview");
  const [daily, setDaily] = useState(null);

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
        hint: "Unique learners · ECR class lists",
        tone: "green",
      },
      {
        id: "at-risk",
        label: "At-risk learners",
        value: atRisk,
        hint: "ARAL Learners + Classroom remedial",
        tone: Number(atRisk) > 0 ? "orange" : "green",
      },
      {
        id: "aral",
        label: "ARAL Learners",
        value: aral,
        hint: "English / Filipino below 75",
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
      showToast("Report downloaded.");
    } catch (err) {
      showToast(err?.message ?? "Unable to export PDF.");
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
      showToast("Excel export downloaded.");
    } catch (err) {
      showToast(err?.message ?? "Unable to export Excel.");
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
      handleExportPdf();
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
        description="School snapshot of grades, who needs support, lesson plans, and attendance."
        controls={
          <div className="flex w-full min-w-0 flex-nowrap items-center gap-2 sm:w-auto">
            <div className="flex flex-nowrap items-center gap-2">
              <PageHelp
                summary="School snapshot from ECR grades. Daily attendance lives on Attendance Monitoring. Uploaded SF2 is archive only."
                steps={[
                  "Filter by school year and term, then review the four learner counts.",
                  "Overview shows unique learners, ARAL Learners, and Classroom remedial from ECR grades.",
                  "Classes opens grade and section folders. Use List if you prefer a table.",
                  "Attendance uses Morning and Afternoon marks. Open Attendance Monitoring for the full month.",
                  "Uploaded SF2 figures stay separate and are not mixed into academic risk.",
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
            <div className="ml-auto flex flex-nowrap items-center gap-2">
              <button
                type="button"
                onClick={() => refresh()}
                className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-[var(--card)] dark:text-slate-300 dark:hover:bg-white/5"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={handleExportPdf}
                disabled={loading}
                className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-[var(--card)] dark:text-slate-300 dark:hover:bg-white/5"
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
          Loading school snapshot…
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
                {schoolSummary?.predictionsPending ? (
                  <p className="text-[12px] text-slate-500">
                    Academic prediction is not ready yet. ARAL Learners and
                    Classroom remedial still use ECR grades.
                  </p>
                ) : null}
                <ReportSummaryMetrics rows={extraRows} />
                <p className="text-[12px] text-slate-500">
                  <button
                    type="button"
                    onClick={() => router.push("/lesson-plan-review")}
                    className="cursor-pointer font-semibold text-cnhs-green-dark underline-offset-2 hover:underline"
                  >
                    Lesson plans pending
                  </button>
                  {": "}
                  {lessonSummary?.pending ?? 0} awaiting review.
                </p>
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
