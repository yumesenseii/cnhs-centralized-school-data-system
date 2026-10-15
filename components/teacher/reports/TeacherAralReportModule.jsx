"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Layers3,
  BookOpen,
  Languages,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import AppSelect from "@/components/shared/AppSelect";
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
import { aggregateAralLearners } from "@/lib/monitoring/aralLearnerAggregation";
import { computeFacilitatorReportData } from "@/lib/reports/aralReportsAggregation";
import {
  ARAL_ASSESSMENT_PERIODS,
  ARAL_PERIOD_LABELS,
  aralPeriodLabel,
} from "@/lib/monitoring/assessmentTimeline";

const PAGE_SIZE = 10;

const PERIOD_OPTIONS = [
  { value: ARAL_ASSESSMENT_PERIODS.BOSY, label: "Beginning Assessment (BOSY)" },
  { value: ARAL_ASSESSMENT_PERIODS.MOSY, label: "Mid-Year Assessment (MOSY)" },
  { value: ARAL_ASSESSMENT_PERIODS.EOSY, label: "End-of-Year Assessment (EOSY)" },
];

const GRADE_OPTIONS = [
  { value: "All Grades", label: "All Grades" },
  { value: "Grade 7", label: "Grade 7" },
  { value: "Grade 8", label: "Grade 8" },
  { value: "Grade 9", label: "Grade 9" },
  { value: "Grade 10", label: "Grade 10" },
];

const LANGUAGE_OPTIONS = [
  { value: "All Languages", label: "All Languages" },
  { value: "English", label: "English" },
  { value: "Filipino", label: "Filipino" },
];

export default function TeacherAralReportModule({
  students = [],
  teacherId = null,
  teacherName = "",
  schoolYear = "SY 2026-2027",
  schoolYears = ["SY 2026-2027", "SY 2025-2026"],
  initialPeriod = "BOSY",
}) {
  const [selectedSchoolYear, setSelectedSchoolYear] = useState(schoolYear);
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod || "BOSY");
  const [selectedGrade, setSelectedGrade] = useState("All Grades");
  const [selectedLanguage, setSelectedLanguage] = useState("All Languages");
  const [page, setPage] = useState(1);

  // 1. Authoritative aggregation: 1 row per learner + language + school year
  const canonicalLearners = useMemo(() => {
    return aggregateAralLearners(students, {
      currentTeacherId: teacherId,
      schoolYear: selectedSchoolYear,
    });
  }, [students, teacherId, selectedSchoolYear]);

  // 2. Compute Facilitator Report data directly from canonical records
  const reportData = useMemo(() => {
    return computeFacilitatorReportData(canonicalLearners, {
      teacherId,
      teacherName,
      schoolYear: selectedSchoolYear,
      aralPeriod: selectedPeriod,
      grade: selectedGrade,
      language: selectedLanguage,
    });
  }, [
    canonicalLearners,
    teacherId,
    teacherName,
    selectedSchoolYear,
    selectedPeriod,
    selectedGrade,
    selectedLanguage,
  ]);

  // Reset page when filters change
  const handleGradeChange = (val) => {
    setSelectedGrade(val);
    setPage(1);
  };
  const handleLanguageChange = (val) => {
    setSelectedLanguage(val);
    setPage(1);
  };
  const handlePeriodChange = (val) => {
    setSelectedPeriod(val);
    setPage(1);
  };
  const handleSchoolYearChange = (val) => {
    setSelectedSchoolYear(val);
    setPage(1);
  };

  // Pagination for learner breakdown
  const learnersList = reportData.learnerBreakdown || [];
  const totalPages = Math.max(1, Math.ceil(learnersList.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedLearners = learnersList.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // If teacher is NOT an assigned facilitator, show read-only referral status
  if (!reportData.isFacilitator) {
    const referredList = reportData.referredLearners || [];

    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
        <div className="border-b border-slate-100 pb-3 dark:border-white/5">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-white/10 dark:text-slate-300">
              Referral Status (Read-Only)
            </span>
          </div>
          <h2 className="mt-2 text-base font-bold text-slate-900 dark:text-slate-100">
            ARAL Reading Referrals
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Read-only status of learners you referred for reading assessment. Full ARAL reporting is reserved for teachers assigned by the Principal as ARAL facilitators.
          </p>
        </div>

        {referredList.length === 0 ? (
          <div className="py-8 text-center">
            <Info size={28} className="mx-auto text-slate-300 dark:text-slate-600" />
            <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-400">
              You have not been assigned by the Principal as an ARAL facilitator and have no active reading referrals.
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              When assigned to conduct reading assessments or handle ARAL sessions, your full ARAL Learners Report will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-white/[0.02]">
                  <th className="px-3 py-2.5">Learner</th>
                  <th className="px-3 py-2.5">Grade & Section</th>
                  <th className="px-3 py-2.5">Language</th>
                  <th className="px-3 py-2.5">Principal Review</th>
                  <th className="px-3 py-2.5">Assigned Facilitator</th>
                  <th className="px-3 py-2.5">Current Stage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {referredList.map((row) => (
                  <tr key={row.id || row.studentId} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2.5 font-semibold text-slate-800 dark:text-slate-200">
                      {row.name || `${row.lastName || ""}, ${row.firstName || ""}`.trim()}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                      {row.gradeSectionDisplay || `${row.grade} · ${row.section}`}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                      {row.language || row.subject || "English"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300">
                        {row.aralApprovalStatus || "Under Review"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                      {row.aralFacilitatorName || "Unassigned"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400">
                      {row.currentStepLabel || "Waiting for Review"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // Teacher IS an assigned facilitator: Render full report flow
  const { summaryCounts, assessmentStatusTable, readingProfileTable, readingProfileChartData, totalAssessed, hasReadingProfiles, shortInterpretation, progressReport } = reportData;

  const schoolYearOptions = schoolYears.map((y) => ({ value: y, label: y }));

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-white/10 dark:bg-[var(--card)]">
      {/* 1. FACILITATOR REPORT HEADER */}
      <div className="border-b border-slate-100 pb-4 dark:border-white/5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#166534] dark:bg-emerald-950/40 dark:text-emerald-300">
                Assigned by Principal
              </span>
            </div>
            <h2 className="mt-1.5 text-lg font-bold tracking-tight text-[#166534] dark:text-emerald-400">
              MY ARAL LEARNERS REPORT
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
              {aralPeriodLabel(selectedPeriod)} · {selectedSchoolYear}
            </p>
          </div>

          {/* Minimal, relevant filters: School Year, Period, Grade, Language (No unrelated subjects) */}
          <div className="flex flex-wrap items-center gap-2">
            <AppSelect
              label="School Year"
              value={selectedSchoolYear}
              onChange={handleSchoolYearChange}
              options={schoolYearOptions}
              icon={CalendarDays}
              size="pill"
              className="w-[148px]"
            />
            <AppSelect
              label="Assessment Period"
              value={selectedPeriod}
              onChange={handlePeriodChange}
              options={PERIOD_OPTIONS}
              icon={Layers3}
              size="pill"
              className="w-[160px]"
            />
            <AppSelect
              label="Grade"
              value={selectedGrade}
              onChange={handleGradeChange}
              options={GRADE_OPTIONS}
              icon={BookOpen}
              size="pill"
              className="w-[120px]"
            />
            <AppSelect
              label="Language"
              value={selectedLanguage}
              onChange={handleLanguageChange}
              options={LANGUAGE_OPTIONS}
              icon={Languages}
              size="pill"
              className="w-[130px]"
            />
          </div>
        </div>
      </div>

      {/* 2. FACILITATOR SUMMARY (5 simple counts, avoid technical labels) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 text-center dark:border-white/10 dark:bg-white/[0.02]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Assigned Learners
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {summaryCounts.assigned}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 text-center dark:border-white/10 dark:bg-white/[0.02]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Waiting for Assessment
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-amber-700 dark:text-amber-400">
            {summaryCounts.waitingForAssessment}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 text-center dark:border-white/10 dark:bg-white/[0.02]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Needs Individual Assessment
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-blue-700 dark:text-blue-400">
            {summaryCounts.needsIndividualAssessment}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 text-center dark:border-white/10 dark:bg-white/[0.02]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Under ARAL Support
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {summaryCounts.underAralSupport}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 text-center dark:border-white/10 dark:bg-white/[0.02]">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Completed
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-700 dark:text-slate-300">
            {summaryCounts.completed}
          </p>
        </div>
      </div>

      {/* 3. TABLE 1: ASSESSMENT STATUS REPORT */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/10 dark:bg-[var(--card)]">
        <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 dark:border-white/5 dark:bg-white/[0.02]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#166534] dark:text-emerald-400">
            TABLE 1. ASSESSMENT STATUS
          </h3>
        </div>
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500 dark:border-white/5">
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right tabular-nums">Learners</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {assessmentStatusTable.map((row) => (
              <tr key={row.status} className="hover:bg-slate-50/50">
                <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{row.status}</td>
                <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {row.learners}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 4. TABLE 2: READING PROFILE REPORT & CHART (Only when valid profiles exist) */}
      {hasReadingProfiles ? (
        <div className="space-y-3 rounded-xl border border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-[var(--card)]">
          <div className="border-b border-slate-100 pb-2.5 dark:border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#166534] dark:text-emerald-400">
              TABLE 2. READING PROFILE SUMMARY
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Phil-IRI oral reading profile distribution among assessed learners.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Table 2 */}
            <div className="overflow-hidden rounded-lg border border-slate-100 dark:border-white/5">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-white/[0.02]">
                    <th className="px-3 py-2">Reading Profile</th>
                    <th className="px-3 py-2 text-center tabular-nums">Learners</th>
                    <th className="px-3 py-2 text-right tabular-nums">Percentage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {readingProfileTable.map((row) => (
                    <tr key={row.profile} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                        {row.profile}
                      </td>
                      <td className="px-3 py-2 text-center font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                        {row.count}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600 dark:text-slate-400">
                        {row.percentage}%
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/80 font-bold dark:bg-white/[0.02]">
                    <td className="px-3 py-2 text-slate-800 dark:text-slate-100">
                      Total Assessed / Profiles Available
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums text-slate-900 dark:text-slate-100">
                      {totalAssessed}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-900 dark:text-slate-100">
                      100%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Simple Bar Chart */}
            <div className="h-[180px] w-full rounded-lg border border-slate-100 p-2 dark:border-white/5">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={readingProfileChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="profile" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "11px" }}
                    formatter={(val) => [`${val} learners`, "Learners"]}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={32}>
                    {readingProfileChartData.map((entry) => (
                      <Cell key={entry.profile} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 5. SHORT INTERPRETATION (Rule-based, actual counts only) */}
          {shortInterpretation ? (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-3 text-xs text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
              <span className="font-semibold">Interpretation: </span>
              {shortInterpretation}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-white/[0.02]">
          <p className="font-medium text-slate-700 dark:text-slate-300">
            No valid Phil-IRI reading profiles recorded yet for {aralPeriodLabel(selectedPeriod)}.
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Table 2 and reading profile charts will appear once individual reading assessments are conducted.
          </p>
        </div>
      )}

      {/* 6. FACILITATOR PROGRESS REPORT */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 dark:border-white/10 dark:bg-[var(--card)]">
        <div className="border-b border-slate-100 pb-2.5 dark:border-white/5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#166534] dark:text-emerald-400">
            READING PROGRESS
          </h3>
        </div>

        {progressReport?.isAvailable ? (
          <div className="mt-3">
            <p className="mb-2 text-[11px] font-medium text-slate-500">
              {progressReport.label}
            </p>
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/5">
                  <th className="px-3 py-2">Profile</th>
                  <th className="px-3 py-2 text-center tabular-nums">BOSY</th>
                  <th className="px-3 py-2 text-center tabular-nums">{selectedPeriod}</th>
                  <th className="px-3 py-2 text-right tabular-nums">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {progressReport.rows.map((r) => (
                  <tr key={r.profile} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-300">
                      {r.profile}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums text-slate-600 dark:text-slate-400">
                      {r.bosy}
                    </td>
                    <td className="px-3 py-2 text-center font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                      {r.current}
                    </td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums text-slate-800 dark:text-slate-100">
                      {r.change}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/40 p-3 text-xs text-slate-500 dark:border-white/5 dark:bg-white/[0.02]">
            {progressReport?.notice || "Progress comparison will appear after the next applicable assessment period."}
          </div>
        )}
      </div>

      {/* 7. FACILITATOR LEARNER BREAKDOWN (10 per page, read-only) */}
      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/10 dark:bg-[var(--card)]">
        <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-white/5 dark:bg-white/[0.02]">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#166534] dark:text-emerald-400">
            FACILITATOR LEARNER BREAKDOWN
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Read-only summary of assigned learners. Assessment recording and progress updates are managed in ARAL Monitoring.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/5">
                <th className="px-4 py-2.5">Learner</th>
                <th className="px-4 py-2.5">Grade & Section</th>
                <th className="px-4 py-2.5">Language</th>
                <th className="px-4 py-2.5">Reading Profile</th>
                <th className="px-4 py-2.5">Current ARAL Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {learnersList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">
                    No assigned learners match the selected filters.
                  </td>
                </tr>
              ) : (
                pagedLearners.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-2.5 font-semibold text-slate-800 dark:text-slate-200">
                      {row.name}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">
                      {row.gradeSection}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">
                      {row.language}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          row.readingProfile === "Independent"
                            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : row.readingProfile === "Instructional"
                              ? "bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                              : row.readingProfile === "Frustration"
                                ? "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
                                : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400"
                        }`}
                      >
                        {row.readingProfile}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                      {row.currentAralStatus}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 10 per page pagination */}
        {learnersList.length > PAGE_SIZE ? (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500 dark:border-white/5">
            <span>
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, learnersList.length)} of {learnersList.length} learners
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:bg-[var(--card)]"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                {safePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-white/10 dark:bg-[var(--card)]"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
