"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, CalendarDays, Loader2 } from "lucide-react";
import StudentPageHeader from "@/components/student/layout/StudentPageHeader";
import StudentSectionCard, {
  StudentPanelCard,
} from "@/components/student/layout/StudentSectionCard";
import {
  Pill,
  RiskPill,
  gradeStatusStyles,
  interventionTypeStyles,
} from "@/components/student/shared";
import { useStudentPortal } from "@/hooks/student/useStudentPortal";
import { termLabel } from "@/lib/academic/termLabels";
import { createClient } from "@/lib/supabase/client";

function Kpi({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.04em] text-card-foreground">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[10px] font-medium leading-4 text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export default function StudentDashboard() {
  const { data, loading, error } = useStudentPortal();
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadFlags() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id || !active) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("must_change_password, temp_password")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (!active || !profile) return;
      const temp = String(profile.temp_password ?? "").trim();
      setMustChangePassword(
        Boolean(profile.must_change_password) && Boolean(temp)
      );
    }
    loadFlags();
    return () => {
      active = false;
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="pb-3"
    >
      <StudentPageHeader
        breadcrumb="Home / Dashboard"
        title="Dashboard"
        subtitle={
          data
            ? `${data.profile.displayName} · ${data.profile.gradeSection}`
            : "Your academic standing and interventions"
        }
      />

      {error ? (
        <div className="mb-2 rounded-xl border border-red-200/60 bg-red-50 px-3 py-2 text-[12px] text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {mustChangePassword ? (
        <div className="mb-2 rounded-xl border border-amber-200/70 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-200">
          Update your temporary password in{" "}
          <Link
            href="/student/profile"
            className="font-semibold text-cnhs-green-dark underline underline-offset-2"
          >
            Profile → Security
          </Link>
          .
        </div>
      ) : null}

      {loading || !data ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-10 text-[13px] text-muted-foreground">
          <Loader2 size={15} className="animate-spin" />
          Loading dashboard…
        </div>
      ) : (
        <div className="space-y-2.5">
          <StudentSectionCard
            icon={BarChart3}
            title="Academic Analytics"
            subtitle="Risk from ECR grades only — not attendance."
          >
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
              <Kpi
                label="Average"
                value={data.summary.average ?? "—"}
                hint={
                  data.period.schoolYear
                    ? `${data.period.schoolYear} · ${termLabel(data.period.quarter)}`
                    : "No grades yet"
                }
              />
              <div className="rounded-xl border border-border bg-card p-3 shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Risk Level
                </p>
                <div className="mt-2">
                  <RiskPill value={data.summary.riskLevel} />
                </div>
              </div>
              <Kpi
                label="Interventions"
                value={data.summary.activeInterventionCount}
                hint="ARAL / Classroom Remedial"
              />
              <Kpi
                label="Weak Subjects"
                value={data.summary.weakSubjects.length || "0"}
                hint={
                  data.summary.weakSubjects.length
                    ? data.summary.weakSubjects.join(", ")
                    : "None below 75"
                }
              />
            </div>

            <div className="mt-2.5 grid grid-cols-1 gap-2 xl:grid-cols-2">
              <StudentPanelCard
                title="Recent Grades"
                actions={
                  <Link
                    href="/student/grades"
                    className="text-[11px] font-semibold text-cnhs-green-dark transition-colors duration-200 hover:underline"
                  >
                    View all
                  </Link>
                }
              >
                <div className="overflow-x-auto px-3 pb-2">
                  <table className="w-full min-w-[360px] text-left">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                        <th className="py-1.5 font-semibold">Subject</th>
                        <th className="py-1.5 font-semibold">Grade</th>
                        <th className="py-1.5 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.grades.length ? (
                        data.grades.slice(0, 5).map((row) => (
                          <tr
                            key={row.id}
                            className="border-t border-border text-[12px]"
                          >
                            <td className="py-1.5 font-medium text-card-foreground">
                              {row.subject}
                            </td>
                            <td className="py-1.5 text-muted-foreground">
                              {row.finalGrade ?? "—"}
                            </td>
                            <td className="py-1.5">
                              <Pill
                                value={row.status}
                                styles={gradeStatusStyles}
                              />
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={3}
                            className="py-4 text-center text-[11px] text-muted-foreground"
                          >
                            No grades for this period yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </StudentPanelCard>

              <StudentPanelCard
                title="Interventions"
                actions={
                  <Link
                    href="/student/interventions"
                    className="text-[11px] font-semibold text-cnhs-green-dark transition-colors duration-200 hover:underline"
                  >
                    Details
                  </Link>
                }
              >
                <div className="space-y-1.5 px-3 pb-2">
                  {data.interventions.length ? (
                    data.interventions.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-border bg-muted/40 px-2.5 py-1.5"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Pill
                            value={item.type}
                            styles={interventionTypeStyles}
                          />
                          <RiskPill value={item.riskLevel} />
                        </div>
                        <p className="mt-1 text-[12px] font-semibold text-card-foreground">
                          {item.subject}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="py-4 text-center text-[11px] text-muted-foreground">
                      No interventions right now.
                    </p>
                  )}
                </div>
              </StudentPanelCard>
            </div>
          </StudentSectionCard>

          <StudentSectionCard
            icon={CalendarDays}
            title="Attendance"
            subtitle="SF2 only — separate from academic risk."
            actions={
              <Link
                href="/student/profile"
                className="text-[11px] font-semibold text-cnhs-green-dark transition-colors duration-200 hover:underline"
              >
                History
              </Link>
            }
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Kpi
                label="Present"
                value={String(data.attendance?.summary?.present ?? 0)}
              />
              <Kpi
                label="Absent"
                value={String(data.attendance?.summary?.absent ?? 0)}
              />
              <Kpi
                label="Attendance %"
                value={
                  data.attendance?.summary?.attendanceRate != null
                    ? `${data.attendance.summary.attendanceRate}%`
                    : "—"
                }
              />
              <Kpi
                label="Status"
                value={data.attendance?.summary?.status ?? "No data"}
              />
            </div>
          </StudentSectionCard>
        </div>
      )}
    </motion.div>
  );
}
