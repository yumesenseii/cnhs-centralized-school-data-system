"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Loader2, RefreshCw } from "lucide-react";
import AcademicPerformanceAnalysis from "@/components/academic-records/AcademicPerformanceAnalysis";
import AcademicRecordsTable from "@/components/academic-records/AcademicRecordsTable";
import ActionToolbar from "@/components/academic-records/ActionToolbar";
import FilterDropdown from "@/components/academic-records/FilterDropdown";
import GradeLevelSummary from "@/components/academic-records/GradeLevelSummary";
import RecentUploadActivity from "@/components/academic-records/RecentUploadActivity";
import SearchBar from "@/components/academic-records/SearchBar";
import SummaryCard from "@/components/academic-records/SummaryCard";
import TablePagination from "@/components/academic-records/TablePagination";
import TeacherSubmissionStatus from "@/components/academic-records/TeacherSubmissionStatus";
import ValidationSummary from "@/components/academic-records/ValidationSummary";
import Header from "@/components/layout/Header";
import { useAcademicRecords } from "@/hooks/admin/useAcademicRecords";
import { exportAcademicRecordsExcel } from "@/lib/admin/academicRecordsExport";

const selectClass =
  "h-8 cursor-pointer rounded-full border border-slate-200 bg-white pl-8 pr-7 text-[11px] font-medium text-slate-600 shadow-sm outline-none transition-colors hover:bg-slate-50 focus:border-cnhs-green";

export default function AcademicRecordsPage() {
  const {
    loading,
    error,
    schoolYear,
    quarter,
    schoolYears,
    quarters,
    setSchoolYear,
    setQuarter,
    refresh,
    summaryCards,
    gradeSummary,
    students,
    allStudents,
    filterOptions,
    teacherSubmissions,
    submissionProgress,
    validationSummary,
    validationLastUpdated,
    academicAnalysis,
    recentUploadActivity,
    periodLabel,
    search,
    setSearch,
    gradeFilter,
    setGradeFilter,
    sectionFilter,
    setSectionFilter,
    riskFilter,
    setRiskFilter,
    teacherFilter,
    setTeacherFilter,
  } = useAcademicRecords();

  const [toast, setToast] = useState("");
  const [exporting, setExporting] = useState(false);

  const quarterLabel = useMemo(() => {
    if (!quarter) return "All Terms";
    return (
      quarters.find((item) => item.value === quarter)?.label ||
      `Quarter ${quarter}`
    );
  }, [quarter, quarters]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function handleExportRecords() {
    try {
      setExporting(true);
      await exportAcademicRecordsExcel({
        students: allStudents,
        summaryCards,
        schoolYear,
        quarter: quarterLabel,
        periodLabel,
      });
      setToast("Academic records Excel downloaded.");
    } catch (err) {
      setToast(err?.message ?? "Unable to export academic records.");
    } finally {
      setExporting(false);
    }
  }

  function handleToolbarAction(label) {
    if (label === "Export Records") {
      handleExportRecords();
      return;
    }
    if (label === "View Intervention Summary") {
      window.location.href = "/monitoring";
      return;
    }
    setToast(
      `${label} stays on this page for review — use filters to find pending learners.`
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <Header
        breadcrumb="Home / Student Academic Records"
        title="Academic Records"
        controls={
          <>
            <label className="relative">
              <span className="sr-only">School Year</span>
              <CalendarDays
                size={12}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <select
                value={schoolYear}
                onChange={(e) => setSchoolYear(e.target.value)}
                className={selectClass}
                disabled={loading && !schoolYears.length}
              >
                {!schoolYears.length ? (
                  <option value="">Loading…</option>
                ) : (
                  schoolYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label>
              <span className="sr-only">Quarter</span>
              <select
                value={quarter}
                onChange={(e) => setQuarter(e.target.value)}
                className="h-8 cursor-pointer rounded-full border border-slate-200 bg-white px-4 text-[11px] font-medium text-slate-600 shadow-sm outline-none transition-colors hover:bg-slate-50 focus:border-cnhs-green"
                disabled={loading}
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
              disabled={loading}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-sm transition-colors duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw size={12} aria-hidden="true" />
              )}
              Refresh
            </button>
          </>
        }
      />

      {error ? (
        <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading && !summaryCards.length ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white py-16 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          Loading academic records…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {summaryCards.map((card) => (
              <SummaryCard key={card.id} card={card} />
            ))}
          </div>

          <div className="mt-4">
            <ActionToolbar
              onAction={handleToolbarAction}
              exporting={exporting}
            />
          </div>

          <div className="mt-4 space-y-3">
            <GradeLevelSummary rows={gradeSummary} />

            <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-2 lg:flex-row">
                <SearchBar value={search} onChange={setSearch} />
                <FilterDropdown
                  label="Grade Filter"
                  options={filterOptions.grades}
                  value={gradeFilter}
                  onChange={setGradeFilter}
                />
                <FilterDropdown
                  label="Section Filter"
                  options={filterOptions.sections}
                  value={sectionFilter}
                  onChange={setSectionFilter}
                />
                <FilterDropdown
                  label="Risk Level Filter"
                  options={filterOptions.risks}
                  value={riskFilter}
                  onChange={setRiskFilter}
                />
                <FilterDropdown
                  label="Teacher Filter"
                  options={filterOptions.teachers}
                  value={teacherFilter}
                  onChange={setTeacherFilter}
                />
              </div>
              <TablePagination count={students.length} />
            </section>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_256px]">
              <div className="min-w-0 space-y-3">
                <AcademicRecordsTable students={students} />
                <RecentUploadActivity activity={recentUploadActivity} />
              </div>

              <aside className="space-y-3">
                <TeacherSubmissionStatus
                  submissions={teacherSubmissions}
                  progress={submissionProgress}
                  periodLabel={periodLabel}
                />
                <ValidationSummary
                  summary={validationSummary}
                  lastValidated={validationLastUpdated}
                />
                <AcademicPerformanceAnalysis analysis={academicAnalysis} />
              </aside>
            </div>
          </div>
        </>
      )}

      {toast ? (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </motion.div>
  );
}
