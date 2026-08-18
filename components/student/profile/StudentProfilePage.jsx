"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import StudentPageHeader from "@/components/student/layout/StudentPageHeader";
import StudentSecurityCard from "@/components/student/profile/StudentSecurityCard";
import ThemeSettingsCard from "@/components/settings/ThemeSettingsCard";
import {
  Pill,
  RiskPill,
  gradeStatusStyles,
  interventionTypeStyles,
} from "@/components/student/shared";
import { useStudentPortal } from "@/hooks/student/useStudentPortal";
import { ATTENDANCE_STATUS } from "@/lib/attendance/constants";

function InfoCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value || "—"}</p>
    </div>
  );
}

const attendanceStatusStyles = {
  [ATTENDANCE_STATUS.NORMAL]: "bg-green-50 text-cnhs-green-dark",
  [ATTENDANCE_STATUS.WARNING]: "bg-amber-50 text-amber-700",
  [ATTENDANCE_STATUS.CRITICAL]: "bg-red-50 text-red-600",
  [ATTENDANCE_STATUS.UNKNOWN]: "bg-slate-100 text-slate-500",
};

export default function StudentProfilePage() {
  const { data, loading, error } = useStudentPortal();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <StudentPageHeader
        breadcrumb="Home / Profile"
        title="Profile"
        subtitle="Academic performance, attendance monitoring, and account security"
      />

      {error ? (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {loading || !data ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white py-12 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading profile…
        </div>
      ) : (
        <div className="space-y-3">
          <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cnhs-green-soft text-sm font-semibold text-cnhs-green-dark">
                {data.profile.fullName
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()}
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {data.profile.fullName}
                </h2>
                <p className="text-[12px] text-slate-500">
                  {data.profile.studentNumber} · {data.profile.gradeSection}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
            <h2 className="text-sm font-semibold text-slate-900">
              Academic Performance
            </h2>
            <p className="mt-1 text-[11px] text-slate-500">
              Risk predictions are based on academic performance (ECR grades)
              only.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 sm:col-span-2">
                <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                  Subject Grades
                </p>
                <div className="mt-2 space-y-1.5">
                  {data.grades.length ? (
                    data.grades.map((g) => (
                      <div
                        key={g.id}
                        className="flex items-center justify-between text-[12px]"
                      >
                        <span className="font-medium text-slate-700">
                          {g.subject}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">
                            {g.finalGrade ?? "—"}
                          </span>
                          <Pill value={g.status} styles={gradeStatusStyles} />
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[12px] text-slate-400">No grades yet.</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                  Prediction Result
                </p>
                <div className="mt-2">
                  <Pill
                    value={data.summary.recommendation}
                    styles={interventionTypeStyles}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                  Risk Level
                </p>
                <div className="mt-2">
                  <RiskPill value={data.summary.riskLevel} />
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 sm:col-span-2">
                <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                  Recommended Intervention
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {data.interventions.length
                    ? data.interventions.map((i) => i.type).join(" · ")
                    : data.summary.recommendation}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
            <h2 className="text-sm font-semibold text-slate-900">Attendance</h2>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <InfoCard
                label="Present"
                value={String(data.attendance?.summary?.present ?? 0)}
              />
              <InfoCard
                label="Absent"
                value={String(data.attendance?.summary?.absent ?? 0)}
              />
              <InfoCard
                label="Late"
                value={String(data.attendance?.summary?.late ?? 0)}
              />
              <InfoCard
                label="Attendance %"
                value={
                  data.attendance?.summary?.attendanceRate != null
                    ? `${data.attendance.summary.attendanceRate}%`
                    : "—"
                }
              />
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
                <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                  Attendance Status
                </p>
                <div className="mt-2">
                  <Pill
                    value={
                      data.attendance?.summary?.status ??
                      ATTENDANCE_STATUS.UNKNOWN
                    }
                    styles={attendanceStatusStyles}
                  />
                </div>
              </div>
            </div>

            {data.attendance?.history?.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-[12px]">
                  <thead className="bg-slate-50/80">
                    <tr className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
                      <th className="px-3 py-2 font-semibold">Month</th>
                      <th className="px-3 py-2 font-semibold">Present</th>
                      <th className="px-3 py-2 font-semibold">Absent</th>
                      <th className="px-3 py-2 font-semibold">Rate</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.attendance.history.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-700">
                          {row.monthName} · {row.schoolYear}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{row.present}</td>
                        <td className="px-3 py-2 text-slate-600">{row.absent}</td>
                        <td className="px-3 py-2 text-slate-600">
                          {row.attendanceRate != null
                            ? `${row.attendanceRate}%`
                            : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <Pill
                            value={row.status}
                            styles={attendanceStatusStyles}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 text-[12px] text-slate-400">
                No SF2 attendance records uploaded for you yet.
              </p>
            )}
          </section>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start">
            <ThemeSettingsCard description="Choose how CNHS Learn looks on this browser. The theme stays after logout and when you return." />
            <StudentSecurityCard />
          </div>
        </div>
      )}
    </motion.div>
  );
}
