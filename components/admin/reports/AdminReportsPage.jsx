"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, FileText, Layers3, Loader2 } from "lucide-react";
import AppSelect from "@/components/shared/AppSelect";
import Header from "@/components/layout/Header";
import PageHelp from "@/components/shared/PageHelp";
import TabSwitchPanel from "@/components/shared/TabSwitchPanel";
import AcademicReportTab from "@/components/admin/reports/tabs/AcademicReportTab";
import AralReportTab from "@/components/admin/reports/tabs/AralReportTab";
import AttendanceReportTab from "@/components/admin/reports/tabs/AttendanceReportTab";
import { useAppToast } from "@/components/shared/AppToast";
import { useAdminReports } from "@/hooks/admin/useAdminReports";
import { useAralAssessmentPeriod } from "@/hooks/useAralAssessmentPeriod";
import { exportDynamicSchoolReportPdf } from "@/lib/admin/reportsExport";
import { getSchoolDailyMonth } from "@/lib/supabase/queries/attendanceDaily";
import { todayIsoDateManila } from "@/lib/attendance/sf2Daily";
import { cn } from "@/lib/utils";

const PAGE_TABS = [
  { id: "academic", label: "Academic" },
  { id: "aral", label: "ARAL" },
  { id: "attendance", label: "Attendance" },
];

export default function AdminReportsPage() {
  const {
    loading,
    error,
    schoolYear,
    quarter,
    schoolYears,
    quarters,
    classReports,
    charts,
    summary,
    schoolSummary,
    overviewActionCounts,
    overviewHotspots,
    overviewMonitoringHealth,
    aralSummary,
    students,
    doingWell,
    setSchoolYear,
    setQuarter,
  } = useAdminReports();

  const { showToast } = useAppToast();
  const { period: aralPeriod } = useAralAssessmentPeriod();

  const [pageTab, setPageTab] = useState("academic");
  const [daily, setDaily] = useState(null);
  const [exportBusy, setExportBusy] = useState(false);

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

  function handleExportCurrentTabPdf() {
    setExportBusy(true);
    try {
      exportDynamicSchoolReportPdf({
        tab: pageTab,
        schoolYear,
        quarter,
        termLabel: quarterLabel,
        aralPeriod,
        summary,
        schoolSummary,
        aralSummary,
        doingWell,
        classReports,
        charts,
        overviewHotspots,
        overviewMonitoringHealth,
        actionCounts: overviewActionCounts,
        daily,
      });
      const tabObj = PAGE_TABS.find((t) => t.id === pageTab);
      showToast(`${tabObj?.label || "School"} report PDF downloaded.`);
    } catch (err) {
      showToast(err?.message ?? "Unable to export PDF.");
    } finally {
      setExportBusy(false);
    }
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
        description="Official school executive reports for academic performance, ARAL intervention, and student attendance."
        controls={
          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <PageHelp
                summary="Official school reports for Cambaog National High School. Review Academic, ARAL, and Attendance summaries for the selected school year and term."
                steps={[
                  "Select the School Year and Term to filter executive reporting data.",
                  "Choose between Academic, ARAL, and Attendance tabs to view focused metrics.",
                  "Review the 4 scoped summary cards, primary chart, and section summary table.",
                  "Click Export PDF to download the formal, print-ready DepEd A4 report.",
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
            <div className="ml-auto flex items-center justify-end">
              <button
                type="button"
                id="export-school-report-pdf-btn"
                disabled={loading || exportBusy}
                onClick={handleExportCurrentTabPdf}
                className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white shadow-xs transition-colors hover:bg-[#246f54] disabled:opacity-60"
              >
                {exportBusy ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <FileText size={12} />
                )}
                Export PDF
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
          Loading report data…
        </div>
      ) : (
        <div className="space-y-3">
          {/* TAB SWITCHER */}
          <div className="flex justify-end">
            <div
              role="tablist"
              aria-label="Reports views"
              className="inline-flex max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs dark:border-white/5 dark:bg-[var(--card)]"
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
                      "min-w-max cursor-pointer rounded-md px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cnhs-green/35",
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

          {/* TAB PANELS: STRICTLY SCOPED */}
          <TabSwitchPanel
            activeKey={pageTab}
            id={`reports-panel-${pageTab}`}
            role="tabpanel"
            aria-labelledby={`reports-tab-${pageTab}`}
          >
            {pageTab === "academic" ? (
              <AcademicReportTab
                summary={summary}
                schoolSummary={schoolSummary}
                classReports={classReports}
                charts={charts}
                overviewMonitoringHealth={overviewMonitoringHealth}
                doingWell={doingWell}
              />
            ) : null}

            {pageTab === "aral" ? (
              <AralReportTab
                aralSummary={aralSummary}
                aralPeriod={aralPeriod}
                classReports={classReports}
                overviewHotspots={overviewHotspots}
                students={students}
                schoolYear={schoolYear}
                quarter={quarter}
              />
            ) : null}

            {pageTab === "attendance" ? (
              <AttendanceReportTab daily={daily} />
            ) : null}
          </TabSwitchPanel>
        </div>
      )}
    </motion.div>
  );
}
