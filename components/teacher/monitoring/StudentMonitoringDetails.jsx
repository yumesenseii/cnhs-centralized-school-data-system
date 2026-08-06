"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronDown, Loader2, Menu, Save } from "lucide-react";
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

const inputClass =
  "mt-0.5 h-8 w-full rounded-full border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none focus:border-cnhs-green";

function FieldLabel({ children }) {
  return (
    <p className="text-[9px] font-semibold uppercase tracking-[0.06em] text-slate-400">
      {children}
    </p>
  );
}

function InfoCell({ label, value }) {
  return (
    <div className="min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <p className="mt-0.5 truncate text-[12px] font-semibold text-slate-800">
        {value || "—"}
      </p>
    </div>
  );
}

export default function StudentMonitoringDetails({ classId, studentId }) {
  const { detail, loading, error, saving, saveRecord } =
    useStudentMonitoringDetail(classId, studentId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
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
      className="pb-4"
    >
      <header className="mb-2 flex items-start justify-between gap-3">
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
          <div className="mt-1.5 flex items-center gap-2">
            <Link
              href="/teacher/monitoring"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
            >
              <ArrowLeft size={13} />
            </Link>
            <div>
              <h1 className="text-lg font-semibold tracking-[-0.03em] text-slate-800 sm:text-xl">
                {detail?.name ?? "Academic Monitoring"}
              </h1>
              <p className="text-[11px] text-slate-500">
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
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden"
              />
            }
          >
            <Menu size={16} />
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
        <div className="mb-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[12px] text-red-600">
          {error}
        </div>
      ) : null}

      {loading || !detail ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white py-10 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading student monitoring…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-2">
            {/* Learner profile + academics in one denser panel */}
            <section className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-[0_4px_12px_rgba(15,23,42,0.03)] sm:p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <h2 className="text-sm font-semibold text-slate-900">
                  Student Information
                </h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  <RiskPill value={detail.riskLevel} />
                  <Pill
                    value={detail.monitoringStatus}
                    styles={monitoringStatusStyles}
                  />
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
                <InfoCell label="Name" value={detail.name} />
                <InfoCell label="Student Number" value={detail.studentNumber} />
                <InfoCell label="Grade Level" value={detail.gradeLevel} />
                <InfoCell label="Section" value={detail.section} />
                <InfoCell label="Adviser" value={detail.adviser} />
                <InfoCell label="Subject Teacher" value={detail.teacher} />
              </div>

              <div className="mt-2.5 border-t border-slate-100 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[12px] font-semibold text-slate-800">
                    Academic Performance
                  </h3>
                  <p className="text-[10px] font-medium text-slate-400">
                    {detail.schoolYear} · {detail.quarter}
                  </p>
                </div>

                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                  <div className="rounded-lg border border-green-100 bg-green-50/70 px-2.5 py-1.5">
                    <FieldLabel>Subject Grade</FieldLabel>
                    <p className="mt-0.5 text-lg font-semibold leading-none text-cnhs-green-dark">
                      {detail.classSubjectGrade ??
                        detail.generalAverage ??
                        "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-1.5">
                    <FieldLabel>Weak Subjects</FieldLabel>
                    <p className="mt-0.5 text-[12px] font-semibold text-slate-700">
                      {detail.weakSubjects.length
                        ? detail.weakSubjects.join(", ")
                        : "None"}
                    </p>
                  </div>
                </div>
                <p className="mt-1.5 text-[10px] text-slate-400">
                  Risk uses ECR grades only. SF2 attendance is under Attendance
                  Monitoring.
                </p>

                <div className="mt-1.5 overflow-hidden rounded-lg border border-slate-100">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-slate-50/80">
                        <th className="px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                          Subject
                        </th>
                        <th className="px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">
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
                            <td className="px-2 py-1 text-[12px] font-medium text-slate-700">
                              {row.subject}
                            </td>
                            <td
                              className={cn(
                                "px-2 py-1 text-[12px] font-semibold",
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
                            className="px-2 py-4 text-center text-[11px] text-slate-400"
                          >
                            No subject grades recorded for this quarter yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-[0_4px_12px_rgba(15,23,42,0.03)] sm:p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">
                  System Recommendation
                </h2>
                {detail.recommendationDisplay ? (
                  <Pill
                    value={detail.recommendationDisplay}
                    styles={interventionStyles}
                  />
                ) : null}
              </div>
              {detail.recommendationDisplay ? (
                <>
                  <p className="mt-1.5 text-[11px] leading-4 text-slate-500">
                    {detail.recommendationReason}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Generated by the Random Forest recommendation engine.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1.5 text-[11px] leading-4 text-slate-500">
                    ARAL Learners applies to English and Filipino only, so no
                    student-level recommendation is generated for{" "}
                    {detail.subject}.
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Classroom Remedial for this class is evaluated at the class
                    level in Monitoring and Reports.
                  </p>
                </>
              )}
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
              <button
                type="button"
                onClick={() => setHistoryOpen((open) => !open)}
                className="flex w-full cursor-pointer items-center justify-between gap-2 px-2.5 py-2 text-left sm:px-3"
              >
                <h2 className="text-sm font-semibold text-slate-900">
                  {isAral
                    ? "ARAL Weekly Progress History"
                    : "Monitoring History"}
                  <span className="ml-1.5 text-[10px] font-semibold text-slate-400">
                    ({detail.records.length})
                  </span>
                </h2>
                <ChevronDown
                  size={14}
                  className={cn(
                    "shrink-0 text-slate-400 transition-transform",
                    historyOpen ? "rotate-180" : ""
                  )}
                />
              </button>
              {historyOpen ? (
                <div className="space-y-1.5 border-t border-slate-100 px-2.5 py-2 sm:px-3">
                  {detail.records.length ? (
                    detail.records.map((record) => (
                      <div
                        key={record.id}
                        className="rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-1.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <p className="text-[11px] font-semibold text-slate-800">
                            {record.weekLabel ? `${record.weekLabel} · ` : ""}
                            {record.observationDate}
                          </p>
                          <Pill
                            value={record.monitoringStatus}
                            styles={monitoringStatusStyles}
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-600">
                          <span className="font-semibold text-slate-700">
                            Intervention:
                          </span>{" "}
                          {record.interventionGiven}
                          {" · "}
                          <span className="font-semibold text-slate-700">
                            Progress:
                          </span>{" "}
                          {record.studentProgress}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-600">
                          <span className="font-semibold text-slate-700">
                            Remarks:
                          </span>{" "}
                          {record.teacherRemarks}
                        </p>
                        <p className="mt-0.5 text-[9px] text-slate-400">
                          Follow-up: {record.followUpNeeded ? "Yes" : "No"}
                          {record.teacherName !== "—"
                            ? ` · ${record.teacherName}`
                            : ""}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="py-3 text-center text-[11px] text-slate-400">
                      {isAral
                        ? "No weekly ARAL progress updates yet. Submit Week 1 below."
                        : "No monitoring records yet. Use the form to add the first entry."}
                    </p>
                  )}
                </div>
              ) : null}
            </section>
          </div>

          <section className="h-fit rounded-xl border border-slate-100 bg-white p-2.5 shadow-[0_4px_12px_rgba(15,23,42,0.03)] sm:p-3 xl:sticky xl:top-3">
            <h2 className="text-sm font-semibold text-slate-900">
              {isAral
                ? `Weekly ARAL Progress · Week ${nextWeek}`
                : "Record Monitoring Progress"}
            </h2>
            <p className="mt-0.5 text-[10px] leading-3.5 text-slate-400">
              {isAral
                ? "You are the assigned Summer ARAL facilitator. Record whether the learner improved this week."
                : isAralIdentified
                  ? "Identified as ARAL Learners. Weekly Summer ARAL progress is submitted by the assigned facilitator only. You may still record classroom monitoring below."
                  : "Save observations for this learner. Entries are visible to the Head Teacher."}
            </p>

            {isAralIdentified && !isAral ? (
              <div className="mt-2 rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-[10px] font-medium text-amber-800">
                Weekly ARAL updates are available only to the assigned
                facilitator (Admin → Academic Monitoring → Assign ARAL
                Facilitators).
              </div>
            ) : null}

            {toast ? (
              <div className="mt-2 rounded-lg border border-green-100 bg-green-50 px-2.5 py-1.5 text-[11px] font-medium text-cnhs-green-dark">
                {toast}
              </div>
            ) : null}
            {formError ? (
              <div className="mt-2 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-600">
                {formError}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-2.5 space-y-2">
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
                  className={inputClass}
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
                  className={inputClass}
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
                  rows={3}
                  placeholder="Describe performance, behavior, and support provided…"
                  className="mt-0.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-cnhs-green"
                />
              </label>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="block">
                  <FieldLabel>
                    {isAral ? "Weekly Progress" : "Student Progress"}
                  </FieldLabel>
                  <select
                    value={form.studentProgress}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        studentProgress: e.target.value,
                      }))
                    }
                    className={inputClass}
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
                    className={inputClass}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-100 bg-slate-50/70 px-3 py-1.5">
                <input
                  type="checkbox"
                  checked={form.followUpNeeded}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      followUpNeeded: e.target.checked,
                    }))
                  }
                  className="h-3.5 w-3.5 rounded border-slate-300 text-cnhs-green-dark"
                />
                <span className="text-[11px] font-medium text-slate-700">
                  Follow-up Needed
                </span>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-cnhs-green-dark text-[12px] font-semibold text-white transition-colors hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
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
