"use client";

import { X, BookOpen, User, CheckCircle2, FileText, History } from "lucide-react";

export default function PrincipalAralOutcomeModal({
  open = false,
  outcomeRecord = null,
  onClose,
}) {
  if (!open || !outcomeRecord) return null;

  const {
    learnerName,
    gradeSection,
    language,
    latestReadingProfile,
    outcome,
    assessmentPeriod,
    rawLearner = {},
  } = outcomeRecord;

  // Derive assessment history (BOSY, MOSY, EOSY)
  const history = [
    {
      period: "Beginning Assessment (BOSY)",
      code: "BOSY",
      profile: rawLearner.bosyProfile || (rawLearner.philIriScore != null ? latestReadingProfile : "—"),
      score: rawLearner.bosyScore ?? rawLearner.philIriScore ?? "—",
    },
    {
      period: "Mid-Year Assessment (MOSY)",
      code: "MOSY",
      profile: rawLearner.mosyProfile || (assessmentPeriod === "MOSY" ? latestReadingProfile : "—"),
      score: rawLearner.mosyScore ?? "—",
    },
    {
      period: "End-of-Year Assessment (EOSY)",
      code: "EOSY",
      profile: rawLearner.eosyProfile || (assessmentPeriod === "EOSY" ? latestReadingProfile : "—"),
      score: rawLearner.eosyScore ?? "—",
    },
  ];

  const supportProgram =
    rawLearner.supportProgram ||
    rawLearner.interventionTitle ||
    rawLearner.programName ||
    (rawLearner.inAralProgram ? "ARAL Reading Remediation" : "Direct Assessment / Independent");

  const facilitator =
    rawLearner.aralFacilitatorName || rawLearner.facilitatorName || "Unassigned";

  const latestNote =
    rawLearner.latestProgressNote ||
    rawLearner.notes ||
    rawLearner.progressNote ||
    rawLearner.remarks ||
    "Completed session milestones and demonstrated required assessment proficiency.";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="aral-outcome-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[var(--card)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4 dark:border-white/5 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-[#166534] dark:bg-emerald-950/60 dark:text-emerald-300">
              <CheckCircle2 size={16} />
            </div>
            <div>
              <h2
                id="aral-outcome-modal-title"
                className="text-sm font-bold uppercase tracking-wider text-[#166534] dark:text-emerald-400"
              >
                ARAL LEARNER OUTCOME
              </h2>
              <p className="text-[11px] text-slate-500">
                Official validated reading intervention outcome (Read-only for Principal)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-200"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="max-h-[75vh] space-y-4 overflow-y-auto p-5 text-xs">
          {/* Learner Info Grid */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-white/5 dark:bg-white/[0.02]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Learner
              </p>
              <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                {learnerName}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Grade & Section
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                {gradeSection}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Language
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                {language}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Assessment Period
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                {assessmentPeriod}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Latest Reading Profile
              </p>
              <p className="mt-1">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    latestReadingProfile === "Independent"
                      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : latestReadingProfile === "Instructional"
                        ? "bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                        : latestReadingProfile === "Frustration"
                          ? "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                          : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400"
                  }`}
                >
                  {latestReadingProfile}
                </span>
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Assigned Facilitator
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                {facilitator}
              </p>
            </div>
            <div className="col-span-2 border-t border-slate-200/60 pt-3 dark:border-white/5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Support Received
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                {supportProgram}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Program Outcome
              </p>
              <p className="mt-1">
                <span className="inline-flex rounded-lg bg-emerald-100/80 px-2.5 py-1 text-xs font-bold text-[#166534] dark:bg-emerald-950/60 dark:text-emerald-300">
                  {outcome}
                </span>
              </p>
            </div>
          </div>

          {/* Latest Progress Note */}
          <div className="rounded-xl border border-slate-100 bg-white p-3.5 dark:border-white/5 dark:bg-white/[0.01]">
            <div className="flex items-center gap-1.5 text-slate-500">
              <FileText size={13} />
              <p className="text-[10px] font-bold uppercase tracking-wider">
                Latest Facilitator Progress Note
              </p>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              "{latestNote}"
            </p>
          </div>

          {/* Assessment History Timeline */}
          <div className="rounded-xl border border-slate-100 bg-white p-3.5 dark:border-white/5 dark:bg-white/[0.01]">
            <div className="flex items-center gap-1.5 text-slate-500">
              <History size={13} />
              <p className="text-[10px] font-bold uppercase tracking-wider">
                ASSESSMENT HISTORY
              </p>
            </div>

            <div className="mt-2.5 overflow-hidden rounded-lg border border-slate-100 dark:border-white/5">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-white/[0.02]">
                    <th className="px-3 py-2">Assessment Period</th>
                    <th className="px-3 py-2 text-center">Score</th>
                    <th className="px-3 py-2 text-right">Reading Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {history.map((row) => (
                    <tr key={row.code} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                        {row.period}
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums text-slate-600 dark:text-slate-400">
                        {row.score}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800 dark:text-slate-200">
                        {row.profile}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-5 py-3 dark:border-white/5 dark:bg-white/[0.02]">
          <p className="text-[11px] text-slate-400">
            Facilitator assessment results and progress notes are read-only.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-white/10 dark:bg-[var(--card)] dark:text-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
