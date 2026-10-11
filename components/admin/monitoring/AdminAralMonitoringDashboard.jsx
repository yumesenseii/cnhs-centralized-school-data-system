"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  FileSpreadsheet,
  RefreshCw,
  X,
  BookOpen,
  UserCheck,
  ClipboardList,
} from "lucide-react";
import Header from "@/components/layout/Header";
import PageHelp from "@/components/shared/PageHelp";
import AppSelect from "@/components/shared/AppSelect";
import AdminAralApprovalPanel from "@/components/admin/monitoring/AdminAralApprovalPanel";
import AdminAralFacilitatorAssignPanel from "@/components/admin/monitoring/AdminAralFacilitatorAssignPanel";
import AdminAralProgressPanel from "@/components/admin/monitoring/AdminAralProgressPanel";
import AdminAralSummerEligibilityPanel from "@/components/admin/monitoring/AdminAralSummerEligibilityPanel";
import AdminAralLearnerDetailPanel from "@/components/admin/monitoring/AdminAralLearnerDetailPanel";

import { useAdminMonitoring } from "@/hooks/teacher/useMonitoring";
import { aggregateAralLearners } from "@/lib/monitoring/aralLearnerAggregation";
import {
  isAralHtTrackedLearner,
  ARAL_APPROVAL_STATUS,
} from "@/lib/monitoring/aralApproval";
import { listRecentAralAbsenceIds } from "@/lib/supabase/queries/monitoring";
import { useAralAssessmentPeriod } from "@/hooks/useAralAssessmentPeriod";
import {
  aralPeriodLabel,
  aralPeriodShortLabel,
} from "@/lib/monitoring/assessmentTimeline";
import { cn } from "@/lib/utils";

const ARAL_ADMIN_TABS = [
  { id: "review", label: "Waiting for Review" },
  { id: "assessment", label: "Assessment & Support" },
  { id: "outcomes", label: "Outcomes" },
];

const OUTCOME_FILTERS = [
  { id: "completed", label: "Completed" },
  { id: "continued", label: "Needs Continued Support" },
  { id: "summer", label: "Summer Eligible" },
];

const ARAL_PERIOD_OPTIONS = [
  { value: "BOSY", label: "Beginning Assessment (BOSY)" },
  { value: "MOSY", label: "Mid-Year Assessment (MOSY)" },
  { value: "EOSY", label: "End-of-Year Assessment (EOSY)" },
];

/** Case-insensitive approval matching (canonical labels or legacy values). */
function approvalIs(value, ...needles) {
  const text = String(value || "");
  return needles.some((n) => text.toLowerCase().includes(n));
}

function isApprovedLearner(s) {
  return approvalIs(s.aralApprovalStatus, "approved");
}

function isCompletedLearner(s) {
  return (
    s.monitoringStatus === "Completed" ||
    s.aralStatus === "Completed" ||
    s.movementOutcome === "Promoted"
  );
}

function isPendingPrincipal(status) {
  return (
    !status ||
    status === ARAL_APPROVAL_STATUS.SUGGESTED ||
    status === ARAL_APPROVAL_STATUS.SUBMITTED ||
    approvalIs(status, "submitted", "suggested")
  );
}

export default function AdminAralMonitoringDashboard() {
  const prefersReducedMotion = useReducedMotion();
  const {
    students,
    filterOptions,
    loading,
    refreshing,
    error,
    refresh,
  } = useAdminMonitoring();

  const [activeTab, setActiveTab] = useState("review"); // 'review' | 'assessment' | 'outcomes'
  const [assessmentSubView, setAssessmentSubView] = useState("facilitators"); // 'facilitators' | 'progress'
  const [outcomeFilter, setOutcomeFilter] = useState("completed");
  const [schoolYear, setSchoolYear] = useState("");
  const [grade, setGrade] = useState("All Grades");
  const [section, setSection] = useState("All Sections");
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const {
    period: aralPeriod,
    updatePeriod,
    saving: savingPeriod,
  } = useAralAssessmentPeriod();

  const currentTerm = "Term 1";

  const activeSchoolYear =
    schoolYear || filterOptions.schoolYears?.[0] || "SY 2026-2027";

  // Deduplicate student records to unique learners
  const deduplicatedStudents = useMemo(() => {
    return aggregateAralLearners(students);
  }, [students]);

  // Recent ARAL session absences
  const [absentIds, setAbsentIds] = useState(() => new Set());
  useEffect(() => {
    if (activeTab !== "assessment") return;
    let cancelled = false;
    (async () => {
      try {
        const approvedIds = [
          ...new Set(
            (students ?? [])
              .filter((s) => approvalIs(s.aralApprovalStatus, "approved"))
              .map((s) => s.studentId)
              .filter(Boolean)
          ),
        ];
        if (!approvedIds.length) {
          if (!cancelled) setAbsentIds(new Set());
          return;
        }
        const result = await listRecentAralAbsenceIds(approvedIds, 30);
        if (!cancelled) setAbsentIds(result.data ?? new Set());
      } catch {
        if (!cancelled) setAbsentIds(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, students]);

  // Filter students by school year, search, grade, and section consistently
  const filteredStudents = useMemo(() => {
    return (deduplicatedStudents || []).filter((s) => {
      // 1. School year filter (defaulting to active school year)
      if (activeSchoolYear && s.schoolYear && s.schoolYear !== activeSchoolYear) {
        return false;
      }

      // 2. Search query filter
      const q = search.toLowerCase().trim();
      if (q) {
        const hitName = (s.name || `${s.lastName || ""} ${s.firstName || ""}`)
          .toLowerCase()
          .includes(q);
        const hitLrn = String(s.studentNumber || s.lrn || "").includes(q);
        const hitSection = String(s.gradeSection || s.section || "")
          .toLowerCase()
          .includes(q);
        if (!hitName && !hitLrn && !hitSection) return false;
      }

      // 3. Grade & section filters
      if (grade !== "All Grades" && s.grade !== grade && `Grade ${s.grade}` !== grade) {
        return false;
      }
      if (section !== "All Sections" && s.section !== section && s.gradeSection !== section) {
        return false;
      }
      return true;
    });
  }, [deduplicatedStudents, activeSchoolYear, search, grade, section]);

  // Executive ARAL KPIs — strictly aligned with section records
  const aralKpi = useMemo(() => {
    const list = filteredStudents;
    const awaitingReview = list.filter(
      (s) => isAralHtTrackedLearner(s) && isPendingPrincipal(s.aralApprovalStatus)
    ).length;

    // Stage 1: Approved + no facilitator = Need Facilitator
    const unassignedFacilitator = list.filter(
      (s) =>
        isApprovedLearner(s) &&
        !isCompletedLearner(s) &&
        !s.aralFacilitatorAssigned &&
        !s.aralFacilitatorTeacherId
    ).length;

    // Stage 2: Facilitator assigned + assessment not completed = Waiting for Assessment
    const facilitatorAssignedList = list.filter(
      (s) =>
        isApprovedLearner(s) &&
        !isCompletedLearner(s) &&
        (Boolean(s.aralFacilitatorAssigned) || Boolean(s.aralFacilitatorTeacherId))
    );

    const midlineDue = facilitatorAssignedList.filter(
      (s) =>
        s.monitoringStatus === "For Midline Assessment" ||
        s.aralPhase === "Midline" ||
        s.midlineScore == null
    ).length;

    const eosyDue = facilitatorAssignedList.filter(
      (s) =>
        s.monitoringStatus === "For EOSY Assessment" ||
        s.aralPhase === "EOSY" ||
        s.eosyScore == null
    ).length;

    const approvedAwaitingBaseline = facilitatorAssignedList.filter(
      (s) => s.philIriScore == null
    ).length;

    const assessmentDue =
      aralPeriod === "MOSY"
        ? midlineDue
        : aralPeriod === "EOSY"
          ? eosyDue
          : approvedAwaitingBaseline;

    const summerEligible = list.filter(
      (s) =>
        s.summerStatus === "Eligible" ||
        s.eosyDecision === "ARAL Summer Referral" ||
        Boolean(s.isSummerEligible)
    ).length;

    const completedCount = list.filter(isCompletedLearner).length;
    const continuedCount = list.filter(
      (s) =>
        s.monitoringStatus === "Needs Further Support" ||
        s.monitoringStatus === "For Further Monitoring" ||
        s.monitoringStatus === "Referred"
    ).length;
    const totalOutcomes = completedCount + continuedCount + summerEligible;

    return {
      awaitingReview,
      unassignedFacilitator,
      assessmentDue,
      summerEligible,
      completedCount,
      continuedCount,
      totalOutcomes,
    };
  }, [filteredStudents, aralPeriod]);

  return (
    <div className="pb-8">
      <Header
        breadcrumb="Home > ARAL Monitoring"
        title="ARAL Monitoring"
        description="Review ARAL referrals, assign reading facilitators, track Phil-IRI assessments, and monitor learner outcomes."
        controls={
          <>
            <PageHelp
              summary="School-wide ARAL Monitoring administration under RA 12028."
              steps={[
                "Review teacher endorsements for English and Filipino reading candidates.",
                "Assign reading teachers/facilitators to approved ARAL learner cohorts.",
                "Track assessment progress from BOSY Group Screening Test (GST) to Midline and EOSY.",
                "ARAL Summer Program is recorded as an Eligibility state; summer instruction remains outside CNHS Learn.",
              ]}
            />

            <button
              type="button"
              onClick={() => refresh({ bustCache: true })}
              disabled={loading || refreshing}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 active:scale-95 disabled:opacity-60"
            >
              <RefreshCw
                size={13}
                className={refreshing || loading ? "animate-spin" : ""}
              />
              <span>Refresh</span>
            </button>
          </>
        }
      />

      {error ? (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-xs text-red-700 shadow-xs">
          <div>
            <p className="font-semibold">Unable to load ARAL monitoring data</p>
            <p className="mt-0.5 text-[11px] text-red-600">
              Please check your connection and try again.
            </p>
          </div>
          <button
            type="button"
            onClick={() => refresh({ bustCache: true })}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50 active:scale-95"
          >
            <RefreshCw size={12} />
            <span>Retry</span>
          </button>
        </div>
      ) : null}

      {/* TOP INFO BAR */}
      <div className="mb-4 flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="font-bold text-slate-900">
            {activeSchoolYear} · Current Term: {currentTerm}
          </span>
          <span className="text-slate-300">•</span>
          <span className="inline-flex items-center gap-1.5 text-slate-600">
            <BookOpen size={13} className="text-cnhs-green-dark" />
            ARAL Assessment:{" "}
            <strong className="font-semibold text-cnhs-green-dark">
              {aralPeriodLabel(aralPeriod)}
            </strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <AppSelect
            label="Assessment period"
            value={aralPeriod}
            onChange={(next) =>
              updatePeriod(next, { schoolYear: activeSchoolYear })
            }
            options={ARAL_PERIOD_OPTIONS}
            disabled={savingPeriod}
            className="w-[210px]"
            triggerClassName="h-8 rounded-lg text-xs font-semibold"
          />
        </div>
      </div>

      {/* 3 IMPORTANT ACTION CARDS WITH STANDARDIZED SIZING AND NO OUTLINE ON CLICK */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* 1. Waiting for Review */}
        <button
          type="button"
          onClick={() => setActiveTab("review")}
          className={cn(
            "group relative flex min-h-[140px] w-full cursor-pointer flex-col justify-between rounded-xl border p-4 text-left shadow-xs outline-none transition-all duration-150 hover:border-cnhs-green/40 hover:bg-cnhs-green-soft/20 focus:outline-none focus-visible:outline-none active:scale-[0.99] active:translate-y-[0.5px]",
            aralKpi.awaitingReview > 0
              ? "border-amber-300/80 bg-amber-50/40 hover:border-amber-400 hover:bg-amber-50/70"
              : "border-slate-200 bg-white"
          )}
        >
          <div>
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  aralKpi.awaitingReview > 0 ? "text-amber-800" : "text-slate-500"
                )}
              >
                Waiting for Review
              </span>
              {aralKpi.awaitingReview > 0 ? (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  Action Needed
                </span>
              ) : null}
            </div>
            <p
              className={cn(
                "mt-1.5 text-2xl font-bold leading-none tracking-tight tabular-nums",
                aralKpi.awaitingReview > 0 ? "text-amber-900" : "text-slate-900"
              )}
            >
              {aralKpi.awaitingReview}
            </p>
            <p className="mt-1.5 text-[11px] text-slate-500">
              {aralKpi.awaitingReview > 0
                ? "Teacher referrals waiting for your review."
                : "No referrals waiting for review."}
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100/80 pt-2.5 text-[11px] font-semibold text-cnhs-green-dark">
            <span>Review Queue</span>
            <span className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </div>
        </button>

        {/* 2. Need Facilitator */}
        <button
          type="button"
          onClick={() => {
            setActiveTab("assessment");
            setAssessmentSubView("facilitators");
          }}
          className={cn(
            "group relative flex min-h-[140px] w-full cursor-pointer flex-col justify-between rounded-xl border p-4 text-left shadow-xs outline-none transition-all duration-150 hover:border-cnhs-green/40 hover:bg-cnhs-green-soft/20 focus:outline-none focus-visible:outline-none active:scale-[0.99] active:translate-y-[0.5px]",
            aralKpi.unassignedFacilitator > 0
              ? "border-amber-300/80 bg-amber-50/40 hover:border-amber-400 hover:bg-amber-50/70"
              : "border-slate-200 bg-white"
          )}
        >
          <div>
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  aralKpi.unassignedFacilitator > 0
                    ? "text-amber-800"
                    : "text-slate-500"
                )}
              >
                Need Facilitator
              </span>
              {aralKpi.unassignedFacilitator > 0 ? (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  Action Needed
                </span>
              ) : null}
            </div>
            <p
              className={cn(
                "mt-1.5 text-2xl font-bold leading-none tracking-tight tabular-nums",
                aralKpi.unassignedFacilitator > 0
                  ? "text-amber-900"
                  : "text-slate-900"
              )}
            >
              {aralKpi.unassignedFacilitator}
            </p>
            <p className="mt-1.5 text-[11px] text-slate-500">
              {aralKpi.unassignedFacilitator > 0
                ? "Approved learners without an assigned facilitator"
                : "All approved learners have facilitators assigned."}
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100/80 pt-2.5 text-[11px] font-semibold text-cnhs-green-dark">
            <span>Assign Facilitators</span>
            <span className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </div>
        </button>

        {/* 3. Waiting for Assessment (Neutral styling, Principal does not assess) */}
        <button
          type="button"
          onClick={() => {
            setActiveTab("assessment");
            setAssessmentSubView("progress");
          }}
          className="group relative flex min-h-[140px] w-full cursor-pointer flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs outline-none transition-all duration-150 hover:border-cnhs-green/40 hover:bg-cnhs-green-soft/20 focus:outline-none focus-visible:outline-none active:scale-[0.99] active:translate-y-[0.5px]"
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Waiting for Assessment
              </span>
              {aralKpi.assessmentDue > 0 ? (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                  Waiting
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 text-2xl font-bold leading-none tracking-tight tabular-nums text-slate-900">
              {aralKpi.assessmentDue}
            </p>
            <p className="mt-1.5 text-[11px] text-slate-500">
              {aralKpi.assessmentDue > 0
                ? "Learners waiting for assessment"
                : "All assessments are up to date for this period."}
            </p>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100/80 pt-2.5 text-[11px] font-semibold text-cnhs-green-dark">
            <span>Assessment Progress</span>
            <span className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </div>
        </button>
      </div>

      {/* FILTER CONTROLS */}
      <section className="mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidate name, LRN, or section…"
            className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-cnhs-green"
          />
          <div className="flex flex-wrap items-center gap-2">
            <AppSelect
              label="School year"
              value={schoolYear || activeSchoolYear}
              onChange={setSchoolYear}
              options={filterOptions.schoolYears}
              className="w-[148px]"
              triggerClassName="h-9 rounded-lg text-xs"
            />
            <AppSelect
              label="Grade"
              value={grade}
              onChange={setGrade}
              options={filterOptions.grades}
              className="w-[132px]"
              triggerClassName="h-9 rounded-lg text-xs"
            />
            <AppSelect
              label="Section"
              value={section}
              onChange={setSection}
              options={filterOptions.sections}
              className="w-[148px]"
              triggerClassName="h-9 rounded-lg text-xs"
            />
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setGrade("All Grades");
                setSection("All Sections");
              }}
              className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-95"
            >
              <X size={12} />
              Clear
            </button>
          </div>
        </div>
      </section>

      {/* 3 WORKFLOW TABS */}
      <div
        className="mb-4 flex items-end gap-3 overflow-x-auto border-b border-slate-200"
        role="tablist"
        aria-label="Principal ARAL monitoring workflow tabs"
      >
        {ARAL_ADMIN_TABS.map((tab) => {
          const selected = activeTab === tab.id;
          const badgeCount =
            tab.id === "review"
              ? aralKpi.awaitingReview
              : tab.id === "assessment"
                ? aralKpi.unassignedFacilitator + aralKpi.assessmentDue
                : 0;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "-mb-px inline-flex shrink-0 cursor-pointer items-center gap-2 border-b-2 px-1 pb-2.5 text-xs transition-colors",
                selected
                  ? "border-cnhs-green font-bold text-cnhs-green-dark"
                  : "border-transparent font-medium text-slate-500 hover:text-slate-700"
              )}
            >
              <span>{tab.label}</span>
              {badgeCount > 0 ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums",
                    selected
                      ? "bg-cnhs-green-soft text-cnhs-green-dark"
                      : "bg-amber-100 text-amber-800"
                  )}
                >
                  {badgeCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT PANELS WITH 200–250ms TRANSITION */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -4 }}
          transition={{
            duration: prefersReducedMotion ? 0 : 0.22,
            ease: "easeOut",
          }}
          role="tabpanel"
        >
          {/* TAB 1: WAITING FOR REVIEW */}
          {activeTab === "review" ? (
            <AdminAralApprovalPanel
              students={filteredStudents}
              onChanged={() => refresh({ bustCache: true })}
              onViewStudent={setSelectedStudent}
            />
          ) : null}

          {/* TAB 2: ASSESSMENT & SUPPORT */}
          {activeTab === "assessment" ? (
            <div className="space-y-3">
              {/* Sub-view switcher for Facilitator Assignment vs Progress */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs">
                <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 p-1">
                  <button
                    type="button"
                    onClick={() => setAssessmentSubView("facilitators")}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.98]",
                      assessmentSubView === "facilitators"
                        ? "bg-white text-cnhs-green-dark shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <UserCheck size={13} />
                    Facilitator Assignment
                    {aralKpi.unassignedFacilitator > 0 ? (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                        {aralKpi.unassignedFacilitator}
                      </span>
                    ) : null}
                  </button>

                  <button
                    type="button"
                    onClick={() => setAssessmentSubView("progress")}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.98]",
                      assessmentSubView === "progress"
                        ? "bg-white text-cnhs-green-dark shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <ClipboardList size={13} />
                    Assessment & Learning Progress
                    {aralKpi.assessmentDue > 0 ? (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.2 text-[10px] font-bold text-amber-800">
                        {aralKpi.assessmentDue}
                      </span>
                    ) : null}
                  </button>
                </div>

                <span className="text-[11px] text-slate-400">
                  {assessmentSubView === "facilitators"
                    ? "Assign reading teachers by Grade & Section"
                    : "Track GST, Midline, and EOSY scores"}
                </span>
              </div>

              {/* Sub-view Panels */}
              {assessmentSubView === "facilitators" ? (
                <AdminAralFacilitatorAssignPanel
                  students={filteredStudents}
                  onChanged={() => refresh({ bustCache: true })}
                  absentIds={absentIds}
                  onViewStudent={setSelectedStudent}
                />
              ) : (
                <AdminAralProgressPanel
                  students={filteredStudents}
                  onViewStudent={setSelectedStudent}
                  activePeriod={aralPeriod}
                />
              )}
            </div>
          ) : null}

          {/* TAB 3: OUTCOMES */}
          {activeTab === "outcomes" ? (
            <div className="space-y-3">
              {aralKpi.totalOutcomes === 0 ? (
                <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xs">
                  <p className="text-sm font-bold text-slate-800">
                    No learner outcomes yet.
                  </p>
                  <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
                    Outcomes will appear after the applicable assessment and support stages are completed.
                  </p>
                </section>
              ) : (
                <>
                  <div
                    className="flex flex-wrap items-center gap-1.5"
                    role="tablist"
                    aria-label="Outcome filters"
                  >
                    {OUTCOME_FILTERS.map((item) => {
                      const selected = outcomeFilter === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          onClick={() => setOutcomeFilter(item.id)}
                          className={cn(
                            "inline-flex h-8 cursor-pointer items-center rounded-full px-3 text-[11px] font-semibold transition-all active:scale-95",
                            selected
                              ? "bg-cnhs-green-dark text-white"
                              : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                          )}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>

                  {outcomeFilter === "summer" ? (
                    <>
                      {aralPeriod !== "EOSY" && aralKpi.summerEligible === 0 ? (
                        <p className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-[12px] text-slate-500">
                          Summer eligibility becomes available after End-of-Year Assessment.
                        </p>
                      ) : null}
                      <AdminAralSummerEligibilityPanel
                        schoolYear={activeSchoolYear}
                        onViewStudent={setSelectedStudent}
                      />
                    </>
                  ) : (
                    <AdminAralProgressPanel
                      students={filteredStudents}
                      onViewStudent={setSelectedStudent}
                      outcomeFilter={outcomeFilter}
                      activePeriod={aralPeriod}
                    />
                  )}
                </>
              )}
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>

      {/* CENTRALIZED SLIDING LEARNER DETAIL PANEL */}
      <AdminAralLearnerDetailPanel
        learner={selectedStudent}
        isOpen={Boolean(selectedStudent)}
        onClose={() => setSelectedStudent(null)}
        onUpdated={() => refresh({ bustCache: true })}
        currentTerm={currentTerm}
      />
    </div>
  );
}
