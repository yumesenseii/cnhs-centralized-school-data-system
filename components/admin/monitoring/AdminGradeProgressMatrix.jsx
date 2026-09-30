"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock3,
  GraduationCap,
  Layers,
  Search,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ARAL_APPROVAL_STATUS } from "@/lib/monitoring/aralApproval";
import { isAralRecommended, isAralProgramLearner } from "@/lib/monitoring/aralProgress";
import { RECOMMENDATION, RISK_LEVEL } from "@/lib/monitoring/recommendations";
import TablePagination from "@/components/academic-records/TablePagination";

const PAGE_SIZE = 12;

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
  classSummaries = [],
  onNavigateTab,
  onViewStudent,
  schoolYear = "SY 2026-2027",
  quarter = "All Terms",
}) {
  const [search, setSearch] = useState("");
  const [selectedGradeFilter, setSelectedGradeFilter] = useState("All Grades");
  const [page, setPage] = useState(1);

  // Build matrix rows by Section
  const matrixData = useMemo(() => {
    const sectionsMap = new Map();

    // Group students by section key
    for (const student of students) {
      const rawSection = student.section || student.gradeSection || "Unassigned";
      const sectionName = parseCleanSectionName(rawSection);
      const gradeLabel = parseGradeLevel(student.gradeSection, student.gradeLevel || student.grade);
      const sectionKey = `${gradeLabel} — ${sectionName}`;

      if (!sectionsMap.has(sectionKey)) {
        sectionsMap.set(sectionKey, {
          sectionKey,
          grade: gradeLabel,
          sectionName,
          students: new Map(),
          facilitatorNames: new Set(),
        });
      }

      const sec = sectionsMap.get(sectionKey);
      const studentId = student.studentId || student.id;
      if (!sec.students.has(studentId)) {
        sec.students.set(studentId, student);
      } else {
        // Merge records for multiple subject enrollments
        const existing = sec.students.get(studentId);
        if (student.aralApprovalStatus) existing.aralApprovalStatus = student.aralApprovalStatus;
        if (student.aralFacilitatorName) existing.aralFacilitatorName = student.aralFacilitatorName;
        if (student.atRisk) existing.atRisk = true;
      }

      if (student.aralFacilitatorName && student.aralFacilitatorName !== "—") {
        sec.facilitatorNames.add(student.aralFacilitatorName);
      }
    }

    const rows = [];
    for (const [sectionKey, sec] of sectionsMap.entries()) {
      const learnerList = Array.from(sec.students.values());
      const totalEnrolled = learnerList.length;
      
      const atRiskList = learnerList.filter((s) => s.atRisk || s.riskLevel === RISK_LEVEL.HIGH);
      const aralCandidates = learnerList.filter((s) => isAralRecommended(s) || (s.aralEligible && s.belowPassing));
      const pendingReview = learnerList.filter(
        (s) =>
          s.aralApprovalStatus === ARAL_APPROVAL_STATUS.SUBMITTED ||
          s.aralApprovalStatus === ARAL_APPROVAL_STATUS.SUGGESTED
      );
      const aralApproved = learnerList.filter((s) => s.aralApprovalStatus === ARAL_APPROVAL_STATUS.APPROVED || s.inAralProgram);
      const classroomRemedial = learnerList.filter(
        (s) => s.atRisk && !isAralRecommended(s) && s.recommendation !== RECOMMENDATION.ARAL
      );

      const facilitators = Array.from(sec.facilitatorNames);
      const hasUnassignedFacilitator = aralApproved.some((s) => !s.aralFacilitatorTeacherId && !s.aralFacilitatorName);

      rows.push({
        sectionKey,
        grade: sec.grade,
        sectionName: sec.sectionName,
        totalEnrolled,
        atRiskCount: atRiskList.length,
        aralCandidateCount: aralCandidates.length,
        pendingReviewCount: pendingReview.length,
        aralApprovedCount: aralApproved.length,
        classroomRemedialCount: classroomRemedial.length,
        facilitators,
        hasUnassignedFacilitator,
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
  }, [students]);

  // Distinct grades for filter pill
  const availableGrades = useMemo(() => {
    const set = new Set(matrixData.map((r) => r.grade));
    return ["All Grades", ...Array.from(set).sort((a, b) => parseGradeSortKey(a) - parseGradeSortKey(b))];
  }, [matrixData]);

  // Filter rows
  const filteredRows = useMemo(() => {
    return matrixData.filter((row) => {
      const matchesGrade = selectedGradeFilter === "All Grades" || row.grade === selectedGradeFilter;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        row.sectionKey.toLowerCase().includes(q) ||
        row.sectionName.toLowerCase().includes(q) ||
        row.grade.toLowerCase().includes(q) ||
        row.facilitators.some((f) => f.toLowerCase().includes(q));
      return matchesGrade && matchesSearch;
    });
  }, [matrixData, selectedGradeFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

  // Summary statistics across whole school
  const schoolSummary = useMemo(() => {
    let totalLearners = 0;
    let totalAtRisk = 0;
    let totalPendingReview = 0;
    let totalAralApproved = 0;
    let totalClassroomRemedial = 0;

    for (const r of matrixData) {
      totalLearners += r.totalEnrolled;
      totalAtRisk += r.atRiskCount;
      totalPendingReview += r.pendingReviewCount;
      totalAralApproved += r.aralApprovedCount;
      totalClassroomRemedial += r.classroomRemedialCount;
    }

    return {
      totalLearners,
      totalAtRisk,
      totalPendingReview,
      totalAralApproved,
      totalClassroomRemedial,
      totalSections: matrixData.length,
    };
  }, [matrixData]);

  return (
    <div className="space-y-4">
      {/* Matrix Controls & Search */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between dark:border-white/5 dark:bg-[var(--card)]">
        <div className="relative min-w-0 flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search grade, section, or facilitator name…"
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-9 pr-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-cnhs-green focus:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          />
        </div>

        {/* Grade Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          {availableGrades.map((grade) => {
            const isSelected = selectedGradeFilter === grade;
            return (
              <button
                key={grade}
                type="button"
                onClick={() => {
                  setSelectedGradeFilter(grade);
                  setPage(1);
                }}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  isSelected
                    ? "bg-cnhs-green-dark text-white shadow-xs"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                )}
              >
                {grade}
              </button>
            );
          })}
        </div>
      </div>

      {/* Progress Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/5 dark:bg-[var(--card)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 dark:border-white/5 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <Layers size={15} className="text-cnhs-green-dark" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Grade & Section Learning Support Summary
            </h3>
          </div>
          <p className="text-[11px] font-medium text-slate-500">
            {schoolSummary.totalSections} sections · {schoolSummary.totalLearners} learners enrolled
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-white/[0.03] dark:text-slate-400">
                <th className="px-3.5 py-2.5">Grade & Section</th>
                <th className="px-3 py-2.5 text-center">Enrolled</th>
                <th className="px-3 py-2.5 text-center">At-Risk Learners</th>
                <th className="px-3 py-2.5 text-center">Identified for ARAL</th>
                <th className="px-3 py-2.5 text-center">Awaiting Approval</th>
                <th className="px-3 py-2.5 text-center">In ARAL Program</th>
                <th className="px-3 py-2.5 text-center">Classroom Remediation</th>
                <th className="px-3.5 py-2.5">Facilitator Assigned</th>
                <th className="px-3 py-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No grade sections match your search or filter criteria.
                  </td>
                </tr>
              ) : (
                pagedRows.map((row) => {
                  const gradeNum = String(row.grade).replace(/\D/g, "");
                  const badgeLabel = gradeNum ? `G${gradeNum}` : "G";
                  return (
                    <tr
                      key={row.sectionKey}
                      className="transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[0.02]"
                    >
                      <td className="px-3.5 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cnhs-green-soft text-[11px] font-bold text-cnhs-green-dark dark:bg-cnhs-green-dark/20 dark:text-cnhs-green">
                            {badgeLabel}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{row.sectionName}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">{row.grade}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-2.5 text-center font-semibold text-slate-700 dark:text-slate-300">
                        {row.totalEnrolled}
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        {row.atRiskCount > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-500/10 dark:text-red-400">
                            {row.atRiskCount}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        {row.aralCandidateCount > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                            {row.aralCandidateCount}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        {row.pendingReviewCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => onNavigateTab?.("intake")}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-cnhs-orange-soft px-2.5 py-0.5 text-[10px] font-bold text-cnhs-orange hover:ring-1 hover:ring-cnhs-orange"
                            title="Click to review pending endorsements"
                          >
                            <AlertTriangle size={10} />
                            {row.pendingReviewCount} pending
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        {row.aralApprovedCount > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-500/10 dark:text-purple-400">
                            {row.aralApprovedCount} in ARAL
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-center">
                        {row.classroomRemedialCount > 0 ? (
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-400">
                            {row.classroomRemedialCount}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-3.5 py-2.5">
                        {row.facilitators.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {row.facilitators.map((name) => (
                              <span
                                key={name}
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
                              >
                                <UserCheck size={10} />
                                {name}
                              </span>
                            ))}
                          </div>
                        ) : row.aralApprovedCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => onNavigateTab?.("facilitators")}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300"
                          >
                            <UserPlus size={10} />
                            Assign facilitator
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {row.pendingReviewCount > 0 ? (
                            <button
                              type="button"
                              onClick={() => onNavigateTab?.("intake")}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-cnhs-green px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-cnhs-green-dark"
                            >
                              Review ({row.pendingReviewCount})
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onNavigateTab?.("assessments")}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                            >
                              Progress
                              <ArrowRight size={10} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Pagination */}
        {filteredRows.length > PAGE_SIZE ? (
          <div className="border-t border-slate-100 p-2.5 dark:border-white/5">
            <TablePagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={filteredRows.length}
              pageSize={PAGE_SIZE}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

