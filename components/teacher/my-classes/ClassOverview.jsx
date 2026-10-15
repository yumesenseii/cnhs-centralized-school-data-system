"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  Users,
  Activity,
  BarChart2,
  Table,
  Loader2,
} from "lucide-react";
import AppSelect from "@/components/shared/AppSelect";
import MobileNavSheet from "@/components/layout/MobileNavSheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import EClassUploadDialog from "@/components/teacher/my-classes/EClassUploadDialog";
import EmptyLearnersState from "@/components/teacher/my-classes/EmptyLearnersState";
import ClassSupportCard from "@/components/teacher/my-classes/ClassSupportCard";
import ReadingReviewCard from "@/components/teacher/my-classes/ReadingReviewCard";
import LearnersNeedingAttentionCard from "@/components/teacher/my-classes/LearnersNeedingAttentionCard";
import ClassPerformanceModal from "@/components/teacher/my-classes/ClassPerformanceModal";
import MasterClassListTab from "@/components/teacher/my-classes/MasterClassListTab";
import ReportPreviewModal from "@/components/teacher/reports/ReportPreviewModal";
import Sf9ReportCardModal from "@/components/reports/Sf9ReportCardModal";
import { formatStudentForSf9 } from "@/lib/reports/sf9DataService";
import {
  PageBreadcrumb,
  SummaryKpiCards,
} from "@/components/teacher/my-classes/shared";
import { useClassDetails } from "@/hooks/teacher/useMyClasses";
import { useClassReport } from "@/hooks/teacher/useClassReport";
import {
  getCurrentTeacherSession,
  invalidateTeacherClassesCache,
} from "@/lib/supabase/queries/myClasses";
import { exportClassPerformanceSystemReport } from "@/lib/teacher/reportsExport";
import { buildQuarterlyAverages } from "@/lib/teacher/myClassesMappers";
import { isAralLanguageSubject } from "@/lib/monitoring/aralAcademicStatus";
import { useAppToast } from "@/components/shared/AppToast";
import { cn } from "@/lib/utils";

export default function ClassOverview({ classId }) {
  const router = useRouter();
  const {
    classItem,
    students,
    kpis,
    loading,
    error,
    refresh,
    viewQuarter,
    setViewQuarter,
    termOptions,
    allTermGradeRows,
  } = useClassDetails(classId);

  const {
    report,
    loading: reportLoading,
    generate: generateReport,
    reset: resetReport,
  } = useClassReport(classId);

  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "class-list"
  const [classListFilter, setClassListFilter] = useState("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [performanceOpen, setPerformanceOpen] = useState(false);
  const [sf9ModalOpen, setSf9ModalOpen] = useState(false);
  const [teacherId, setTeacherId] = useState(null);
  const { showToast } = useAppToast();

  async function openUpload() {
    const session = await getCurrentTeacherSession();
    setTeacherId(session.data?.teacherId ?? null);
    setUploadOpen(true);
  }

  async function handleGenerateReport() {
    if (reportLoading) return;
    const result = await generateReport();
    if (!result) {
      showToast("Unable to generate class report. Please try again.");
      return;
    }
    if (!result.hasGrades) {
      showToast(
        "No grades uploaded yet. Upload an E-Class Record before generating a report."
      );
      return;
    }
    setReportOpen(true);
  }

  async function handleExportReportExcel() {
    if (!report?.classReport) return;
    try {
      await exportClassPerformanceSystemReport({
        classReport: report.classReport,
        preview: report.preview,
        teacherName: report.teacherName,
        schoolYear: report.schoolYear,
        quarter: report.quarter,
        charts: report.charts,
      });
      showToast("Excel export downloaded.");
    } catch (err) {
      showToast(err?.message ?? "Unable to export Excel.");
    }
  }

  function closeReport() {
    setReportOpen(false);
    resetReport();
  }

  function handleNavigateToNeedsAttention() {
    setClassListFilter("below75");
    setActiveTab("class-list");
  }

  if (loading && !classItem) {
    return (
      <div className="mx-auto w-full max-w-5xl rounded-xl border border-slate-100 bg-white px-4 py-10 text-center text-sm text-slate-400 dark:border-white/10 dark:bg-slate-900">
        Loading class overview...
      </div>
    );
  }

  if (error || !classItem) {
    return (
      <div className="mx-auto w-full max-w-5xl rounded-xl border border-red-100 bg-red-50 px-4 py-10 text-center text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/20">
        {error || "Class not found."}
      </div>
    );
  }

  const hasLearners = students.length > 0;
  const isLanguage = isAralLanguageSubject(classItem.subject);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="mx-auto w-full max-w-5xl space-y-4 pb-8"
    >
      {/* Simple Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <PageBreadcrumb
              items={[
                { label: "My Classes", href: "/teacher/my-classes" },
                { label: `${classItem.subject} — ${classItem.gradeSection}` },
              ]}
            />
            <div className="mt-1 flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-[-0.03em] text-slate-900 sm:text-2xl dark:text-white">
                {classItem.subject}
              </h1>
              {classItem.isAdviser && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-[#246f54] border border-emerald-200/80 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300">
                  Advisory Class
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
              {[
                classItem.gradeSection,
                classItem.schoolYear,
                `Term ${viewQuarter}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          <MobileNavSheet
            ariaLabel="Open teacher menu"
            title="Teacher navigation"
          >
            {(close) => <TeacherSidebar mobile onNavigate={close} />}
          </MobileNavSheet>
        </div>

        {/* Header Right: Term selector & Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <div className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 shadow-2xs dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
            <span className="text-slate-400">Term</span>
            <AppSelect
              label="Term"
              value={String(viewQuarter)}
              onChange={(next) => {
                const n = Number(next);
                const target = termOptions.find((opt) => opt.value === n);
                if (target?.classId && target.classId !== classId) {
                  router.push(`/teacher/my-classes/${target.classId}`);
                  return;
                }
                setViewQuarter(n);
              }}
              options={termOptions.map((opt) => ({
                value: String(opt.value),
                label: opt.label,
              }))}
              size="pill"
              className="min-w-0"
              triggerClassName="h-7 w-auto border-0 bg-transparent px-1 shadow-none font-semibold text-[11px] text-slate-700 hover:bg-transparent dark:text-slate-200"
            />
          </div>
          <Link
            href="/teacher/my-classes"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-2xs hover:bg-slate-50 transition dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/5"
          >
            <ArrowLeft size={12} />
            Back to Classes
          </Link>
        </div>
      </header>

      {/* Primary Actions Toolbar */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-white/[0.02]">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {classItem.gradeSection} · {classItem.students} Learners Enrolled
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openUpload}
              className="inline-flex h-8 sm:h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 sm:px-3.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
            >
              <FileSpreadsheet size={14} className="text-[#246f54]" />
              <span>Upload E-Record</span>
            </button>

            <Link
              href={`/teacher/my-classes/${classItem.id}/e-record`}
              className="inline-flex h-8 sm:h-9 items-center gap-1.5 rounded-xl bg-[#246f54] hover:bg-[#1b5842] active:bg-[#144332] px-3 sm:px-3.5 text-xs font-semibold text-white shadow-xs transition cursor-pointer"
            >
              <Table size={14} />
              <span>Online Grade Sheet</span>
            </Link>

            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={reportLoading}
              className="inline-flex h-8 sm:h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer disabled:opacity-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
            >
              {reportLoading ? (
                <Loader2 size={13} className="animate-spin text-slate-500" />
              ) : (
                <FileText size={13} className="text-slate-500" />
              )}
              <span>Class Report</span>
            </button>

            {classItem?.isAdviser && (
              <button
                type="button"
                onClick={() => setSf9ModalOpen(true)}
                className="inline-flex h-8 sm:h-9 items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 px-3 text-xs font-semibold shadow-2xs transition cursor-pointer dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300"
              >
                <GraduationCap size={14} />
                <span>SF9 Cards</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Top 3 Summary Cards (Total Learners, Passed, Need Support) */}
      <SummaryKpiCards kpis={kpis} />

      {!hasLearners ? (
        <div className="mt-4">
          <EmptyLearnersState onUpload={openUpload} />
        </div>
      ) : (
        <>
          {/* Tabs: Overview vs Class List */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className={cn(
                  "relative flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold transition cursor-pointer",
                  activeTab === "overview"
                    ? "text-[#246f54] dark:text-emerald-400 font-bold"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                )}
              >
                <Activity size={15} />
                <span>Overview</span>
                {activeTab === "overview" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#246f54] dark:bg-emerald-400 rounded-full" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setClassListFilter("all");
                  setActiveTab("class-list");
                }}
                className={cn(
                  "relative flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold transition cursor-pointer",
                  activeTab === "class-list"
                    ? "text-[#246f54] dark:text-emerald-400 font-bold"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                )}
              >
                <Users size={15} />
                <span>Class List</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                  {students.length}
                </span>
                {activeTab === "class-list" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#246f54] dark:bg-emerald-400 rounded-full" />
                )}
              </button>
            </div>
          </div>

          {/* Tab 1: Single-Column Overview Flow */}
          {activeTab === "overview" ? (
            <div className="space-y-4">
              {/* 1. Class Support */}
              <ClassSupportCard
                classItem={classItem}
                students={students}
                currentTerm={viewQuarter}
                onReviewLearners={handleNavigateToNeedsAttention}
              />

              {/* 2. Reading Review (English & Filipino Only) */}
              {isLanguage && (
                <ReadingReviewCard
                  onReviewLearners={handleNavigateToNeedsAttention}
                />
              )}

              {/* 3. Learners Needing Attention (Top 5) */}
              <LearnersNeedingAttentionCard
                classItem={classItem}
                students={students}
                currentTerm={viewQuarter}
                onViewAllLearners={handleNavigateToNeedsAttention}
              />


              {/* 5. View Class Performance Secondary Button */}
              <div className="pt-1 flex justify-center">
                <button
                  type="button"
                  onClick={() => setPerformanceOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition cursor-pointer dark:border-white/10 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-white/5"
                >
                  <BarChart2 size={15} className="text-[#246f54]" />
                  <span>View Class Performance</span>
                </button>
              </div>
            </div>
          ) : (
            /* Tab 2: Class List */
            <div className="mt-2">
              <MasterClassListTab
                classItem={classItem}
                students={students}
                currentTerm={viewQuarter}
                initialStatusFilter={classListFilter}
              />
            </div>
          )}
        </>
      )}

      {/* Class Performance Modal (Charts + Class Average) */}
      <ClassPerformanceModal
        isOpen={performanceOpen}
        onClose={() => setPerformanceOpen(false)}
        classItem={classItem}
        students={students}
        quarterlyAverages={buildQuarterlyAverages(
          classItem,
          students,
          allTermGradeRows
        )}
      />

      {/* Upload Dialog */}
      <EClassUploadDialog
        open={uploadOpen}
        classItem={classItem}
        teacherId={teacherId}
        onClose={() => setUploadOpen(false)}
        onSuccess={async (result) => {
          const learners = result?.imported ?? 0;
          const grades = result?.gradesUpserted ?? 0;
          showToast(
            `Imported ${learners} learner${learners === 1 ? "" : "s"}${
              grades ? ` and ${grades} grade record${grades === 1 ? "" : "s"}` : ""
            }.`
          );
          invalidateTeacherClassesCache(teacherId);
          await refresh();
        }}
      />

      {/* Report Preview Modal */}
      <ReportPreviewModal
        open={reportOpen}
        preview={report?.preview ?? null}
        onClose={closeReport}
        onExport={handleExportReportExcel}
        exportLabel="Export Excel"
        closeLabel="Close"
      />

      {/* SF9 Report Card Modal (Advisers) */}
      {sf9ModalOpen && students.length > 0 && (
        <Sf9ReportCardModal
          isOpen={sf9ModalOpen}
          onClose={() => setSf9ModalOpen(false)}
          studentData={formatStudentForSf9(students[0])}
          studentsList={students.map(formatStudentForSf9)}
          sectionName={classItem?.gradeSection || "Section"}
          schoolYear={classItem?.schoolYear || "2026-2027"}
        />
      )}
    </motion.div>
  );
}
