"use client";

import { useMemo, useState, useEffect } from "react";
import AdminTablePagination from "@/components/shared/AdminTablePagination";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Eye,
  TrendingDown,
  TrendingUp,
  Minus,
  Info,
  CheckCircle2,
  BookOpen,
  FileText,
  Download,
} from "lucide-react";
import { aralPeriodLabel } from "@/lib/monitoring/assessmentTimeline";
import { aggregateAralLearners } from "@/lib/monitoring/aralLearnerAggregation";
import {
  computePrincipalAralReportData,
  computeSchoolReadingProfileForm2,
  computePhilIriSchoolSummaryForm5,
} from "@/lib/reports/aralReportsAggregation";
import PrincipalAralOutcomeModal from "@/components/admin/reports/PrincipalAralOutcomeModal";
import ExportAralReportModal from "@/components/aral/ExportAralReportModal";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

export default function AralReportTab({
  aralSummary = {},
  aralPeriod = "BOSY",
  classReports = [],
  overviewHotspots = {},
  students = [],
  schoolYear = "SY 2026-2027",
  quarter = "",
}) {
  const [viewMode, setViewMode] = useState("overview"); // 'overview' | 'form2' | 'form5'
  const [formLanguage, setFormLanguage] = useState("All Languages");
  const [exportModalOpen, setExportModalOpen] = useState(false);

  // 1. Authoritative aggregation of canonical ARAL cases
  const canonicalLearners = useMemo(() => {
    return aggregateAralLearners(students, {
      schoolYear,
      role: "principal",
      scope: "school-wide",
    });
  }, [students, schoolYear]);

  // 2. Compute Principal ARAL Report Data
  const reportData = useMemo(() => {
    return computePrincipalAralReportData(canonicalLearners, {
      schoolYear,
      quarter,
      aralPeriod,
    });
  }, [canonicalLearners, schoolYear, quarter, aralPeriod]);

  // 3. Official Form 2 & Form 5 Data
  const form2Data = useMemo(() => {
    return computeSchoolReadingProfileForm2(canonicalLearners, {
      schoolYear,
      language: formLanguage,
      aralPeriod,
    });
  }, [canonicalLearners, schoolYear, formLanguage, aralPeriod]);

  const form5Data = useMemo(() => {
    return computePhilIriSchoolSummaryForm5(canonicalLearners, {
      schoolYear,
      language: formLanguage,
      aralPeriod,
    });
  }, [canonicalLearners, schoolYear, formLanguage, aralPeriod]);

  // Modal state for viewing outcome details
  const [selectedOutcome, setSelectedOutcome] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenOutcome = (record) => {
    setSelectedOutcome(record);
    setIsModalOpen(true);
  };

  // 8. Summary Cards: Prefer computed reportData; fallback to prop aralSummary if empty
  const summaryCards = useMemo(() => {
    if (canonicalLearners.length > 0) {
      return reportData.summaryCards;
    }
    const waitingReview = Number(aralSummary?.waitingForReview ?? 0);
    const waitingAssessment = Number(aralSummary?.waitingForAssessment ?? 0);
    const underSupport = Number(aralSummary?.underAralSupport ?? 0);
    const outcomesCount = Number(aralSummary?.outcomes ?? 0);

    return [
      {
        label: "Total Enrolled",
        value: Number(aralSummary?.total ?? 0),
        desc: "Enrolled in language classes",
      },
      {
        label: "Needs Screening",
        value: waitingAssessment,
        desc: `${aralPeriodLabel(aralPeriod)} GST pending`,
      },
      {
        label: "Needs Reading Assessment",
        value: underSupport,
        desc: "Score < 28 — Form 3 required",
      },
      {
        label: "Assessment Complete",
        value: outcomesCount,
        desc: outcomesCount > 0 ? `${outcomesCount} validated reading assessments` : "Assessments in progress",
      },
    ];
  }, [canonicalLearners.length, reportData.summaryCards, aralSummary, aralPeriod]);

  // 11. Grade Chart Data: Prefer reportData grade distribution
  const gradeChartData = useMemo(() => {
    if (canonicalLearners.length > 0) {
      return reportData.gradeChartData;
    }
    // Fallback if raw students not yet loaded
    const gradeMap = new Map([
      ["Grade 7", 0],
      ["Grade 8", 0],
      ["Grade 9", 0],
      ["Grade 10", 0],
    ]);
    classReports.forEach((c) => {
      const g = c.gradeLevel ? `Grade ${c.gradeLevel}` : null;
      if (g && gradeMap.has(g)) {
        const count = c.aralEligible ? Number(c.aralScreening) || 0 : Number(c.aralCount) || 0;
        gradeMap.set(g, gradeMap.get(g) + count);
      }
    });
    return Array.from(gradeMap.entries()).map(([grade, learners]) => ({
      grade,
      learners,
    }));
  }, [canonicalLearners.length, reportData.gradeChartData, classReports]);

  // 12. Section Summary Table Data: Prefer reportData section table
  const sectionSummaryData = useMemo(() => {
    if (canonicalLearners.length > 0) {
      return reportData.sectionSummaryTable;
    }
    // Fallback from classReports
    const secMap = new Map();
    classReports.forEach((c) => {
      const name = c.gradeSection || c.className || "Section";
      if (!secMap.has(name)) {
        secMap.set(name, {
          section: name,
          totalCases: Number(c.aralScreening) || Number(c.aralCount) || 0,
          waitingAssessment: 0,
          underSupport: Number(c.aralCount) || 0,
          completedOutcomes: 0,
        });
      }
    });
    return Array.from(secMap.values());
  }, [canonicalLearners.length, reportData.sectionSummaryTable, classReports]);

  // Section Table Pagination
  const [sectionPage, setSectionPage] = useState(1);
  useEffect(() => {
    setSectionPage(1);
  }, [sectionSummaryData]);
  const totalSectionPages = Math.max(1, Math.ceil(sectionSummaryData.length / PAGE_SIZE));
  const safeSectionPage = Math.min(Math.max(sectionPage, 1), totalSectionPages);
  const pagedSections = useMemo(() => {
    const start = (safeSectionPage - 1) * PAGE_SIZE;
    return sectionSummaryData.slice(start, start + PAGE_SIZE);
  }, [sectionSummaryData, safeSectionPage]);

  // Outcomes Table Pagination
  const outcomesList = reportData.outcomesTableRows || [];
  const [outcomePage, setOutcomePage] = useState(1);
  const totalOutcomePages = Math.max(1, Math.ceil(outcomesList.length / PAGE_SIZE));
  const safeOutcomePage = Math.min(Math.max(outcomePage, 1), totalOutcomePages);
  const pagedOutcomes = useMemo(() => {
    const start = (safeOutcomePage - 1) * PAGE_SIZE;
    return outcomesList.slice(start, start + PAGE_SIZE);
  }, [outcomesList, safeOutcomePage]);

  const { trendData, termMovement, outcomeCategoriesSummary, hasOutcomes } = reportData;

  return (
    <div className="space-y-5">
      {/* View Mode Switcher Chips */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist">
          <button
            type="button"
            onClick={() => setViewMode("overview")}
            className={cn(
              "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all active:scale-95",
              viewMode === "overview"
                ? "bg-[#166534] text-white shadow-xs"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
            )}
          >
            <span>Overview & Outcomes</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("form2")}
            className={cn(
              "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all active:scale-95",
              viewMode === "form2"
                ? "bg-[#166534] text-white shadow-xs"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
            )}
          >
            <BookOpen size={13} />
            <span>Form 2: School Reading Profile</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("form5")}
            className={cn(
              "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all active:scale-95",
              viewMode === "form5"
                ? "bg-[#166534] text-white shadow-xs"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
            )}
          >
            <FileText size={13} />
            <span>Form 5: Phil-IRI School Summary</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {viewMode !== "overview" ? (
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-medium text-slate-400 mr-1">Language:</span>
              {["All Languages", "English", "Filipino"].map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setFormLanguage(lang)}
                  className={cn(
                    "h-7 rounded-md px-2.5 text-[11px] font-semibold transition-all cursor-pointer",
                    formLanguage === lang
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                  )}
                >
                  {lang}
                </button>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            disabled={canonicalLearners.length === 0}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:border-[#166534]/40 hover:bg-emerald-50/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          >
            <Download size={13} className="text-[#166534] dark:text-emerald-400" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {viewMode === "form2" ? (
        /* Form 2: School Reading Profile View */
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-white/5">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#166534] dark:bg-emerald-950/40 dark:text-emerald-300">
                  DepEd Phil-IRI Form 2
                </span>
                <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                  School Reading Profile (Grades 7–10)
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Consolidated screening test (GST) and individual graded-passage reading level distribution across junior high school grade levels.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold dark:border-white/10 dark:bg-white/5">
                  {schoolYear}
                </span>
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold dark:border-white/10 dark:bg-white/5">
                  {aralPeriodLabel(aralPeriod)}
                </span>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Cases</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {form2Data.total.totalCases}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">At Grade Level (GST ≥ 28)</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {form2Data.total.atGradeLevel}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Form 3 Instructional</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-amber-800 dark:text-amber-400">
                  {form2Data.total.form3Instructional}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Form 3 Frustration</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-red-700 dark:text-red-400">
                  {form2Data.total.form3Frustration}
                </p>
              </div>
            </div>
          </div>

          {/* Form 2 Breakdown Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
            <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-white/5 dark:bg-white/[0.02]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#166534] dark:text-emerald-400">
                Grade-Level Reading Profile Reconciliation
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[750px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/5">
                    <th className="px-4 py-2.5">Grade Level</th>
                    <th className="px-3 py-2.5 text-center tabular-nums">Total Cases</th>
                    <th className="px-3 py-2.5 text-center tabular-nums">GST Screened</th>
                    <th className="px-3 py-2.5 text-center tabular-nums text-emerald-700 dark:text-emerald-400">At Grade Level (28–40)</th>
                    <th className="px-3 py-2.5 text-center tabular-nums text-blue-700 dark:text-blue-400">2 Levels Down (16–27)</th>
                    <th className="px-3 py-2.5 text-center tabular-nums text-rose-700 dark:text-rose-400">3 Levels Down (0–15)</th>
                    <th className="px-3 py-2.5 text-center tabular-nums">Form 3 Assessed</th>
                    <th className="px-3 py-2.5 text-center tabular-nums text-emerald-700 dark:text-emerald-400">Independent</th>
                    <th className="px-3 py-2.5 text-center tabular-nums text-blue-700 dark:text-blue-400">Instructional</th>
                    <th className="px-3 py-2.5 text-center tabular-nums text-rose-700 dark:text-rose-400">Frustration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {form2Data.rows.map((row) => (
                    <tr key={row.grade} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-slate-100">
                        {row.grade}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-slate-700 dark:text-slate-300">
                        {row.totalCases}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                        {row.assessed}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">
                        {row.atGradeLevel}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-blue-700 dark:text-blue-400">
                        {row.twoLevelsDown}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-rose-700 dark:text-rose-400">
                        {row.threeLevelsDown}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                        {row.form3Assessed}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-emerald-700 dark:text-emerald-400">
                        {row.form3Independent}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-blue-700 dark:text-blue-400">
                        {row.form3Instructional}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-rose-700 dark:text-rose-400">
                        {row.form3Frustration}
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold dark:border-white/10 dark:bg-white/[0.04]">
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100">Total</td>
                    <td className="px-3 py-3 text-center tabular-nums">{form2Data.total.totalCases}</td>
                    <td className="px-3 py-3 text-center tabular-nums">{form2Data.total.assessed}</td>
                    <td className="px-3 py-3 text-center tabular-nums text-emerald-700 dark:text-emerald-400">{form2Data.total.atGradeLevel}</td>
                    <td className="px-3 py-3 text-center tabular-nums text-blue-700 dark:text-blue-400">{form2Data.total.twoLevelsDown}</td>
                    <td className="px-3 py-3 text-center tabular-nums text-rose-700 dark:text-rose-400">{form2Data.total.threeLevelsDown}</td>
                    <td className="px-3 py-3 text-center tabular-nums">{form2Data.total.form3Assessed}</td>
                    <td className="px-3 py-3 text-center tabular-nums text-emerald-700 dark:text-emerald-400">{form2Data.total.form3Independent}</td>
                    <td className="px-3 py-3 text-center tabular-nums text-blue-700 dark:text-blue-400">{form2Data.total.form3Instructional}</td>
                    <td className="px-3 py-3 text-center tabular-nums text-rose-700 dark:text-rose-400">{form2Data.total.form3Frustration}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : viewMode === "form5" ? (
        /* Form 5: Phil-IRI School Summary View */
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-white/5">
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#166534] dark:bg-emerald-950/40 dark:text-emerald-300">
                  DepEd Phil-IRI Form 5
                </span>
                <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                  School Summary Report on Learners’ Reading Level
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Official Phil-IRI summary consolidating screening results with graded passage evaluations for School Reading Coordinator / School Head endorsement.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold dark:border-white/10 dark:bg-white/5">
                  {schoolYear}
                </span>
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold dark:border-white/10 dark:bg-white/5">
                  {aralPeriodLabel(aralPeriod)}
                </span>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Screened</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {form5Data.total.totalScreened}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">At Grade Level</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {form5Data.total.atGradeLevel}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Requiring ARAL Support</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-amber-800 dark:text-amber-400">
                  {form5Data.total.requiringSupport}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-center shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Independent Readers</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {form5Data.total.independent}
                </p>
              </div>
            </div>
          </div>

          {/* Form 5 Consolidated Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
            <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-white/5 dark:bg-white/[0.02]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#166534] dark:text-emerald-400">
                School Consolidated Summary by Grade Level
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/5">
                    <th className="px-4 py-2.5">Grade Level</th>
                    <th className="px-3 py-2.5 text-center tabular-nums">Total Screened</th>
                    <th className="px-3 py-2.5 text-center tabular-nums text-emerald-700 dark:text-emerald-400">At Grade Level (GST ≥ 28)</th>
                    <th className="px-3 py-2.5 text-center tabular-nums text-blue-700 dark:text-blue-400">Instructional</th>
                    <th className="px-3 py-2.5 text-center tabular-nums text-rose-700 dark:text-rose-400">Frustration</th>
                    <th className="px-3 py-2.5 text-center tabular-nums text-emerald-700 dark:text-emerald-400">Independent</th>
                    <th className="px-3 py-2.5 text-right tabular-nums font-bold text-rose-700 dark:text-rose-400">Requiring ARAL Support</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {form5Data.rows.map((row) => (
                    <tr key={row.grade} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-bold text-slate-900 dark:text-slate-100">
                        {row.grade}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                        {row.totalScreened}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-emerald-700 dark:text-emerald-400">
                        {row.atGradeLevel}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-blue-700 dark:text-blue-400">
                        {row.instructional}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-rose-700 dark:text-rose-400">
                        {row.frustration}
                      </td>
                      <td className="px-3 py-2.5 text-center tabular-nums text-emerald-700 dark:text-emerald-400">
                        {row.independent}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold text-rose-700 dark:text-rose-400">
                        {row.requiringSupport}
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold dark:border-white/10 dark:bg-white/[0.04]">
                    <td className="px-4 py-3 text-slate-900 dark:text-slate-100">Total</td>
                    <td className="px-3 py-3 text-center tabular-nums">{form5Data.total.totalScreened}</td>
                    <td className="px-3 py-3 text-center tabular-nums text-emerald-700 dark:text-emerald-400">{form5Data.total.atGradeLevel}</td>
                    <td className="px-3 py-3 text-center tabular-nums text-blue-700 dark:text-blue-400">{form5Data.total.instructional}</td>
                    <td className="px-3 py-3 text-center tabular-nums text-rose-700 dark:text-rose-400">{form5Data.total.frustration}</td>
                    <td className="px-3 py-3 text-center tabular-nums text-emerald-700 dark:text-emerald-400">{form5Data.total.independent}</td>
                    <td className="px-3 py-3 text-right tabular-nums font-bold text-rose-700 dark:text-rose-400">{form5Data.total.requiringSupport}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Default Overview & Outcomes View */
        <>
          {/* 8. PRINCIPAL ARAL SUMMARY (4 SCOPED CARDS) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="flex min-h-[105px] flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[var(--card)]"
              >
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {card.label}
                </p>
                <p className="mt-1 text-2xl font-bold leading-tight tabular-nums text-slate-900 dark:text-slate-100">
                  {card.value}
                </p>
                <p className="mt-1 truncate text-[11px] text-slate-500">
                  {card.desc}
                </p>
              </div>
            ))}
          </div>

          {/* 9 & 10. TERM-BASED ARAL TREND & TERM MOVEMENT */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* ARAL SUPPORT TREND */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
              <div className="border-b border-slate-100 pb-2.5 dark:border-white/5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#166534] dark:text-emerald-400">
                  ARAL SUPPORT TREND
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Term-over-term comparison of learners requiring ARAL support.
                </p>
              </div>

              {trendData?.isAvailable ? (
                <div className="mt-3.5 space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 dark:border-white/5 dark:bg-white/[0.02]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Previous Term
                      </p>
                      <p className="mt-1 text-base font-bold tabular-nums text-slate-700 dark:text-slate-300">
                        {trendData.previousTermCount}
                      </p>
                      <p className="text-[10px] text-slate-400">learners</p>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 dark:border-white/5 dark:bg-white/[0.02]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Current Term
                      </p>
                      <p className="mt-1 text-base font-bold tabular-nums text-slate-900 dark:text-slate-100">
                        {trendData.currentTermCount}
                      </p>
                      <p className="text-[10px] text-slate-400">learners</p>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 dark:border-white/5 dark:bg-white/[0.02]">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Change
                      </p>
                      <p className="mt-1 text-base font-bold tabular-nums text-[#166534] dark:text-emerald-400">
                        {trendData.changeText}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-xs text-slate-700 dark:border-white/5 dark:bg-white/[0.02] dark:text-slate-300">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      Current Direction:{" "}
                    </span>
                    “{trendData.directionText}”
                  </div>
                </div>
              ) : (
                <div className="mt-3.5 rounded-lg border border-slate-100 bg-slate-50/50 p-4 text-xs text-slate-500 dark:border-white/5 dark:bg-white/[0.02]">
                  {trendData?.notice || "Trend will appear when a previous comparable term is available."}
                </div>
              )}
            </div>

            {/* TERM MOVEMENT */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
              <div className="border-b border-slate-100 pb-2.5 dark:border-white/5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#166534] dark:text-emerald-400">
                  TERM MOVEMENT
                </h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Actual case transitions explaining changes in active support volume.
                </p>
              </div>

              <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 text-center dark:border-white/5 dark:bg-white/[0.02]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    New Referrals
                  </p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-slate-800 dark:text-slate-200">
                    {termMovement.newReferrals}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 text-center dark:border-white/5 dark:bg-white/[0.02]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Started Support
                  </p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {termMovement.startedSupport}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 text-center dark:border-white/5 dark:bg-white/[0.02]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Completed / Exited
                  </p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-blue-700 dark:text-blue-400">
                    {termMovement.completedExited}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 text-center dark:border-white/5 dark:bg-white/[0.02]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Net Change
                  </p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                    {termMovement.netChangeText}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 11. ARAL STATUS BY GRADE */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
            <div className="border-b border-slate-100 pb-2.5 dark:border-white/5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#166534] dark:text-emerald-400">
                ARAL STATUS BY GRADE LEVEL
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Current valid ARAL cases distributed across grade levels.
              </p>
            </div>

            <div className="mt-4 h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={gradeChartData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis
                    dataKey="grade"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={{ stroke: "#e2e8f0" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(val) => [`${val} learners`, "ARAL Cases"]}
                  />
                  <Bar
                    dataKey="learners"
                    fill="#166534"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 12. SECTION SUMMARY TABLE */}
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
            <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-white/5 dark:bg-white/[0.02]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#166534] dark:text-emerald-400">
                SECTION SUMMARY
              </h3>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Breakdown of ARAL cases, assessments, and active support per section.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/5">
                    <th className="px-4 py-2.5">Section</th>
                    <th className="px-4 py-2.5 text-center tabular-nums">Total ARAL Cases</th>
                    <th className="px-4 py-2.5 text-center tabular-nums">Waiting for Assessment</th>
                    <th className="px-4 py-2.5 text-center tabular-nums">Under ARAL Support</th>
                    <th className="px-4 py-2.5 text-right tabular-nums">Completed / Outcomes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {sectionSummaryData.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">
                        No section ARAL records available for this period.
                      </td>
                    </tr>
                  ) : (
                    pagedSections.map((row) => (
                      <tr key={row.section} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 font-semibold text-slate-800 dark:text-slate-100">
                          {row.section}
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold tabular-nums text-slate-800 dark:text-slate-200">
                          {row.totalCases}
                        </td>
                        <td className="px-4 py-2.5 text-center tabular-nums text-slate-600 dark:text-slate-400">
                          {row.waitingAssessment}
                        </td>
                        <td className="px-4 py-2.5 text-center font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                          {row.underSupport}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                          {row.completedOutcomes}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <AdminTablePagination
              page={safeSectionPage}
              pageSize={PAGE_SIZE}
              total={sectionSummaryData.length}
              onPageChange={setSectionPage}
              itemLabel="sections"
            />
          </div>

          {/* C. PRINCIPAL OUTCOMES SECTION (SAFEGUARDS 1 & 7) */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
            <div className="border-b border-slate-100 pb-3 dark:border-white/5">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#166534] dark:bg-emerald-950/40 dark:text-emerald-300">
                  Validated Dispositions
                </span>
              </div>
              <h3 className="mt-1.5 text-sm font-bold tracking-tight text-[#166534] dark:text-emerald-400">
                PRINCIPAL OUTCOMES
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Consolidated results from ARAL Reading Assessment. Dispositions reflect completed assessments and resolved intervention milestones.
              </p>
            </div>

            {hasOutcomes ? (
              <div className="mt-4 space-y-4">
                {/* 14. OUTCOME SUMMARY CHIPS */}
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    OUTCOME SUMMARY
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {outcomeCategoriesSummary.map((cat) => (
                      <div
                        key={cat.label}
                        className="rounded-lg border border-slate-100 bg-slate-50/50 p-2.5 text-center dark:border-white/5 dark:bg-white/[0.02]"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {cat.label}
                        </p>
                        <p className="mt-1 text-lg font-bold tabular-nums text-[#166534] dark:text-emerald-400">
                          {cat.count}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 15. OUTCOMES TABLE */}
                <div className="overflow-hidden rounded-lg border border-slate-100 dark:border-white/5">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/5">
                        <th className="px-3 py-2.5">Learner</th>
                        <th className="px-3 py-2.5">Grade & Section</th>
                        <th className="px-3 py-2.5">Language</th>
                        <th className="px-3 py-2.5">Latest Reading Profile</th>
                        <th className="px-3 py-2.5">Outcome</th>
                        <th className="px-3 py-2.5">Assessment Period</th>
                        <th className="px-3 py-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {pagedOutcomes.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/50">
                          <td className="px-3 py-2.5 font-semibold text-slate-800 dark:text-slate-100">
                            {row.learnerName}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                            {row.gradeSection}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                            {row.language}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                row.latestReadingProfile === "Independent"
                                  ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : row.latestReadingProfile === "Instructional"
                                    ? "bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                                    : row.latestReadingProfile === "Frustration"
                                      ? "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                                      : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400"
                              }`}
                            >
                              {row.latestReadingProfile}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-[#166534] dark:bg-emerald-950/40 dark:text-emerald-300">
                              {row.outcome}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                            {row.assessmentPeriod}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenOutcome(row)}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/10 dark:bg-[var(--card)] dark:text-slate-300"
                            >
                              <Eye size={12} />
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {outcomesList.length > PAGE_SIZE ? (
                    <AdminTablePagination
                      page={safeOutcomePage}
                      pageSize={PAGE_SIZE}
                      total={outcomesList.length}
                      onPageChange={setOutcomePage}
                      itemLabel="outcomes"
                    />
                  ) : null}
                </div>
              </div>
            ) : (
              /* 17. EMPTY OUTCOME STATE */
              <div className="py-8 text-center">
                <Info size={28} className="mx-auto text-slate-300 dark:text-slate-600" />
                <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  No learner outcomes yet.
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  Outcomes will appear after the applicable assessment and support stages are completed.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* 16. OUTCOME DETAIL MODAL (Read-only for Principal) */}
      <PrincipalAralOutcomeModal
        open={isModalOpen}
        outcomeRecord={selectedOutcome}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedOutcome(null);
        }}
      />

      {/* 17. EXPORT ARAL & PHIL-IRI REPORT MODAL */}
      <ExportAralReportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        schoolYear={schoolYear}
        period={aralPeriod}
        language={formLanguage}
        scopeLabel={
          viewMode === "form2"
            ? "Phil-IRI Form 2 Reading Profile"
            : viewMode === "form5"
            ? "Phil-IRI Form 5 Reading Summary"
            : "ARAL Program Oversight"
        }
        learners={canonicalLearners}
        form2Data={form2Data}
        form5Data={form5Data}
        teacherName="School Principal"
        initialReportType={viewMode === "form5" ? "form5" : "form2"}
        allowFormSelection={true}
      />
    </div>
  );
}
