"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  FileSpreadsheet,
} from "lucide-react";
import MobileNavSheet from "@/components/layout/MobileNavSheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import { PageBreadcrumb } from "@/components/teacher/my-classes/shared";
import { useStudentProfile } from "@/hooks/teacher/useMyClasses";
import { cn } from "@/lib/utils";

export default function StudentProfile({ classId, studentId }) {
  const { classItem, student, loading, error } = useStudentProfile(
    classId,
    studentId
  );

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white px-4 py-10 text-center text-sm text-slate-400 dark:border-white/10 dark:bg-slate-900">
        Loading student profile...
      </div>
    );
  }

  if (error || !classItem || !student) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-10 text-center text-sm text-red-600 dark:border-red-900/40 dark:bg-red-950/20">
        {error || "Student profile not found."}
      </div>
    );
  }

  const summary = student.summary ?? {};
  const termGrades = summary.termGrades ?? { 1: null, 2: null, 3: null, final: null };
  const hasGrades = Boolean(summary.hasGrades);

  // Current Grade & Previous Grade
  const currentGrade = summary.currentGrade;
  const previousGrade = summary.previousGrade;
  const progressText = summary.progress ?? "No previous grade";
  const comparisonSentence = summary.comparisonSentence;

  // Shared Academic Monitoring State
  const monitoringState = student.monitoringState ?? {};
  const currentSupportLabel = monitoringState.currentSupport ?? "Monitoring";
  const currentSupportKey = monitoringState.currentSupportKey ?? "monitoring";
  const currentSupportBadgeStyle =
    monitoringState.currentSupportBadgeStyle ??
    "border-slate-200 bg-slate-50 text-slate-700 dark:bg-white/5 dark:text-slate-300";

  // Recommended Support (Requirement 6)
  let recommendedSupportLabel = "Continue Monitoring";
  let recommendedSupportDescription =
    "Learner is currently meeting expectations; continue routine classroom observation.";

  if (currentSupportKey === "under_class_support") {
    recommendedSupportLabel = "Class Remedial";
    recommendedSupportDescription =
      "Active classroom remedial support is currently in progress.";
  } else if (currentSupportKey === "under_aral_support") {
    recommendedSupportLabel = "ARAL Program";
    recommendedSupportDescription =
      "Active ARAL intervention program is currently underway.";
  } else if (currentGrade !== null && currentGrade < 75) {
    recommendedSupportLabel = "Class Remedial";
    recommendedSupportDescription =
      `Academic performance in ${classItem.subject} is below passing grade (75). Classroom remedial support is recommended.`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-8 space-y-4 w-full"
    >
      {/* 1. Simplified Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between pb-1">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <PageBreadcrumb
              items={[
                { label: "My Classes", href: "/teacher/my-classes" },
                {
                  label: classItem.subject,
                  href: `/teacher/my-classes/${classItem.id}`,
                },
                {
                  label: "Students",
                  href: `/teacher/my-classes/${classItem.id}`,
                },
                { label: student.name },
              ]}
            />
            <h1 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white uppercase">
              {student.name}
            </h1>
            <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              LRN {student.studentNumber || "—"} · {student.grade || classItem.grade} – {student.section || classItem.section} · {student.gender || "—"}
            </p>
            <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
              {classItem.subject} · {classItem.schoolYear || student.schoolYear || "SY 2026–2027"}
            </p>
          </div>

          <MobileNavSheet ariaLabel="Open teacher menu" title="Teacher navigation">
            {(close) => <TeacherSidebar mobile onNavigate={close} />}
          </MobileNavSheet>
        </div>

        <Link
          href={`/teacher/my-classes/${classItem.id}`}
          className="inline-flex h-8 items-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-2xs hover:bg-slate-50 transition shrink-0 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-white/5"
        >
          <ArrowLeft size={12} />
          <span>Back to Class List</span>
        </Link>
      </header>

      {/* 2. Current Subject Status */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-white/[0.02]">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Current Subject Status
        </h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Current Grade */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 dark:border-white/5 dark:bg-white/[0.02]">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
              Current Grade
            </span>
            <p
              className={cn(
                "mt-1 text-2xl font-bold tracking-tight",
                currentGrade !== null && currentGrade < 75
                  ? "text-red-600 dark:text-red-400"
                  : "text-slate-900 dark:text-white"
              )}
            >
              {currentGrade !== null ? currentGrade : "—"}
            </p>
            {currentGrade !== null && currentGrade < 75 ? (
              <span className="inline-block mt-1 text-[11px] font-semibold text-red-600 dark:text-red-400">
                Below passing grade
              </span>
            ) : currentGrade !== null && currentGrade >= 75 ? (
              <span className="inline-block mt-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                Passing grade
              </span>
            ) : (
              <span className="inline-block mt-1 text-[11px] text-slate-400">
                No grade recorded yet
              </span>
            )}
          </div>

          {/* Progress */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 dark:border-white/5 dark:bg-white/[0.02]">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
              Progress
            </span>
            <div className="mt-1 flex items-center gap-1.5">
              {progressText === "Improving" && (
                <TrendingUp size={18} className="text-emerald-600 dark:text-emerald-400" />
              )}
              {progressText === "Declining" && (
                <TrendingDown size={18} className="text-amber-700 dark:text-amber-400" />
              )}
              {progressText === "No clear change" && (
                <Minus size={18} className="text-slate-400" />
              )}
              <p
                className={cn(
                  "text-2xl font-bold tracking-tight",
                  progressText === "Improving" && "text-emerald-600 dark:text-emerald-400",
                  progressText === "Declining" && "text-amber-700 dark:text-amber-400",
                  progressText === "No previous grade" && "text-slate-700 dark:text-slate-300",
                  progressText === "No clear change" && "text-slate-700 dark:text-slate-300"
                )}
              >
                {progressText}
              </p>
            </div>
            <span className="inline-block mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              {progressText === "No previous grade"
                ? "First recorded term"
                : "Compared with previous term"}
            </span>
          </div>

          {/* Current Support */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 dark:border-white/5 dark:bg-white/[0.02]">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
              Current Support
            </span>
            <div className="mt-1.5">
              <span
                className={cn(
                  "inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold border",
                  currentSupportBadgeStyle
                )}
              >
                {currentSupportLabel}
              </span>
            </div>
            <span className="inline-block mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
              Shared Academic Monitoring status
            </span>
          </div>
        </div>
      </section>

      {/* 3. Grade History OR Empty Grade State */}
      {!hasGrades ? (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-xs dark:border-white/10 dark:bg-white/[0.02]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400">
            <FileSpreadsheet size={22} />
          </div>
          <h3 className="mt-3 text-sm font-bold text-slate-900 dark:text-white">
            No grades recorded yet.
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Grades will appear here after the class E-Record is uploaded or grades are entered.
          </p>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-white/[0.02]">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Grade History
          </h2>

          {/* Compact Terms Grid */}
          <div className="mt-3 grid grid-cols-4 gap-2 text-center rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-white/5 dark:bg-white/[0.02]">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                Term 1
              </span>
              <p
                className={cn(
                  "mt-1 text-base sm:text-lg font-bold",
                  termGrades[1] !== null && termGrades[1] < 75
                    ? "text-red-600 dark:text-red-400"
                    : "text-slate-900 dark:text-white"
                )}
              >
                {termGrades[1] ?? "—"}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                Term 2
              </span>
              <p
                className={cn(
                  "mt-1 text-base sm:text-lg font-bold",
                  termGrades[2] !== null && termGrades[2] < 75
                    ? "text-red-600 dark:text-red-400"
                    : "text-slate-900 dark:text-white"
                )}
              >
                {termGrades[2] ?? "—"}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                Term 3
              </span>
              <p
                className={cn(
                  "mt-1 text-base sm:text-lg font-bold",
                  termGrades[3] !== null && termGrades[3] < 75
                    ? "text-red-600 dark:text-red-400"
                    : "text-slate-900 dark:text-white"
                )}
              >
                {termGrades[3] ?? "—"}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                Final
              </span>
              <p
                className={cn(
                  "mt-1 text-base sm:text-lg font-bold",
                  termGrades.final !== null && termGrades.final < 75
                    ? "text-red-600 dark:text-red-400"
                    : "text-slate-900 dark:text-white"
                )}
              >
                {termGrades.final ?? "—"}
              </p>
            </div>
          </div>

          {/* Comparison summary */}
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5 space-y-2">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-[10.5px] uppercase font-bold text-slate-400">
                  Previous Grade
                </span>
                <p className="mt-0.5 font-bold text-slate-800 dark:text-slate-200">
                  {previousGrade !== null ? previousGrade : "—"}
                </p>
              </div>
              <div>
                <span className="text-[10.5px] uppercase font-bold text-slate-400">
                  Current Grade
                </span>
                <p
                  className={cn(
                    "mt-0.5 font-bold",
                    currentGrade !== null && currentGrade < 75
                      ? "text-red-600 dark:text-red-400"
                      : "text-slate-800 dark:text-slate-200"
                  )}
                >
                  {currentGrade !== null ? currentGrade : "—"}
                </p>
              </div>
              <div>
                <span className="text-[10.5px] uppercase font-bold text-slate-400">
                  Progress
                </span>
                <p
                  className={cn(
                    "mt-0.5 font-bold",
                    progressText === "Improving" && "text-emerald-600 dark:text-emerald-400",
                    progressText === "Declining" && "text-amber-700 dark:text-amber-400",
                    progressText === "No previous grade" && "text-slate-500 dark:text-slate-400",
                    progressText === "No clear change" && "text-slate-700 dark:text-slate-300"
                  )}
                >
                  {progressText}
                </p>
              </div>
            </div>

            {comparisonSentence && (
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400 italic">
                “{comparisonSentence}”
              </p>
            )}
          </div>
        </section>
      )}

      {/* 4. Teacher Support */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-white/[0.02]">
        <div className="pb-3 border-b border-slate-100 dark:border-white/5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Teacher Support
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Support status and canonical recommendations for this learner in {classItem.subject}.
          </p>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 dark:border-white/5 dark:bg-white/[0.02]">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
              Current Support
            </span>
            <div className="mt-1.5">
              <span
                className={cn(
                  "inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold border",
                  currentSupportBadgeStyle
                )}
              >
                {currentSupportLabel}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              {currentSupportKey === "needs_review"
                ? "Academic concern identified; teacher review is pending."
                : currentSupportKey === "under_class_support"
                ? "Classroom remedial intervention is active."
                : currentSupportKey === "under_aral_support"
                ? "Learner is currently receiving ARAL program support."
                : "Learner is under regular classroom observation."}
            </p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 dark:border-white/5 dark:bg-white/[0.02]">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
              Recommended Support
            </span>
            <div className="mt-1.5">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
                {recommendedSupportLabel}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              {recommendedSupportDescription}
            </p>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
