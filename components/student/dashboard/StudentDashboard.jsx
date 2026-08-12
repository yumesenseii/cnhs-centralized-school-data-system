"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import StudentPageHeader from "@/components/student/layout/StudentPageHeader";
import {
  Pill,
  RiskPill,
  gradeStatusStyles,
  interventionTypeStyles,
} from "@/components/student/shared";
import { useStudentPortal } from "@/hooks/student/useStudentPortal";
import { termLabel } from "@/lib/academic/termLabels";

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-800">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default function StudentDashboard() {
  const { data, loading, error } = useStudentPortal();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <StudentPageHeader
        breadcrumb="Home / Dashboard"
        title="Dashboard"
        subtitle={
          data
            ? `${data.profile.displayName} · ${data.profile.gradeSection}`
            : "Your academic standing and PLP interventions"
        }
      />

      {error ? (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {loading || !data ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white py-12 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading student dashboard…
        </div>
      ) : (
        <>
          <section className="mb-2">
            <h2 className="text-sm font-semibold text-slate-900">
              Academic Analytics
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Risk predictions are based on academic performance (ECR grades)
              only.
            </p>
          </section>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Average"
              value={data.summary.average ?? "—"}
              hint={
                data.period.schoolYear
                  ? `${data.period.schoolYear} · ${termLabel(data.period.quarter)}`
                  : "No grades yet"
              }
            />
            <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
              <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                Risk Level
              </p>
              <div className="mt-3">
                <RiskPill value={data.summary.riskLevel} />
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Based on ECR grades only (not attendance)
              </p>
            </div>
            <StatCard
              label="Active Interventions"
              value={data.summary.activeInterventionCount}
              hint="ARAL Learners and Classroom Remedial"
            />
            <StatCard
              label="Weak Subjects"
              value={data.summary.weakSubjects.length || "0"}
              hint={
                data.summary.weakSubjects.length
                  ? data.summary.weakSubjects.join(", ")
                  : "None below 75"
              }
            />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Recent Grades
                </h2>
                <Link
                  href="/student/grades"
                  className="text-[11px] font-semibold text-cnhs-green-dark hover:underline"
                >
                  View all
                </Link>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[420px] text-left">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.08em] text-slate-400">
                      <th className="pb-2 font-semibold">Subject</th>
                      <th className="pb-2 font-semibold">Grade</th>
                      <th className="pb-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.grades.length ? (
                      data.grades.slice(0, 6).map((row) => (
                        <tr
                          key={row.id}
                          className="border-t border-slate-100 text-[12px]"
                        >
                          <td className="py-2.5 font-medium text-slate-700">
                            {row.subject}
                          </td>
                          <td className="py-2.5 text-slate-600">
                            {row.finalGrade ?? "—"}
                          </td>
                          <td className="py-2.5">
                            <Pill value={row.status} styles={gradeStatusStyles} />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={3}
                          className="py-8 text-center text-xs text-slate-400"
                        >
                          No grades recorded for this period yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Interventions / PLP
                </h2>
                <Link
                  href="/student/interventions"
                  className="text-[11px] font-semibold text-cnhs-green-dark hover:underline"
                >
                  Details
                </Link>
              </div>
              <div className="mt-3 space-y-3">
                {data.interventions.length ? (
                  data.interventions.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill
                          value={item.type}
                          styles={interventionTypeStyles}
                        />
                        <RiskPill value={item.riskLevel} />
                      </div>
                      <p className="mt-2 text-[12px] font-semibold text-slate-800">
                        {item.subject}
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-slate-500">
                        {item.explanation}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="py-6 text-center text-xs text-slate-400">
                    No PLP interventions recommended right now.
                  </p>
                )}
              </div>

              {data.monitoring ? (
                <div className="mt-3 rounded-xl border border-cnhs-green/20 bg-cnhs-green-soft/40 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-cnhs-green-dark">
                    Teacher follow-up
                  </p>
                  <p className="mt-1 text-[12px] font-medium text-slate-800">
                    Status: {data.monitoring.status}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {data.monitoring.interventionGiven
                      ? `Intervention: ${data.monitoring.interventionGiven}`
                      : "Your teacher is tracking support progress."}
                  </p>
                </div>
              ) : null}
            </section>
          </div>

          <div className="mt-3 border-t border-slate-100 pt-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Attendance Analytics
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Monitoring only — not used in academic risk prediction. Status
              warns when approaching the 20% absence threshold.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Present"
                value={String(data.attendance?.summary?.present ?? 0)}
              />
              <StatCard
                label="Absent"
                value={String(data.attendance?.summary?.absent ?? 0)}
              />
              <StatCard
                label="Attendance %"
                value={
                  data.attendance?.summary?.attendanceRate != null
                    ? `${data.attendance.summary.attendanceRate}%`
                    : "—"
                }
              />
              <StatCard
                label="Status"
                value={data.attendance?.summary?.status ?? "No data"}
                hint="Normal / Warning / Critical"
              />
            </div>
            <Link
              href="/student/profile"
              className="mt-3 inline-block text-[11px] font-semibold text-cnhs-green-dark hover:underline"
            >
              View attendance history on Profile
            </Link>
          </div>
        </>
      )}
    </motion.div>
  );
}
