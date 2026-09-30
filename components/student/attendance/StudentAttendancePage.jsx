"use client";

import { motion } from "framer-motion";
import {
  AlertCircle,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";
import StudentPageHeader from "@/components/student/layout/StudentPageHeader";
import { Pill } from "@/components/student/shared";
import { useStudentPortal } from "@/hooks/student/useStudentPortal";
import { ATTENDANCE_STATUS } from "@/lib/attendance/constants";

const attendanceStatusStyles = {
  [ATTENDANCE_STATUS.NORMAL]:
    "bg-emerald-50 text-cnhs-green-dark border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50",
  [ATTENDANCE_STATUS.WARNING]:
    "bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50",
  [ATTENDANCE_STATUS.CRITICAL]:
    "bg-red-50 text-red-600 border border-red-200/60 dark:bg-red-950/45 dark:text-red-300 dark:border-red-800/50",
  [ATTENDANCE_STATUS.UNKNOWN]:
    "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-white/10 dark:text-slate-400 dark:border-white/10",
};

export default function StudentAttendancePage() {
  const { data, loading, error } = useStudentPortal();

  const summary = data?.attendance?.summary;
  const history = data?.attendance?.history ?? [];

  const gradeLevelSection =
    [data?.profile?.gradeLevel, data?.profile?.sectionName]
      .filter(Boolean)
      .join(" • ") ||
    data?.profile?.gradeSection ||
    "—";

  const schoolYearDisplay =
    data?.period?.schoolYear || data?.profile?.schoolYear || "SY 2026–2027";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="pb-5"
    >
      <StudentPageHeader
        breadcrumb="Home / My Attendance"
        title="MY ATTENDANCE"
        subtitle={
          <div className="mt-1 space-y-0.5">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {gradeLevelSection}
            </p>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {schoolYearDisplay}
            </p>
          </div>
        }
      />

      {error ? (
        <div className="mb-3 rounded-xl border border-red-200/60 bg-red-50 px-3.5 py-2.5 text-[12px] text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {loading || !data ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-12 text-[13px] text-slate-500 shadow-sm dark:border-white/5 dark:bg-card dark:text-slate-400">
          <Loader2 size={16} className="animate-spin text-cnhs-green-dark" />
          Loading attendance records…
        </div>
      ) : (
        <>
          {/* Summary KPI Cards */}
          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/40 p-2.5 sm:p-3 dark:border-white/5 dark:bg-white/[0.03]">
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
              {/* PRESENT DAYS */}
              <div className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_4px_12px_rgba(15,23,42,0.03)] sm:p-3.5 dark:border-white/10 dark:bg-card">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-cnhs-green-dark dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CheckCircle2 size={18} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                    Present Days
                  </p>
                  <p className="mt-0.5 text-xl font-bold tracking-tight text-cnhs-green-dark dark:text-emerald-300 sm:text-2xl">
                    {summary?.present ?? 0}
                  </p>
                </div>
              </div>

              {/* ABSENT DAYS */}
              <div className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_4px_12px_rgba(15,23,42,0.03)] sm:p-3.5 dark:border-white/10 dark:bg-card">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    (summary?.absent ?? 0) > 0
                      ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300"
                      : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"
                  }`}
                >
                  <XCircle size={18} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                    Absent Days
                  </p>
                  <p
                    className={`mt-0.5 text-xl font-bold tracking-tight sm:text-2xl ${
                      (summary?.absent ?? 0) > 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-slate-900 dark:text-white"
                    }`}
                  >
                    {summary?.absent ?? 0}
                  </p>
                </div>
              </div>

              {/* ATTENDANCE RATE */}
              <div className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_4px_12px_rgba(15,23,42,0.03)] sm:p-3.5 dark:border-white/10 dark:bg-card">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  <CalendarCheck size={18} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                    Attendance Rate
                  </p>
                  <p className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                    {summary?.attendanceRate != null
                      ? `${summary.attendanceRate}%`
                      : "—"}
                  </p>
                </div>
              </div>

              {/* SCHOOL DAYS */}
              <div className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_4px_12px_rgba(15,23,42,0.03)] sm:p-3.5 dark:border-white/10 dark:bg-card">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  <CalendarDays size={18} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                    Total School Days
                  </p>
                  <p className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                    {summary?.schoolDays ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Attendance Table Card */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.03)] dark:border-white/5 dark:bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-white/5 dark:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="text-cnhs-green-dark dark:text-emerald-300" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Monthly Attendance Records
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    DepEd School Form 2 (SF2) monthly summary records.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <Clock size={12} />
                {history.length} month{history.length === 1 ? "" : "s"} recorded
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead className="bg-slate-50/80 dark:bg-white/[0.02]">
                  <tr className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-2.5">Month</th>
                    <th className="px-4 py-2.5 text-center">School Days</th>
                    <th className="px-4 py-2.5 text-center">Present</th>
                    <th className="px-4 py-2.5 text-center">Absent</th>
                    <th className="px-4 py-2.5 text-center">Late</th>
                    <th className="px-4 py-2.5 text-center">Rate</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length ? (
                    history.map((row) => (
                      <tr
                        key={row.id}
                        className="border-t border-slate-100 text-[12px] transition-colors hover:bg-slate-50/60 dark:border-white/5 dark:hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                          {row.monthName || `Month ${row.month}`}
                        </td>
                        <td className="px-4 py-2.5 text-center text-slate-600 dark:text-slate-300">
                          {row.schoolDays}
                        </td>
                        <td className="px-4 py-2.5 text-center font-semibold text-cnhs-green-dark dark:text-emerald-300">
                          {row.present}
                        </td>
                        <td className="px-4 py-2.5 text-center text-red-600 dark:text-red-400">
                          {row.absent}
                        </td>
                        <td className="px-4 py-2.5 text-center text-amber-600 dark:text-amber-400">
                          {row.late}
                        </td>
                        <td className="px-4 py-2.5 text-center font-semibold text-slate-900 dark:text-white">
                          {row.attendanceRate != null
                            ? `${row.attendanceRate}%`
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <Pill
                            value={row.status}
                            styles={attendanceStatusStyles}
                          />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <div className="mx-auto max-w-sm space-y-1">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            No attendance records available
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Your monthly attendance records will appear here once submitted by your class adviser.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Attendance Policy Notice */}
            <div className="border-t border-slate-100 bg-slate-50/40 px-4 py-3 text-[11px] text-slate-500 dark:border-white/5 dark:bg-white/[0.01] dark:text-slate-400">
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <AlertCircle size={13} className="shrink-0 text-emerald-600" />
                <span>
                  <strong>Note:</strong> Attendance records are for school monitoring only (DepEd SF2) and are never factored into academic risk predictions or grade computations.
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
