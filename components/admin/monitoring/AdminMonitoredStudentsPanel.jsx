"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ARAL_APPROVAL_STATUS } from "@/lib/monitoring/aralApproval";
import { isAralRecommended } from "@/lib/monitoring/aralProgress";
import {
  MONITORING_STATUS,
  RECOMMENDATION,
  RISK_LEVEL,
  normalizeRiskLevel,
} from "@/lib/monitoring/recommendations";
import {
  getLearnerAralReferralState,
  isAralLanguageSubject,
} from "@/lib/monitoring/aralAcademicStatus";
import AdminTablePagination from "@/components/shared/AdminTablePagination";

const PAGE_SIZE = 10;

const STATUS_FILTERS = [
  { id: "all", label: "All Needing Review" },
  { id: "immediate", label: "Needs Immediate Review" },
  { id: "monitoring", label: "Needs Monitoring" },
  { id: "remedial", label: "Under Class Remedial" },
  { id: "improving", label: "Improving" },
];

export default function AdminMonitoredStudentsPanel({
  learners = [],
  schoolYear = "SY 2026-2027",
  quarter = "All Terms",
  onViewStudent,
  loading = false,
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Filter only learners who need academic attention or are monitored
  const reviewLearners = useMemo(() => {
    return learners.filter((learner) => {
      const isHigh =
        normalizeRiskLevel(learner.riskLevel) === RISK_LEVEL.HIGH ||
        learner.riskPriority === true;
      const isMod =
        normalizeRiskLevel(learner.riskLevel) === RISK_LEVEL.MODERATE;
      const isRemedial =
        learner.recommendation === RECOMMENDATION.REMEDIATION ||
        learner.classroomRemedialRecommended;
      const isLanguage = isAralLanguageSubject(learner.subject);
      const isAral =
        isLanguage &&
        (learner.aralApprovalStatus === ARAL_APPROVAL_STATUS.SUBMITTED ||
          learner.aralApprovalStatus === ARAL_APPROVAL_STATUS.APPROVED ||
          learner.candidateStatus === "Referred to ARAL" ||
          learner.inAralProgram);
      const isOngoing =
        learner.monitoringStatus === MONITORING_STATUS.ONGOING;
      const isImproving =
        learner.monitoringStatus === MONITORING_STATUS.IMPROVED ||
        learner.performanceTrend === "Improving";

      return (
        isHigh ||
        isMod ||
        isRemedial ||
        isAral ||
        isOngoing ||
        isImproving ||
        learner.atRisk
      );
    });
  }, [learners]);

  // Apply user search and status filter
  const filteredLearners = useMemo(() => {
    return reviewLearners.filter((learner) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        learner.name?.toLowerCase().includes(q) ||
        learner.gradeSection?.toLowerCase().includes(q) ||
        learner.section?.toLowerCase().includes(q) ||
        (Array.isArray(learner.subjects)
          ? learner.subjects.some((s) => s.toLowerCase().includes(q))
          : learner.subject?.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      const isHigh =
        normalizeRiskLevel(learner.riskLevel) === RISK_LEVEL.HIGH ||
        learner.riskPriority === true;
      const isMod =
        normalizeRiskLevel(learner.riskLevel) === RISK_LEVEL.MODERATE;
      const isRemedial =
        learner.recommendation === RECOMMENDATION.REMEDIATION ||
        learner.classroomRemedialRecommended;
      const isImproving =
        learner.monitoringStatus === MONITORING_STATUS.IMPROVED ||
        learner.performanceTrend === "Improving";

      if (statusFilter === "immediate") return isHigh;
      if (statusFilter === "monitoring") return isMod && !isHigh;
      if (statusFilter === "remedial") return isRemedial;
      if (statusFilter === "improving") return isImproving;

      return true;
    });
  }, [reviewLearners, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLearners.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pagedLearners = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredLearners.slice(start, start + PAGE_SIZE);
  }, [filteredLearners, safePage]);

  if (loading && learners.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-12 text-sm text-slate-500 shadow-xs dark:border-white/5 dark:bg-[var(--card)]">
        <Loader2 size={16} className="animate-spin text-cnhs-green-dark" />
        Loading learners needing academic review…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search and Status Filters */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between dark:border-white/5 dark:bg-[var(--card)]">
        <div className="relative min-w-0 flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search learner name, section, or subject…"
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-cnhs-green focus:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          />
        </div>

        {/* Status Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((item) => {
            const isSelected = statusFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setStatusFilter(item.id);
                  setPage(1);
                }}
                className={cn(
                  "inline-flex cursor-pointer items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  isSelected
                    ? "bg-cnhs-green-dark text-white shadow-xs"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Strictly Academic Learners Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-white/5 dark:bg-[var(--card)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-white/5 dark:bg-white/[0.02]">
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Learners Needing Academic Attention
          </h3>
          <p className="text-[12px] font-medium text-slate-500">
            {filteredLearners.length} learner{filteredLearners.length === 1 ? "" : "s"} found
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-white/[0.03] dark:text-slate-400">
                <th className="px-4 py-3">Learner</th>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3 text-center">Current Grade</th>
                <th className="px-4 py-3 text-center">Risk</th>
                <th className="px-4 py-3">Current Support</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {pagedLearners.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                    No learners currently require academic review under this selection.
                  </td>
                </tr>
              ) : (
                pagedLearners.map((learner) => {
                  const isHigh =
                    normalizeRiskLevel(learner.riskLevel) === RISK_LEVEL.HIGH ||
                    learner.riskPriority === true;
                  const isMod =
                    normalizeRiskLevel(learner.riskLevel) ===
                    RISK_LEVEL.MODERATE;
                  const isRemedial =
                    learner.recommendation === RECOMMENDATION.REMEDIATION ||
                    learner.classroomRemedialRecommended;
                  const isImproving =
                    learner.monitoringStatus === MONITORING_STATUS.IMPROVED ||
                    learner.performanceTrend === "Improving";

                  let riskBadgeLabel = "Needs Monitoring";
                  let riskBadgeClass =
                    "border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300";

                  if (isHigh) {
                    riskBadgeLabel = "Needs Immediate Review";
                    riskBadgeClass =
                      "border-red-200/80 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-950/40 dark:text-red-300";
                  } else if (isImproving) {
                    riskBadgeLabel = "Improving";
                    riskBadgeClass =
                      "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300";
                  } else if (isRemedial) {
                    riskBadgeLabel = "Under Class Remedial";
                    riskBadgeClass =
                      "border-slate-200/80 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-300";
                  } else if (isMod) {
                    riskBadgeLabel = "Needs Monitoring";
                    riskBadgeClass =
                      "border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300";
                  }

                  const subjectsDisplay =
                    Array.isArray(learner.subjects) && learner.subjects.length
                      ? learner.subjects.join(", ")
                      : learner.subject || "Enrolled Subjects";

                  const sectionDisplay =
                    learner.gradeSection || learner.section || "—";

                  const gradeDisplay =
                    learner.classSubjectGrade ??
                    learner.generalAverage ??
                    "—";

                  const refState = getLearnerAralReferralState(learner);

                  return (
                    <tr
                      key={learner.id || learner.studentId}
                      className="transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-2.5 text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                        {learner.name}
                      </td>
                      <td className="px-4 py-2.5 text-[13px] font-medium text-slate-700 dark:text-slate-300">
                        {sectionDisplay}
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-slate-600 dark:text-slate-300">
                        {subjectsDisplay}
                      </td>
                      <td className="px-4 py-2.5 text-center text-[13px] font-bold text-slate-800 dark:text-slate-200">
                        {gradeDisplay}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium leading-tight",
                            riskBadgeClass
                          )}
                        >
                          {riskBadgeLabel}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {refState.isLanguageSubject && refState.isUnderSupport ? (
                          <span className="text-[12px] font-medium text-slate-800 dark:text-slate-200">
                            Under ARAL Support
                          </span>
                        ) : refState.isLanguageSubject && refState.isApproved ? (
                          <span className="text-[12px] font-medium text-emerald-700 dark:text-emerald-400">
                            Approved for Assessment
                          </span>
                        ) : refState.isLanguageSubject && refState.isPending ? (
                          <span className="text-[12px] font-medium text-amber-800 dark:text-amber-400">
                            Pending Principal Review
                          </span>
                        ) : refState.isLanguageSubject && refState.isReturned ? (
                          <span className="text-[12px] font-medium text-amber-800 dark:text-amber-400">
                            Returned for Teacher Review
                          </span>
                        ) : isRemedial ? (
                          <span className="text-[12px] font-medium text-slate-700 dark:text-slate-300">
                            Class Remedial
                          </span>
                        ) : learner.monitoringStatus && learner.monitoringStatus !== "Not Started" ? (
                          <span className="text-[12px] font-medium text-slate-700 dark:text-slate-300">
                            {learner.monitoringStatus}
                          </span>
                        ) : (
                          <span className="text-[12px] text-slate-400 dark:text-slate-500">
                            Classroom Monitoring
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => onViewStudent?.(learner)}
                          className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                        >
                          View Record
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <AdminTablePagination
          page={safePage}
          pageSize={PAGE_SIZE}
          total={filteredLearners.length}
          onPageChange={setPage}
          itemLabel="learners"
        />
      </div>
    </div>
  );
}
