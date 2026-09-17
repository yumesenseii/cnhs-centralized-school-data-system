"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  ChevronRight,
  Download,
  Loader2,
  RefreshCw,
} from "lucide-react";
import AcademicRecordsTable from "@/components/academic-records/AcademicRecordsTable";
import ClassFolderCards from "@/components/academic-records/ClassFolderCards";
import FilterDropdown from "@/components/academic-records/FilterDropdown";
import GradeFolderCards from "@/components/academic-records/GradeFolderCards";
import SectionFolderCards from "@/components/academic-records/SectionFolderCards";
import OperationsAccordion from "@/components/academic-records/OperationsAccordion";
import RecordsBrowseBar from "@/components/academic-records/RecordsBrowseBar";
import SummaryCard from "@/components/academic-records/SummaryCard";
import TablePagination, {
  ACADEMIC_RECORDS_PAGE_SIZE,
} from "@/components/academic-records/TablePagination";
import Header from "@/components/layout/Header";
import AppSelect from "@/components/shared/AppSelect";
import { useAppToast } from "@/components/shared/AppToast";
import { useAcademicRecords } from "@/hooks/admin/useAcademicRecords";
import { exportAcademicRecordsExcel } from "@/lib/admin/academicRecordsExport";

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
    sectionFolders,
    classes,
    selectedClass,
    students,
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
    selectGradeFolder,
    clearGradeFolder,
    selectSectionFolder,
    clearSectionFolder,
    sectionFilter,
    setSectionFilter,
    teacherFilter,
    setTeacherFilter,
    statusFilter,
    setStatusFilter,
    statusCounts,
    selectClass: openClass,
    clearClass,
  } = useAcademicRecords();

  const { showToast } = useAppToast();
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);

  const quarterLabel = useMemo(() => {
    if (!quarter) return "All Terms";
    return (
      quarters.find((item) => item.value === quarter)?.label ||
      `Quarter ${quarter}`
    );
  }, [quarter, quarters]);

  const gradeFocused = gradeFilter !== "All Grades";
  const sectionFocused = sectionFilter !== "All Sections";
  const classOpen = Boolean(selectedClass);

  const breadcrumb = classOpen
    ? `Home / Academic Records / ${selectedClass.gradeLabel} / ${selectedClass.section} / ${selectedClass.subject}`
    : gradeFocused && sectionFocused
      ? `Home / Academic Records / ${gradeFilter} / ${sectionFilter}`
      : gradeFocused
        ? `Home / Academic Records / ${gradeFilter}`
        : "Home / Academic Records";

  useEffect(() => {
    setPage(1);
  }, [
    search,
    gradeFilter,
    sectionFilter,
    teacherFilter,
    statusFilter,
    schoolYear,
    quarter,
    selectedClass?.id,
  ]);

  const totalStudents = students.length;
  const totalPages = Math.max(
    1,
    Math.ceil(totalStudents / ACADEMIC_RECORDS_PAGE_SIZE) || 1
  );
  const safePage = Math.min(Math.max(page, 1), totalPages);

  const pagedStudents = useMemo(() => {
    const start = (safePage - 1) * ACADEMIC_RECORDS_PAGE_SIZE;
    return students.slice(start, start + ACADEMIC_RECORDS_PAGE_SIZE);
  }, [students, safePage]);

  async function handleExportRecords() {
    try {
      setExporting(true);
      await exportAcademicRecordsExcel({
        students: classOpen ? students : [],
        classes: classOpen ? [selectedClass] : classes,
        summaryCards,
        schoolYear,
        quarter: quarterLabel,
        periodLabel,
        classTitle: selectedClass
          ? `${selectedClass.subject} · ${selectedClass.gradeSection} · ${selectedClass.termLabel}`
          : "",
      });
      showToast("Academic records Excel downloaded.");
    } catch (err) {
      showToast(err?.message ?? "Unable to export academic records.");
    } finally {
      setExporting(false);
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
        breadcrumb={breadcrumb}
        title="Academic Records"
        controls={
          <>
            <AppSelect
              label="School Year"
              value={schoolYear}
              onChange={setSchoolYear}
              options={
                !schoolYears.length
                  ? [{ value: "", label: "Loading…" }]
                  : schoolYears
              }
              icon={CalendarDays}
              size="pill"
              align="end"
              disabled={loading && !schoolYears.length}
            />
            <AppSelect
              label="Term"
              value={quarter}
              onChange={setQuarter}
              options={quarters}
              size="pill"
              align="end"
              disabled={loading}
            />
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
            <button
              type="button"
              onClick={handleExportRecords}
              disabled={exporting || loading || (!classOpen && !classes.length)}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting ? (
                <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              ) : (
                <Download size={12} aria-hidden="true" />
              )}
              Export
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {summaryCards.map((card) => (
              <SummaryCard key={card.id} card={card} />
            ))}
          </div>

          {!gradeFocused && !classOpen ? (
            <section className="mt-4">
              <div className="mb-2">
                <h2 className="text-sm font-semibold text-slate-800">
                  Grade folders
                </h2>
              </div>
              <GradeFolderCards
                rows={gradeSummary}
                activeGrade={gradeFilter}
                onSelect={selectGradeFolder}
              />
            </section>
          ) : null}

          <section className={gradeFocused || classOpen ? "mt-3 space-y-2" : "mt-4 space-y-3"}>
            <div className="flex flex-wrap items-center gap-1 text-[12px] text-slate-500">
              <button
                type="button"
                onClick={clearGradeFolder}
                className="cursor-pointer font-medium text-slate-600 hover:text-cnhs-green-dark"
              >
                Academic Records
              </button>
              {gradeFocused ? (
                <>
                  <ChevronRight size={12} className="text-slate-300" />
                  <button
                    type="button"
                    onClick={clearSectionFolder}
                    className="cursor-pointer font-semibold text-slate-800 hover:text-cnhs-green-dark"
                  >
                    {gradeFilter}
                  </button>
                </>
              ) : null}
              {sectionFocused ? (
                <>
                  <ChevronRight size={12} className="text-slate-300" />
                  <button
                    type="button"
                    onClick={clearClass}
                    className="cursor-pointer font-semibold text-slate-800 hover:text-cnhs-green-dark"
                  >
                    {sectionFilter}
                  </button>
                </>
              ) : null}
              {classOpen ? (
                <>
                  <ChevronRight size={12} className="text-slate-300" />
                  <span className="font-semibold text-slate-800">
                    {selectedClass.subject}
                  </span>
                </>
              ) : null}
              {gradeFocused ? (
                <button
                  type="button"
                  onClick={clearGradeFolder}
                  className="ml-2 cursor-pointer text-[11px] font-semibold text-cnhs-green-dark hover:underline"
                >
                  Show all grades
                </button>
              ) : null}
              <span className="ml-auto text-[10px] text-slate-400">
                {classOpen
                  ? `${totalStudents} in list · ${periodLabel}`
                  : sectionFocused
                    ? `${classes.length} classes · ${periodLabel}`
                    : gradeFocused
                      ? `${sectionFolders.length} sections · ${periodLabel}`
                      : periodLabel}
              </span>
            </div>

            <RecordsBrowseBar
              search={search}
              onSearchChange={setSearch}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              counts={statusCounts}
              showGradePills={classOpen}
              extraFilters={
                <div className="flex flex-wrap gap-2 lg:shrink-0">
                  <FilterDropdown
                    label="Section Filter"
                    options={filterOptions.sections}
                    value={sectionFilter}
                    onChange={(value) => {
                      if (value === "All Sections") {
                        selectSectionFolder("All Sections");
                      } else {
                        selectSectionFolder(value);
                      }
                    }}
                  />
                  <FilterDropdown
                    label="Teacher Filter"
                    options={filterOptions.teachers}
                    value={teacherFilter}
                    onChange={(value) => {
                      setTeacherFilter(value);
                      clearClass();
                    }}
                  />
                </div>
              }
            />

            {classOpen ? (
              <>
                <AcademicRecordsTable
                  students={pagedStudents}
                  title={`${selectedClass.subject} · ${selectedClass.gradeSection} · ${selectedClass.teacherName} · ${selectedClass.termLabel}`}
                  recordCount={totalStudents}
                  termHeader={
                    selectedClass.isTermGroup
                      ? ""
                      : `${selectedClass.termLabel} grade`
                  }
                />
                <TablePagination
                  page={safePage}
                  pageSize={ACADEMIC_RECORDS_PAGE_SIZE}
                  total={totalStudents}
                  onPageChange={setPage}
                />
              </>
            ) : gradeFocused && sectionFocused ? (
              <ClassFolderCards classes={classes} onSelect={openClass} />
            ) : gradeFocused ? (
              <SectionFolderCards
                rows={sectionFolders}
                onSelect={selectSectionFolder}
              />
            ) : null}
          </section>

          <OperationsAccordion
            recentUploadActivity={recentUploadActivity}
            teacherSubmissions={teacherSubmissions}
            submissionProgress={submissionProgress}
            periodLabel={periodLabel}
            validationSummary={validationSummary}
            validationLastUpdated={validationLastUpdated}
            academicAnalysis={academicAnalysis}
          />
        </>
      )}

    </motion.div>
  );
}
