"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Users,
  X,
} from "lucide-react";
import Header from "@/components/layout/Header";
import AdminAralFacilitatorAssignPanel from "@/components/admin/monitoring/AdminAralFacilitatorAssignPanel";
import AdminAralApprovalPanel from "@/components/admin/monitoring/AdminAralApprovalPanel";
import AdminAralProgressPanel from "@/components/admin/monitoring/AdminAralProgressPanel";
import AdminClassReportFilesPanel from "@/components/admin/monitoring/AdminClassReportFilesPanel";
import LearnersInterventionTable from "@/components/teacher/monitoring/LearnersInterventionTable";
import {
  Pill,
  RiskPill,
  interventionStyles,
  monitoringStatusStyles,
} from "@/components/teacher/monitoring/shared";
import { useAdminMonitoring } from "@/hooks/teacher/useMonitoring";
import {
  RISK_LEVEL,
  normalizeRecommendationType,
  normalizeRiskLevel,
} from "@/lib/monitoring/recommendations";
import {
  exportAralRecommendedExcel,
  filterAralRecommendedLearners,
} from "@/lib/reports/aralRecommendedExport";
import { cn } from "@/lib/utils";

const MONITORING_TABS = [
  { id: "received", label: "Received files" },
  { id: "approve", label: "Approve ARAL" },
  { id: "facilitators", label: "Assign facilitators" },
  { id: "progress", label: "ARAL assessments" },
  { id: "students", label: "Monitored students" },
];

function StatCard({ label, value, icon: Icon, tone, alert }) {
  return (
    <div className="relative flex min-w-0 items-center gap-2 rounded-lg border border-slate-100 bg-white px-2.5 py-2 shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
      {alert ? (
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
      ) : null}
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
          tone
        )}
      >
        <Icon size={13} strokeWidth={1.8} />
      </span>
      <div className="min-w-0">
        <p className="text-base font-semibold leading-none tracking-[-0.03em] text-slate-900 sm:text-lg">
          {value}
        </p>
        <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-600">
          {label}
        </p>
      </div>
    </div>
  );
}

function DetailPanel({ detail, loading, onClose }) {
  if (!detail && !loading) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-3 backdrop-blur-[1px] sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="relative z-10 flex max-h-[72vh] w-[min(920px,94vw)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
              Academic Monitoring Record
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              {detail?.name ?? "Loading…"}
            </h2>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {detail
                ? `${detail.studentNumber} · ${detail.gradeSection}`
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-5">
          {loading || !detail ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              Loading record…
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <RiskPill value={detail.riskLevel} />
                <Pill
                  value={detail.recommendation}
                  styles={interventionStyles}
                />
                <Pill
                  value={detail.monitoringStatus}
                  styles={monitoringStatusStyles}
                />
              </div>

              <section className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                  Student Information
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] lg:grid-cols-4">
                  <p>
                    <span className="text-slate-400">Adviser:</span>{" "}
                    <span className="font-medium text-slate-700">
                      {detail.adviser}
                    </span>
                  </p>
                  <p>
                    <span className="text-slate-400">Teacher:</span>{" "}
                    <span className="font-medium text-slate-700">
                      {detail.teacher}
                    </span>
                  </p>
                  <p>
                    <span className="text-slate-400">Subject grade:</span>{" "}
                    <span className="font-medium text-slate-700">
                      {detail.classSubjectGrade ?? detail.generalAverage ?? "—"}
                    </span>
                  </p>
                  <p>
                    <span className="text-slate-400">Period:</span>{" "}
                    <span className="font-medium text-slate-700">
                      {detail.schoolYear} · {detail.quarter}
                    </span>
                  </p>
                </div>
              </section>

              <section>
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                  Subject Grades
                </p>
                <div className="mt-2 overflow-hidden rounded-xl border border-slate-100">
                  <table className="w-full text-left">
                    <tbody>
                      {detail.subjectGrades.length ? (
                        detail.subjectGrades.map((row) => (
                          <tr
                            key={`${row.subject}-${row.grade}`}
                            className="border-t border-slate-100 first:border-t-0"
                          >
                            <td className="px-3 py-2 text-xs text-slate-600">
                              {row.subject}
                            </td>
                            <td className="px-3 py-2 text-right text-xs font-semibold text-slate-800">
                              {row.grade ?? "—"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-3 py-4 text-center text-xs text-slate-400">
                            No grades available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section>
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                  System Recommendation
                </p>
                <p className="mt-2 text-[12px] leading-5 text-slate-600">
                  {detail.recommendationReason}
                </p>
              </section>

              <section>
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                  Weekly Progress History (view-only)
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {detail.records.length ? (
                    detail.records.map((record) => (
                      <div
                        key={record.id}
                        className="rounded-xl border border-slate-100 bg-white px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-slate-800">
                            {record.weekLabel ? `${record.weekLabel} · ` : ""}
                            {record.observationDate}
                          </p>
                          <Pill
                            value={record.monitoringStatus}
                            styles={monitoringStatusStyles}
                          />
                        </div>
                        <p className="mt-1 text-[11px] font-semibold text-slate-700">
                          Progress: {record.studentProgress || "—"}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-600">
                          {record.interventionGiven}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {record.teacherRemarks}
                        </p>
                        {record.teacherName && record.teacherName !== "—" ? (
                          <p className="mt-1 text-[10px] text-slate-400">
                            Teacher: {record.teacherName}
                          </p>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="col-span-full py-2 text-center text-xs text-slate-400">
                      No weekly progress updates recorded yet.
                    </p>
                  )}
                </div>
              </section>
            </>
          )}
        </div>

        <div className="flex shrink-0 justify-end border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
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
    stats,
    filterOptions,
    loading,
    refreshing,
    error,
    refresh,
    selectedDetail,
    detailLoading,
    openStudent,
    closeStudent,
  } = useAdminMonitoring();

  const [search, setSearch] = useState("");
  const [schoolYear, setSchoolYear] = useState("");
  const [quarter, setQuarter] = useState("All Terms");
  const [grade, setGrade] = useState("All Grades");
  const [section, setSection] = useState("All Sections");
  const [recommendation, setRecommendation] = useState("All Recommendations");
  const [risk, setRisk] = useState("All Risks");
  const [status, setStatus] = useState("All Status");
  const [exportingAral, setExportingAral] = useState(false);
  const [activeTab, setActiveTab] = useState("received");
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);

  useEffect(() => {
    const riskParam = searchParams.get("risk");
    const recommendationParam = searchParams.get("recommendation");
    if (riskParam) {
      setRisk(normalizeRiskLevel(riskParam));
    }
    if (recommendationParam) {
      setRecommendation(normalizeRecommendationType(recommendationParam));
    }
    if (riskParam || recommendationParam) {
      setMoreFiltersOpen(true);
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    return students.filter((learner) => {
      const query = search.trim().toLowerCase();
      const matchesSearch =
        !query ||
        learner.name.toLowerCase().includes(query) ||
        learner.studentNumber.toLowerCase().includes(query);
      const matchesYear =
        !schoolYear || learner.schoolYear === schoolYear;
      const matchesQuarter =
        quarter === "All Terms" || learner.quarter === quarter;
      const matchesGrade = grade === "All Grades" || learner.grade === grade;
      const matchesSection =
        section === "All Sections" || learner.section === section;
      const matchesRecommendation =
        recommendation === "All Recommendations" ||
        normalizeRecommendationType(learner.recommendation) ===
          normalizeRecommendationType(recommendation);
      const learnerRisk = normalizeRiskLevel(learner.riskLevel);
      const matchesRisk = risk === "All Risks" || learnerRisk === risk;
      const matchesStatus =
        status === "All Status" || learner.monitoringStatus === status;

      return (
        matchesSearch &&
        matchesYear &&
        matchesQuarter &&
        matchesGrade &&
        matchesSection &&
        matchesRecommendation &&
        matchesRisk &&
        matchesStatus
      );
    });
  }, [
    students,
    search,
    schoolYear,
    quarter,
    grade,
    section,
    recommendation,
    risk,
    status,
  ]);

  const activeSchoolYear =
    schoolYear || filterOptions.schoolYears[0] || "SY 2026-2027";

  function clearFilters() {
    setSearch("");
    setSchoolYear("");
    setQuarter("All Terms");
    setGrade("All Grades");
    setSection("All Sections");
    setRecommendation("All Recommendations");
    setRisk("All Risks");
    setStatus("All Status");
  }

  const aralExportCount = useMemo(
    () => filterAralRecommendedLearners(filtered).length,
    [filtered]
  );

  const exportScopeLabel = useMemo(() => {
    const parts = [];
    if (grade && grade !== "All Grades") parts.push(grade);
    if (section && section !== "All Sections") parts.push(section);
    return parts.length ? parts.join(" ") : "School-wide";
  }, [grade, section]);

  async function handleExportAralRecommended() {
    if (exportingAral) return;
    setExportingAral(true);
    try {
      const result = await exportAralRecommendedExcel({
        learners: filtered,
        schoolYear: activeSchoolYear,
        quarter: quarter === "All Terms" ? "All Terms" : quarter,
        periodLabel: quarter === "All Terms" ? "All Terms" : quarter,
        generatedBy: "Head Teacher / Admin",
        scopeLabel: exportScopeLabel,
        includeTeacherColumn: true,
      });
      if (result.count === 0) {
        window.alert(
          "No ARAL-recommended learners under the current filters. The Excel file still downloaded for review."
        );
      }
    } catch (err) {
      console.error(err);
      window.alert("Unable to export ARAL recommended list. Please try again.");
    } finally {
      setExportingAral(false);
    }
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

  const moreFiltersActive =
    recommendation !== "All Recommendations" ||
    risk !== "All Risks" ||
    status !== "All Status";

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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <Header
        breadcrumb="Home > Academic Monitoring"
        title="Academic Monitoring"
        description="Track at-risk learners, ARAL approvals, and remediation across classes."
        controls={
          <>
            <button
              type="button"
              onClick={handleExportAralRecommended}
              disabled={loading || exportingAral}
              title="Export English/Filipino learners recommended for ARAL (for review)"
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 text-[12px] font-semibold text-sky-800 transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exportingAral ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <FileSpreadsheet size={13} />
              )}
              Export ARAL
              {aralExportCount > 0 ? (
                <span className="rounded-full bg-white/80 px-1.5 text-[10px] font-bold text-sky-700">
                  {aralExportCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() =>
                handleServerFilterChange({
                  schoolYear,
                  quarter,
                  grade,
                  section,
                })
              }
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
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
        <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <section className="mb-3 rounded-xl border border-slate-100 bg-white p-2.5 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student name or number…"
            className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-cnhs-green"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={schoolYear || activeSchoolYear}
              onChange={(e) =>
                handleServerFilterChange({ schoolYear: e.target.value })
              }
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 outline-none focus:border-cnhs-green"
            >
              {filterOptions.schoolYears.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              value={quarter}
              onChange={(e) =>
                handleServerFilterChange({ quarter: e.target.value })
              }
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 outline-none focus:border-cnhs-green"
            >
              {(filterOptions.quarters.length > 1
                ? filterOptions.quarters
                : [
                    "All Terms",
                    "Term 1",
                    "Term 2",
                    "Term 3",
                    "Final Grade / Average",
                  ]
              ).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              value={grade}
              onChange={(e) =>
                handleServerFilterChange({ grade: e.target.value })
              }
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 outline-none focus:border-cnhs-green"
            >
              {filterOptions.grades.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              value={section}
              onChange={(e) =>
                handleServerFilterChange({ section: e.target.value })
              }
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 outline-none focus:border-cnhs-green"
            >
              {filterOptions.sections.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setMoreFiltersOpen((open) => !open)}
              className={cn(
                "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[11px] font-semibold transition-colors",
                moreFiltersOpen || moreFiltersActive
                  ? "border-cnhs-green/40 bg-emerald-50 text-cnhs-green-dark"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              )}
            >
              More filters
              <ChevronDown
                size={12}
                className={cn(
                  "transition-transform",
                  moreFiltersOpen ? "rotate-180" : ""
                )}
              />
              {moreFiltersActive ? (
                <span className="h-1.5 w-1.5 rounded-full bg-cnhs-green-dark" />
              ) : null}
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-50"
            >
              <X size={12} />
              Clear
            </button>
          </div>
        </div>

        {moreFiltersOpen ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
            <select
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 outline-none focus:border-cnhs-green"
            >
              {filterOptions.interventions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              value={risk}
              onChange={(e) => setRisk(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 outline-none focus:border-cnhs-green"
            >
              {(filterOptions.risks ?? [
                "All Risks",
                RISK_LEVEL.HIGH,
                RISK_LEVEL.MODERATE,
                RISK_LEVEL.LOW,
              ]).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 outline-none focus:border-cnhs-green"
            >
              {filterOptions.statuses.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </section>

      <div className="mb-4 rounded-2xl border border-slate-100 bg-slate-50/50 p-2.5 sm:p-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <StatCard
            label="At-Risk"
            value={stats.totalAtRisk}
            icon={Users}
            tone="bg-sky-50 text-sky-600"
            alert={stats.totalAtRisk > 0}
          />
          <StatCard
            label="ARAL"
            value={stats.aral}
            icon={Clock3}
            tone="bg-orange-50 text-cnhs-orange"
            alert={stats.aral > 0}
          />
          <StatCard
            label="Remedial"
            value={stats.remediation}
            icon={BookOpen}
            tone="bg-green-50 text-cnhs-green-dark"
          />
          <StatCard
            label="Ongoing"
            value={stats.ongoing}
            icon={AlertTriangle}
            tone="bg-red-50 text-red-500"
            alert={stats.ongoing > 0}
          />
          <StatCard
            label="Completed"
            value={stats.completed}
            icon={CheckCircle2}
            tone="bg-emerald-50 text-emerald-600"
          />
        </div>
      </div>

      <div
        className="mb-3 flex items-end gap-4 overflow-x-auto border-b border-slate-200"
        role="tablist"
        aria-label="Academic monitoring panels"
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
                "-mb-px shrink-0 cursor-pointer border-b-2 px-0.5 pb-2.5 text-[13px] transition-colors",
                selected
                  ? "border-cnhs-green-dark font-semibold text-cnhs-green-dark"
                  : "border-transparent font-medium text-slate-500 hover:text-slate-700"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`admin-monitoring-panel-${activeTab}`}
        aria-labelledby={`admin-monitoring-tab-${activeTab}`}
      >
        {activeTab === "received" ? (
          <AdminClassReportFilesPanel
            students={students}
            classSummaries={classSummaries}
            onChanged={() => refreshWithCurrentFilters({ bustCache: true })}
          />
        ) : null}

        {activeTab === "approve" ? (
          <AdminAralApprovalPanel
            students={filtered}
            onChanged={() => refreshWithCurrentFilters({ bustCache: true })}
          />
        ) : null}

        {activeTab === "facilitators" ? (
          <AdminAralFacilitatorAssignPanel
            students={students}
            onChanged={() =>
              refresh({
                schoolYear: schoolYear || undefined,
                quarterNumber:
                  quarter !== "All Terms"
                    ? Number(String(quarter).replace(/\D/g, "")) || null
                    : null,
              })
            }
          />
        ) : null}

        {activeTab === "progress" ? (
          <AdminAralProgressPanel
            students={students}
            onViewStudent={openStudent}
          />
        ) : null}

        {activeTab === "students" ? (
          loading && students.length === 0 ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white py-10 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              Loading monitoring data…
            </div>
          ) : (
            <LearnersInterventionTable
              learners={filtered}
              schoolYear={activeSchoolYear}
              quarter={quarter === "All Terms" ? "All Terms" : quarter}
              onViewMonitoring={openStudent}
              title="Monitored Students"
              showAralApproval
            />
          )
        ) : null}
      </div>

      <DetailPanel
        detail={selectedDetail}
        loading={detailLoading}
        onClose={closeStudent}
      />
    </motion.div>
  );
}
