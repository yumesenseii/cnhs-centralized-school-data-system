"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ChevronDown,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import Header from "@/components/layout/Header";
import PageHelp from "@/components/shared/PageHelp";
import AdminGradeProgressMatrix from "@/components/admin/monitoring/AdminGradeProgressMatrix";
import AdminMonitoredStudentsPanel from "@/components/admin/monitoring/AdminMonitoredStudentsPanel";
import {
  Pill,
  RiskPill,
  interventionStyles,
  monitoringStatusStyles,
} from "@/components/teacher/monitoring/shared";
import { useAdminMonitoring } from "@/hooks/teacher/useMonitoring";
import { groupMonitoredStudentsForAdmin } from "@/lib/teacher/monitoringMappers";
import {
  MONITORING_STATUS,
  RECOMMENDATION,
  RISK_LEVEL,
  normalizeRecommendationType,
  normalizeRiskLevel,
} from "@/lib/monitoring/recommendations";
import { cn } from "@/lib/utils";
import AppSelect from "@/components/shared/AppSelect";

const MONITORING_TABS = [
  { id: "matrix", label: "School & Sections" },
  { id: "students", label: "Learners Needing Review" },
];

function DetailPanel({ detail, learner, loading, onClose }) {
  if (!detail && !learner && !loading) return null;

  const activeName = detail?.name ?? learner?.name ?? "Learner Record";
  const activeNumber =
    detail?.studentNumber ?? learner?.studentNumber ?? "";
  const activeSection =
    detail?.gradeSection ?? learner?.gradeSection ?? learner?.section ?? "";
  const activeRisk = detail?.riskLevel ?? learner?.riskLevel ?? "—";
  const activeRecommendation =
    detail?.recommendation ?? learner?.recommendation ?? "—";
  const activeStatus =
    detail?.monitoringStatus ?? learner?.monitoringStatus ?? "—";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-[1px] sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="relative z-10 flex max-h-[75vh] w-[min(900px,94vw)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[var(--card)]">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-3.5 dark:border-white/5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Academic Monitoring Record
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
              {activeName}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {activeNumber ? `${activeNumber} · ` : ""}
              {activeSection}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <RiskPill value={activeRisk} />
            <Pill value={activeRecommendation} styles={interventionStyles} />
            <Pill value={activeStatus} styles={monitoringStatusStyles} />
          </div>

          {loading && !detail ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin text-cnhs-green-dark" />
              Loading academic details…
            </div>
          ) : detail ? (
            <>
              {/* Student Academic Info */}
              <section className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 dark:border-white/5 dark:bg-white/[0.02]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Academic Information
                </p>
                <div className="mt-2 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <div>
                    <span className="text-slate-400">Adviser:</span>
                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                      {detail.adviser || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Teacher:</span>
                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                      {detail.teacher || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Subject Grade:</span>
                    <p className="font-bold text-slate-800 dark:text-slate-100">
                      {detail.classSubjectGrade ?? detail.generalAverage ?? "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Period:</span>
                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                      {detail.schoolYear} · {detail.quarter}
                    </p>
                  </div>
                </div>
              </section>

              {/* Subject Grades */}
              <section>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Subject Grades
                </p>
                <div className="mt-1.5 overflow-hidden rounded-xl border border-slate-100 dark:border-white/5">
                  <table className="w-full text-left text-xs">
                    <tbody>
                      {detail.subjectGrades && detail.subjectGrades.length ? (
                        detail.subjectGrades.map((row) => (
                          <tr
                            key={`${row.subject}-${row.grade}`}
                            className="border-t border-slate-100 first:border-t-0 dark:border-white/5"
                          >
                            <td className="px-3.5 py-2 text-slate-700 dark:text-slate-300">
                              {row.subject}
                            </td>
                            <td className="px-3.5 py-2 text-right font-bold text-slate-900 dark:text-slate-100">
                              {row.grade ?? "—"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-3.5 py-3 text-center text-slate-400">
                            No subject grades recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* System Academic Recommendation */}
              {detail.recommendationReason ? (
                <section>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Academic Recommendation
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {detail.recommendationReason}
                  </p>
                </section>
              ) : null}

              {/* Weekly Progress History */}
              <section>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Weekly Progress History (View-Only)
                </p>
                <div className="mt-2 space-y-2">
                  {detail.records && detail.records.length ? (
                    detail.records.map((record) => (
                      <div
                        key={record.id}
                        className="rounded-xl border border-slate-100 bg-white p-3 shadow-2xs dark:border-white/5 dark:bg-white/[0.02]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {record.weekLabel ? `${record.weekLabel} · ` : ""}
                            {record.observationDate}
                          </p>
                          <Pill
                            value={record.monitoringStatus}
                            styles={monitoringStatusStyles}
                          />
                        </div>
                        {record.studentProgress ? (
                          <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Progress: {record.studentProgress}
                          </p>
                        ) : null}
                        {record.interventionGiven ? (
                          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                            {record.interventionGiven}
                          </p>
                        ) : null}
                        {record.teacherRemarks ? (
                          <p className="mt-0.5 text-xs text-slate-500 italic dark:text-slate-400">
                            "{record.teacherRemarks}"
                          </p>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="py-2 text-center text-xs text-slate-400">
                      No weekly progress history recorded yet.
                    </p>
                  )}
                </div>
              </section>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end border-t border-slate-100 px-5 py-3 dark:border-white/5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminMonitoringPage() {
  const searchParams = useSearchParams();
  const {
    students,
    classSummaries,
    filterOptions,
    loading,
    refreshing,
    error,
    refresh,
    selectedDetail,
    selectedLearner,
    detailLoading,
    openStudent,
    closeStudent,
  } = useAdminMonitoring();

  const [search, setSearch] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [quarter, setQuarter] = useState("All Terms");
  const [grade, setGrade] = useState("All Grades");
  const [section, setSection] = useState("All Sections");
  const [activeTab, setActiveTab] = useState("matrix");

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "matrix" || tabParam === "students") {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const activeSchoolYear =
    schoolYear || filterOptions.schoolYears[0] || "SY 2026-2027";

  // Filter students based on active School Year, Term, Grade, Section, and Search
  const filtered = useMemo(() => {
    return students.filter((learner) => {
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        learner.name.toLowerCase().includes(query) ||
        learner.studentNumber.toLowerCase().includes(query) ||
        learner.section?.toLowerCase().includes(query) ||
        learner.gradeSection?.toLowerCase().includes(query);
      const matchesYear =
        !schoolYear || learner.schoolYear === schoolYear;
      const matchesQuarter =
        quarter === "All Terms" || learner.quarter === quarter;
      const matchesGrade =
        grade === "All Grades" || learner.grade === grade;
      const matchesSection =
        section === "All Sections" || learner.section === section;

      return (
        matchesSearch &&
        matchesYear &&
        matchesQuarter &&
        matchesGrade &&
        matchesSection
      );
    });
  }, [students, search, schoolYear, quarter, grade, section]);

  // Group filtered student records into unique learners per section (no duplicates)
  const dedupedMonitored = useMemo(
    () => groupMonitoredStudentsForAdmin(filtered, classSummaries),
    [filtered, classSummaries]
  );

  // Compute the 3 Top Summary counts strictly from deduplicated learners
  // Reusing confirmed CNHS risk classification / ML bands without inventing thresholds
  const summaryCounts = useMemo(() => {
    let immediateReview = 0;
    let needsMonitoring = 0;
    let underSupport = 0;

    for (const learner of dedupedMonitored) {
      const isHigh =
        normalizeRiskLevel(learner.riskLevel) === RISK_LEVEL.HIGH ||
        learner.riskPriority === true;
      const isMod =
        normalizeRiskLevel(learner.riskLevel) === RISK_LEVEL.MODERATE;
      const hasSupport =
        learner.recommendation === RECOMMENDATION.REMEDIATION ||
        learner.classroomRemedialRecommended ||
        learner.monitoringStatus === MONITORING_STATUS.ONGOING;

      if (isHigh) {
        immediateReview++;
      } else if (isMod || learner.recommendation === "Classroom Monitoring") {
        needsMonitoring++;
      }

      if (hasSupport) {
        underSupport++;
      }
    }

    return { immediateReview, needsMonitoring, underSupport };
  }, [dedupedMonitored]);

  function clearFilters() {
    setSearch("");
    setSchoolYear("");
    setQuarter("All Terms");
    setGrade("All Grades");
    setSection("All Sections");
  }

  function handleServerFilterChange(next = {}) {
    const year = next.schoolYear ?? schoolYear;
    const q = next.quarter ?? quarter;
    const g = next.grade ?? grade;
    const s = next.section ?? section;

    if (next.schoolYear !== undefined) setSchoolYear(next.schoolYear);
    if (next.quarter !== undefined) setQuarter(next.quarter);
    if (next.grade !== undefined) setGrade(next.grade);
    if (next.section !== undefined) setSection(next.section);

    const quarterNumber =
      q && q !== "All Terms"
        ? Number(String(q).replace(/\D/g, "")) || null
        : null;
    const gradeLevel =
      g && g !== "All Grades"
        ? Number(String(g).replace(/\D/g, "")) || null
        : null;

    refresh({
      schoolYear: year || null,
      quarterNumber,
      gradeLevel,
      sectionName: s && s !== "All Sections" ? s : null,
    });
  }

  function refreshWithCurrentFilters(extra = {}) {
    return refresh({
      schoolYear: schoolYear || undefined,
      quarterNumber:
        quarter !== "All Terms"
          ? Number(String(quarter).replace(/\D/g, "")) || null
          : null,
      gradeLevel:
        grade !== "All Grades"
          ? Number(String(grade).replace(/\D/g, "")) || null
          : null,
      sectionName: section !== "All Sections" ? section : null,
      ...extra,
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="space-y-4 pb-6"
    >
      <Header
        breadcrumb="Home > Academic Monitoring"
        title="Academic Monitoring"
        description="Which sections and learners currently need academic attention?"
        controls={
          <>
            <PageHelp
              summary="Academic Monitoring for School Principals."
              steps={[
                "Select a School Year and Term to focus on current concerns.",
                "Review the 3 summary cards for immediate review, monitoring, and active support totals.",
                "In 'School & Sections', click 'Open Section' to inspect a section's learners.",
                "In 'Learners Needing Review', scan learners across subjects and view their records.",
                "Formal exports and historical comparisons are available under Reports → Academic.",
                "ARAL approvals and facilitator assignments are managed in ARAL Monitoring.",
              ]}
            />
            <button
              type="button"
              onClick={() => refreshWithCurrentFilters({ bustCache: true })}
              disabled={loading || refreshing}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:border-cnhs-green/40 hover:bg-cnhs-green-soft/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-[var(--card)] dark:text-slate-200"
            >
              <RefreshCw
                size={13}
                className={refreshing || loading ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </>
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {/* TOP SUMMARY CARDS (3 Simple Cards) */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div
          className={cn(
            "relative rounded-xl border bg-white p-4 shadow-xs transition-colors dark:bg-[var(--card)]",
            summaryCounts.immediateReview > 0
              ? "border-amber-300 bg-amber-50/25 dark:border-amber-500/30"
              : "border-slate-200 dark:border-white/5"
          )}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Needs Immediate Review
            </p>
            {summaryCounts.immediateReview > 0 ? (
              <span className="flex h-2 w-2 rounded-full bg-amber-500" />
            ) : null}
          </div>
          <p
            className={cn(
              "mt-2 text-3xl font-bold leading-none tracking-tight",
              summaryCounts.immediateReview > 0
                ? "text-amber-800 dark:text-amber-400"
                : "text-slate-900 dark:text-white"
            )}
          >
            {summaryCounts.immediateReview}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            Learners with high academic risk requiring attention
          </p>
        </div>

        <div className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/5 dark:bg-[var(--card)]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Needs Monitoring
          </p>
          <p className="mt-2 text-3xl font-bold leading-none tracking-tight text-slate-900 dark:text-white">
            {summaryCounts.needsMonitoring}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            Learners under teacher observation with moderate risk
          </p>
        </div>

        <div className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-xs dark:border-white/5 dark:bg-[var(--card)]">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Under Class Support
          </p>
          <p className="mt-2 text-3xl font-bold leading-none tracking-tight text-slate-900 dark:text-white">
            {summaryCounts.underSupport}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
            Learners receiving active classroom remedial support
          </p>
        </div>
      </section>

      {/* FILTER BAR */}
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-white/5 dark:bg-[var(--card)]">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search learner name, student number, or section…"
            className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:border-cnhs-green dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          />
          <div className="flex flex-wrap items-center gap-2">
            <AppSelect
              id="monitoring-school-year"
              label="School year"
              value={schoolYear || activeSchoolYear}
              onChange={(next) =>
                handleServerFilterChange({ schoolYear: next })
              }
              options={filterOptions.schoolYears}
              className="w-[144px]"
              triggerClassName="h-9 rounded-lg text-xs font-medium"
            />
            <AppSelect
              id="monitoring-term"
              label="Term"
              value={quarter}
              onChange={(next) =>
                handleServerFilterChange({ quarter: next })
              }
              options={
                filterOptions.quarters.length > 1
                  ? filterOptions.quarters
                  : [
                      "All Terms",
                      "Term 1",
                      "Term 2",
                      "Term 3",
                      "Final Grade / Average",
                    ]
              }
              className="w-[160px]"
              triggerClassName="h-9 rounded-lg text-xs font-medium"
            />
            <AppSelect
              id="monitoring-grade"
              label="Grade"
              value={grade}
              onChange={(next) =>
                handleServerFilterChange({ grade: next })
              }
              options={filterOptions.grades}
              className="w-[128px]"
              triggerClassName="h-9 rounded-lg text-xs font-medium"
            />
            <AppSelect
              id="monitoring-section"
              label="Section"
              value={section}
              onChange={(next) =>
                handleServerFilterChange({ section: next })
              }
              options={filterOptions.sections}
              className="w-[144px]"
              triggerClassName="h-9 rounded-lg text-xs font-medium"
            />
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
            >
              <X size={13} />
              Reset
            </button>
          </div>
        </div>
      </section>

      {/* MAIN TABS */}
      <div
        className="flex items-end gap-5 border-b border-slate-200 dark:border-white/10"
        role="tablist"
        aria-label="Academic monitoring views"
      >
        {MONITORING_TABS.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "-mb-px shrink-0 cursor-pointer border-b-2 px-1 pb-2.5 text-sm transition-colors",
                selected
                  ? "border-cnhs-green-dark font-bold text-cnhs-green-dark dark:border-cnhs-green dark:text-cnhs-green"
                  : "border-transparent font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT PANELS */}
      <div
        role="tabpanel"
        id={`admin-monitoring-panel-${activeTab}`}
        aria-labelledby={`admin-monitoring-tab-${activeTab}`}
      >
        {activeTab === "matrix" ? (
          <AdminGradeProgressMatrix
            students={filtered}
            dedupedStudents={dedupedMonitored}
            classSummaries={classSummaries}
            onViewStudent={openStudent}
            schoolYear={activeSchoolYear}
            quarter={quarter === "All Terms" ? "All Terms" : quarter}
          />
        ) : null}

        {activeTab === "students" ? (
          <AdminMonitoredStudentsPanel
            learners={dedupedMonitored}
            schoolYear={activeSchoolYear}
            quarter={quarter === "All Terms" ? "All Terms" : quarter}
            onViewStudent={openStudent}
            loading={loading}
          />
        ) : null}
      </div>

      {/* VIEW-ONLY ACADEMIC RECORD DETAIL MODAL */}
      {selectedLearner || selectedDetail ? (
        <DetailPanel
          detail={selectedDetail}
          learner={selectedLearner}
          loading={detailLoading}
          onClose={closeStudent}
        />
      ) : null}
    </motion.div>
  );
}
