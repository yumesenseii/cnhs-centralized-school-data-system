"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, FileText, Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import EClassUploadDialog from "@/components/teacher/my-classes/EClassUploadDialog";
import EmptyLearnersState from "@/components/teacher/my-classes/EmptyLearnersState";
import GradeDistributionChart from "@/components/teacher/my-classes/GradeDistributionChart";
import QuickActions from "@/components/teacher/my-classes/QuickActions";
import RiskDistributionChart from "@/components/teacher/my-classes/RiskDistributionChart";
import SubmissionStatus from "@/components/teacher/my-classes/SubmissionStatus";
import UpcomingTasks from "@/components/teacher/my-classes/UpcomingTasks";
import ReportPreviewModal from "@/components/teacher/reports/ReportPreviewModal";
import {
  PageBreadcrumb,
  SummaryKpiCards,
} from "@/components/teacher/my-classes/shared";
import { useClassDetails } from "@/hooks/teacher/useMyClasses";
import { useClassReport } from "@/hooks/teacher/useClassReport";
import { getCurrentTeacherSession } from "@/lib/supabase/queries/myClasses";
import {
  exportClassReportExcel,
  exportTeacherReportsPdf,
} from "@/lib/teacher/reportsExport";
import { SIDEBAR_SHEET_CLASS } from "@/lib/constants/layout";
import { buildQuarterlyAverages } from "@/lib/teacher/myClassesMappers";
import { termLabel } from "@/lib/academic/termLabels";
import { useRouter } from "next/navigation";

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
    termOptions,
    allTermGradeRows,
  } = useClassDetails(classId);
  const {
    report,
    loading: reportLoading,
    generate: generateReport,
    reset: resetReport,
  } = useClassReport(classId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [teacherId, setTeacherId] = useState(null);
  const [toast, setToast] = useState("");

  async function openUpload() {
    const session = await getCurrentTeacherSession();
    setTeacherId(session.data?.teacherId ?? null);
    setUploadOpen(true);
  }

  async function handleGenerateReport() {
    if (reportLoading) return;
    const result = await generateReport();
    if (!result) {
      setToast("Unable to generate class report. Please try again.");
      return;
    }
    if (!result.hasGrades) {
      setToast(
        "No grades uploaded yet. Import an E-Class Record before generating a report."
      );
      return;
    }
    setReportOpen(true);
  }

  function handleQuickAction(action) {
    if (action.id === "qa3") {
      handleGenerateReport();
      return;
    }
    if (action.id === "qa1") {
      openUpload();
    }
  }

  function handleExportReportPdf() {
    if (!report?.classReport) return;
    try {
      exportTeacherReportsPdf({
        teacherName: report.teacherName,
        schoolYear: report.schoolYear,
        quarter: report.quarter,
        summary: report.summary,
        classReports: [report.classReport],
        charts: report.charts,
      });
    } catch (err) {
      setToast(err?.message ?? "Unable to export PDF.");
    }
  }

  async function handleExportReportExcel() {
    if (!report?.classReport) return;
    try {
      await exportClassReportExcel(report.classReport, report.charts);
      setToast("Excel export downloaded.");
    } catch (err) {
      setToast(err?.message ?? "Unable to export Excel.");
    }
  }

  function closeReport() {
    setReportOpen(false);
    resetReport();
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white px-4 py-10 text-center text-sm text-slate-400">
        Loading class overview...
      </div>
    );
  }

  if (error || !classItem) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-10 text-center text-sm text-red-600">
        {error || "Class not found."}
      </div>
    );
  }

  const hasLearners = students.length > 0;

  const gradeDistribution = [
    {
      label: "A (90–100)",
      count: students.filter((s) => s.averageGrade >= 90).length,
      tone: "green",
      percent: hasLearners
        ? Math.round(
            (students.filter((s) => s.averageGrade >= 90).length / students.length) * 100
          )
        : 0,
    },
    {
      label: "B (80–89)",
      count: students.filter((s) => s.averageGrade >= 80 && s.averageGrade < 90).length,
      tone: "violet",
      percent: hasLearners
        ? Math.round(
            (students.filter((s) => s.averageGrade >= 80 && s.averageGrade < 90).length /
              students.length) *
              100
          )
        : 0,
    },
    {
      label: "C (75–79)",
      count: students.filter((s) => s.averageGrade >= 75 && s.averageGrade < 80).length,
      tone: "orange",
      percent: hasLearners
        ? Math.round(
            (students.filter((s) => s.averageGrade >= 75 && s.averageGrade < 80).length /
              students.length) *
              100
          )
        : 0,
    },
    {
      label: "D (below 75)",
      count: students.filter((s) => s.averageGrade !== null && s.averageGrade < 75).length,
      tone: "red",
      percent: hasLearners
        ? Math.round(
            (students.filter((s) => s.averageGrade !== null && s.averageGrade < 75).length /
              students.length) *
              100
          )
        : 0,
    },
  ];

  const riskDistribution = [
    {
      name: "High Risk",
      value: students.filter((s) => {
        const grade = Number(s.averageGrade);
        return Number.isFinite(grade) && grade < 75;
      }).length,
      color: "#e63946",
    },
    {
      name: "Active",
      value: students.filter((s) => {
        const grade = Number(s.averageGrade);
        return !(Number.isFinite(grade) && grade < 75);
      }).length,
      color: "#52b788",
    },
  ];

  const submission = {
    eClass: {
      detail: classItem.hasLearners
        ? `Imported · ${classItem.lastUpdated}`
        : "Not yet uploaded",
      status: classItem.academicRecord,
    },
    lessonPlan: {
      detail: classItem.lessonPlan,
      status: classItem.lessonPlan,
    },
  };

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
            <PageBreadcrumb
              items={[
                { label: "My Classes", href: "/teacher/my-classes" },
                { label: `${classItem.subject} — ${classItem.gradeSection}` },
              ]}
            />
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-800 sm:text-[22px]">
              {classItem.subject}
            </h1>
          </div>

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger
              render={
                <button
                  type="button"
                  aria-label="Open teacher menu"
                  className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
                />
              }
            >
              <Menu size={18} />
            </SheetTrigger>
            <SheetContent side="left" showCloseButton={false} className={SIDEBAR_SHEET_CLASS}>
              <SheetTitle className="sr-only">Teacher navigation</SheetTitle>
              <TeacherSidebar mobile onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 text-[11px] font-semibold text-sky-700">
            <FileText size={12} />
            {classItem.gradeSection}
          </span>
          {termOptions?.length > 1 ? (
            <label className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 shadow-sm">
              <span className="text-slate-400">Term</span>
              <select
                value={String(viewQuarter)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  const target = termOptions.find((opt) => opt.value === n);
                  if (target?.classId && target.classId !== classId) {
                    router.push(`/teacher/my-classes/${target.classId}`);
                    return;
                  }
                }}
                className="cursor-pointer bg-transparent text-[11px] font-semibold text-slate-700 outline-none"
              >
                {termOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <Link
            href="/teacher/my-classes"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft size={12} />
            Back
          </Link>
        </div>
      </header>

      {toast ? (
        <div className="mb-4 rounded-xl border border-green-100 bg-green-50 px-3 py-2.5 text-[12px] font-medium text-cnhs-green-dark">
          {toast}
        </div>
      ) : null}

      <SummaryKpiCards kpis={kpis} />

      {!hasLearners ? (
        <div className="mt-4">
          <EmptyLearnersState onUpload={openUpload} />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_0.9fr]">
          <div className="space-y-3">
            <GradeDistributionChart
              data={gradeDistribution}
              quarterlyAverages={buildQuarterlyAverages(
                classItem,
                students,
                allTermGradeRows
              )}
            />
            <RiskDistributionChart data={riskDistribution} />
          </div>

          <div className="space-y-3">
            <SubmissionStatus submission={submission} />
            <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
              <h3 className="text-sm font-semibold text-slate-900">Class Information</h3>
              <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  ["Subject", classItem.subject],
                  ["Grade & Section", classItem.gradeSection],
                  ["School Year", classItem.schoolYear],
                  ["Term", termLabel(viewQuarter) || classItem.currentQuarter],
                  ["Teacher", classItem.teacher],
                  ["Total Enrolled", `${classItem.students} students`],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                      {label}
                    </dt>
                    <dd className="mt-1 text-[12px] font-semibold text-slate-800">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          <div className="space-y-3">
            <QuickActions
              actions={[
                { id: "qa1", label: "Upload E-Class Record", tone: "primary", icon: "upload" },
                { id: "qa2", label: "Upload Lesson Plan", tone: "violet", icon: "file" },
                { id: "qa3", label: "Generate Class Report", tone: "orange", icon: "report" },
              ]}
              classId={classItem.id}
              busyId={reportLoading ? "qa3" : null}
              onAction={handleQuickAction}
            />
            <UpcomingTasks
              tasks={[
                {
                  id: "ut1",
                  title: "Review imported learner records",
                  due: "After E-Class import",
                  tone: "orange",
                },
              ]}
            />
          </div>
        </div>
      )}

      <EClassUploadDialog
        open={uploadOpen}
        classItem={classItem}
        teacherId={teacherId}
        onClose={() => setUploadOpen(false)}
        onSuccess={(result) => {
          const learners = result?.imported ?? 0;
          const grades = result?.gradesUpserted ?? 0;
          setToast(
            `Imported ${learners} learner${learners === 1 ? "" : "s"}${
              grades ? ` and ${grades} grade record${grades === 1 ? "" : "s"}` : ""
            }.`
          );
          refresh();
          window.setTimeout(() => setToast(""), 3200);
        }}
      />

      <ReportPreviewModal
        open={reportOpen}
        preview={report?.preview ?? null}
        onClose={closeReport}
        onExport={handleExportReportPdf}
        onExportExcel={handleExportReportExcel}
        closeLabel="Close"
      />
    </motion.div>
  );
}
