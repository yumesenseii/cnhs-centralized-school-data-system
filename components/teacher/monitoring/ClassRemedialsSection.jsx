"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Minus,
  ClipboardList,
  Siren,
  LifeBuoy,
  Eye,
} from "lucide-react";
import LearnerName from "@/components/shared/LearnerName";
import AppSelect from "@/components/shared/AppSelect";
import MonitoringTablePagination from "@/components/teacher/monitoring/MonitoringTablePagination";
import { RiskPill, PriorityCue } from "@/components/teacher/monitoring/shared";
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

function StatusBadge({ row }) {
  if (row?.monitoringStatus === "Ongoing" || row?.inAralProgram || row?.recommendedSupport === "Class Remedial") {
    return (
      <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800">
        Under Support
      </span>
    );
  }
  if (row?.performanceTrend === "Improving") {
    return (
      <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
        Improving
      </span>
    );
  }
  if (
    row?.monitoringStatus === "Needs Review" ||
    row?.monitoringStatus === "For Review" ||
    row?.recommendedSupport === "Review" ||
    row?.recommendedSupport === "ARAL Screening"
  ) {
    return (
      <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
        For Review
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
      Monitoring
    </span>
  );
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

  // 4 Primary Summary Cards (Academic Focus)
  const forReviewCount = useMemo(() => {
    return students.filter((s) => {
      return s.monitoringStatus === "Needs Review" || s.monitoringStatus === "For Review" || s.recommendedSupport === "Review";
    }).length;
  }, [students]);

  const highPriorityCount = useMemo(() => {
    return students.filter((s) => {
      const risk = s.riskLevel || s.academicRisk || "";
      return risk === "High Risk" || risk === "High";
    }).length;
  }, [students]);

  const underSupportCount = useMemo(() => {
    return students.filter((s) => {
      return (
        s.monitoringStatus === "Ongoing" ||
        s.recommendedSupport === "Class Remedial" ||
        s.inAralProgram
      );
    }).length;
  }, [students]);

  const improvingCount = useMemo(() => {
    return students.filter((s) => s.performanceTrend === "Improving").length;
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
      {/* 4 PRIMARY CARDS: FOR REVIEW, HIGH PRIORITY, UNDER SUPPORT, IMPROVING */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <div className="flex items-start gap-3.5 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-200/60">
            <ClipboardList size={18} strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              For Review
            </p>
            <p className="mt-1 text-[26px] font-bold leading-none tracking-tight text-slate-900">
              {forReviewCount}
            </p>
            <p className="mt-1.5 text-[11px] leading-4 text-slate-400">Requires teacher review</p>
          </div>
        </div>

        <div className="flex items-start gap-3.5 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700 ring-1 ring-red-200/60">
            <Siren size={18} strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              High Priority
            </p>
            <p className="mt-1 text-[26px] font-bold leading-none tracking-tight text-red-700">
              {highPriorityCount}
            </p>
            <p className="mt-1.5 text-[11px] leading-4 text-red-600/80">Immediate attention needed</p>
          </div>
        </div>

        <div className="flex items-start gap-3.5 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 ring-1 ring-blue-200/60">
            <LifeBuoy size={18} strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Under Support
            </p>
            <p className="mt-1 text-[26px] font-bold leading-none tracking-tight text-blue-700">
              {underSupportCount}
            </p>
            <p className="mt-1.5 text-[11px] leading-4 text-blue-600/80">Active remediation / intervention</p>
          </div>
        </div>

        <div className="flex items-start gap-3.5 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60">
            <TrendingUp size={18} strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Improving
            </p>
            <p className="mt-1 text-[26px] font-bold leading-none tracking-tight text-emerald-700">
              {improvingCount}
            </p>
            <p className="mt-1.5 text-[11px] leading-4 text-emerald-600/80">Positive performance trend</p>
          </div>
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
                <th className="py-2.5 px-3">Subject</th>
                <th className="py-2.5 px-3 text-center">Grade</th>
                <th className="py-2.5 px-3">Trend</th>
                <th className="py-2.5 px-3 text-center">Risk</th>
                <th className="py-2.5 px-3 text-center">Priority</th>
                <th className="py-2.5 px-3 text-center">Status</th>
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
                        </div>
                      </td>

                      {/* Subject */}
                      <td className="py-2.5 px-3">
                        <span className="text-[12px] font-medium text-slate-700">
                          {row.subject || "—"}
                        </span>
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

                      {/* Performance Trend */}
                      <td className="py-2.5 px-3">
                        <TrendIndicator trend={trendVal} />
                      </td>

                      {/* Risk */}
                      <td className="py-2.5 px-3 text-center">
                        <RiskPill value={row.riskLevel || row.academicRisk || "—"} />
                      </td>

                      {/* Priority */}
                      <td className="py-2.5 px-3 text-center">
                        <PriorityCue learner={row} />
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center">
                        <StatusBadge row={row} />
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewLearner?.(row);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-xs transition hover:border-cnhs-green/50 hover:bg-cnhs-green-soft/40 hover:text-cnhs-green-dark"
                        >
                          <Eye size={13} strokeWidth={1.9} />
                          Review
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
