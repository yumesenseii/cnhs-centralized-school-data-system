"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Pill,
  RiskPill,
  interventionStyles,
} from "@/components/teacher/monitoring/shared";
import { monitoringDashboardData } from "@/data/teacher/monitoringDashboard";
import { cn } from "@/lib/utils";

function FieldLabel({ children }) {
  return (
    <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
      {children}
    </p>
  );
}

export default function MonitoringDetailsDrawer({
  open,
  onOpenChange,
  learner,
}) {
  const [observation, setObservation] = useState("");
  const [progress, setProgress] = useState(monitoringDashboardData.progressOptions[2]);
  const [nextRecommendation, setNextRecommendation] = useState(
    monitoringDashboardData.nextRecommendationOptions[0]
  );
  const [finalRecommendation, setFinalRecommendation] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!learner) return;
    setObservation("");
    setProgress(monitoringDashboardData.progressOptions[2]);
    setNextRecommendation(
      learner.intervention === "ARAL Learners" ||
        learner.intervention === "Recommended for ARAL Screening"
        ? "Recommend for ARAL Learners"
        : "Continue Classroom Remediation"
    );
    setFinalRecommendation("");
    setToast("");
  }, [learner]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!learner) return null;

  function handleSaveObservation(e) {
    e.preventDefault();
    setToast("Observation saved successfully.");
  }

  function handleSubmitRecommendation(e) {
    e.preventDefault();
    setToast("Recommendation submitted to Head Teacher.");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-l border-slate-100 bg-cnhs-page p-0 sm:max-w-[480px]"
      >
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <SheetHeader className="gap-1 p-0">
            <SheetTitle className="text-base font-semibold text-slate-900">
              Monitoring Details
            </SheetTitle>
            <SheetDescription className="text-[12px] text-slate-500">
              Record weekly observations and submit recommendations to the Head Teacher. This does
              not enroll the learner in ARAL.
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="space-y-3 p-4 sm:p-3.5">
          {toast ? (
            <div className="flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 px-3 py-2.5 text-[12px] font-medium text-cnhs-green-dark">
              <CheckCircle2 size={14} />
              {toast}
            </div>
          ) : null}

          <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
            <h3 className="text-sm font-semibold text-slate-900">Student Information</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              {[
                ["Student Name", learner.name],
                ["Student Number", learner.studentNumber],
                ["Grade & Section", learner.gradeSection],
                ["Weak Subject", learner.weakSubject],
                ["Subject Grade", learner.classSubjectGrade ?? learner.generalAverage],
              ].map(([label, value]) => (
                <div key={label}>
                  <FieldLabel>{label}</FieldLabel>
                  <dd className="mt-1 text-[12px] font-semibold text-slate-800">{value}</dd>
                </div>
              ))}
              <div>
                <FieldLabel>Risk Level</FieldLabel>
                <div className="mt-1.5">
                  <RiskPill value={learner.riskLevel} />
                </div>
              </div>
              <div>
                <FieldLabel>Current Intervention Recommendation</FieldLabel>
                <div className="mt-1.5">
                  <Pill value={learner.intervention} styles={interventionStyles} />
                </div>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
            <h3 className="text-sm font-semibold text-slate-900">Academic Summary</h3>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <div>
                <FieldLabel>Weak Subject</FieldLabel>
                <p className="mt-1 text-[12px] font-semibold text-slate-800">
                  {learner.weakSubject}
                </p>
              </div>
              <div>
                <FieldLabel>Subject Grade</FieldLabel>
                <p
                  className={cn(
                    "mt-1 text-[12px] font-semibold",
                    (learner.classSubjectGrade ?? learner.generalAverage) < 75
                      ? "text-red-600"
                      : "text-slate-800"
                  )}
                >
                  {learner.classSubjectGrade ?? learner.generalAverage ?? "—"}
                </p>
              </div>
            </div>
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-slate-50/80">
                    <th className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      Latest Grades
                    </th>
                    <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      Grade
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {learner.latestGrades.map((row) => (
                    <tr key={row.subject} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-[12px] text-slate-600">
                        {row.subject}
                        {row.subject === learner.weakSubject ? (
                          <span className="ml-2 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                            Weak
                          </span>
                        ) : null}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right text-[12px] font-semibold",
                          row.grade < 75 ? "text-red-600" : "text-slate-700"
                        )}
                      >
                        {row.grade}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
            <h3 className="text-sm font-semibold text-slate-900">Monitoring Timeline</h3>
            <div className="mt-3 space-y-3">
              {learner.timeline.map((week) => (
                <article
                  key={week.week}
                  className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-[12px] font-semibold text-slate-800">{week.week}</h4>
                    <span className="text-[10px] font-medium text-slate-400">
                      {week.observationDate ?? "No date yet"}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-600">{week.summary}</p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-700">
                    Progress: {week.progress}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <form
            onSubmit={handleSaveObservation}
            className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]"
          >
            <h3 className="text-sm font-semibold text-slate-900">Teacher Observation</h3>
            <p className="mt-1 text-[11px] text-slate-400">
              Record participation, learning progress, behavior, assessment notes, and
              challenges. SF2 attendance is tracked separately under Attendance Monitoring.
            </p>
            <textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              rows={5}
              placeholder="Enter weekly observation notes..."
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] text-slate-700 outline-none focus:border-cnhs-green"
            />

            <div className="mt-3 grid grid-cols-1 gap-3">
              <label className="block">
                <span className="text-[11px] font-medium text-slate-600">Progress Assessment</span>
                <select
                  value={progress}
                  onChange={(e) => setProgress(e.target.value)}
                  className="mt-1.5 h-9 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none focus:border-cnhs-green"
                >
                  {monitoringDashboardData.progressOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-[11px] font-medium text-slate-600">Next Recommendation</span>
                <select
                  value={nextRecommendation}
                  onChange={(e) => setNextRecommendation(e.target.value)}
                  className="mt-1.5 h-9 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none focus:border-cnhs-green"
                >
                  {monitoringDashboardData.nextRecommendationOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-cnhs-green-dark px-4 text-[11px] font-semibold text-white transition-colors hover:bg-[#246f54]"
              >
                Save Observation
              </button>
            </div>
          </form>

          <form
            onSubmit={handleSubmitRecommendation}
            className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]"
          >
            <h3 className="text-sm font-semibold text-slate-900">Final Recommendation</h3>
            <p className="mt-1 text-[11px] text-slate-400">
              Submits monitoring results to the Head Teacher only. It does not enroll the learner
              into the DepEd ARAL Program.
            </p>
            <textarea
              value={finalRecommendation}
              onChange={(e) => setFinalRecommendation(e.target.value)}
              rows={4}
              placeholder="Summarize the learner's overall progress and provide your recommendation for the Head Teacher."
              className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] text-slate-700 outline-none focus:border-cnhs-green"
            />
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-[#d8efe4] px-4 text-[11px] font-semibold text-cnhs-green-dark transition-colors hover:bg-[#c6e6d7]"
              >
                Submit Recommendation to Head Teacher
              </button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
