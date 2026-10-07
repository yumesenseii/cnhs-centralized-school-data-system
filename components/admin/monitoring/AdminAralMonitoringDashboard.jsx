"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  GraduationCap,
  Download,
  ChevronDown,
  X,
  BookOpen,
  Users,
  CheckCircle2,
  AlertTriangle,
  History,
  TrendingUp,
} from "lucide-react";
import Header from "@/components/layout/Header";
import PageHelp from "@/components/shared/PageHelp";
import AppSelect from "@/components/shared/AppSelect";
import AdminAralApprovalPanel from "@/components/admin/monitoring/AdminAralApprovalPanel";
import AdminAralFacilitatorAssignPanel from "@/components/admin/monitoring/AdminAralFacilitatorAssignPanel";
import AdminAralProgressPanel from "@/components/admin/monitoring/AdminAralProgressPanel";
import AdminAralSummerEligibilityPanel from "@/components/admin/monitoring/AdminAralSummerEligibilityPanel";

import { useAdminMonitoring } from "@/hooks/teacher/useMonitoring";
import { exportAralRecommendedPdf } from "@/lib/reports/aralRecommendedPdfExport";
import { aggregateAralLearners } from "@/lib/monitoring/aralLearnerAggregation";
import { listAralBenchmarks } from "@/lib/supabase/queries/aralProgram";
import { listAralApprovals } from "@/lib/supabase/queries/aralApprovals";
import { getAralAssignmentMapByStudent } from "@/lib/supabase/queries/aralProgram";
import {
  getCachedAdminRoster,
  getCachedMonitoringRosterShell,
} from "@/lib/admin/adminRosterCache";
import { attachAralApprovals } from "@/lib/monitoring/aralApproval";
import { useAralAssessmentPeriod } from "@/hooks/useAralAssessmentPeriod";
import {
  aralPeriodLabel,
  aralPeriodShortLabel,
} from "@/lib/monitoring/assessmentTimeline";
import { cn } from "@/lib/utils";

const ARAL_ADMIN_TABS = [
  { id: "intake", label: "ARAL Referrals" },
  { id: "facilitators", label: "Facilitator Assignment" },
  { id: "assessments", label: "Intervention Progress" },
  { id: "outcomes", label: "Outcomes" },
];

const OUTCOME_FILTERS = [
  { id: "all", label: "All Outcomes" },
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

/** Prefer the most-progressed row per learner for school-wide counting. */
function uniqueLearnersPreferAral(rows = []) {
  const rank = (s) => {
    if (isCompletedLearner(s)) return 5;
    if (/approved/i.test(String(s.aralApprovalStatus || ""))) return 4;
    if (s.aralFacilitatorAssigned) return 3;
    if (/submitted/i.test(String(s.aralApprovalStatus || ""))) return 2;
    return 1;
  };
  const best = new Map();
  for (const row of rows) {
    const id = row.studentId || row.id;
    if (!id) continue;
    const prev = best.get(id);
    if (!prev || rank(row) >= rank(prev)) best.set(id, row);
  }
  return [...best.values()];
}

/** Equivalent-period outcome measures from enriched roster rows. */
function deriveOutcomeMeasures(rows = []) {
  const learners = uniqueLearnersPreferAral(rows);
  const referred = learners.filter(
    (s) =>
      approvalIs(s.aralApprovalStatus, "submitted", "approved", "returned") ||
      s.candidateStatus === "Referred to ARAL"
  );
  const approved = learners.filter((s) =>
    approvalIs(s.aralApprovalStatus, "approved")
  );
  const assessed = learners.filter(
    (s) =>
      s.philIriScore != null ||
      (s.readingLevel && s.readingLevel !== "Not Assessed")
  );
  const assigned = learners.filter((s) => s.aralFacilitatorAssigned);
  const completed = learners.filter(isCompletedLearner);
  const continued = learners.filter(
    (s) =>
      s.monitoringStatus === "Needs Further Support" ||
      s.monitoringStatus === "For Further Monitoring" ||
      s.monitoringStatus === "Referred"
  );
  const summer = learners.filter(
    (s) =>
      s.summerStatus === "Eligible" ||
      s.eosyDecision === "ARAL Summer Referral" ||
      Boolean(s.isSummerEligible)
  );
  return {
    total: learners.length,
    referred: referred.length,
    approved: approved.length,
    assessed: assessed.length,
    assigned: assigned.length,
    completed: completed.length,
    continued: continued.length,
    summer: summer.length,
  };
}

function previousSchoolYearLabel(schoolYear) {
  const match = String(schoolYear || "").match(/(\d{4})\s*[–-]\s*(\d{4})/);
  if (!match) return null;
  return `SY ${Number(match[1]) - 1}-${Number(match[2]) - 1}`;
}

export default function AdminAralMonitoringDashboard() {
  const {
    students,
    classSummaries,
    filterOptions,
    teachers,
    profile,
    loading,
    refreshing,
    error,
    refresh,
  } = useAdminMonitoring();

  const [activeTab, setActiveTab] = useState("intake");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [schoolYear, setSchoolYear] = useState("");
  const [grade, setGrade] = useState("All Grades");
  const [section, setSection] = useState("All Sections");
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [benchmarks, setBenchmarks] = useState([]);
  const [prevHistory, setPrevHistory] = useState(null);
  const {
    period: aralPeriod,
    updatePeriod,
    saving: savingPeriod,
  } = useAralAssessmentPeriod();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await listAralBenchmarks();
      if (!cancelled) setBenchmarks(result.data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeSchoolYear =
    schoolYear || filterOptions.schoolYears?.[0] || "SY 2026-2027";

  // Previous school year, same measures, live roster (equivalent periods).
  // NOTE: declared after activeSchoolYear (deps evaluate at effect call).
  useEffect(() => {
    let cancelled = false;
    setPrevHistory(null);
    (async () => {
      try {
        const prevYear = previousSchoolYearLabel(activeSchoolYear);
        if (!prevYear) {
          if (!cancelled) setPrevHistory({ unavailable: true });
          return;
        }
        const payload = await getCachedAdminRoster({ schoolYear: prevYear });
        if (payload.error) throw payload.error;
        const shell = await getCachedMonitoringRosterShell(payload.data ?? {}, {
          schoolYear: prevYear,
        });
        const [approvals, fac] = await Promise.all([
          listAralApprovals({ schoolYear: prevYear }),
          getAralAssignmentMapByStudent({ schoolYear: prevYear }),
        ]);
        let rows = attachAralApprovals(
          shell?.students ?? [],
          approvals.data ?? new Map()
        );
        const facMap = fac.data ?? new Map();
        rows = rows.map((r) => ({
          ...r,
          aralFacilitatorAssigned: facMap.has(r.studentId),
        }));
        if (!cancelled && rows.length) {
          setPrevHistory({ year: prevYear, measures: deriveOutcomeMeasures(rows) });
        } else if (!cancelled) {
          setPrevHistory({ unavailable: true });
        }
      } catch {
        if (!cancelled) setPrevHistory({ unavailable: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSchoolYear]);

  // Deduplicate student records to unique learners
  const deduplicatedStudents = useMemo(() => {
    return aggregateAralLearners(students);
  }, [students]);

  // Filter students to language/reading & selected filters
  const filteredStudents = useMemo(() => {
    return (deduplicatedStudents || []).filter((s) => {
      const q = search.toLowerCase().trim();
      if (q) {
        const hitName = (s.name || `${s.lastName || ""} ${s.firstName || ""}`)
          .toLowerCase()
          .includes(q);
        const hitLrn = String(s.studentNumber || s.lrn || "").includes(q);
        if (!hitName && !hitLrn) return false;
      }

      if (grade !== "All Grades" && s.grade !== grade && `Grade ${s.grade}` !== grade) {
        return false;
      }
      if (section !== "All Sections" && s.section !== section) {
        return false;
      }
      return true;
    });
  }, [students, search, grade, section]);

  // Executive ARAL KPIs (canonical approval labels, case-insensitive)
  const aralKpi = useMemo(() => {
    const list = filteredStudents;
    const needsReview = list.filter(
      (s) =>
        approvalIs(s.aralApprovalStatus, "submitted", "suggested") ||
        s.aralStatus === "Needs Review" ||
        s.monitoringStatus === "Needs Review" ||
        (s.recommendedSupport === "ARAL Screening" && !s.aralApprovalStatus)
    ).length;

    const activeIntervention = list.filter(
      (s) =>
        s.aralStatus === "Active Intervention" ||
        s.monitoringStatus === "Active Intervention" ||
        s.monitoringStatus === "Ongoing" ||
        s.monitoringStatus === "Progressing" ||
        Boolean(s.hasActiveAralBatch)
    ).length;

    const midlineDue = list.filter(
      (s) =>
        s.monitoringStatus === "For Midline Assessment" ||
        s.aralPhase === "Midline"
    ).length;

    const eosyDue = list.filter(
      (s) =>
        s.monitoringStatus === "For EOSY Assessment" ||
        s.aralPhase === "EOSY"
    ).length;

    const completed = list.filter(isCompletedLearner).length;

    const summerEligible = list.filter(
      (s) =>
        s.summerStatus === "Eligible" ||
        s.eosyDecision === "ARAL Summer Referral" ||
        Boolean(s.isSummerEligible)
    ).length;

    // Assessment Due follows the authoritative ARAL period.
    const approvedAwaitingBaseline = list.filter(
      (s) => isApprovedLearner(s) && s.philIriScore == null && !isCompletedLearner(s)
    ).length;
    const assessmentDue =
      aralPeriod === "MOSY" ? midlineDue : aralPeriod === "EOSY" ? eosyDue : approvedAwaitingBaseline;
    const assessmentDueLabel =
      aralPeriod === "MOSY"
        ? "Mid-Year Assessment Due"
        : aralPeriod === "EOSY"
          ? "End-of-Year Assessment Due"
          : "Beginning Assessment Due";

    const awaitingReview = list.filter((s) =>
      approvalIs(s.aralApprovalStatus, "submitted")
    ).length;

    const unassignedFacilitator = list.filter(
      (s) => isApprovedLearner(s) && !s.aralFacilitatorAssigned
    ).length;

    const continuedSupport = list.filter(
      (s) =>
        s.monitoringStatus === "Needs Further Support" ||
        s.monitoringStatus === "For Further Monitoring" ||
        s.monitoringStatus === "Referred"
    ).length;

    const referred = list.filter(
      (s) =>
        approvalIs(s.aralApprovalStatus, "submitted", "approved", "returned") ||
        s.candidateStatus === "Referred to ARAL"
    ).length;

    return {
      needsReview,
      activeIntervention,
      midlineDue,
      eosyDue,
      completed,
      summerEligible,
      assessmentDue,
      assessmentDueLabel,
      awaitingReview,
      unassignedFacilitator,
      continuedSupport,
      referred,
    };
  }, [filteredStudents, aralPeriod]);

  // Equivalent-period longitudinal comparison: live current-year measures
  // vs the same measures from the previous school year. Official benchmark
  // rows are only a labeled fallback, never silently mixed with live data.
  const historyComparison = useMemo(() => {
    const current = deriveOutcomeMeasures(students);
    let prev = null;
    if (prevHistory && !prevHistory.unavailable) {
      prev = {
        year: prevHistory.year,
        periodLabel: `${aralPeriodShortLabel(aralPeriod)} window`,
        source: "live",
        ...prevHistory.measures,
      };
    } else {
      const prevRow =
        (benchmarks ?? []).find(
          (b) => b.school_year && b.school_year !== activeSchoolYear
        ) ??
        (benchmarks ?? [])[0] ??
        null;
      if (prevRow) {
        prev = {
          year: prevRow.school_year,
          periodLabel: prevRow.period_label || "Annual Intervention Cycle",
          source: "official-reference",
          referred:
            Number(prevRow.basic_beginning ?? 0) + Number(prevRow.plus_beginning ?? 0),
          approved: null,
          assessed: null,
          assigned: null,
          active: Number(prevRow.basic_end ?? 0) + Number(prevRow.plus_end ?? 0),
          completed:
            Number(prevRow.basic_promoted ?? 0) + Number(prevRow.plus_promoted ?? 0),
          continued:
            Number(prevRow.basic_retained ?? 0) + Number(prevRow.plus_retained ?? 0),
          summer: null,
        };
      }
    }

    const eosy = aralPeriod === "EOSY";
    const keys = eosy
      ? ["referred", "approved", "assessed", "assigned", "completed", "continued", "summer"]
      : ["referred", "approved", "assessed", "assigned"];
    const labels = {
      referred: "Referred",
      approved: "Approved",
      assessed: "Assessed",
      assigned: "Assigned",
      completed: "Completed",
      continued: "Continued",
      summer: "Summer",
    };

    function direction(before, after) {
      if (before == null || after == null) return null;
      if (after > before) return "increased";
      if (after < before) return "decreased";
      return "held steady";
    }
    const sentences = [];
    if (prev) {
      const dReferred = direction(prev.referred, current.referred);
      if (dReferred) {
        sentences.push(
          `Referrals ${dReferred} compared with the same period last school year (${prev.referred} → ${current.referred}).`
        );
      }
      const dAssessed = direction(prev.assessed, current.assessed);
      if (dAssessed) {
        sentences.push(
          `More learners completed assessment compared with the same period last year (${prev.assessed} → ${current.assessed}).`
        );
      }
      if (eosy) {
        const dCompleted = direction(prev.completed, current.completed);
        if (dCompleted) {
          sentences.push(
            `Completed cases ${dCompleted} (${prev.completed} → ${current.completed}).`
          );
        }
      }
    }
    return { current, prev, keys, labels, sentences, eosy };
  }, [students, prevHistory, benchmarks, activeSchoolYear, aralPeriod]);

  async function handleExportPdf() {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      exportAralRecommendedPdf({
        learners: filteredStudents,
        schoolYear: activeSchoolYear,
        quarter: "All Terms",
        scopeLabel: "School-Wide ARAL",
        preparedBy: profile?.full_name || "Principal / Administrator",
        includeTeacherColumn: true,
      });
    } catch (err) {
      console.error(err);
      window.alert("Failed to export ARAL Endorsement Roster.");
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-6"
    >
      <Header
        breadcrumb="Home > ARAL Monitoring"
        title="ARAL Monitoring"
        description="Principal oversight of ARAL referrals, reading facilitator assignments, assessment progress by period, and summer eligibility."
        controls={
          <>
            <PageHelp
              summary="School-wide ARAL Monitoring administration under RA 12028."
              steps={[
                "Review teacher endorsements for English and Filipino reading candidates.",
                "Assign reading teachers/facilitators to approved ARAL learner cohorts.",
                "Track assessment progress from BOSY Group Screening Test (GST) to Midline and EOSY.",
                "ARAL Summer Program is strictly recorded as an Eligibility/Referral state; summer camp instruction remains outside CNHS Learn.",
                "Multi-year comparison tracks longitudinal reading intervention outcomes across consecutive school years.",
              ]}
            />

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={loading || exportingPdf}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 text-[12px] font-semibold text-blue-800 transition-colors hover:bg-blue-100 disabled:opacity-60"
            >
              {exportingPdf ? (
                <Loader2 size={13} className="animate-spin text-blue-800" />
              ) : (
                <FileText size={13} className="text-blue-800" />
              )}
              <span>Export Endorsement PDF</span>
            </button>

            <button
              type="button"
              onClick={() => refresh()}
              disabled={loading || refreshing}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw
                size={13}
                className={refreshing || loading ? "animate-spin" : ""}
              />
              <span>Refresh</span>
            </button>

            <Link
              href="/monitoring"
              title="Return to general Academic Monitoring"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              <FileSpreadsheet size={13} />
              <span>Academic Monitoring</span>
            </Link>
          </>
        }
      />

      {error ? (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

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
              label="Assessment period"
              value={aralPeriod}
              onChange={(next) => updatePeriod(next, { schoolYear: activeSchoolYear })}
              options={ARAL_PERIOD_OPTIONS}
              disabled={savingPeriod}
              className="w-[220px]"
              triggerClassName="h-9 rounded-lg text-xs font-semibold"
            />
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
              className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              <X size={12} />
              Clear
            </button>
          </div>
        </div>
      </section>

      {/* REQUIRES YOUR ATTENTION — current period only; zero and
          future-stage items stay hidden */}
      {(() => {
        const items = [
          {
            label: "referral(s) waiting for review",
            count: aralKpi.awaitingReview,
            tab: "intake",
          },
          {
            label: "approved learner(s) without assigned facilitator",
            count: aralKpi.unassignedFacilitator,
            tab: "facilitators",
          },
          {
            label: `assessment(s) due — ${aralPeriodShortLabel(aralPeriod)}`,
            count: aralKpi.assessmentDue,
            tab: "assessments",
          },
          ...(aralPeriod === "EOSY" || aralKpi.summerEligible > 0
            ? [
                {
                  label: "summer-eligible learner(s) needing placement",
                  count: aralKpi.summerEligible,
                  tab: "outcomes",
                },
              ]
            : []),
        ].filter((item) => item.count > 0);
        return (
          <div className="mb-4 rounded-xl border border-amber-200/70 bg-amber-50/40 p-4 shadow-xs">
            <div className="flex items-center gap-2 border-b border-amber-200/60 pb-2.5">
              <AlertTriangle size={15} className="text-amber-700" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Requires Your Attention
              </h3>
            </div>
            {items.length ? (
              <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.tab);
                      if (item.tab === "outcomes") setOutcomeFilter("summer");
                    }}
                    title="Open related cases"
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-amber-200/60 bg-white px-3 py-2 text-left transition hover:border-amber-300 hover:shadow-xs"
                  >
                    <span className="text-[12px] text-slate-600">
                      <strong className="font-bold tabular-nums text-slate-900">
                        {item.count}
                      </strong>{" "}
                      {item.label}
                    </span>
                    <span className="shrink-0 text-[11px] font-semibold text-cnhs-green-dark">
                      Review →
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-2.5 text-[12px] text-slate-500">
                All clear — nothing needs attention right now.
              </p>
            )}
          </div>
        );
      })()}

      {/* 5 ARAL EXECUTIVE KPIS — Assessment Due follows the current period */}
      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <GraduationCap size={16} className="text-blue-800" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              ARAL Monitoring Summary
            </h3>
          </div>
          <span className="text-[11px] font-semibold text-cnhs-green-dark">
            {aralPeriodLabel(aralPeriod)} · {activeSchoolYear}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-center">
          <div className="p-2">
            <span className="block text-[10px] font-semibold uppercase text-slate-500">
              Pending Review
            </span>
            <span className="mt-1 block text-lg font-bold text-amber-800">
              {aralKpi.needsReview}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Referrals</span>
          </div>

          <div className="p-2">
            <span className="block text-[10px] font-semibold uppercase text-slate-500">
              Active ARAL
            </span>
            <span className="mt-1 block text-lg font-bold text-blue-800">
              {aralKpi.activeIntervention}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">In Sessions</span>
          </div>

          <div className="p-2">
            <span className="block text-[10px] font-semibold uppercase text-slate-500">
              {aralKpi.assessmentDueLabel}
            </span>
            <span className="mt-1 block text-lg font-bold text-slate-800">
              {aralKpi.assessmentDue}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">{aralPeriodShortLabel(aralPeriod)}</span>
          </div>

          <div className="p-2">
            <span className="block text-[10px] font-semibold uppercase text-slate-500">
              Completed
            </span>
            <span className="mt-1 block text-lg font-bold text-emerald-700">
              {aralKpi.completed}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Exited / Promoted</span>
          </div>

          <div className="p-2">
            <span className="block text-[10px] font-semibold uppercase text-slate-500">
              Summer Eligible
            </span>
            <span className="mt-1 block text-lg font-bold text-slate-800">
              {aralKpi.summerEligible}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Referred Roster</span>
          </div>
        </div>
      </div>

      {/* 5 WORKFLOW TABS (operational work comes before longitudinal analytics) */}
      <div
        className="mb-3 flex items-end gap-3 overflow-x-auto border-b border-slate-200"
        role="tablist"
        aria-label="Principal ARAL monitoring tabs"
      >
        {ARAL_ADMIN_TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "-mb-px shrink-0 cursor-pointer border-b-2 px-1 pb-2.5 text-xs transition-colors",
                selected
                  ? "border-cnhs-green font-bold text-cnhs-green-dark"
                  : "border-transparent font-medium text-slate-500 hover:text-slate-700"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT PANELS */}
      <div role="tabpanel">
        {activeTab === "intake" ? (
          <AdminAralApprovalPanel
            students={filteredStudents}
            onChanged={() => refresh({ bustCache: true })}
            onViewStudent={setSelectedStudent}
          />
        ) : null}

        {activeTab === "facilitators" ? (
          <AdminAralFacilitatorAssignPanel
            students={deduplicatedStudents}
            onChanged={() => refresh()}
          />
        ) : null}

        {activeTab === "assessments" ? (
          <AdminAralProgressPanel
            students={deduplicatedStudents}
            onViewStudent={setSelectedStudent}
          />
        ) : null}

        {activeTab === "outcomes" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Outcome filters">
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
                      "inline-flex h-8 cursor-pointer items-center rounded-full px-3 text-[11px] font-semibold transition-colors",
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
                students={deduplicatedStudents}
                onViewStudent={setSelectedStudent}
                outcomeFilter={outcomeFilter}
              />
            )}
          </div>
        ) : null}
      </div>

      {/* HISTORICAL TRENDS — below operational work, equivalent periods */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-1.5">
            <History size={14} className="text-cnhs-green-dark" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Historical Trends
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            {historyComparison.prev?.year ?? "Previous year"} {historyComparison.prev?.periodLabel ?? ""} · {aralPeriodShortLabel(aralPeriod)} window
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <span className="font-bold text-slate-900 font-mono text-[13px]">
                {historyComparison.prev?.year ?? "Previous year"}
              </span>
              <span className="text-[10px] font-semibold uppercase text-slate-400">
                {historyComparison.prev
                  ? historyComparison.prev.source === "live"
                    ? "Same period"
                    : "Official reference"
                  : "Not available"}
              </span>
            </div>
            <div className={`mt-2.5 grid ${historyComparison.eosy ? "grid-cols-7" : "grid-cols-4"} divide-x divide-slate-200 text-center`}>
              {historyComparison.keys.map((key) => (
                <div key={key} className="px-1">
                  <span className="text-[10px] font-medium text-slate-500 block">{historyComparison.labels[key]}</span>
                  <span className="mt-1 text-base font-bold text-slate-800 block">
                    {historyComparison.prev?.[key] ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-cnhs-green-dark/20 bg-cnhs-green-soft/20 p-3">
            <div className="flex items-center justify-between border-b border-cnhs-green-dark/10 pb-2">
              <span className="font-bold text-slate-900 font-mono text-[13px]">{activeSchoolYear}</span>
              <span className="text-[10px] font-semibold uppercase text-cnhs-green-dark">Live roster</span>
            </div>
            <div className={`mt-2.5 grid ${historyComparison.eosy ? "grid-cols-7" : "grid-cols-4"} divide-x divide-slate-200 text-center`}>
              {historyComparison.keys.map((key) => (
                <div key={key} className="px-1">
                  <span className="text-[10px] font-medium text-slate-500 block">{historyComparison.labels[key]}</span>
                  <span className="mt-1 text-base font-bold text-slate-800 block">
                    {historyComparison.current[key] ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 rounded border border-slate-100 bg-slate-50/70 p-2.5 text-[11px] text-slate-600 flex items-start gap-2">
          <TrendingUp size={14} className="text-emerald-600 shrink-0 mt-0.5" />
          <span>
            {historyComparison.sentences.length ? (
              historyComparison.sentences.map((line, i) => (
                <span key={i} className="block">{line}</span>
              ))
            ) : (
              <span>Previous-year same-period reference is not available yet. Current figures update live from the roster.</span>
            )}
            {historyComparison.prev && aralPeriod !== "EOSY" ? (
              <span className="mt-1 block text-slate-400">
                Final outcomes arrive with the End-of-Year Assessment.
              </span>
            ) : null}
          </span>
        </div>
      </div>

      {/* Centralized Learner Profile View */}
      {selectedStudent ? (
        <InterventionDetailPanel
          learner={selectedStudent}
          canWrite={false}
          onClose={() => setSelectedStudent(null)}
        />
      ) : null}
    </motion.div>
  );
}
