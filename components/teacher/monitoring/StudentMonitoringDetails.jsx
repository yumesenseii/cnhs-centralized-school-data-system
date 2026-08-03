"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Menu,
  Save,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import TeacherSidebar from "@/components/teacher/layout/TeacherSidebar";
import {
  Pill,
  RiskPill,
  interventionStyles,
  monitoringStatusStyles,
} from "@/components/teacher/monitoring/shared";
import { useStudentMonitoringDetail } from "@/hooks/teacher/useMonitoring";
import {
  ARAL_PROGRESS_OPTIONS,
  ARAL_WEEKLY_INTERVENTION,
  canSubmitAralWeeklyProgress,
  formatAralWeeklyRemarks,
  isAralRecommended,
  nextAralWeekNumber,
} from "@/lib/monitoring/aralProgress";
import {
  MONITORING_STATUS,
  RECOMMENDATION,
} from "@/lib/monitoring/recommendations";
import { SIDEBAR_SHEET_CLASS } from "@/lib/constants/layout";
import { cn } from "@/lib/utils";

const PROGRESS_OPTIONS = ARAL_PROGRESS_OPTIONS;

const STATUS_OPTIONS = [
  MONITORING_STATUS.ONGOING,
  MONITORING_STATUS.IMPROVED,
  MONITORING_STATUS.NEEDS_FOLLOW_UP,
  MONITORING_STATUS.COMPLETED,
];

const INTERVENTION_OPTIONS = [
  ARAL_WEEKLY_INTERVENTION,
  "Classroom Remediation",
  "One-on-one Support",
  "Peer Tutoring",
  "Parent Conference",
  "ARAL Referral Follow-up",
  "Other",
];

function FieldLabel({ children }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
      {children}
    </p>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
      <FieldLabel>{label}</FieldLabel>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value || "—"}</p>
    </div>
  );
}

export default function StudentMonitoringDetails({ classId, studentId }) {
  const { detail, loading, error, saving, saveRecord } =
    useStudentMonitoringDetail(classId, studentId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const isAralIdentified = detail ? isAralRecommended(detail) : false;
  const isAral = detail ? canSubmitAralWeeklyProgress(detail) : false;
  const nextWeek = detail ? nextAralWeekNumber(detail.records ?? []) : 1;
  const [form, setForm] = useState({
    observationDate: new Date().toISOString().slice(0, 10),
    interventionGiven: INTERVENTION_OPTIONS[0],
    teacherRemarks: "",
    studentProgress: PROGRESS_OPTIONS[2],
    followUpNeeded: false,
    monitoringStatus: MONITORING_STATUS.ONGOING,
  });

  useEffect(() => {
    if (!detail) return;
    if (canSubmitAralWeeklyProgress(detail)) {
      setForm((prev) => ({
        ...prev,
        interventionGiven: ARAL_WEEKLY_INTERVENTION,
      }));
    }
  }, [detail]);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setToast("");

    if (!form.observationDate) {
      setFormError("Observation date is required.");
      return;
    }

    const remarks = isAral
      ? formatAralWeeklyRemarks(nextWeek, form.teacherRemarks)
      : form.teacherRemarks;

    const result = await saveRecord({
      ...form,
      interventionGiven: isAral
        ? form.interventionGiven || ARAL_WEEKLY_INTERVENTION
        : form.interventionGiven,
      teacherRemarks: remarks,
    });
    if (!result.ok) {
      setFormError(result.error?.message ?? "Failed to save monitoring record.");
      return;
    }

    setToast(
      isAral
        ? `Week ${nextWeek} ARAL progress saved. Visible to the Head Teacher.`
        : "Monitoring record saved."
    );
    setForm((prev) => ({
      ...prev,
      teacherRemarks: "",
      observationDate: new Date().toISOString().slice(0, 10),
      interventionGiven: isAral
        ? ARAL_WEEKLY_INTERVENTION
        : INTERVENTION_OPTIONS[0],
    }));
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <header className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium text-slate-400">
            <Link href="/teacher/dashboard" className="hover:text-slate-600">
              Home
            </Link>
            <span className="text-slate-300"> &gt; </span>
            <Link href="/teacher/monitoring" className="hover:text-slate-600">
              Monitoring
            </Link>
            <span className="text-slate-300"> &gt; </span>
            <span className="font-semibold text-slate-600">Student Details</span>
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Link
              href="/teacher/monitoring"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
            >
              <ArrowLeft size={14} />
            </Link>
            <div>
              <h1 className="text-xl font-semibold tracking-[-0.03em] text-slate-800">
                {detail?.name ?? "Academic Monitoring"}
              </h1>
              <p className="mt-0.5 text-[12px] text-slate-500">
                {detail
                  ? `${detail.studentNumber} · ${detail.gradeSection} · ${detail.subject}`
                  : "Loading student details…"}
              </p>
            </div>
          </div>
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
          <SheetContent
            side="left"
            showCloseButton={false}
            className={SIDEBAR_SHEET_CLASS}
          >
            <SheetTitle className="sr-only">Teacher navigation</SheetTitle>
            <TeacherSidebar mobile onNavigate={() => setMenuOpen(false)} />
          </SheetContent>
        </Sheet>
      </header>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      {loading || !detail ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white py-10 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading student monitoring…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-3">
            <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Student Information
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <RiskPill value={detail.riskLevel} />
                  <Pill
                    value={detail.monitoringStatus}
                    styles={monitoringStatusStyles}
                  />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoCard label="Name" value={detail.name} />
                <InfoCard label="Student Number" value={detail.studentNumber} />
                <InfoCard label="Grade Level" value={detail.gradeLevel} />
                <InfoCard label="Section" value={detail.section} />
                <InfoCard label="Adviser" value={detail.adviser} />
                <InfoCard label="Subject Teacher" value={detail.teacher} />
              </div>
            </section>

            <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  Academic Performance
                </h2>
                <p className="text-[11px] font-medium text-slate-400">
                  {detail.schoolYear} · {detail.quarter}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-green-100 bg-green-50/70 px-3 py-2">
                  <FieldLabel>Subject Grade</FieldLabel>
                  <p className="mt-1 text-2xl font-semibold text-cnhs-green-dark">
                    {detail.classSubjectGrade ?? detail.generalAverage ?? "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
                  <FieldLabel>Weak Subjects</FieldLabel>
                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    {detail.weakSubjects.length
                      ? detail.weakSubjects.join(", ")
                      : "None"}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                Risk is based on academic performance (ECR grades) only. SF2 attendance is
                tracked under Attendance Monitoring.
              </p>

              <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                        Subject
                      </th>
                      <th className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                        Grade
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.subjectGrades.length ? (
                      detail.subjectGrades.map((row) => (
                        <tr
                          key={`${row.subject}-${row.grade}`}
                          className="border-t border-slate-100"
                        >
                          <td className="px-3 py-2.5 text-xs font-medium text-slate-700">
                            {row.subject}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-2.5 text-xs font-semibold",
                              row.grade != null && row.grade < 75
                                ? "text-red-600"
                                : "text-slate-800"
                            )}
                          >
                            {row.grade ?? "—"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={2}
                          className="px-3 py-6 text-center text-xs text-slate-400"
                        >
                          No subject grades recorded for this quarter yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
              <h2 className="text-sm font-semibold text-slate-900">
                System Recommendation
              </h2>
              {detail.recommendationDisplay ? (
                <>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Pill
                      value={detail.recommendationDisplay}
                      styles={interventionStyles}
                    />
                    {detail.recommendationDisplay === RECOMMENDATION.NONE ? null : (
                      <RiskPill value={detail.riskLevel} />
                    )}
                  </div>
                  <p className="mt-3 text-[12px] leading-5 text-slate-500">
                    {detail.recommendationReason}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-400">
                    Generated by the Random Forest recommendation engine.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-3 text-[12px] leading-5 text-slate-500">
                    ARAL Learners applies to English and Filipino only, so no
                    student-level recommendation is generated for{" "}
                    {detail.subject}.
                  </p>
                  <p className="mt-2 text-[11px] text-slate-400">
                    Classroom Remedial for this class is evaluated at the class
                    level in Monitoring and Reports.
                  </p>
                </>
              )}
            </section>

            <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
              <h2 className="text-sm font-semibold text-slate-900">
                {isAral ? "ARAL Weekly Progress History" : "Monitoring History"}
              </h2>
              <div className="mt-3 space-y-3">
                {detail.records.length ? (
                  detail.records.map((record) => (
                    <div
                      key={record.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-800">
                          {record.weekLabel ? `${record.weekLabel} · ` : ""}
                          {record.observationDate}
                        </p>
                        <Pill
                          value={record.monitoringStatus}
                          styles={monitoringStatusStyles}
                        />
                      </div>
                      <p className="mt-2 text-[12px] text-slate-600">
                        <span className="font-semibold text-slate-700">
                          Intervention:
                        </span>{" "}
                        {record.interventionGiven}
                      </p>
                      <p className="mt-1 text-[12px] text-slate-600">
                        <span className="font-semibold text-slate-700">
                          Progress:
                        </span>{" "}
                        {record.studentProgress}
                      </p>
                      <p className="mt-1 text-[12px] text-slate-600">
                        <span className="font-semibold text-slate-700">
                          Remarks:
                        </span>{" "}
                        {record.teacherRemarks}
                      </p>
                      <p className="mt-2 text-[10px] text-slate-400">
                        Follow-up needed: {record.followUpNeeded ? "Yes" : "No"}
                        {record.teacherName !== "—"
                          ? ` · ${record.teacherName}`
                          : ""}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="py-4 text-center text-xs text-slate-400">
                    {isAral
                      ? "No weekly ARAL progress updates yet. Submit Week 1 below."
                      : "No monitoring records yet. Use the form to add the first entry."}
                  </p>
                )}
              </div>
            </section>
          </div>

          <section className="h-fit rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5 xl:sticky xl:top-4">
            <h2 className="text-sm font-semibold text-slate-900">
              {isAral
                ? `Weekly ARAL Progress · Week ${nextWeek}`
                : "Record Monitoring Progress"}
            </h2>
            <p className="mt-1 text-[11px] text-slate-400">
              {isAral
                ? "You are the assigned Summer ARAL facilitator. Record whether the learner improved this week."
                : isAralIdentified
                  ? "This learner is identified as ARAL Learners. Weekly Summer ARAL progress is submitted only by the assigned facilitator. You may still record regular classroom monitoring below."
                  : "Save observations for this learner. Entries are stored in the database and visible to the Head Teacher."}
            </p>

            {isAralIdentified && !isAral ? (
              <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
                Weekly ARAL Program updates are available only to the assigned
                facilitator (see Admin → Academic Monitoring → Assign ARAL
                Facilitators).
              </div>
            ) : null}

            {toast ? (
              <div className="mt-3 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-[12px] font-medium text-cnhs-green-dark">
                {toast}
              </div>
            ) : null}
            {formError ? (
              <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[12px] text-red-600">
                {formError}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <label className="block">
                <FieldLabel>Observation Date</FieldLabel>
                <input
                  type="date"
                  value={form.observationDate}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      observationDate: e.target.value,
                    }))
                  }
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none focus:border-cnhs-green"
                  required
                />
              </label>

              <label className="block">
                <FieldLabel>Intervention Given</FieldLabel>
                <select
                  value={form.interventionGiven}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      interventionGiven: e.target.value,
                    }))
                  }
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none focus:border-cnhs-green"
                >
                  {INTERVENTION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <FieldLabel>Teacher Remarks</FieldLabel>
                <textarea
                  value={form.teacherRemarks}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      teacherRemarks: e.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Describe the learner's performance, behavior, and support provided…"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-cnhs-green"
                />
              </label>

              <label className="block">
                <FieldLabel>
                  {isAral ? "Weekly Progress (did the learner improve?)" : "Student Progress"}
                </FieldLabel>
                <select
                  value={form.studentProgress}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      studentProgress: e.target.value,
                    }))
                  }
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none focus:border-cnhs-green"
                >
                  {PROGRESS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <FieldLabel>Monitoring Status</FieldLabel>
                <select
                  value={form.monitoringStatus}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      monitoringStatus: e.target.value,
                    }))
                  }
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none focus:border-cnhs-green"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={form.followUpNeeded}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      followUpNeeded: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-cnhs-green-dark"
                />
                <span className="text-[12px] font-medium text-slate-700">
                  Follow-up Needed
                </span>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-cnhs-green-dark text-sm font-semibold text-white transition-colors hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                {isAral
                  ? `Save Week ${nextWeek} ARAL Progress`
                  : "Save Monitoring Record"}
              </button>
            </form>
          </section>
        </div>
      )}
    </motion.div>
  );
}
