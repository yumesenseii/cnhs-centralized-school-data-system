"use client";

import { Eye, Loader2, Pencil, Send } from "lucide-react";
import {
  Pill,
  RiskPill,
  PriorityCue,
  avatarTones,
} from "@/components/teacher/monitoring/shared";
import MonitoringTablePagination from "@/components/teacher/monitoring/MonitoringTablePagination";
import { isAralRecommended } from "@/lib/monitoring/aralProgress";
import {
  ARAL_APPROVAL_STATUS,
  aralApprovalStyles,
} from "@/lib/monitoring/aralApproval";
import { cn } from "@/lib/utils";

function formatGrade(value) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? n : "—";
}

/**
 * Clean Planning & Research–style list of monitored / ARAL-recommended learners.
 */
export default function AralRecommendedTable({
  learners,
  totalCount,
  page,
  pageSize,
  onPageChange,
  showAralApproval = false,
  onView,
  onEdit,
  onSubmitAralReview = null,
  submittingAralId = "",
}) {
  const displayTotal =
    typeof totalCount === "number" ? totalCount : learners.length;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <p className="text-[12px] font-medium text-slate-500">
          Showing {learners.length} of {displayTotal}{" "}
          {displayTotal === 1 ? "learner" : "learners"}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[920px] w-full border-collapse text-left">
          <thead>
            <tr>
              {[
                "Learner name",
                "Student no.",
                "Grade Lvl",
                "Section",
                "Subject / Term grade",
                "Risk",
                "Priority",
                "HT status",
                "Actions",
              ].map((column) => (
                <th
                  key={column}
                  className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {learners.map((learner) => {
              const aral = isAralRecommended(learner);
              const approvalStatus =
                learner.aralApprovalStatus || ARAL_APPROVAL_STATUS.SUGGESTED;
              const canSubmit =
                showAralApproval &&
                aral &&
                typeof onSubmitAralReview === "function" &&
                approvalStatus !== ARAL_APPROVAL_STATUS.APPROVED &&
                approvalStatus !== ARAL_APPROVAL_STATUS.SUBMITTED;
              const submitting = submittingAralId === learner.id;
              const termGrade =
                learner.termGrades?.[learner.quarterNumber] ??
                learner.classSubjectGrade ??
                learner.generalAverage;

              return (
                <tr
                  key={learner.id}
                  className="border-t border-slate-100 transition-colors hover:bg-slate-50/60"
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                          avatarTones[learner.avatarTone] ?? avatarTones.blue
                        )}
                      >
                        {learner.initials}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-slate-800">
                          {learner.name}
                        </p>
                        <p className="truncate text-[11px] text-slate-400">
                          {learner.subject}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[12px] font-medium text-slate-600">
                    {learner.studentNumber}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] font-medium text-slate-700">
                    {learner.grade}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] font-medium text-slate-700">
                    {learner.section}
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="text-[12px] font-semibold text-slate-800">
                      {formatGrade(termGrade)}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {learner.quarter || "Term"}
                    </p>
                  </td>
                  <td className="px-4 py-2.5">
                    <RiskPill value={learner.riskLevel} />
                  </td>
                  <td className="px-4 py-2.5">
                    <PriorityCue learner={learner} />
                  </td>
                  <td className="px-4 py-2.5">
                    {showAralApproval && aral ? (
                      <div>
                        <Pill
                          value={
                            approvalStatus === ARAL_APPROVAL_STATUS.SUGGESTED
                              ? "Draft"
                              : approvalStatus
                          }
                          styles={{
                            ...aralApprovalStyles,
                            Draft: aralApprovalStyles[ARAL_APPROVAL_STATUS.SUGGESTED],
                          }}
                        />
                        {learner.aralApprovalNote &&
                        approvalStatus === ARAL_APPROVAL_STATUS.RETURNED ? (
                          <p className="mt-0.5 max-w-[120px] truncate text-[10px] text-orange-700">
                            {learner.aralApprovalNote}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onView?.(learner)}
                        className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Eye size={11} />
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit?.(learner)}
                        className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 text-[10px] font-semibold text-sky-800 transition-colors hover:bg-sky-100"
                      >
                        <Pencil size={11} />
                        Edit
                      </button>
                      {canSubmit ? (
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => onSubmitAralReview?.(learner)}
                          title="Submit ARAL recommendation for Head Teacher review"
                          className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 text-[10px] font-semibold text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-50"
                        >
                          {submitting ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <Send size={11} />
                          )}
                          Submit to HT
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {displayTotal === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-slate-500">
          No learners match your current filters.
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
