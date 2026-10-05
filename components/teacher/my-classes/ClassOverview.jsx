"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import AppSelect from "@/components/shared/AppSelect";
import MobileNavSheet from "@/components/layout/MobileNavSheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import EClassUploadDialog from "@/components/teacher/my-classes/EClassUploadDialog";
import EmptyLearnersState from "@/components/teacher/my-classes/EmptyLearnersState";
import GradeDistributionChart from "@/components/teacher/my-classes/GradeDistributionChart";
import QuickActions from "@/components/teacher/my-classes/QuickActions";
import RiskDistributionChart from "@/components/teacher/my-classes/RiskDistributionChart";
import SubmissionStatus from "@/components/teacher/my-classes/SubmissionStatus";
import UpcomingTasks from "@/components/teacher/my-classes/UpcomingTasks";
import ReportPreviewModal from "@/components/teacher/reports/ReportPreviewModal";
import Sf9ReportCardModal from "@/components/reports/Sf9ReportCardModal";
import { formatStudentForSf9 } from "@/lib/reports/sf9DataService";
import {
  PageBreadcrumb,
  SummaryKpiCards,
} from "@/components/teacher/my-classes/shared";
import { useClassDetails } from "@/hooks/teacher/useMyClasses";
import { useClassReport } from "@/hooks/teacher/useClassReport";
import { getCurrentTeacherSession } from "@/lib/supabase/queries/myClasses";
import {
  exportClassPerformanceSystemReport,
} from "@/lib/teacher/reportsExport";
import { UPLOAD_STORAGE_KEY } from "@/data/teacher/lessonPlans";
import { buildQuarterlyAverages } from "@/lib/teacher/myClassesMappers";
import { termLabel } from "@/lib/academic/termLabels";
import { useAppToast } from "@/components/shared/AppToast";

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
  const [uploadOpen, setUploadOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
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
        "No grades uploaded yet. Import an E-Class Record before generating a report."
      );
      return;
    }
    setReportOpen(true);
  }

  function handleQuickAction(action) {
    if (action.id === "qa-sf9") {
      setSf9ModalOpen(true);
      return;
    }
    if (action.id === "qa3") {
      handleGenerateReport();
      return;
    }
    if (action.id === "qa-ecr-enter") {
      router.push(`/teacher/my-classes/${classItem?.id ?? classId}/e-record`);
      return;
    }
    if (action.id === "qa1") {
      openUpload();
      return;
    }
    if (action.id === "qa2") {
      const targetClassId = classItem?.id ?? classId;
      if (!targetClassId) return;
      try {
        const raw = window.sessionStorage.getItem(UPLOAD_STORAGE_KEY);
        const prev = raw ? JSON.parse(raw) : {};
        window.sessionStorage.setItem(
          UPLOAD_STORAGE_KEY,
          JSON.stringify({
            ...prev,
            classId: targetClassId,
            selectedClassSnapshot: null,
            step: 1,
          })
        );
      } catch {
        /* ignore storage errors — query param still preselects */
      }
      router.push(
        `/teacher/lesson-plans/upload?classId=${encodeURIComponent(targetClassId)}&fresh=1`
      );
      return;
    }
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

  if (loading && !classItem) {
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
        return Number.isFinite(grade) && grade >= 75;
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
          <div className="min-w-0">
            <PageBreadcrumb
              items={[
                { label: "My Classes", href: "/teacher/my-classes" },
                { label: `${classItem.subject} — ${classItem.gradeSection}` },
              ]}
            />
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-800 sm:text-[22px]">
              {classItem.subject}
            </h1>
            <p className="mt-1 truncate text-[12px] font-medium text-slate-500">
              {[
                classItem.gradeSection,
                classItem.schoolYear,
                `${classItem.students} students`,
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

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <div className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 shadow-sm">
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
              triggerClassName="h-8 w-auto border-0 bg-transparent px-1 shadow-none font-semibold text-[11px] text-slate-700 hover:bg-transparent"
            />
          </div>
          <Link
            href="/teacher/my-classes"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
          >
            <ArrowLeft size={12} />
            Back
          </Link>
        </div>
      </header>

      <div className="mb-4">
        <QuickActions
          align="end"
          menuLabel={`More actions for ${classItem.subject}`}
          primary={{
            id: "qa-ecr-enter",
            label: "Enter Grades (E-Record)",
            icon: "upload",
          }}
          secondary={[
            {
              id: "qa-students",
              label: "View Students",
              icon: "users",
              href: `/teacher/my-classes/${classItem.id}/students`,
            },
            {
              id: "qa1",
              label: "Import ECR",
              icon: "file",
              tone: "orange",
            },
          ]}
          overflow={[
            ...(classItem?.isAdviser
              ? [
                  {
                    id: "qa-sf9",
                    label: "Section SF9 Report Cards (PDF)",
                    icon: "report",
                  },
                ]
              : []),
            {
              id: "qa2",
              label: "Upload Lesson Plan",
              icon: "file",
            },
            {
              id: "qa3",
              label: "Generate Class Report",
              icon: "report",
            },
          ]}
          busyId={reportLoading ? "qa3" : null}
          onAction={handleQuickAction}
        />
      </div>

      <SummaryKpiCards kpis={kpis} />

      {!hasLearners ? (
        <div className="mt-4">
          <EmptyLearnersState onUpload={openUpload} />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
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
              <h3 className="text-sm font-semibold text-slate-900">
                Class Information
              </h3>
              <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  ["Subject", classItem.subject],
                  ["Grade & Section", classItem.gradeSection],
                  ["School Year", classItem.schoolYear],
                  [
                    "Term",
                    termLabel(viewQuarter) || classItem.currentQuarter,
                  ],
                  ["Teacher", classItem.teacher],
                  ["Total Enrolled", `${classItem.students} students`],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                      {label}
                    </dt>
                    <dd className="mt-1 text-[12px] font-semibold text-slate-800">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
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
        onSuccess={async (result) => {
          const learners = result?.imported ?? 0;
          const grades = result?.gradesUpserted ?? 0;
          showToast(
            `Imported ${learners} learner${learners === 1 ? "" : "s"}${
              grades ? ` and ${grades} grade record${grades === 1 ? "" : "s"}` : ""
            }.`
          );
          await refresh();
        }}
      />

      <ReportPreviewModal
        open={reportOpen}
        preview={report?.preview ?? null}
        onClose={closeReport}
        onExport={handleExportReportExcel}
        exportLabel="Export Excel"
        closeLabel="Close"
      />

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
