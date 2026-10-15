"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  Layers,
  Search,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ARAL_APPROVAL_STATUS } from "@/lib/monitoring/aralApproval";
import { isAralRecommended } from "@/lib/monitoring/aralProgress";
import {
  MONITORING_STATUS,
  RECOMMENDATION,
  RISK_LEVEL,
  normalizeRiskLevel,
} from "@/lib/monitoring/recommendations";
import TablePagination from "@/components/academic-records/TablePagination";

const PAGE_SIZE = 10;

function parseGradeLevel(gradeSection, gradeLevel) {
  if (gradeLevel != null && gradeLevel !== "") {
    const raw = String(gradeLevel).trim();
    const num = raw.replace(/\D/g, "");
    if (num) return `Grade ${num}`;
    return raw;
  }
  const match = String(gradeSection || "").match(/Grade\s*(\d+)/i);
  return match ? `Grade ${match[1]}` : "Other";
}

function parseCleanSectionName(rawSection) {
  let s = String(rawSection || "Unassigned").trim();
  s = s.replace(/^(Grade\s*\d+\s*[-—–:]*\s*)+/i, "").trim();
  return s || rawSection || "Unassigned";
}

function parseGradeSortKey(gradeStr) {
  const n = Number(String(gradeStr).replace(/\D/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 999;
}

export default function AdminGradeProgressMatrix({
  students = [],
  dedupedStudents = [],
  classSummaries = [],
  onViewStudent,
  schoolYear = "SY 2026-2027",
  quarter = "All Terms",
}) {
  const [search, setSearch] = useState("");
  const [selectedGradeFilter, setSelectedGradeFilter] = useState("All Sections");
  const [page, setPage] = useState(1);

  // Drill-down section state
  const [openedSectionKey, setOpenedSectionKey] = useState(null);
  const [openedSectionSearch, setOpenedSectionSearch] = useState("");
  const [openedSectionPage, setOpenedSectionPage] = useState(1);

  // Use deduplicated learners to guarantee unique learner totals per section
  const sourceLearners = dedupedStudents.length ? dedupedStudents : students;

  // Build matrix rows by Section
  const matrixData = useMemo(() => {
    const sectionsMap = new Map();

    for (const student of sourceLearners) {
      const rawSection = student.section || student.gradeSection || "Unassigned";
      const sectionName = parseCleanSectionName(rawSection);
      const gradeLabel = parseGradeLevel(
        student.gradeSection,
        student.gradeLevel || student.grade
      );
      const sectionKey = `${gradeLabel} — ${sectionName}`;

      if (!sectionsMap.has(sectionKey)) {
        sectionsMap.set(sectionKey, {
          sectionKey,
          grade: gradeLabel,
          sectionName,
          students: new Map(),
        });
      }

      const sec = sectionsMap.get(sectionKey);
      const studentId = student.studentId || student.id;
      if (!sec.students.has(studentId)) {
        sec.students.set(studentId, student);
      }
    }

    const rows = [];
    for (const [sectionKey, sec] of sectionsMap.entries()) {
      const learnerList = Array.from(sec.students.values());
      const totalEnrolled = learnerList.length;

      const immediateReviewList = learnerList.filter(
        (s) =>
          normalizeRiskLevel(s.riskLevel) === RISK_LEVEL.HIGH ||
          s.riskPriority === true
      );
      const needsMonitoringList = learnerList.filter(
        (s) =>
          normalizeRiskLevel(s.riskLevel) === RISK_LEVEL.MODERATE &&
          !(
            normalizeRiskLevel(s.riskLevel) === RISK_LEVEL.HIGH ||
            s.riskPriority === true
          )
      );
      const underSupportList = learnerList.filter(
        (s) =>
          s.recommendation === RECOMMENDATION.REMEDIATION ||
          s.classroomRemedialRecommended ||
          s.monitoringStatus === MONITORING_STATUS.ONGOING
      );

      const needingReviewCount =
        immediateReviewList.length + needsMonitoringList.length;

      let status = "On Track";
      let statusTone = "green";
      if (immediateReviewList.length > 0) {
        status = "Needs Review";
        statusTone = "amber";
      } else if (underSupportList.length > 0 || needsMonitoringList.length > 0) {
        status = "Under Support";
        statusTone = "blue";
      }

      rows.push({
        sectionKey,
        grade: sec.grade,
        sectionName: sec.sectionName,
        totalEnrolled,
        immediateReviewCount: immediateReviewList.length,
        needsMonitoringCount: needsMonitoringList.length,
        needingReviewCount,
        underSupportCount: underSupportList.length,
        status,
        statusTone,
        learners: learnerList,
      });
    }

    // Sort by Grade Level then Section Name
    rows.sort((a, b) => {
      const gDiff = parseGradeSortKey(a.grade) - parseGradeSortKey(b.grade);
      if (gDiff !== 0) return gDiff;
      return a.sectionName.localeCompare(b.sectionName);
    });

    return rows;
  }, [sourceLearners]);

  // Distinct grades for filter pills with section counts
  const availableGrades = useMemo(() => {
    const gradeCounts = new Map();
    for (const r of matrixData) {
      gradeCounts.set(r.grade, (gradeCounts.get(r.grade) || 0) + 1);
    }

    const distinct = Array.from(gradeCounts.keys()).sort(
      (a, b) => parseGradeSortKey(a) - parseGradeSortKey(b)
    );

    return [
      { label: "All Sections", count: matrixData.length },
      ...distinct.map((g) => ({
        label: g,
        count: gradeCounts.get(g) || 0,
      })),
    ];
  }, [matrixData]);

  // Filter rows for the main sections table
  const filteredSections = useMemo(() => {
    return matrixData.filter((row) => {
      const matchesGrade =
        selectedGradeFilter === "All Sections" ||
        row.grade === selectedGradeFilter;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        row.sectionKey.toLowerCase().includes(q) ||
        row.sectionName.toLowerCase().includes(q) ||
        row.grade.toLowerCase().includes(q);
      return matchesGrade && matchesSearch;
    });
  }, [matrixData, selectedGradeFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredSections.length / PAGE_SIZE));
  const pagedSections = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredSections.slice(start, start + PAGE_SIZE);
  }, [filteredSections, page]);

  // Find currently opened section if any
  const openedSection = useMemo(() => {
    if (!openedSectionKey) return null;
    return matrixData.find((r) => r.sectionKey === openedSectionKey) || null;
  }, [matrixData, openedSectionKey]);

  // Filter learners inside the opened section
  const openedSectionFilteredLearners = useMemo(() => {
    if (!openedSection) return [];
    const q = openedSectionSearch.trim().toLowerCase();
    if (!q) return openedSection.learners;
    return openedSection.learners.filter(
      (l) =>
        l.name?.toLowerCase().includes(q) ||
        (Array.isArray(l.subjects)
          ? l.subjects.some((sub) => sub.toLowerCase().includes(q))
          : l.subject?.toLowerCase().includes(q))
    );
  }, [openedSection, openedSectionSearch]);

  const openedSectionTotalPages = Math.max(
    1,
    Math.ceil(openedSectionFilteredLearners.length / PAGE_SIZE)
  );
  const openedSectionPagedLearners = useMemo(() => {
    const start = (openedSectionPage - 1) * PAGE_SIZE;
    return openedSectionFilteredLearners.slice(start, start + PAGE_SIZE);
  }, [openedSectionFilteredLearners, openedSectionPage]);

  // If a section is opened, show section drill-down view
  if (openedSection) {
    return (
      <div className="space-y-3">
        {/* Section Header & Navigation */}
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between dark:border-white/5 dark:bg-[var(--card)]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setOpenedSectionKey(null);
                setOpenedSectionSearch("");
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            >
              <ChevronLeft size={15} />
              Back to all sections
            </button>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {openedSection.grade} — {openedSection.sectionName}
              </h3>
              <p className="text-xs text-slate-500">
                {openedSection.totalEnrolled} enrolled learners · {schoolYear} · {quarter}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-300">
              {openedSection.totalEnrolled} Enrolled
            </span>
            {openedSection.immediateReviewCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
                <AlertTriangle size={12} />
                {openedSection.immediateReviewCount} Needs Immediate Review
              </span>
            ) : null}
            {openedSection.needsMonitoringCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-300">
                {openedSection.needsMonitoringCount} Needs Monitoring
              </span>
            ) : null}
            {openedSection.underSupportCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                {openedSection.underSupportCount} Under Support
              </span>
            ) : null}
          </div>
        </div>

        {/* Section Learner Filter & Search */}
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-white/5 dark:bg-[var(--card)]">
          <div className="relative min-w-0 flex-1">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={openedSectionSearch}
              onChange={(e) => {
                setOpenedSectionSearch(e.target.value);
                setOpenedSectionPage(1);
              }}
              placeholder="Search learner name or subject in this section…"
              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-cnhs-green focus:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            />
          </div>
        </div>

        {/* Section Learners Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-white/5 dark:bg-[var(--card)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-white/[0.03] dark:text-slate-400">
                  <th className="px-4 py-3">Learner</th>
                  <th className="px-3 py-3">Subject</th>
                  <th className="px-3 py-3 text-center">Current Grade</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-3.5 py-3">Current Support</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {openedSectionPagedLearners.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      No learners match your search in this section.
                    </td>
                  </tr>
                ) : (
                  openedSectionPagedLearners.map((learner) => {
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

                    let statusLabel = "On Track";
                    let statusClass =
                      "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400";

                    if (isHigh) {
                      statusLabel = "Needs Immediate Review";
                      statusClass =
                        "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400 font-bold";
                    } else if (isImproving) {
                      statusLabel = "Improving";
                      statusClass =
                        "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400";
                    } else if (isRemedial) {
                      statusLabel = "Under Class Remedial";
                      statusClass =
                        "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400";
                    } else if (isMod) {
                      statusLabel = "Needs Monitoring";
                      statusClass =
                        "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300";
                    }

                    const subjectsDisplay =
                      Array.isArray(learner.subjects) && learner.subjects.length
                        ? learner.subjects.join(", ")
                        : learner.subject || "Enrolled Subjects";

                    const gradeDisplay =
                      learner.classSubjectGrade ??
                      learner.generalAverage ??
                      "—";

                    const hasAralReferral =
                      isAralRecommended(learner) ||
                      learner.aralApprovalStatus === ARAL_APPROVAL_STATUS.SUBMITTED ||
                      learner.aralApprovalStatus === ARAL_APPROVAL_STATUS.SUGGESTED;
                    const inAralProgram =
                      learner.aralApprovalStatus === ARAL_APPROVAL_STATUS.APPROVED ||
                      learner.inAralProgram;

                    return (
                      <tr
                        key={learner.id || learner.studentId}
                        className="transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                          {learner.name}
                        </td>
                        <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                          {subjectsDisplay}
                        </td>
                        <td className="px-3 py-3 text-center font-bold text-slate-800 dark:text-slate-200">
                          {gradeDisplay}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-[11px]",
                              statusClass
                            )}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-3.5 py-3">
                          {inAralProgram ? (
                            <span className="text-[11px] font-medium text-purple-700 dark:text-purple-400">
                              In ARAL Program
                            </span>
                          ) : hasAralReferral ? (
                            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                              ARAL Referral: Pending Principal Review
                            </span>
                          ) : isRemedial ? (
                            <span className="text-[11px] font-medium text-blue-700 dark:text-blue-400">
                              Class Remedial
                            </span>
                          ) : learner.monitoringStatus ===
                            MONITORING_STATUS.ONGOING ? (
                            <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                              Ongoing Monitoring
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500">
                              Classroom Monitoring
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => onViewStudent?.(learner)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-cnhs-green-dark px-3 py-1 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#1b5842]"
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

          {openedSectionFilteredLearners.length > PAGE_SIZE ? (
            <div className="border-t border-slate-100 p-2.5 dark:border-white/5">
              <TablePagination
                page={openedSectionPage}
                totalPages={openedSectionTotalPages}
                onPageChange={setOpenedSectionPage}
                totalItems={openedSectionFilteredLearners.length}
                pageSize={PAGE_SIZE}
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // Section List View
  return (
    <div className="space-y-3">
      {/* Search & Grade Quick-Filters */}
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
            placeholder="Search grade or section name…"
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-cnhs-green focus:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          />
        </div>

        {/* Visible Grade Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          {availableGrades.map(({ label, count }) => {
            const isSelected = selectedGradeFilter === label;
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setSelectedGradeFilter(label);
                  setPage(1);
                }}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  isSelected
                    ? "bg-cnhs-green-dark text-white shadow-xs"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                )}
              >
                {label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sections Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-white/5 dark:bg-[var(--card)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-white/5 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-cnhs-green-dark" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Sections Academic Overview
            </h3>
          </div>
          <p className="text-xs font-medium text-slate-500">
            {filteredSections.length} section{filteredSections.length === 1 ? "" : "s"} shown
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-white/[0.03] dark:text-slate-400">
                <th className="px-4 py-3">Grade & Section</th>
                <th className="px-3.5 py-3 text-center">Total Learners</th>
                <th className="px-3.5 py-3 text-center">Learners Needing Review</th>
                <th className="px-3.5 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {pagedSections.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No sections match your search or filter criteria.
                  </td>
                </tr>
              ) : (
                pagedSections.map((row) => {
                  const gradeNum = String(row.grade).replace(/\D/g, "");
                  const badgeLabel = gradeNum ? `G${gradeNum}` : "G";

                  return (
                    <tr
                      key={row.sectionKey}
                      className="transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cnhs-green-soft text-xs font-bold text-cnhs-green-dark dark:bg-cnhs-green-dark/20 dark:text-cnhs-green">
                            {badgeLabel}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-slate-100">
                              {row.sectionName}
                            </p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">
                              {row.grade}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-3.5 py-3 text-center font-bold text-slate-800 dark:text-slate-200">
                        {row.totalEnrolled}
                      </td>

                      <td className="px-3.5 py-3 text-center">
                        {row.immediateReviewCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
                            <AlertTriangle size={11} />
                            {row.immediateReviewCount} Immediate
                            {row.needsMonitoringCount > 0 ? ` + ${row.needsMonitoringCount} Monitoring` : ""}
                          </span>
                        ) : row.needsMonitoringCount > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-300">
                            {row.needsMonitoringCount} Monitoring
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-3.5 py-3 text-center">
                        {row.statusTone === "amber" ? (
                          <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
                            Needs Review
                          </span>
                        ) : row.statusTone === "blue" ? (
                          <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                            Under Support
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400">
                            On Track
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenedSectionKey(row.sectionKey);
                            setOpenedSectionPage(1);
                            setOpenedSectionSearch("");
                          }}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-cnhs-green-dark/90"
                        >
                          Open
                          <ArrowRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Section List Pagination */}
        {filteredSections.length > PAGE_SIZE ? (
          <div className="border-t border-slate-100 p-2.5 dark:border-white/5">
            <TablePagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={filteredSections.length}
              pageSize={PAGE_SIZE}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
