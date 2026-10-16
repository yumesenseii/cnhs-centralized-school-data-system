"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  FileSpreadsheet,
  RefreshCw,
  X,
  UserCheck,
  ClipboardList,
  Eye,
  CheckCircle2,
} from "lucide-react";
import Header from "@/components/layout/Header";
import PageHelp from "@/components/shared/PageHelp";
import AppSelect from "@/components/shared/AppSelect";
import AdminAralApprovalPanel from "@/components/admin/monitoring/AdminAralApprovalPanel";
import AdminAralFacilitatorAssignPanel from "@/components/admin/monitoring/AdminAralFacilitatorAssignPanel";
import AdminAralSummerEligibilityPanel from "@/components/admin/monitoring/AdminAralSummerEligibilityPanel";
import AdminAralLearnerDetailPanel from "@/components/admin/monitoring/AdminAralLearnerDetailPanel";
import AdminTablePagination from "@/components/shared/AdminTablePagination";

import { useAdminMonitoring } from "@/hooks/teacher/useMonitoring";
import {
  aggregateAralLearners,
  formatReadingAssessmentDisplay,
} from "@/lib/monitoring/aralLearnerAggregation";
import {
  isAralHtTrackedLearner,
  ARAL_APPROVAL_STATUS,
} from "@/lib/monitoring/aralApproval";
import { listRecentAralAbsenceIds } from "@/lib/supabase/queries/monitoring";
import { useAralAssessmentPeriod } from "@/hooks/useAralAssessmentPeriod";
import { cn } from "@/lib/utils";

const ARAL_ADMIN_TABS = [
  { id: "review", label: "Review Referrals" },
  { id: "assign", label: "Assign Facilitators" },
  { id: "outcomes", label: "Outcomes" },
];

const ARAL_PERIOD_OPTIONS = [
  { value: "BOSY", label: "Beginning Assessment (BOSY)" },
  { value: "MOSY", label: "Mid-Year Assessment (MOSY)" },
  { value: "EOSY", label: "End-of-Year Assessment (EOSY)" },
];

const OUTCOMES_PAGE_SIZE = 10;

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

  // 3 Core Principal Flow Tabs: 'review' | 'assign' | 'outcomes'
  const [activeTab, setActiveTab] = useState("review");
  const [assignCohortFilter, setAssignCohortFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("completed"); // 'completed' | 'continued' | 'summer'
  const [outcomesPage, setOutcomesPage] = useState(1);
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
    if (activeTab !== "monitor" && activeTab !== "assign") return;
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
  }, [students, activeTab]);

  // Dynamic Outcome Filter tabs: Summer Eligible only appears at EOSY
  const outcomeFilterTabs = useMemo(() => {
    const list = [
      { id: "completed", label: "Completed & Exited" },
      { id: "continued", label: "Needs Continued Support" },
    ];
    if (aralPeriod === "EOSY") {
      list.push({ id: "summer", label: "Summer Eligible" });
    }
    return list;
  }, [aralPeriod]);

  // Reset outcomeFilter if summer is selected but period is not EOSY
  useEffect(() => {
    if (aralPeriod !== "EOSY" && outcomeFilter === "summer") {
      setOutcomeFilter("completed");
    }
  }, [aralPeriod, outcomeFilter]);

  // Filtered learners
  const filteredStudents = useMemo(() => {
    return (students ?? []).filter((s) => {
      if (grade !== "All Grades") {
        const sGrade = s.gradeLevel || s.grade || "";
        const cleanGrade = String(grade).replace(/^Grade\s+/i, "").trim();
        const cleanSGrade = String(sGrade).replace(/^Grade\s+/i, "").trim();
        if (cleanGrade !== cleanSGrade) return false;
      }
      if (section !== "All Sections") {
        const sSec = s.sectionName || s.section || "";
        if (sSec !== section) return false;
      }
      if (search) {
        const q = search.toLowerCase().trim();
        const nameHit = (s.name || `${s.firstName || ""} ${s.lastName || ""}`)
          .toLowerCase()
          .includes(q);
        const lrnHit = String(s.studentNumber || s.lrn || "")
          .toLowerCase()
          .includes(q);
        const secHit = String(s.gradeSection || "")
          .toLowerCase()
          .includes(q);
        if (!nameHit && !lrnHit && !secHit) return false;
      }
      return true;
    });
  }, [students, grade, section, search]);

  // ARAL KPI Counts
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

    const totalOutcomes = completedCount + continuedCount + (aralPeriod === "EOSY" ? summerEligible : 0);

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

  // Outcomes list
  const outcomeLearners = useMemo(() => {
    const list = filteredStudents;
    if (outcomeFilter === "completed") {
      return list.filter(isCompletedLearner);
    }
    if (outcomeFilter === "continued") {
      return list.filter(
        (s) =>
          s.monitoringStatus === "Needs Further Support" ||
          s.monitoringStatus === "For Further Monitoring" ||
          s.monitoringStatus === "Referred" ||
          s.movementOutcome === "Needs Further Intervention"
      );
    }
    if (outcomeFilter === "summer") {
      return list.filter(
        (s) =>
          s.summerStatus === "Eligible" ||
          s.eosyDecision === "ARAL Summer Referral" ||
          Boolean(s.isSummerEligible)
      );
    }
    return [];
  }, [filteredStudents, outcomeFilter]);

  const outcomesTotalPages = Math.max(
    1,
    Math.ceil(outcomeLearners.length / OUTCOMES_PAGE_SIZE) || 1
  );
  const safeOutcomesPage = Math.min(Math.max(outcomesPage, 1), outcomesTotalPages);
  const pagedOutcomes = useMemo(() => {
    const start = (safeOutcomesPage - 1) * OUTCOMES_PAGE_SIZE;
    return outcomeLearners.slice(start, start + OUTCOMES_PAGE_SIZE);
  }, [outcomeLearners, safeOutcomesPage]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="space-y-4 pb-6"
    >
      <Header
        breadcrumb="Home > ARAL Monitoring"
        title="ARAL Monitoring"
        description="Review referrals, assign facilitators, and track learner assessment progress and outcomes."
        controls={
          <>
            <PageHelp
              summary="School-wide ARAL Monitoring administration under RA 12028."
              steps={[
                "Review teacher reading referrals for English and Filipino learners.",
                "Assign reading facilitators to approved cohorts by section.",
                "Monitor assessment progress from GST screening to Midline and EOSY.",
                "Track verified learner outcomes and summer eligibility at EOSY.",
              ]}
            />

            <AppSelect
              label="Assessment period"
              value={aralPeriod}
              onChange={(next) =>
                updatePeriod(next, { schoolYear: activeSchoolYear })
              }
              options={ARAL_PERIOD_OPTIONS}
              disabled={savingPeriod}
              className="w-[190px] sm:w-[220px]"
              triggerClassName="h-9 rounded-xl text-xs font-semibold"
            />

            <button
              type="button"
              onClick={() => refresh({ bustCache: true })}
              disabled={loading || refreshing}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:border-cnhs-green/40 hover:bg-cnhs-green-soft/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-[var(--card)] dark:text-slate-200"
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
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-xs text-red-700 shadow-xs">
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

      {/* 3 TOP SUMMARY CARDS (Exact size and style as Academic Monitoring) */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* 1. Waiting for Review */}
        <button
          type="button"
          onClick={() => setActiveTab("review")}
          className={cn(
            "relative flex h-full min-h-[108px] w-full cursor-pointer flex-col justify-between rounded-xl border p-4 text-left shadow-xs transition-colors active:scale-[0.99] dark:bg-[var(--card)]",
            aralKpi.awaitingReview > 0
              ? "border-amber-300 bg-amber-50/25 dark:border-amber-500/30"
              : "border-slate-200 bg-white dark:border-white/5"
          )}
        >
          <div>
            <div className="flex items-center justify-between">
              <p
                className={cn(
                  "text-[11px] font-bold uppercase tracking-wider",
                  aralKpi.awaitingReview > 0
                    ? "text-amber-800 dark:text-amber-400"
                    : "text-slate-500 dark:text-slate-400"
                )}
              >
                Waiting for Review
              </p>
              {aralKpi.awaitingReview > 0 ? (
                <span className="flex h-2 w-2 rounded-full bg-amber-500" />
              ) : null}
            </div>
            <p
              className={cn(
                "mt-2 text-3xl font-bold leading-none tracking-tight tabular-nums",
                aralKpi.awaitingReview > 0
                  ? "text-amber-800 dark:text-amber-400"
                  : "text-slate-900 dark:text-white"
              )}
            >
              {aralKpi.awaitingReview}
            </p>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            {aralKpi.awaitingReview > 0
              ? "Teacher referrals waiting for your review."
              : "No referrals waiting for review."}
          </p>
        </button>

        {/* 2. Need Facilitator */}
        <button
          type="button"
          onClick={() => {
            setActiveTab("assign");
            setAssignCohortFilter("unassigned");
          }}
          className={cn(
            "relative flex h-full min-h-[108px] w-full cursor-pointer flex-col justify-between rounded-xl border p-4 text-left shadow-xs transition-colors active:scale-[0.99] dark:bg-[var(--card)]",
            aralKpi.unassignedFacilitator > 0
              ? "border-amber-300 bg-amber-50/25 dark:border-amber-500/30"
              : "border-slate-200 bg-white dark:border-white/5"
          )}
        >
          <div>
            <div className="flex items-center justify-between">
              <p
                className={cn(
                  "text-[11px] font-bold uppercase tracking-wider",
                  aralKpi.unassignedFacilitator > 0
                    ? "text-amber-800 dark:text-amber-400"
                    : "text-slate-500 dark:text-slate-400"
                )}
              >
                Need Facilitator
              </p>
              {aralKpi.unassignedFacilitator > 0 ? (
                <span className="flex h-2 w-2 rounded-full bg-amber-500" />
              ) : null}
            </div>
            <p
              className={cn(
                "mt-2 text-3xl font-bold leading-none tracking-tight tabular-nums",
                aralKpi.unassignedFacilitator > 0
                  ? "text-amber-800 dark:text-amber-400"
                  : "text-slate-900 dark:text-white"
              )}
            >
              {aralKpi.unassignedFacilitator}
            </p>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            {aralKpi.unassignedFacilitator > 0
              ? "Approved learners without an assigned facilitator."
              : "All approved cohorts have assigned facilitators."}
          </p>
        </button>

        {/* 3. Waiting for Assessment */}
        <button
          type="button"
          onClick={() => {
            setActiveTab("assign");
            setAssignCohortFilter("all");
          }}
          className="relative flex h-full min-h-[108px] w-full cursor-pointer flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs transition-colors active:scale-[0.99] dark:border-white/5 dark:bg-[var(--card)]"
        >
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Waiting for Assessment
              </p>
            </div>
            <p className="mt-2 text-3xl font-bold leading-none tracking-tight tabular-nums text-slate-900 dark:text-white">
              {aralKpi.assessmentDue}
            </p>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            Assigned learners awaiting Phil-IRI evaluation by facilitators.
          </p>
        </button>
      </section>

      {/* FILTER CONTROLS */}
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-white/5 dark:bg-[var(--card)]">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidate name, LRN, or section…"
            className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-cnhs-green dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          />
          <div className="flex flex-wrap items-center gap-2">
            <AppSelect
              label="School year"
              value={schoolYear || activeSchoolYear}
              onChange={setSchoolYear}
              options={filterOptions.schoolYears}
              className="w-[144px]"
              triggerClassName="h-9 rounded-lg text-xs font-medium"
            />
            <AppSelect
              label="Grade"
              value={grade}
              onChange={setGrade}
              options={filterOptions.grades}
              className="w-[128px]"
              triggerClassName="h-9 rounded-lg text-xs font-medium"
            />
            <AppSelect
              label="Section"
              value={section}
              onChange={setSection}
              options={filterOptions.sections}
              className="w-[144px]"
              triggerClassName="h-9 rounded-lg text-xs font-medium"
            />
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setGrade("All Grades");
                setSection("All Sections");
              }}
              className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
            >
              <X size={13} />
              Reset
            </button>
          </div>
        </div>
      </section>

      {/* 3 WORKFLOW TABS */}
      <div
        className="flex items-end gap-5 overflow-x-auto border-b border-slate-200 dark:border-white/10"
        role="tablist"
        aria-label="Principal ARAL monitoring workflow tabs"
      >
        {ARAL_ADMIN_TABS.map((tab) => {
          const selected = activeTab === tab.id;
          const badgeCount =
            tab.id === "review"
              ? aralKpi.awaitingReview
              : tab.id === "assign"
                ? aralKpi.unassignedFacilitator
                : 0;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "-mb-px inline-flex shrink-0 cursor-pointer items-center gap-2 border-b-2 px-1 pb-2.5 text-sm transition-colors",
                selected
                  ? "border-cnhs-green-dark font-bold text-cnhs-green-dark dark:border-cnhs-green dark:text-cnhs-green"
                  : "border-transparent font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              <span>{tab.label}</span>
              {badgeCount > 0 ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums",
                    selected
                      ? "bg-cnhs-green-soft text-cnhs-green-dark dark:bg-cnhs-green-dark/20 dark:text-cnhs-green"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                  )}
                >
                  {badgeCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT PANELS */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -4 }}
          transition={{
            duration: prefersReducedMotion ? 0 : 0.18,
            ease: "easeOut",
          }}
          role="tabpanel"
        >
          {/* FLOW STEP 1: REVIEW REFERRALS */}
          {activeTab === "review" ? (
            <AdminAralApprovalPanel
              students={filteredStudents}
              onChanged={() => refresh({ bustCache: true })}
              onViewStudent={setSelectedStudent}
            />
          ) : null}

          {/* FLOW STEP 2: ASSIGN FACILITATORS & COHORTS */}
          {activeTab === "assign" ? (
            <AdminAralFacilitatorAssignPanel
              students={filteredStudents}
              onChanged={() => refresh({ bustCache: true })}
              onViewStudent={setSelectedStudent}
              initialCohortFilter={assignCohortFilter}
            />
          ) : null}

          {/* FLOW STEP 3: VIEW OUTCOMES */}
          {activeTab === "outcomes" ? (
            <div className="space-y-4">
              {/* Category label as requested: CNHS Learn outcome categories */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    CNHS Learn outcome categories
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Verified assessment and intervention outcomes for reading support cases.
                  </p>
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5" role="tablist">
                  {outcomeFilterTabs.map((item) => {
                    const selected = outcomeFilter === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => {
                          setOutcomeFilter(item.id);
                          setOutcomesPage(1);
                        }}
                        className={cn(
                          "inline-flex h-8 cursor-pointer items-center rounded-full px-3 text-xs font-semibold transition-all active:scale-95",
                          selected
                            ? "bg-cnhs-green-dark text-white shadow-xs"
                            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {outcomeFilter === "summer" && aralPeriod === "EOSY" ? (
                <AdminAralSummerEligibilityPanel
                  schoolYear={activeSchoolYear}
                  onViewStudent={setSelectedStudent}
                />
              ) : (
                /* Simple Read-only Outcome Table */
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-white/5 dark:bg-[var(--card)]">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] border-collapse text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50/80 font-bold uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-white/[0.02]">
                        <tr>
                          <th className="px-5 py-3">Learner</th>
                          <th className="px-5 py-3">Grade & Section</th>
                          <th className="px-5 py-3">Latest Reading Profile</th>
                          <th className="px-5 py-3">Outcome</th>
                          <th className="px-5 py-3">Facilitator</th>
                          <th className="px-5 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {pagedOutcomes.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                              No outcomes recorded under this category yet.
                            </td>
                          </tr>
                        ) : (
                          pagedOutcomes.map((learner) => {
                            const profile = formatReadingAssessmentDisplay(learner);
                            const outcomeLabel =
                              outcomeFilter === "completed"
                                ? "Completed & Exited"
                                : outcomeFilter === "continued"
                                  ? "Needs Continued Support"
                                  : "Summer Eligible";

                            return (
                              <tr
                                key={learner.studentId || learner.id}
                                className="transition-colors hover:bg-slate-50/60 dark:hover:bg-white/[0.02]"
                              >
                                <td className="px-5 py-3">
                                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                                    {learner.name}
                                  </p>
                                  <p className="text-[11px] text-slate-400">
                                    LRN: {learner.studentNumber || learner.lrn || "—"}
                                  </p>
                                </td>
                                <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-300">
                                  {learner.gradeSection || "—"}
                                </td>
                                <td className="px-5 py-3 font-semibold text-slate-800 dark:text-slate-200">
                                  {profile}
                                </td>
                                <td className="px-5 py-3">
                                  <span
                                    className={cn(
                                      "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                                      outcomeFilter === "completed"
                                        ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                                        : outcomeFilter === "continued"
                                          ? "bg-blue-50 text-blue-800 ring-1 ring-blue-200"
                                          : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                                    )}
                                  >
                                    {outcomeLabel}
                                  </span>
                                </td>
                                <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-300">
                                  {learner.aralFacilitatorName || "—"}
                                </td>
                                <td className="px-5 py-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedStudent(learner.sourceRows?.[0] || learner)
                                    }
                                    className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
                                  >
                                    <Eye size={12} />
                                    View
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t border-slate-100 px-5 py-3 dark:border-white/5">
                    <AdminTablePagination
                      page={safeOutcomesPage}
                      pageSize={OUTCOMES_PAGE_SIZE}
                      total={outcomeLearners.length}
                      onPageChange={setOutcomesPage}
                      itemLabel="outcomes"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>

      {/* CENTERED ARAL LEARNER DETAIL MODAL */}
      <AdminAralLearnerDetailPanel
        learner={selectedStudent}
        isOpen={Boolean(selectedStudent)}
        onClose={() => setSelectedStudent(null)}
        onUpdated={() => refresh({ bustCache: true })}
        currentTerm={currentTerm}
      />
    </motion.div>
  );
}
