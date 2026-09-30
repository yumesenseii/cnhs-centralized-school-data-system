"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  HeartHandshake,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import StudentPageHeader from "@/components/student/layout/StudentPageHeader";
import {
  Pill,
  RiskPill,
  gradeStatusStyles,
  interventionTypeStyles,
} from "@/components/student/shared";
import { useStudentPortal } from "@/hooks/student/useStudentPortal";
import { termLabel } from "@/lib/academic/termLabels";
import { createClient } from "@/lib/supabase/client";
import { getMyNotifications } from "@/lib/supabase/queries/notifications";

export default function StudentDashboard() {
  const { data, loading, error } = useStudentPortal();
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    let active = true;
    async function loadFlagsAndNotifications() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id || !active) return;

      const [profileResult, notifResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("must_change_password, temp_password")
          .eq("auth_user_id", user.id)
          .maybeSingle(),
        getMyNotifications({ limit: 5 }),
      ]);

      if (!active) return;

      if (profileResult?.data) {
        const temp = String(profileResult.data.temp_password ?? "").trim();
        setMustChangePassword(
          Boolean(profileResult.data.must_change_password) && Boolean(temp)
        );
      }

      if (notifResult?.data) {
        setNotifications(notifResult.data);
      }
    }

    loadFlagsAndNotifications();
    return () => {
      active = false;
    };
  }, []);

  // Compute authoritative summary metrics
  const recordedRows = useMemo(() => {
    return (data?.grades ?? []).filter(
      (r) =>
        r.finalGrade !== null &&
        r.finalGrade !== undefined &&
        r.finalGrade !== "" &&
        Number.isFinite(Number(r.finalGrade))
    );
  }, [data?.grades]);

  const totalSubjects = data?.grades?.length ?? 8;
  const recordedCount = recordedRows.length;

  const average = useMemo(() => {
    if (!recordedCount) return null;
    const sum = recordedRows.reduce((acc, r) => acc + Number(r.finalGrade), 0);
    const avg = Math.round((sum / recordedCount) * 10) / 10;
    return avg % 1 === 0 ? String(avg) : String(avg);
  }, [recordedRows, recordedCount]);

  const below75Count = useMemo(() => {
    if (!recordedCount) return null;
    return recordedRows.filter((r) => Number(r.finalGrade) < 75).length;
  }, [recordedRows, recordedCount]);

  const attendanceSummary = data?.attendance?.summary;
  const attendanceRate = attendanceSummary?.attendanceRate;
  const presentDays = attendanceSummary?.present ?? 0;
  const absentDays = attendanceSummary?.absent ?? 0;
  const hasAttendanceData = (attendanceSummary?.schoolDays ?? 0) > 0;

  // Student greeting and section subtitle
  const firstName = useMemo(() => {
    const raw =
      data?.profile?.firstName ||
      data?.student?.first_name ||
      data?.profile?.fullName?.split(" ")?.[0] ||
      data?.profile?.displayName?.split(" ")?.[0] ||
      "Student";
    return raw.replace(/,/g, "").trim();
  }, [data?.student, data?.profile]);

  const gradeSectionLabel = useMemo(() => {
    if (data?.profile?.gradeLevel && data?.profile?.sectionName) {
      return `${data.profile.gradeLevel} – ${data.profile.sectionName}`;
    }
    return data?.profile?.gradeSection || "Junior High School";
  }, [data?.profile]);

  const schoolYearDisplay =
    data?.period?.schoolYear || data?.profile?.schoolYear || "SY 2026–2027";
  const quarterDisplay = termLabel(data?.period?.quarter || 1);

  // Synthesize student-specific recent activity
  const recentActivities = useMemo(() => {
    const list = [];

    // Notifications
    for (const notif of notifications) {
      list.push({
        id: `notif-${notif.id}`,
        title: notif.title || notif.message,
        detail: notif.message !== notif.title ? notif.message : null,
        time: notif.created_at
          ? new Date(notif.created_at).toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
            })
          : "Recent",
        type: "notification",
      });
    }

    // Graded subject events
    for (const g of recordedRows) {
      list.push({
        id: `grade-${g.id}`,
        title: `Grade record updated for ${g.subject} (${g.finalGrade})`,
        detail: g.descriptor || (g.finalGrade < 75 ? "Below 75" : "Passing"),
        time: `${schoolYearDisplay} · ${quarterDisplay}`,
        type: "grade",
      });
    }

    // Interventions
    for (const item of data?.interventions ?? []) {
      list.push({
        id: `interv-${item.id}`,
        title: `Intervention assigned: ${item.type}`,
        detail: item.subject ? `Subject: ${item.subject}` : null,
        time: item.approvalStatus || "Active",
        type: "intervention",
      });
    }

    // Attendance
    if (hasAttendanceData) {
      list.push({
        id: "att-summary",
        title: "Attendance record updated",
        detail: `${presentDays} Present, ${absentDays} Absent (${attendanceRate}%)`,
        time: schoolYearDisplay,
        type: "attendance",
      });
    }

    // Deduplicate by title
    const seen = new Set();
    return list.filter((item) => {
      if (seen.has(item.title)) return false;
      seen.add(item.title);
      return true;
    }).slice(0, 5);
  }, [
    notifications,
    recordedRows,
    data?.interventions,
    hasAttendanceData,
    presentDays,
    absentDays,
    attendanceRate,
    schoolYearDisplay,
    quarterDisplay,
  ]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="pb-5"
    >
      {/* 1. PAGE HEADER — Matching Admin and Teacher structure */}
      <StudentPageHeader
        breadcrumb="Home / Dashboard"
        title="Overview"
        subtitle={`Welcome back, ${firstName}. Here's your academic progress for ${gradeSectionLabel}.`}
      />

      {error ? (
        <div className="mb-3 rounded-xl border border-red-200/60 bg-red-50 px-3.5 py-2.5 text-[12px] text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {mustChangePassword ? (
        <div className="mb-3 rounded-xl border border-amber-200/70 bg-amber-50 px-3.5 py-2.5 text-[12px] text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-200">
          Update your temporary password in{" "}
          <Link
            href="/student/profile"
            className="font-semibold text-cnhs-green-dark underline underline-offset-2 dark:text-emerald-300"
          >
            Profile → Security
          </Link>
          .
        </div>
      ) : null}

      {loading || !data ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-12 text-[13px] text-slate-500 shadow-sm dark:border-white/5 dark:bg-card dark:text-slate-400">
          <Loader2 size={16} className="animate-spin text-cnhs-green-dark" />
          Loading dashboard…
        </div>
      ) : (
        <>
          {/* 2. TOP SUMMARY CARDS — Clean 4 KPI Cards */}
          <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50/40 p-2.5 sm:p-3 dark:border-white/5 dark:bg-white/[0.03]">
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
              {/* CARD 1: OVERALL AVERAGE */}
              <div className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_4px_12px_rgba(15,23,42,0.03)] sm:p-3.5 dark:border-white/10 dark:bg-card">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-cnhs-green-dark dark:bg-emerald-950/40 dark:text-emerald-300">
                  <Award size={18} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                    Overall Average
                  </p>
                  <p className="mt-0.5 text-xl font-bold tracking-tight text-cnhs-green-dark dark:text-emerald-300 sm:text-2xl">
                    {average !== null ? average : "—"}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] font-medium text-slate-400 dark:text-slate-500">
                    {average !== null
                      ? `Based on ${recordedCount} recorded subject${recordedCount === 1 ? "" : "s"}`
                      : "No grades recorded yet"}
                  </p>
                </div>
              </div>

              {/* CARD 2: RECORDED SUBJECTS */}
              <div className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_4px_12px_rgba(15,23,42,0.03)] sm:p-3.5 dark:border-white/10 dark:bg-card">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  <BookOpen size={18} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                    Recorded Subjects
                  </p>
                  <p className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                    {recordedCount} / {totalSubjects}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] font-medium text-slate-400 dark:text-slate-500">
                    {recordedCount < totalSubjects
                      ? `${totalSubjects - recordedCount} pending teacher encoding`
                      : "All subjects recorded"}
                  </p>
                </div>
              </div>

              {/* CARD 3: SUBJECTS BELOW 75 */}
              <div className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_4px_12px_rgba(15,23,42,0.03)] sm:p-3.5 dark:border-white/10 dark:bg-card">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    below75Count !== null && below75Count > 0
                      ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300"
                      : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"
                  }`}
                >
                  <AlertTriangle size={18} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                    Subjects Below 75
                  </p>
                  <p
                    className={`mt-0.5 text-xl font-bold tracking-tight sm:text-2xl ${
                      below75Count !== null && below75Count > 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-slate-900 dark:text-white"
                    }`}
                  >
                    {below75Count !== null ? String(below75Count) : "—"}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] font-medium text-slate-400 dark:text-slate-500">
                    {below75Count === null
                      ? "No grades recorded yet"
                      : `Out of ${recordedCount} recorded subject${recordedCount === 1 ? "" : "s"}`}
                  </p>
                </div>
              </div>

              {/* CARD 4: ATTENDANCE RATE */}
              <div className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-[0_4px_12px_rgba(15,23,42,0.03)] sm:p-3.5 dark:border-white/10 dark:bg-card">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-cnhs-green-dark dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CalendarCheck size={18} strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                    Attendance Rate
                  </p>
                  <p className="mt-0.5 text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                    {hasAttendanceData && attendanceRate != null
                      ? `${attendanceRate}%`
                      : "—"}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] font-medium text-slate-400 dark:text-slate-500">
                    {hasAttendanceData
                      ? `Present: ${presentDays} | Absent: ${absentDays}`
                      : "No attendance records yet"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 3. TWO-COLUMN MAIN CONTENT GRID */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* LEFT COLUMN: MY ACADEMIC PROGRESS (8 Cols) */}
            <div className="lg:col-span-7 xl:col-span-8">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.03)] dark:border-white/5 dark:bg-card">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-white/5 dark:bg-white/[0.02]">
                  <div className="flex items-center gap-2">
                    <BookOpen
                      size={16}
                      className="text-cnhs-green-dark dark:text-emerald-300"
                    />
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                        My Academic Progress
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        View your subject grades and academic performance.
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                    {quarterDisplay} · {schoolYearDisplay}
                  </span>
                </div>

                {/* Subject Grades Table */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left">
                    <thead className="bg-slate-50/80 dark:bg-white/[0.02]">
                      <tr className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
                        <th className="px-4 py-2.5">Subject</th>
                        <th className="px-4 py-2.5 text-center">Final Grade</th>
                        <th className="px-4 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.grades?.length ? (
                        data.grades.map((row) => (
                          <tr
                            key={row.id}
                            className="border-t border-slate-100 text-[12px] transition-colors hover:bg-slate-50/60 dark:border-white/5 dark:hover:bg-white/[0.02]"
                          >
                            <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">
                              {row.subject}
                            </td>
                            <td className="px-4 py-2.5 text-center font-bold text-slate-900 dark:text-white">
                              {row.finalGrade != null && row.finalGrade !== ""
                                ? row.finalGrade
                                : ""}
                            </td>
                            <td className="px-4 py-2.5">
                              {row.finalGrade != null &&
                              row.finalGrade !== "" &&
                              (row.descriptor || row.status) ? (
                                <Pill
                                  value={row.descriptor || row.status}
                                  styles={gradeStatusStyles}
                                />
                              ) : null}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-10 text-center text-xs text-slate-500 dark:text-slate-400"
                          >
                            No subjects assigned for this period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer Helper & Navigation Button */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/40 px-4 py-3 dark:border-white/5 dark:bg-white/[0.01]">
                  <p className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <AlertCircle size={13} className="shrink-0 text-slate-400" />
                    <span>
                      Some subjects may not yet have grades. Your grades will appear once encoded.
                    </span>
                  </p>
                  <Link
                    href="/student/grades"
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-[11px] font-semibold text-cnhs-green-dark shadow-sm transition-colors hover:bg-emerald-100 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                  >
                    View All Grades
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: RISK, ATTENDANCE & INTERVENTIONS (4-5 Cols) */}
            <div className="space-y-4 lg:col-span-5 xl:col-span-4">
              {/* CARD 1: ACADEMIC RISK */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.03)] dark:border-white/5 dark:bg-card">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <ShieldAlert
                      size={16}
                      className="text-cnhs-green-dark dark:text-emerald-300"
                    />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Academic Risk
                    </h3>
                  </div>
                  <RiskPill
                    value={
                      recordedCount > 0 &&
                      data.summary.riskLevel &&
                      data.summary.riskLevel !== "—"
                        ? data.summary.riskLevel
                        : "Not Assessed"
                    }
                  />
                </div>
                <div className="mt-3 space-y-1.5">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Based on your academic records.
                  </p>
                  {recordedCount > 0 &&
                  data.summary.riskLevel &&
                  data.summary.riskLevel !== "—" ? (
                    <p className="text-xs text-slate-700 dark:text-slate-300">
                      {data.summary.riskLevel === "High Risk" ||
                      data.summary.riskLevel === "Priority"
                        ? "You are recommended for academic intervention support. Speak with your subject teacher for assistance."
                        : data.summary.riskLevel === "Moderate Risk"
                          ? "Monitor your performance and consider extra study time in lower-graded subjects."
                          : "You are currently performing well across your academic subjects. Keep up the good work!"}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Academic risk classification will appear once grades are recorded by your teachers.
                    </p>
                  )}
                  <p className="pt-1 text-[10px] text-slate-400 dark:text-slate-500">
                    * Academic risk is determined solely from academic grades. Attendance is monitored separately.
                  </p>
                </div>
              </div>

              {/* CARD 2: ATTENDANCE OVERVIEW */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.03)] dark:border-white/5 dark:bg-card">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <CalendarDays
                      size={16}
                      className="text-cnhs-green-dark dark:text-emerald-300"
                    />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Attendance Overview
                    </h3>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 text-center dark:border-white/5 dark:bg-white/[0.02]">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
                      Present
                    </p>
                    <p className="mt-0.5 text-base font-bold text-cnhs-green-dark dark:text-emerald-300">
                      {presentDays}
                    </p>
                  </div>
                  <div className="border-x border-slate-200/80 dark:border-white/5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
                      Absent
                    </p>
                    <p
                      className={`mt-0.5 text-base font-bold ${
                        absentDays > 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-slate-900 dark:text-white"
                      }`}
                    >
                      {absentDays}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
                      Rate
                    </p>
                    <p className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
                      {hasAttendanceData && attendanceRate != null
                        ? `${attendanceRate}%`
                        : "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    Separate from academic risk.
                  </p>
                  <Link
                    href="/student/attendance"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-cnhs-green-dark hover:underline dark:text-emerald-300"
                  >
                    View Attendance
                    <ArrowRight size={12} />
                  </Link>
                </div>
              </div>

              {/* CARD 3: MY INTERVENTIONS */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-[0_4px_12px_rgba(15,23,42,0.03)] dark:border-white/5 dark:bg-card">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <HeartHandshake
                      size={16}
                      className="text-cnhs-green-dark dark:text-emerald-300"
                    />
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      My Interventions
                    </h3>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {data.interventions?.length ? (
                    data.interventions.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 dark:border-white/5 dark:bg-white/[0.02]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-900 dark:text-white">
                            {item.type}
                          </p>
                          <Pill
                            value={item.approvalStatus || item.status || "Assigned"}
                            styles={interventionTypeStyles}
                          />
                        </div>
                        <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {item.subject}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="py-2 text-center text-xs text-slate-500 dark:text-slate-400">
                      <p className="font-medium">No interventions assigned.</p>
                      <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                        You do not have any active intervention recommendations.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-white/5">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    View only
                  </span>
                  <Link
                    href="/student/interventions"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-cnhs-green-dark hover:underline dark:text-emerald-300"
                  >
                    View Interventions
                    <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* 4. RECENT ACTIVITY SECTION */}
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.03)] dark:border-white/5 dark:bg-card">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-white/5 dark:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <Clock
                  size={16}
                  className="text-cnhs-green-dark dark:text-emerald-300"
                />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Recent Activity
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Your latest academic records and system notifications.
                  </p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-100 p-2 dark:divide-white/5">
              {recentActivities.length ? (
                recentActivities.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-start justify-between gap-3 px-3 py-2.5 text-xs transition-colors hover:bg-slate-50/60 dark:hover:bg-white/[0.02]"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-cnhs-green-dark dark:bg-emerald-950/40 dark:text-emerald-300">
                        {act.type === "grade" ? (
                          <Award size={13} />
                        ) : act.type === "intervention" ? (
                          <HeartHandshake size={13} />
                        ) : act.type === "attendance" ? (
                          <CalendarCheck size={13} />
                        ) : (
                          <Bell size={13} />
                        )}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {act.title}
                        </p>
                        {act.detail ? (
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {act.detail}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                      {act.time}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  No recent activity.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}
