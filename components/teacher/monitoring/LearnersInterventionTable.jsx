"use client";

import { Eye } from "lucide-react";
import {
  Pill,
  RiskPill,
  avatarTones,
  interventionStyles,
  monitoringStatusStyles,
} from "@/components/teacher/monitoring/shared";
import MonitoringTablePagination from "@/components/teacher/monitoring/MonitoringTablePagination";
import { cn } from "@/lib/utils";

export default function LearnersInterventionTable({
  learners,
  totalCount,
  atRiskCount,
  page,
  pageSize,
  onPageChange,
  schoolYear,
  quarter,
  onViewMonitoring,
  title = "Students for Monitoring",
}) {
  const displayTotal =
    typeof totalCount === "number" ? totalCount : learners.length;
  const displayAtRisk =
    typeof atRiskCount === "number"
      ? atRiskCount
      : learners.filter((l) => l.atRisk).length;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            {displayTotal} total
          </span>
          <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
            {displayAtRisk} at risk
          </span>
        </div>
        <p className="text-[11px] font-medium text-slate-400">
          {schoolYear} · {quarter}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/80">
              {[
                "Student Name",
                "Student Number",
                "Subject Grade",
                "Risk Level",
                "Recommendation",
                "Latest Progress",
                "Monitoring Status",
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
            {learners.map((learner) => (
              <tr
                key={learner.id}
                className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
              >
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold",
                        avatarTones[learner.avatarTone] ?? avatarTones.blue
                      )}
                    >
                      {learner.initials}
                    </span>
                    <div>
                      <p className="text-[12px] font-semibold text-slate-800">
                        {learner.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {learner.gradeSection}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-1.5 text-[12px] font-medium text-slate-600">
                  {learner.studentNumber}
                </td>
                <td className="px-3 py-1.5 text-[12px] font-semibold text-slate-800">
                  {learner.classSubjectGrade ?? learner.generalAverage ?? "—"}
                </td>
                <td className="px-3 py-1.5">
                  <RiskPill value={learner.riskLevel} />
                </td>
                <td className="px-3 py-1.5">
                  {learner.recommendationDisplay ? (
                    <Pill
                      value={learner.recommendationDisplay}
                      styles={interventionStyles}
                    />
                  ) : (
                    <span
                      title="ARAL Learners applies to English and Filipino only."
                      className="text-[11px] font-medium text-slate-400"
                    >
                      Not applicable
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5">
                  <div>
                    <p className="text-[12px] font-medium text-slate-700">
                      {learner.latestProgress || "—"}
                    </p>
                    {learner.inAralProgram ? (
                      <p className="text-[10px] text-slate-400">
                        {learner.weeklyUpdateCount
                          ? `${learner.weeklyUpdateCount} weekly update${
                              learner.weeklyUpdateCount === 1 ? "" : "s"
                            }`
                          : "No weekly updates yet"}
                      </p>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-1.5">
                  <Pill
                    value={learner.monitoringStatus}
                    styles={monitoringStatusStyles}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <button
                    type="button"
                    onClick={() => onViewMonitoring(learner)}
                    className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-cnhs-green-dark/35 bg-white px-2.5 text-[10px] font-semibold text-cnhs-green-dark transition-colors hover:bg-green-50"
                  >
                    <Eye size={11} />
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {displayTotal === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-slate-500">
          No students match your current filters.
        </div>
      ) : null}

      {typeof page === "number" && typeof onPageChange === "function" ? (
        <MonitoringTablePagination
          page={page}
          pageSize={pageSize}
          total={displayTotal}
          onPageChange={onPageChange}
        />
      ) : null}
    </section>
  );
}
