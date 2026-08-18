"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import MobileNavSheet from "@/components/layout/MobileNavSheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import AcademicSummary from "@/components/teacher/my-classes/AcademicSummary";
import { PageBreadcrumb } from "@/components/teacher/my-classes/shared";
import { useStudentProfile } from "@/hooks/teacher/useMyClasses";
import { cn } from "@/lib/utils";

const avatarTones = {
  red: "bg-red-100 text-red-700",
  green: "bg-green-100 text-cnhs-green-dark",
};

export default function StudentProfile({ classId, studentId }) {
  const { classItem, student, loading, error } = useStudentProfile(
    classId,
    studentId
  );
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white px-4 py-10 text-center text-sm text-slate-400">
        Loading student profile...
      </div>
    );
  }

  if (error || !classItem || !student) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-10 text-center text-sm text-red-600">
        {error || "Student profile not found."}
      </div>
    );
  }

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
                {
                  label: classItem.subject,
                  href: `/teacher/my-classes/${classItem.id}`,
                },
                {
                  label: "Students",
                  href: `/teacher/my-classes/${classItem.id}/students`,
                },
                { label: student.name },
              ]}
            />
            <h1 className="mt-1 text-xl font-semibold tracking-[-0.03em] text-slate-800 sm:text-[22px]">
              {student.name}
            </h1>
            <p className="mt-1 text-[12px] text-slate-400">
              Read-only learner profile
            </p>
          </div>

          <MobileNavSheet ariaLabel="Open teacher menu" title="Teacher navigation">
            {(close) => <TeacherSidebar mobile onNavigate={close} />}
          </MobileNavSheet>
        </div>

        <Link
          href={`/teacher/my-classes/${classItem.id}/students`}
          className="inline-flex h-8 items-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
        >
          <ArrowLeft size={12} />
          Back to Students
        </Link>
      </header>

      <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
        <h2 className="text-sm font-semibold text-slate-900">Basic Information</h2>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <span
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-full text-sm font-semibold",
              avatarTones[student.avatarTone] ?? avatarTones.green
            )}
          >
            {student.initials}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-900">
              {student.name}
            </h3>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {student.studentNumber}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ["Gender", student.gender],
                ["Grade Level", student.grade],
                ["Section", student.section],
                ["School Year", student.schoolYear],
                ["Assigned Class", student.assignedClass || classItem.gradeSection],
                ["Weakest Subject", student.weakSubject],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                    {label}
                  </dt>
                  <dd className="mt-1 text-[12px] font-semibold text-slate-800">
                    {value ?? "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <AcademicSummary
          summary={
            student.academicSummary ?? {
              quarterLabel: "Grades per Subject",
              subjects: [],
              generalAverage: student.averageGrade,
            }
          }
        />
        <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
          <h3 className="text-sm font-semibold text-slate-900">Summary</h3>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                General Average
              </dt>
              <dd
                className={cn(
                  "mt-1 text-2xl font-semibold tracking-[-0.03em]",
                  student.averageGrade !== null && student.averageGrade < 75
                    ? "text-red-600"
                    : "text-slate-800"
                )}
              >
                {student.averageGrade ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                Weakest Subject
              </dt>
              <dd className="mt-1 text-[13px] font-semibold text-slate-800">
                {student.weakSubject || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                School Year
              </dt>
              <dd className="mt-1 text-[13px] font-semibold text-slate-800">
                {student.schoolYear || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                Assigned Class
              </dt>
              <dd className="mt-1 text-[13px] font-semibold text-slate-800">
                {student.assignedClass ||
                  `${classItem.gradeSection} · ${classItem.subject}`}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </motion.div>
  );
}
