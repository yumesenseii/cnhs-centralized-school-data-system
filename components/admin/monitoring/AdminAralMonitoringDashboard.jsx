"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  RefreshCw,
  X,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  BookOpen,
  TrendingUp,
  Download,
} from "lucide-react";
import Header from "@/components/layout/Header";
import PageHelp from "@/components/shared/PageHelp";
import AppSelect from "@/components/shared/AppSelect";
import AdminTablePagination from "@/components/shared/AdminTablePagination";
import AdminAralLearnerModal, {
  getSimplifiedAralStatus,
} from "@/components/admin/monitoring/AdminAralLearnerModal";
import LearnerName from "@/components/shared/LearnerName";

import { useAdminMonitoring } from "@/hooks/teacher/useMonitoring";
import {
  aggregateAralLearners,
  computeAralMetrics,
} from "@/lib/monitoring/aralLearnerAggregation";
import {
  aralPeriodLabel,
  getAralTermDisplay,
} from "@/lib/monitoring/assessmentTimeline";
import { formatGradeSection } from "@/lib/monitoring/philIriEvaluation";
import { useAralAssessmentPeriod } from "@/hooks/useAralAssessmentPeriod";
import { cn } from "@/lib/utils";
import ExportAralReportModal from "@/components/aral/ExportAralReportModal";
import {
  computeSchoolReadingProfileForm2,
  computePhilIriSchoolSummaryForm5,
} from "@/lib/reports/aralReportsAggregation";

const ADMIN_READING_TABS = [
  { id: "overview", label: "Overview" },
  { id: "records", label: "Learner Records" },
];

const ARAL_PERIOD_OPTIONS = [
  { value: "BOSY", label: "Beginning Assessment (BOSY)" },
  { value: "MOSY", label: "Mid-Year Assessment (MOSY)" },
  { value: "EOSY", label: "End-of-Year Assessment (EOSY)" },
];

const RECORDS_PAGE_SIZE = 10;
const EOSY_PAGE_SIZE = 10;

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

  // Active Tab: 'overview' | 'records'
  const [activeTab, setActiveTab] = useState("overview");

  // Reduced Filter state for Principal oversight
  const [recordsPage, setRecordsPage] = useState(1);
  const [eosyPage, setEosyPage] = useState(1);
  const [schoolYear, setSchoolYear] = useState("");
  const [grade, setGrade] = useState("All Grades");
  const [language, setLanguage] = useState("All Languages");
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const {
    period: aralPeriod,
    updatePeriod,
    saving: savingPeriod,
  } = useAralAssessmentPeriod();

  const activeSchoolYear =
    schoolYear || filterOptions.schoolYears?.[0] || "SY 2026-2027";

  // 1. Authoritative aggregation of all language reading cases
  const allReadingLearners = useMemo(() => {
    return aggregateAralLearners(students, {
      schoolYear: activeSchoolYear,
      role: "principal",
      scope: "school-wide",
    });
  }, [students, activeSchoolYear]);

  // Phil-IRI Form 2 & Form 5 Data
  const form2Data = useMemo(() => {
    return computeSchoolReadingProfileForm2(allReadingLearners, {
      schoolYear: activeSchoolYear,
      language,
      aralPeriod,
    });
  }, [allReadingLearners, activeSchoolYear, language, aralPeriod]);

  const form5Data = useMemo(() => {
    return computePhilIriSchoolSummaryForm5(allReadingLearners, {
      schoolYear: activeSchoolYear,
      language,
      aralPeriod,
    });
  }, [allReadingLearners, activeSchoolYear, language, aralPeriod]);

  // 2. Pure reading assessment metrics for top KPI cards
  const metrics = useMemo(() => {
    return computeAralMetrics(allReadingLearners);
  }, [allReadingLearners]);

  // Derived 4 Principal Oversight Summary Counts
  const oversightSummary = useMemo(() => {
    const total = metrics.total;
    const completed = metrics.totalCompleteCount;
    const needsFollowUp =
      metrics.needsIndividualAssessmentCount +
      metrics.forReviewCount +
      metrics.absentCount;
    const pending = Math.max(
      0,
      metrics.waitingForAssessmentCount - metrics.absentCount
    );

    return {
      total,
      completed,
      needsFollowUp,
      pending,
    };
  }, [metrics]);

  // 3. Reading Profile Distribution Breakdown
  const profileDistribution = useMemo(() => {
    let atGrade = 0;
    let independent = 0;
    let instructional = 0;
    let frustration = 0;

    for (const l of allReadingLearners) {
      if (l.currentStepKey === "screening_complete_at_grade") {
        atGrade++;
      } else if (l.readingLevel === "Independent") {
        independent++;
      } else if (l.readingLevel === "Instructional") {
        instructional++;
      } else if (l.readingLevel === "Frustration") {
        frustration++;
      }
    }

    const assessedTotal = metrics.totalCompleteCount || 1;

    return {
      atGrade,
      independent,
      instructional,
      frustration,
      atGradePct: Math.round((atGrade / assessedTotal) * 100) || 0,
      independentPct: Math.round((independent / assessedTotal) * 100) || 0,
      instructionalPct: Math.round((instructional / assessedTotal) * 100) || 0,
      frustrationPct: Math.round((frustration / assessedTotal) * 100) || 0,
    };
  }, [allReadingLearners, metrics.totalCompleteCount]);

  // 4. Grade & Section summary breakdown
  const sectionSummaries = useMemo(() => {
    const map = new Map();

    for (const l of allReadingLearners) {
      const g = l.grade ? `Grade ${l.grade}` : "Grade 7";
      const sec = l.section || "General";
      const lang = l.language || l.subject || "English";
      const key = `${g}_${sec}_${lang}`;

      if (!map.has(key)) {
        map.set(key, {
          grade: g,
          section: sec,
          language: lang,
          total: 0,
          assessed: 0,
          needsIra: 0,
          atGrade: 0,
          instructional: 0,
          frustration: 0,
        });
      }

      const item = map.get(key);
      item.total++;

      if (
        l.currentStepKey === "screening_complete_at_grade" ||
        l.currentStepKey === "assessment_complete"
      ) {
        item.assessed++;
      }
      if (l.currentStepKey === "needs_individual_assessment") {
        item.needsIra++;
      }
      if (l.currentStepKey === "screening_complete_at_grade") {
        item.atGrade++;
      } else if (l.readingLevel === "Instructional") {
        item.instructional++;
      } else if (l.readingLevel === "Frustration") {
        item.frustration++;
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const gComp = a.grade.localeCompare(b.grade);
      if (gComp !== 0) return gComp;
      return a.section.localeCompare(b.section);
    });
  }, [allReadingLearners]);

  // 5. Filtered list for the Records Tab (Minimal Principal Filters: Search, School Year, Grade, Language)
  const filteredRecords = useMemo(() => {
    return allReadingLearners.filter((row) => {
      // Search
      if (search) {
        const q = search.toLowerCase().trim();
        const nameHit = (row.name || `${row.firstName || ""} ${row.lastName || ""}`)
          .toLowerCase()
          .includes(q);
        const lrnHit = String(row.studentNumber || row.lrn || "")
          .toLowerCase()
          .includes(q);
        const secHit = String(row.gradeSection || "")
          .toLowerCase()
          .includes(q);
        if (!nameHit && !lrnHit && !secHit) return false;
      }

      // Grade
      if (grade !== "All Grades") {
        const cleanTargetGrade = String(grade).replace(/^Grade\s+/i, "").trim();
        const cleanRowGrade = String(row.grade || "").replace(/^Grade\s+/i, "").trim();
        if (cleanRowGrade !== cleanTargetGrade) return false;
      }

      // Language
      if (language !== "All Languages") {
        if (String(row.language || "").toLowerCase() !== language.toLowerCase()) {
          return false;
        }
      }

      return true;
    });
  }, [allReadingLearners, search, grade, language]);

  // Records pagination
  const recordsTotalPages = Math.max(1, Math.ceil(filteredRecords.length / RECORDS_PAGE_SIZE));
  const safeRecordsPage = Math.min(Math.max(recordsPage, 1), recordsTotalPages);
  const pagedRecords = useMemo(() => {
    const start = (safeRecordsPage - 1) * RECORDS_PAGE_SIZE;
    return filteredRecords.slice(start, start + RECORDS_PAGE_SIZE);
  }, [filteredRecords, safeRecordsPage]);

  // 6. End-of-Year Cases for Further Review
  const eosyReviewCases = useMemo(() => {
    return allReadingLearners.filter((l) => {
      return (
        l.currentStepKey === "for_review" ||
        (aralPeriod === "EOSY" &&
          (l.readingLevel === "Frustration" || l.readingLevel === "Instructional"))
      );
    });
  }, [allReadingLearners, aralPeriod]);

  const eosyTotalPages = Math.max(1, Math.ceil(eosyReviewCases.length / EOSY_PAGE_SIZE));
  const safeEosyPage = Math.min(Math.max(eosyPage, 1), eosyTotalPages);
  const pagedEosyCases = useMemo(() => {
    const start = (safeEosyPage - 1) * EOSY_PAGE_SIZE;
    return eosyReviewCases.slice(start, start + EOSY_PAGE_SIZE);
  }, [eosyReviewCases, safeEosyPage]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="space-y-4 pb-6"
    >
      <Header
        breadcrumb="Home > ARAL Reading Assessment"
        title="ARAL Reading Assessment"
        description="Principal oversight of school-wide reading assessment completion, reading profiles, and term milestones."
        controls={
          <>
            <PageHelp
              summary="School-wide reading assessment monitoring and oversight."
              steps={[
                "English and Filipino Subject Teachers administer reading assessments for all enrolled students.",
                "Principal monitors completion, reading profile distribution, and term-by-term progress.",
                "End-of-Year cases requiring further review are flagged for school head oversight.",
                "CNHS LEARN does not manage summer intervention classes or assign facilitators.",
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
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:border-[#246f54]/40 hover:bg-emerald-50/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-[var(--card)] dark:text-slate-200"
            >
              <RefreshCw
                size={13}
                className={refreshing || loading ? "animate-spin" : ""}
              />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setExportModalOpen(true)}
              disabled={loading || allReadingLearners.length === 0}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:border-[#246f54]/40 hover:bg-emerald-50/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-[var(--card)] dark:text-slate-200"
            >
              <Download size={13} className="text-[#246f54]" />
              <span>Export Report</span>
            </button>
          </>
        }
      />

      {error ? (
        <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-xs text-red-700 shadow-xs">
          <div>
            <p className="font-semibold">Unable to load reading monitoring data</p>
            <p className="mt-0.5 text-[11px] text-red-600">
              Please check your connection and try again.
            </p>
          </div>
          <button
            type="button"
            onClick={() => refresh({ bustCache: true })}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50"
          >
            <RefreshCw size={12} />
            <span>Retry</span>
          </button>
        </div>
      ) : null}

      {/* 1. PRINCIPAL OVERSIGHT SUMMARY CARDS (4 NEUTRAL WHITE CARDS) */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Learners */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Learners
            </p>
            <BookOpen size={16} className="text-slate-400" />
          </div>
          <p className="mt-2 text-3xl font-bold leading-none tracking-tight text-slate-900 dark:text-slate-100">
            {oversightSummary.total}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            Enrolled in English & Filipino classes
          </p>
        </div>

        {/* Card 2: Completed */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Completed
            </p>
            <CheckCircle2 size={16} className="text-slate-400" />
          </div>
          <p className="mt-2 text-3xl font-bold leading-none tracking-tight text-slate-900 dark:text-slate-100">
            {oversightSummary.completed}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
            Screening complete or reading profile recorded
          </p>
        </div>

        {/* Card 3: Needs Follow-Up */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Needs Follow-Up
            </p>
            <AlertCircle size={16} className="text-amber-500/80" />
          </div>
          <p className="mt-2 text-3xl font-bold leading-none tracking-tight text-slate-900 dark:text-slate-100">
            {oversightSummary.needsFollowUp}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            Awaiting assessment, reschedule, or review
          </p>
        </div>

        {/* Card 4: Pending */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Pending
            </p>
            <Clock size={16} className="text-slate-400" />
          </div>
          <p className="mt-2 text-3xl font-bold leading-none tracking-tight text-slate-900 dark:text-slate-100">
            {oversightSummary.pending}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            Awaiting initial screening
          </p>
        </div>
      </section>

      {/* 2 OVERSIGHT TABS: Overview & Learner Records */}
      <div
        className="flex items-end gap-5 overflow-x-auto border-b border-slate-200 dark:border-white/10"
        role="tablist"
        aria-label="Principal reading assessment tabs"
      >
        {ADMIN_READING_TABS.map((tab) => {
          const selected = activeTab === tab.id;
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
                  ? "border-cnhs-green-dark font-semibold text-cnhs-green-dark dark:border-emerald-400 dark:text-emerald-400"
                  : "border-transparent font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              <span>{tab.label}</span>
              {tab.id === "overview" && eosyReviewCases.length > 0 && (
                <span className="rounded-md border border-rose-200/80 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-300">
                  {eosyReviewCases.length} for review
                </span>
              )}
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
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Reading Profile Distribution Summary */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[var(--card)] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Reading Profile Distribution
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Breakdown of evaluated reading profiles across English and Filipino
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {metrics.totalCompleteCount} Total Assessed
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {/* At Grade Level */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      At Grade Level
                    </span>
                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {profileDistribution.atGrade}
                    </p>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      {profileDistribution.atGradePct}% of assessed
                    </span>
                  </div>

                  {/* Independent */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Independent
                    </span>
                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {profileDistribution.independent}
                    </p>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      {profileDistribution.independentPct}% of assessed
                    </span>
                  </div>

                  {/* Instructional */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Instructional
                    </span>
                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {profileDistribution.instructional}
                    </p>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      {profileDistribution.instructionalPct}% of assessed
                    </span>
                  </div>

                  {/* Frustration */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                      Frustration
                    </span>
                    <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {profileDistribution.frustration}
                    </p>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                      {profileDistribution.frustrationPct}% of assessed
                    </span>
                  </div>
                </div>
              </div>

              {/* Grade & Section Summary Table */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
                <div className="border-b border-slate-100 px-4 py-3 dark:border-white/5">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Grade & Section Assessment Progress
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Completion and reading profile counts grouped by class section
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50/75 font-bold uppercase tracking-wider text-[10px] text-slate-400 dark:border-white/5 dark:bg-slate-800/40">
                      <tr>
                        <th className="px-4 py-3">Grade & Section</th>
                        <th className="px-4 py-3">Language</th>
                        <th className="px-4 py-3 text-center">Enrolled</th>
                        <th className="px-4 py-3 text-center">Assessed</th>
                        <th className="px-4 py-3 text-center">Needs Assessment</th>
                        <th className="px-4 py-3 text-center">At Grade Level</th>
                        <th className="px-4 py-3 text-center">Instructional</th>
                        <th className="px-4 py-3 text-center">Frustration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {sectionSummaries.length > 0 ? (
                        sectionSummaries.map((s, idx) => (
                          <tr
                            key={`${s.grade}_${s.section}_${s.language}_${idx}`}
                            className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                              {s.grade} — {s.section}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-600 dark:text-slate-400">
                              {s.language}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-white">
                              {s.total}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-semibold text-[#246f54] dark:text-emerald-400">
                                {s.assessed}
                              </span>
                              <span className="text-[10px] text-slate-400 ml-1">
                                ({s.total > 0 ? Math.round((s.assessed / s.total) * 100) : 0}%)
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-amber-700 dark:text-amber-400">
                              {s.needsIra}
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-emerald-700 dark:text-emerald-400">
                              {s.atGrade}
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-amber-700 dark:text-amber-400">
                              {s.instructional}
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-rose-700 dark:text-rose-400">
                              {s.frustration}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                            No class sections currently recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* School Year Term Progress Overview */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[var(--card)] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      School-Year Assessment Progression
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Reading assessment milestones across Beginning (BOSY), Mid-Year (MOSY), and End-of-Year (EOSY)
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-[#246f54] border border-emerald-200">
                    <TrendingUp size={13} />
                    Active Period: {getAralTermDisplay(aralPeriod)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-white/10 dark:bg-slate-800/40 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Term 1 · Beginning (BOSY)
                    </span>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">
                      Baseline Universal Screening
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      All learners take GST. Learners scoring &lt;28 receive individual reading assessment.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-white/10 dark:bg-slate-800/40 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Term 2 · Middle (MOSY)
                    </span>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">
                      Midyear Reassessment
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Subject teachers update reading assessments to measure growth against baseline.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-white/10 dark:bg-slate-800/40 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Term 3 · End (EOSY)
                    </span>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">
                      Final Reading Outcome
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Final outcomes recorded. Persistent reading difficulties are flagged for school head review.
                    </p>
                  </div>
                </div>
              </div>

              {/* End-of-Year Cases for Further Review (Oversight Summary) */}
              {eosyReviewCases.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
                  <div className="border-b border-slate-100 p-4 dark:border-white/5 space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Cases Requiring School Head Review ({eosyReviewCases.length})
                      </h3>
                      <button
                        type="button"
                        onClick={() => setActiveTab("records")}
                        className="text-xs font-semibold text-cnhs-green-dark hover:underline cursor-pointer dark:text-emerald-400"
                      >
                        View in Records →
                      </button>
                    </div>
                    <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
                      Learners whose reading assessment indicates remaining difficulty across terms.
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50/75 font-bold uppercase tracking-wider text-[10px] text-slate-400 dark:border-white/5 dark:bg-slate-800/40">
                        <tr>
                          <th className="px-4 py-3">Learner</th>
                          <th className="px-4 py-3">Grade & Section</th>
                          <th className="px-4 py-3">Language</th>
                          <th className="px-4 py-3">Current Profile</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {pagedEosyCases.map((row) => (
                          <tr
                            key={`eosy_${row.studentId || row.id}_${row.language}`}
                            className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {row.name}
                              </div>
                              <div className="font-mono text-[10px] text-slate-400">
                                {row.lrn || row.studentNumber || "—"}
                              </div>
                            </td>

                            <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                              {row.gradeSectionDisplay || formatGradeSection(row.grade, row.section)}
                            </td>

                            <td className="px-4 py-3">
                              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-white/5 dark:text-slate-300">
                                {row.language || row.subject || "English"}
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              <span className="font-bold text-rose-700 dark:text-rose-400">
                                {row.readingLevel || "Frustration"}
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              <span className="inline-flex rounded-md bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-800 border border-rose-200">
                                For Further Review
                              </span>
                            </td>

                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedStudent(row)}
                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
                              >
                                <Eye size={12} className="text-slate-400" />
                                <span>View Record</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {eosyReviewCases.length > EOSY_PAGE_SIZE && (
                    <div className="border-t border-slate-100 px-4 py-3 dark:border-white/5">
                      <AdminTablePagination
                        page={safeEosyPage}
                        pageSize={EOSY_PAGE_SIZE}
                        total={eosyReviewCases.length}
                        onPageChange={setEosyPage}
                        itemLabel="cases"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LEARNER RECORDS (SIMPLIFIED 6-COLUMN TABLE + MINIMAL FILTERS) */}
          {activeTab === "records" && (
            <div className="space-y-4">
              {/* Reduced Filter Bar: Search, School Year, Grade, Language, Reset */}
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                  <input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setRecordsPage(1);
                    }}
                    placeholder="Search candidate name, LRN, or section…"
                    className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#246f54] dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <AppSelect
                      label="School year"
                      value={schoolYear || activeSchoolYear}
                      onChange={(val) => {
                        setSchoolYear(val);
                        setRecordsPage(1);
                      }}
                      options={filterOptions.schoolYears}
                      className="w-[144px]"
                      triggerClassName="h-9 rounded-lg text-xs font-medium"
                    />
                    <AppSelect
                      label="Grade"
                      value={grade}
                      onChange={(val) => {
                        setGrade(val);
                        setRecordsPage(1);
                      }}
                      options={filterOptions.grades}
                      className="w-[128px]"
                      triggerClassName="h-9 rounded-lg text-xs font-medium"
                    />
                    <AppSelect
                      label="Language"
                      value={language}
                      onChange={(val) => {
                        setLanguage(val);
                        setRecordsPage(1);
                      }}
                      options={["All Languages", "English", "Filipino"]}
                      className="w-[130px]"
                      triggerClassName="h-9 rounded-lg text-xs font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setGrade("All Grades");
                        setLanguage("All Languages");
                        setRecordsPage(1);
                      }}
                      className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                    >
                      <X size={13} />
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              {/* Simplified 6-Column Main Table */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] text-left text-xs">
                    <thead className="border-b border-slate-100 bg-slate-50/75 font-bold uppercase tracking-wider text-[10px] text-slate-400 dark:border-white/5 dark:bg-slate-800/40">
                      <tr>
                        <th className="px-4 py-3">Learner</th>
                        <th className="px-4 py-3">Grade & Section</th>
                        <th className="px-4 py-3">Language</th>
                        <th className="px-4 py-3">Current Stage</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {pagedRecords.length > 0 ? (
                        pagedRecords.map((row) => {
                          const statusInfo = getSimplifiedAralStatus(row);
                          const stageLabel = aralPeriodLabel(
                            row.assessmentPeriod || aralPeriod
                          );

                          return (
                            <tr
                              key={`${row.studentId || row.id}_${row.language}`}
                              className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors"
                            >
                              {/* 1. Learner */}
                              <td className="px-4 py-3">
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  <LearnerName
                                    firstName={row.firstName}
                                    lastName={row.lastName}
                                    name={row.name}
                                  />
                                </div>
                                <div className="mt-0.5 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                  {row.lrn || row.studentNumber || "—"}
                                </div>
                              </td>

                              {/* 2. Grade & Section */}
                              <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                                {row.gradeSectionDisplay || formatGradeSection(row.grade, row.section)}
                              </td>

                              {/* 3. Language */}
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-white/5 dark:text-slate-300">
                                  {row.language || row.subject || "English"}
                                </span>
                              </td>

                              {/* 4. Current Stage */}
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-medium text-[11px]">
                                {stageLabel}
                              </td>

                              {/* 5. Status (Simplified 6 standard statuses) */}
                              <td className="px-4 py-3">
                                <span
                                  className={cn(
                                    "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border",
                                    statusInfo.badgeClass
                                  )}
                                >
                                  {statusInfo.label}
                                </span>
                              </td>

                              {/* 6. Action */}
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => setSelectedStudent(row)}
                                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
                                >
                                  <Eye size={12} className="text-slate-400" />
                                  <span>View Record</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                            No learner reading records match your criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-slate-100 px-4 py-3 dark:border-white/5">
                  <AdminTablePagination
                    page={safeRecordsPage}
                    pageSize={RECORDS_PAGE_SIZE}
                    total={filteredRecords.length}
                    onPageChange={setRecordsPage}
                    itemLabel="learners"
                  />
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* VIEW-ONLY SIMPLIFIED LEARNER READING RECORD MODAL */}
      <AdminAralLearnerModal
        isOpen={Boolean(selectedStudent)}
        onClose={() => setSelectedStudent(null)}
        learner={selectedStudent}
      />

      {/* EXPORT ARAL & PHIL-IRI READING REPORT MODAL */}
      <ExportAralReportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        schoolYear={activeSchoolYear}
        period={aralPeriod}
        language={language}
        scopeLabel={
          grade !== "All Grades"
            ? `${grade} Reading Assessment`
            : "School-Wide Reading Assessment"
        }
        learners={allReadingLearners}
        form2Data={form2Data}
        form5Data={form5Data}
        teacherName="School Principal"
        initialReportType="form2"
        allowFormSelection={true}
      />
    </motion.div>
  );
}
