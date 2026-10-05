"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import LearnerName from "@/components/shared/LearnerName";
import AppSelect from "@/components/shared/AppSelect";
import MonitoringTablePagination from "@/components/teacher/monitoring/MonitoringTablePagination";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function TrendIndicator({ trend }) {
  if (trend === "Improving") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
        <TrendingUp size={12} className="text-emerald-600" />
        <span>Improving</span>
      </span>
    );
  }
  if (trend === "Declining") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800">
        <TrendingDown size={12} className="text-amber-700" />
        <span>Declining</span>
      </span>
    );
  }
  if (trend === "Stable") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
        <Minus size={12} className="text-slate-400" />
        <span>Stable</span>
      </span>
    );
  }
  return <span className="text-[11px] text-slate-400">—</span>;
}

import { ArrowUpRight } from "lucide-react";

function SupportBadge({ support, onClick }) {
  if (support === "Class Remedial") {
    return (
      <span className="inline-flex items-center rounded-md border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
        Class Remedial
      </span>
    );
  }
  if (support === "ARAL Screening") {
    return onClick ? (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        title="Open reading-related intervention in ARAL Monitoring"
        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-blue-200/80 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800 transition hover:bg-blue-100"
      >
        <span>ARAL Screening</span>
        <ArrowUpRight size={11} />
      </button>
    ) : (
      <span className="inline-flex items-center rounded-md border border-blue-200/80 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
        ARAL Screening
      </span>
    );
  }
  if (support === "Review") {
    return (
      <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
        Review
      </span>
    );
  }
  return <span className="text-[11px] font-medium text-slate-500">None</span>;
}

export default function ClassRemedialsSection({
  students = [],
  currentQuarterNumber = 1,
  onViewLearner,
  onNavigateToAral,
}) {
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("All sections");
  const [quarterFilter, setQuarterFilter] = useState("All quarters");
  const [subject, setSubject] = useState("All subjects");
  const [supportFilter, setSupportFilter] = useState("All support");
  const [page, setPage] = useState(1);

  // 4 Restrained Summary Metrics (Section 2)
  const totalLearners = students.length;

  const academicSupportNeeded = useMemo(() => {
    return students.filter((s) => {
      const cur = s.classSubjectGrade ?? s.currentGrade;
      return (
        s.recommendedSupport === "Class Remedial" ||
        s.recommendedSupport === "ARAL Screening" ||
        (cur != null && Number(cur) < 75)
      );
    }).length;
  }, [students]);

  const improvingCount = useMemo(() => {
    return students.filter((s) => s.performanceTrend === "Improving").length;
  }, [students]);

  const needsAttentionCount = useMemo(() => {
    return students.filter((s) => {
      const cur = s.classSubjectGrade ?? s.currentGrade;
      return (
        s.performanceTrend === "Declining" ||
        s.recommendedSupport === "Review" ||
        (cur != null && Number(cur) < 75)
      );
    }).length;
  }, [students]);

  // Extract filter options
  const filterOptions = useMemo(() => {
    const sections = [...new Set(students.map((s) => s.section).filter(Boolean))].sort();
    const subjects = [...new Set(students.map((s) => s.subject).filter(Boolean))].sort();
    const quarters = [...new Set(students.map((s) => s.quarter).filter(Boolean))].sort();
    return { sections, subjects, quarters };
  }, [students]);

  // Filter student rows
  const filteredRows = useMemo(() => {
    let list = students;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.studentNumber?.toLowerCase().includes(q)
      );
    }

    if (section !== "All sections") {
      list = list.filter((s) => s.section === section);
    }

    if (quarterFilter !== "All quarters") {
      list = list.filter((s) => s.quarter === quarterFilter);
    }

    if (subject !== "All subjects") {
      list = list.filter((s) => s.subject === subject);
    }

    if (supportFilter !== "All support") {
      list = list.filter((s) => (s.recommendedSupport || "None") === supportFilter);
    }

    return list;
  }, [students, search, section, quarterFilter, subject, supportFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, section, quarterFilter, subject, supportFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE) || 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pagedRows = useMemo(() => {
    return filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  }, [filteredRows, safePage]);

  return (
    <div className="space-y-4">
      {/* 4 COMPACT RESTRAINED METRICS (Strong typography with simple dividers) */}
      <div className="grid grid-cols-2 rounded-xl border border-slate-200 bg-white shadow-xs divide-y sm:divide-y-0 sm:divide-x divide-slate-100 sm:grid-cols-4 overflow-hidden">
        <div className="px-5 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Learners
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 leading-none">
            {totalLearners}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Total active records</p>
        </div>

        <div className="px-5 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Academic Support Needed
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-amber-800 leading-none">
            {academicSupportNeeded}
          </p>
          <p className="mt-1 text-[11px] text-amber-700/80">Remedial or ARAL pathway</p>
        </div>

        <div className="px-5 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Improving
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-700 leading-none">
            {improvingCount}
          </p>
          <p className="mt-1 text-[11px] text-emerald-600">Positive performance trend</p>
        </div>

        <div className="px-5 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Needs Attention
          </p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-800 leading-none">
            {needsAttentionCount}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Declining or near threshold</p>
        </div>
      </div>

      {/* MAIN CLEAN SCHOOL-RECORD TABLE */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {/* Table Filters Toolbar */}
        <div className="border-b border-slate-100 p-3.5 bg-slate-50/50">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input */}
            <div className="relative min-w-[240px] flex-1">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search learner by name or LRN…"
                className="h-8.5 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[12px] text-slate-800 placeholder:text-slate-400 outline-none transition focus:border-cnhs-green focus:ring-1 focus:ring-cnhs-green/30"
              />
            </div>

            {/* Filter Dropdowns with AppSelect */}
            <div className="flex flex-wrap items-center gap-2">
              {filterOptions.sections.length > 0 ? (
                <AppSelect
                  label="All sections"
                  value={section}
                  onChange={setSection}
                  options={["All sections", ...filterOptions.sections]}
                  size="pill"
                  triggerClassName="h-8.5 text-[11px] font-semibold"
                />
              ) : null}

              {filterOptions.quarters.length > 0 ? (
                <AppSelect
                  label="All quarters"
                  value={quarterFilter}
                  onChange={setQuarterFilter}
                  options={["All quarters", ...filterOptions.quarters]}
                  size="pill"
                  triggerClassName="h-8.5 text-[11px] font-semibold"
                />
              ) : null}

              {filterOptions.subjects.length > 0 ? (
                <AppSelect
                  label="All subjects"
                  value={subject}
                  onChange={setSubject}
                  options={["All subjects", ...filterOptions.subjects]}
                  size="pill"
                  triggerClassName="h-8.5 text-[11px] font-semibold"
                />
              ) : null}

              <AppSelect
                label="All support"
                value={supportFilter}
                onChange={setSupportFilter}
                options={[
                  "All support",
                  "Class Remedial",
                  "ARAL Screening",
                  "Review",
                  "None",
                ]}
                size="pill"
                triggerClassName="h-8.5 text-[11px] font-semibold"
              />
            </div>
          </div>
        </div>

        {/* Table Sub-bar */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 bg-white px-4 py-2 text-[11px] text-slate-500">
          <span>
            Showing <strong className="text-slate-700">{filteredRows.length}</strong> enrolled learner{filteredRows.length === 1 ? "" : "s"}
          </span>
          <span className="text-[10.5px] text-slate-400">
            Click row or View to open continuous Learner Profile
          </span>
        </div>

        {/* Formal School-Record Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10.5px] font-bold uppercase tracking-wider text-slate-600">
                <th className="py-2.5 px-4">Learner</th>
                <th className="py-2.5 px-3 text-center">Current Grade</th>
                <th className="py-2.5 px-3 text-center">Previous Grade</th>
                <th className="py-2.5 px-3">Performance Trend</th>
                <th className="py-2.5 px-3 text-center">Attendance</th>
                <th className="py-2.5 px-3">Assessment</th>
                <th className="py-2.5 px-3">Support</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {pagedRows.length ? (
                pagedRows.map((row) => {
                  const curGrade = row.classSubjectGrade ?? row.currentGrade ?? null;
                  const prevGrade =
                    row.previousGrade ??
                    (currentQuarterNumber > 1 ? row.termGrades?.[currentQuarterNumber - 1] : null);
                  const isPassing = curGrade != null && Number(curGrade) >= 75;

                  const readingDisplay =
                    row.readingLevel ||
                    (row.philIriScore != null ? `GST ${row.philIriScore}/20` : null) ||
                    (row.assessmentDisplay && row.assessmentDisplay !== "Not Screened" ? row.assessmentDisplay : null);

                  const isReadingSubject = /english|filipino/i.test(row.subject || "");
                  const assessmentCell = readingDisplay || (isReadingSubject ? "Not Screened" : "—");

                  const supportVal = row.recommendedSupport || "None";
                  const trendVal = row.performanceTrend || "Stable";
                  const attVal = row.attendanceRate || "—";

                  return (
                    <tr
                      key={row.id || `${row.studentId}-${row.subject}`}
                      onClick={() => onViewLearner?.(row)}
                      className="cursor-pointer transition-colors hover:bg-slate-50/80"
                    >
                      {/* Learner */}
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900">
                          <LearnerName
                            firstName={row.firstName}
                            middleName={row.middleName}
                            lastName={row.lastName}
                            name={row.name}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono mt-0.5">
                          <span>LRN {row.studentNumber || "—"}</span>
                          <span>•</span>
                          <span className="font-sans text-slate-600">{row.grade} · {row.section}</span>
                          {row.subject ? (
                            <>
                              <span>•</span>
                              <span className="font-sans text-slate-600">{row.subject}</span>
                            </>
                          ) : null}
                        </div>
                      </td>

                      {/* Current Grade */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={cn(
                            "text-sm font-bold",
                            curGrade == null
                              ? "text-slate-400"
                              : isPassing
                              ? "text-slate-900"
                              : "text-amber-800"
                          )}
                        >
                          {curGrade != null ? curGrade : "—"}
                        </span>
                      </td>

                      {/* Previous Grade */}
                      <td className="py-2.5 px-3 text-center text-slate-600 font-medium">
                        {prevGrade != null ? prevGrade : "—"}
                      </td>

                      {/* Performance Trend */}
                      <td className="py-2.5 px-3">
                        <TrendIndicator trend={trendVal} />
                      </td>

                      {/* Attendance */}
                      <td className="py-2.5 px-3 text-center text-slate-700 font-medium font-mono text-[11px]">
                        {attVal}
                      </td>

                      {/* Assessment (Phil-IRI reading assessment evidence) */}
                      <td className="py-2.5 px-3 text-slate-700 font-medium">
                        {assessmentCell}
                      </td>

                      {/* Support (Recommended Intervention) */}
                      <td className="py-2.5 px-3">
                        <SupportBadge
                          support={supportVal}
                          onClick={
                            supportVal === "ARAL Screening" && onNavigateToAral
                              ? () => onNavigateToAral(row)
                              : null
                          }
                        />
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewLearner?.(row);
                          }}
                          className="inline-flex items-center rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-xs transition hover:border-cnhs-green/40 hover:bg-slate-50 hover:text-cnhs-green-dark"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                      <BookOpen size={20} />
                    </div>
                    <p className="mt-2 font-medium text-slate-700">No student records match criteria.</p>
                    <p className="text-[12px] text-slate-400 mt-0.5">
                      Try adjusting the search query or dropdown filters.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <MonitoringTablePagination
          page={safePage}
          pageSize={PAGE_SIZE}
          total={filteredRows.length}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
