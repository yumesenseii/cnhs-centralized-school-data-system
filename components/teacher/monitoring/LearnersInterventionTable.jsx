"use client";

import { Eye, Loader2, Send } from "lucide-react";
import {
  Pill,
  RiskPill,
  PriorityCue,
  avatarTones,
  interventionStyles,
  monitoringStatusStyles,
} from "@/components/teacher/monitoring/shared";
import MonitoringTablePagination from "@/components/teacher/monitoring/MonitoringTablePagination";
import { isAralRecommended } from "@/lib/monitoring/aralProgress";
import {
  ARAL_APPROVAL_STATUS,
  aralApprovalDisplayLabel,
  aralApprovalStyles,
} from "@/lib/monitoring/aralApproval";
import { RECOMMENDATION } from "@/lib/monitoring/recommendations";
import { cn } from "@/lib/utils";

function subjectGradeDisplay(learner, layout) {
  if (layout === "htAral") {
    const grade =
      learner.aralClassSubjectGrade ??
      learner.classSubjectGrade ??
      learner.generalAverage ??
      "—";
    const subjects =
      learner.aralSubjects?.length > 0
        ? learner.aralSubjects
        : learner.subjects?.filter(Boolean) ?? [];
    return { grade, subjects };
  }

  if (layout === "htNonAral") {
    const grade =
      learner.nonAralClassSubjectGrade ??
      learner.classSubjectGrade ??
      learner.generalAverage ??
      "—";
    const subjects =
      learner.nonAralSubjects?.length > 0
        ? learner.nonAralSubjects
        : learner.subjects?.filter(Boolean) ?? [];
    return { grade, subjects };
  }

  return {
    grade: learner.classSubjectGrade ?? learner.generalAverage ?? "—",
    subjects: learner.subjects ?? [],
  };
}

function nextActionLabel(status) {
  if (!status) return "—";
  if (status === "Needs Follow-up" || status === "Needs Update") {
    return "Needs follow-up";
  }
  return status;
}

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
  /** default | htAral | htNonAral */
  layout = "default",
  /** When true (Eng/Fil teacher portal), show approval status + Submit */
  showAralApproval = false,
  onSubmitAralReview = null,
  submittingAralId = "",
  emptyMessage = "No students match your current filters.",
  emptyHint = "",
}) {
  const displayTotal =
    typeof totalCount === "number" ? totalCount : learners.length;
  const displayAtRisk =
    typeof atRiskCount === "number"
      ? atRiskCount
      : learners.filter((l) => l.atRisk).length;

  const isHtLite = layout === "htAral" || layout === "htNonAral";

  const columns = isHtLite
    ? layout === "htNonAral"
      ? [
          "Student",
          "Section / Subject",
          "Risk",
          "Priority",
          "Recommendation",
          "Next action",
          "Action",
        ]
      : [
          "Student",
          "Section / Subject",
          "Risk",
          "Priority",
          "Recommendation",
          "HT approval",
          "Next action",
          "Action",
        ]
    : [
        "Student Name",
        "Student Number",
        "Subject Grade",
        "Risk Level",
        "Priority",
        "Recommendation",
        ...(showAralApproval ? ["HT Approval"] : []),
        "Latest Progress",
        "Monitoring Status",
        "Action",
      ];

  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            {displayTotal} total
          </span>
          {!isHtLite ? (
            <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
              {displayAtRisk} at risk
            </span>
          ) : null}
        </div>
        <p className="text-[11px] font-medium text-slate-400">
          {schoolYear} · {quarter}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table
          className={cn(
            "w-full border-collapse text-left",
            isHtLite ? "min-w-[720px]" : "min-w-[980px]"
          )}
        >
          <thead>
            <tr className="bg-slate-50/80">
              {columns.map((column) => (
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
            {learners.map((learner) => {
              const aral = isAralRecommended(learner);
              const approvalStatus =
                learner.aralApprovalStatus || ARAL_APPROVAL_STATUS.SUGGESTED;
              const canSubmit =
                showAralApproval &&
                layout !== "htNonAral" &&
                !isHtLite &&
                aral &&
                typeof onSubmitAralReview === "function" &&
                approvalStatus !== ARAL_APPROVAL_STATUS.APPROVED &&
                approvalStatus !== ARAL_APPROVAL_STATUS.SUBMITTED;
              const submitting = submittingAralId === learner.id;
              const { grade, subjects } = subjectGradeDisplay(learner, layout);
              const subjectLine =
                subjects.length > 0
                  ? subjects.slice(0, 2).join(", ") +
                    (subjects.length > 2 ? ` +${subjects.length - 2}` : "")
                  : "—";

              return (
                <tr
                  key={learner.selectKey || learner.id}
                  className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
                >
                  {isHtLite ? (
                    <>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                              avatarTones[learner.avatarTone] ??
                                avatarTones.blue
                            )}
                          >
                            {learner.initials}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[12px] font-semibold text-slate-800">
                              {learner.name}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {learner.studentNumber || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-1.5">
                        <p className="text-[12px] font-medium text-slate-700">
                          {learner.gradeSection || "—"}
                        </p>
                        <p
                          className="mt-0.5 text-[10px] text-slate-400"
                          title={subjects.join(", ")}
                        >
                          {subjectLine}
                          {grade !== "—" ? ` · ${grade}` : ""}
                        </p>
                      </td>
                      <td className="px-3 py-1.5">
                        <RiskPill value={learner.riskLevel} />
                      </td>
                      <td className="px-3 py-1.5">
                        <PriorityCue learner={learner} />
                      </td>
                      <td className="px-3 py-1.5">
                        {layout === "htNonAral" ? (
                          <p className="text-[11px] font-medium text-cnhs-orange">
                            Classroom remedial
                          </p>
                        ) : learner.recommendationDisplay ? (
                          <Pill
                            value={learner.recommendationDisplay}
                            styles={interventionStyles}
                          />
                        ) : (
                          <Pill
                            value={RECOMMENDATION.NONE}
                            styles={interventionStyles}
                          />
                        )}
                      </td>
                      {layout === "htAral" ? (
                        <td className="px-3 py-1.5">
                          <Pill
                            value={aralApprovalDisplayLabel(approvalStatus)}
                            styles={{
                              ...aralApprovalStyles,
                              [aralApprovalDisplayLabel(approvalStatus)]:
                                aralApprovalStyles[approvalStatus],
                            }}
                          />
                          {learner.aralApprovalNote &&
                          approvalStatus === ARAL_APPROVAL_STATUS.RETURNED ? (
                            <p className="mt-0.5 max-w-[140px] truncate text-[10px] text-orange-700">
                              {learner.aralApprovalNote}
                            </p>
                          ) : null}
                        </td>
                      ) : null}
                      <td className="px-3 py-1.5">
                        <Pill
                          value={nextActionLabel(learner.monitoringStatus)}
                          styles={{
                            ...monitoringStatusStyles,
                            [nextActionLabel(learner.monitoringStatus)]:
                              monitoringStatusStyles[learner.monitoringStatus],
                          }}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <button
                          type="button"
                          onClick={() => onViewMonitoring(learner)}
                          className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-cnhs-green-dark/35 bg-white px-2.5 text-[10px] font-semibold text-cnhs-green-dark transition-colors hover:bg-green-50"
                        >
                          <Eye size={11} />
                          View
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold",
                              avatarTones[learner.avatarTone] ??
                                avatarTones.blue
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
                        <p>{grade}</p>
                        {subjects.length > 0 ? (
                          <p
                            className="mt-0.5 text-[10px] font-medium text-slate-400"
                            title={subjects.join(", ")}
                          >
                            {subjects.slice(0, 3).join(", ")}
                            {subjects.length > 3
                              ? ` +${subjects.length - 3}`
                              : ""}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-1.5">
                        <RiskPill value={learner.riskLevel} />
                      </td>
                      <td className="px-3 py-1.5">
                        <PriorityCue learner={learner} />
                      </td>
                      <td className="px-3 py-1.5">
                        {learner.recommendationDisplay ? (
                          <Pill
                            value={learner.recommendationDisplay}
                            styles={interventionStyles}
                          />
                        ) : (
                          <Pill
                            value={RECOMMENDATION.NONE}
                            styles={interventionStyles}
                          />
                        )}
                      </td>
                      {showAralApproval ? (
                        <td className="px-3 py-1.5">
                          {aral ? (
                            <div>
                              <Pill
                                value={aralApprovalDisplayLabel(approvalStatus)}
                                styles={{
                                  ...aralApprovalStyles,
                                  [aralApprovalDisplayLabel(approvalStatus)]:
                                    aralApprovalStyles[approvalStatus],
                                }}
                              />
                              {learner.aralApprovalNote &&
                              approvalStatus ===
                                ARAL_APPROVAL_STATUS.RETURNED ? (
                                <p className="mt-0.5 max-w-[140px] truncate text-[10px] text-orange-700">
                                  {learner.aralApprovalNote}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </td>
                      ) : null}
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
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onViewMonitoring(learner)}
                            className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-cnhs-green-dark/35 bg-white px-2.5 text-[10px] font-semibold text-cnhs-green-dark transition-colors hover:bg-green-50"
                          >
                            <Eye size={11} />
                            View Details
                          </button>
                          {canSubmit ? (
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => onSubmitAralReview(learner)}
                              title="Submit ARAL recommendation for Head Teacher review"
                              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 text-[10px] font-semibold text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-50"
                            >
                              {submitting ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <Send size={11} />
                              )}
                              Submit for HT
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {displayTotal === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-slate-600">{emptyMessage}</p>
          {emptyHint ? (
            <p className="mt-1.5 text-[12px] text-slate-400">{emptyHint}</p>
          ) : null}
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
