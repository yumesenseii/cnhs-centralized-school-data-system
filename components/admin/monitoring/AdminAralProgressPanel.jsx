"use client";

import { Eye } from "lucide-react";
import {
  Pill,
  interventionStyles,
  monitoringStatusStyles,
} from "@/components/teacher/monitoring/shared";
import { isAralProgramLearner } from "@/lib/monitoring/aralProgress";

/**
 * Admin view-only panel: Summer ARAL weekly progress from assigned facilitators.
 */
export default function AdminAralProgressPanel({
  students = [],
  onViewStudent,
}) {
  const aralLearners = students.filter(isAralProgramLearner);

  return (
    <section className="overflow-hidden rounded-xl border border-sky-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-50 bg-sky-50/40 px-3 py-2.5 sm:px-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            ARAL Learners Weekly Progress
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            View-only. Assigned Summer ARAL facilitators submit weekly updates;
            Head Teacher reviews whether each learner improved.
          </p>
        </div>
        <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
          {aralLearners.length} ARAL learner
          {aralLearners.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[960px] w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/80">
              {[
                "Student",
                "Facilitator",
                "Subject Teacher",
                "Subject",
                "Latest Progress",
                "Weekly Updates",
                "Status",
                "Action",
              ].map((column) => (
                <th
                  key={column}
                  className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {aralLearners.length ? (
              aralLearners.map((learner) => (
                <tr
                  key={learner.id}
                  className="border-t border-slate-100 hover:bg-slate-50/70"
                >
                  <td className="px-3 py-2">
                    <p className="text-[12px] font-semibold text-slate-800">
                      {learner.name}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {learner.studentNumber} · {learner.gradeSection}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-[12px] text-slate-600">
                    {learner.aralFacilitatorName || (
                      <span className="text-amber-600">Unassigned</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-[12px] text-slate-600">
                    {learner.teacherName || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Pill
                      value={
                        learner.recommendationDisplay || learner.recommendation
                      }
                      styles={interventionStyles}
                    />
                    <p className="mt-1 text-[10px] text-slate-400">
                      {learner.subject}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-[12px] text-slate-600">
                    {learner.latestProgress || "—"}
                  </td>
                  <td className="px-3 py-2 text-[12px] text-slate-600">
                    {learner.weeklyUpdateCount
                      ? `${learner.weeklyUpdateCount} weekly update${
                          learner.weeklyUpdateCount === 1 ? "" : "s"
                        }`
                      : "No weekly updates yet"}
                  </td>
                  <td className="px-3 py-2">
                    <Pill
                      value={learner.monitoringStatus}
                      styles={monitoringStatusStyles}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onViewStudent?.(learner)}
                      className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      <Eye size={12} />
                      View progress
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-8 text-center text-[12px] text-slate-400"
                >
                  No ARAL Learners yet. Assign facilitators after English /
                  Filipino teachers identify candidates.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
