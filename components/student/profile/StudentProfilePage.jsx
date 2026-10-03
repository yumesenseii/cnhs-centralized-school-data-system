"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, CalendarDays, Loader2, UserRound } from "lucide-react";
import StudentPageHeader from "@/components/student/layout/StudentPageHeader";
import StudentSectionCard from "@/components/student/layout/StudentSectionCard";
import StudentSecurityCard from "@/components/student/profile/StudentSecurityCard";
import StudentPrivacyCard from "@/components/student/profile/StudentPrivacyCard";
import ThemeSettingsCard from "@/components/settings/ThemeSettingsCard";
import {
  Pill,
  RiskPill,
  gradeStatusStyles,
  interventionTypeStyles,
} from "@/components/student/shared";
import { useStudentPortal } from "@/hooks/student/useStudentPortal";
import { ATTENDANCE_STATUS } from "@/lib/attendance/constants";
import { createClient } from "@/lib/supabase/client";

function InfoCard({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-2.5 py-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-[12px] font-semibold text-card-foreground">
        {value || "—"}
      </p>
    </div>
  );
}

const attendanceStatusStyles = {
  [ATTENDANCE_STATUS.NORMAL]:
    "bg-green-50 text-cnhs-green-dark dark:bg-emerald-950/40 dark:text-emerald-300",
  [ATTENDANCE_STATUS.WARNING]:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  [ATTENDANCE_STATUS.CRITICAL]:
    "bg-red-50 text-red-600 dark:bg-red-950/45 dark:text-red-300",
  [ATTENDANCE_STATUS.UNKNOWN]: "bg-muted text-muted-foreground",
};

export default function StudentProfilePage() {
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="pb-3"
    >
      <StudentPageHeader
        breadcrumb="Home / Profile"
        title="Profile"
        subtitle="Account · Appearance · Security · Privacy"
      />

      {error ? (
        <div className="mb-2 rounded-xl border border-red-200/60 bg-red-50 px-3 py-2 text-[12px] text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {mustChangePassword ? (
        <div className="mb-2 rounded-xl border border-amber-200/70 bg-amber-50 px-3 py-2 text-[12px] text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-200">
          Update your temporary password in{" "}
          <span className="font-semibold">Security</span> below.
        </div>
      ) : null}

      {loading || !data ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-10 text-[13px] text-muted-foreground">
          <Loader2 size={15} className="animate-spin" />
          Loading profile…
        </div>
      ) : (
        <div className="space-y-2.5">
          <StudentSectionCard icon={UserRound} title="Account">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cnhs-green-soft text-[12px] font-semibold text-cnhs-green-dark dark:bg-cnhs-green/20">
                {data.profile.fullName
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-[14px] font-semibold text-card-foreground">
                  {data.profile.fullName}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {data.profile.studentNumber} · {data.profile.gradeSection}
                </p>
              </div>
            </div>
            <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <InfoCard label="Learner ID" value={data.profile.studentNumber} />
              <InfoCard
                label="Grade · Section"
                value={data.profile.gradeSection}
              />
              <InfoCard label="Role" value="Student" />
            </div>
          </StudentSectionCard>

          <ThemeSettingsCard description="Theme stays on this browser after logout." />

          <StudentSecurityCard />

          <StudentPrivacyCard />

          <StudentSectionCard
            icon={BarChart3}
            title="Academic (view only)"
            subtitle="Risk from ECR grades only."
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <InfoCard label="Average" value={data.summary.average ?? "—"} />
              <div className="rounded-lg border border-border bg-muted/40 px-2.5 py-2">
                <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                  Risk
                </p>
                <div className="mt-1">
                  <RiskPill value={data.summary.riskLevel} />
                </div>
              </div>
              <InfoCard
                label="Areas needing attention"
                value={
                  data.summary.weakSubjects?.length
                    ? data.summary.weakSubjects.join(", ")
                    : "None"
                }
              />
              <div className="rounded-lg border border-border bg-muted/40 px-2.5 py-2">
                <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                  Interventions
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {data.interventions?.length ? (
                    data.interventions.slice(0, 2).map((item) => (
                      <Pill
                        key={item.id}
                        value={item.type}
                        styles={interventionTypeStyles}
                      />
                    ))
                  ) : (
                    <span className="text-[11px] text-muted-foreground">None</span>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-2 space-y-1">
              {data.grades.length ? (
                data.grades.slice(0, 6).map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between gap-2 border-t border-border pt-1 text-[12px] first:border-t-0 first:pt-0"
                  >
                    <span className="font-medium text-card-foreground">
                      {g.subject || g.subjectName}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-card-foreground">
                        {g.finalGrade ?? "—"}
                      </span>
                      <Pill value={g.status} styles={gradeStatusStyles} />
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-muted-foreground">No grades yet.</p>
              )}
            </div>
          </StudentSectionCard>

          <StudentSectionCard
            icon={CalendarDays}
            title="Attendance (view only)"
            subtitle="SF2 — separate from academic risk."
          >
            {data.attendance?.summary ? (
              <div className="mb-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <InfoCard
                  label="Present"
                  value={String(data.attendance.summary.present ?? 0)}
                />
                <InfoCard
                  label="Absent"
                  value={String(data.attendance.summary.absent ?? 0)}
                />
                <InfoCard
                  label="Rate"
                  value={
                    data.attendance.summary.attendanceRate != null
                      ? `${data.attendance.summary.attendanceRate}%`
                      : "—"
                  }
                />
                <div className="rounded-lg border border-border bg-muted/40 px-2.5 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                    Status
                  </p>
                  <div className="mt-1">
                    <Pill
                      value={data.attendance.summary.status}
                      styles={attendanceStatusStyles}
                    />
                  </div>
                </div>
              </div>
            ) : null}
            {data.attendance?.history?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[440px] text-left text-[12px]">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                      <th className="py-1.5 font-semibold">Period</th>
                      <th className="py-1.5 font-semibold">Present</th>
                      <th className="py-1.5 font-semibold">Absent</th>
                      <th className="py-1.5 font-semibold">Rate</th>
                      <th className="py-1.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.attendance.history.map((row) => (
                      <tr key={row.id} className="border-t border-border">
                        <td className="py-1.5 font-medium text-card-foreground">
                          {row.monthName} · {row.schoolYear}
                        </td>
                        <td className="py-1.5 text-muted-foreground">
                          {row.present}
                        </td>
                        <td className="py-1.5 text-muted-foreground">
                          {row.absent}
                        </td>
                        <td className="py-1.5 text-muted-foreground">
                          {row.attendanceRate != null
                            ? `${row.attendanceRate}%`
                            : "—"}
                        </td>
                        <td className="py-1.5">
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
              <p className="text-[12px] text-muted-foreground">
                No SF2 attendance records yet.
              </p>
            )}
          </StudentSectionCard>
        </div>
      )}
    </motion.div>
  );
}
