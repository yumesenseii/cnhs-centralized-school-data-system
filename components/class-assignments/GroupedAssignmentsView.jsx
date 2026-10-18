"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search, Plus, Filter, Check, MoreVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function GroupedAssignmentsView({
  assignments = [],
  subjects = [],
  sections = [],
  teachers = [],
  schoolYears = [],
  selectedSchoolYear,
  onSchoolYearChange,
  searchQuery,
  onSearchChange,
  onEdit,
  onAssign,
  onDelete,
  busy = false,
}) {
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [expandedSubjects, setExpandedSubjects] = useState({});

  // 1. Effective sections for selected school year
  const effectiveSections = useMemo(() => {
    const active = (sections ?? []).filter((s) => s.status !== "inactive");
    if (!selectedSchoolYear || selectedSchoolYear === "All School Years") {
      return active;
    }
    const yearMatched = active.filter((s) => s.school_year === selectedSchoolYear);
    return yearMatched.length > 0 ? yearMatched : active;
  }, [sections, selectedSchoolYear]);

  // Distinct grade levels sorted ascending
  const gradeLevels = useMemo(() => {
    const grades = new Set(
      effectiveSections
        .map((s) => Number(s.grade_level))
        .filter((g) => Number.isFinite(g) && g > 0)
    );
    if (grades.size === 0) return [7, 8, 9, 10];
    return Array.from(grades).sort((a, b) => a - b);
  }, [effectiveSections]);

  // 2. Build Hierarchy: Subject -> Grade Level -> Sections
  const groupedData = useMemo(() => {
    const q = (searchQuery || "").trim().toLowerCase();

    // Map each subject
    return (subjects ?? [])
      .map((subject) => {
        let subjectTotalSections = 0;
        let subjectAssignedCount = 0;
        let subjectUnassignedCount = 0;

        const gradesData = gradeLevels
          .map((grade) => {
            const gradeSections = effectiveSections
              .filter((sec) => Number(sec.grade_level) === grade)
              .sort((a, b) => (a.section_name || "").localeCompare(b.section_name || ""));

            if (gradeSections.length === 0) return null;

            const sectionRows = gradeSections.map((sec) => {
              // Find matching assignment in this subject, section, and school year
              const match = assignments.find((a) => {
                const sameSubject =
                  a.subjectId === subject.id ||
                  (subject.subject_name &&
                    a.subjectName?.toLowerCase() === subject.subject_name?.toLowerCase());
                const sameSection =
                  a.sectionId === sec.id ||
                  (sec.section_name &&
                    a.sectionName?.toLowerCase() === sec.section_name?.toLowerCase() &&
                    Number(a.gradeLevel) === Number(sec.grade_level));
                const sameYear =
                  !selectedSchoolYear ||
                  selectedSchoolYear === "All School Years" ||
                  a.schoolYear === selectedSchoolYear;
                return sameSubject && sameSection && sameYear;
              });

              const isAssigned = Boolean(match && match.teacherName && match.teacherName !== "—");

              return {
                section: sec,
                assignment: match || null,
                isAssigned,
                teacherName: isAssigned ? match.teacherName : "No teacher assigned",
              };
            });

            // Filter if user toggled "Only Unassigned"
            const visibleRows = onlyUnassigned
              ? sectionRows.filter((r) => !r.isAssigned)
              : sectionRows;

            const total = sectionRows.length;
            const assigned = sectionRows.filter((r) => r.isAssigned).length;
            const unassigned = total - assigned;

            subjectTotalSections += total;
            subjectAssignedCount += assigned;
            subjectUnassignedCount += unassigned;

            return {
              grade,
              gradeLabel: `Grade ${grade}`,
              totalSections: total,
              assignedCount: assigned,
              unassignedCount: unassigned,
              rows: visibleRows,
            };
          })
          .filter(Boolean);

        // Subject search matching
        const matchesSubjectName =
          !q ||
          subject.subject_name?.toLowerCase().includes(q) ||
          subject.subject_code?.toLowerCase().includes(q);

        const hasMatchingChild = gradesData.some((g) =>
          g.rows.some(
            (r) =>
              r.section.section_name?.toLowerCase().includes(q) ||
              (r.isAssigned && r.teacherName.toLowerCase().includes(q))
          )
        );

        const isVisible = matchesSubjectName || hasMatchingChild;

        return {
          subject,
          totalSections: subjectTotalSections,
          assignedCount: subjectAssignedCount,
          unassignedCount: subjectUnassignedCount,
          grades: gradesData,
          isVisible,
        };
      })
      .filter((s) => s.isVisible && s.grades.length > 0);
  }, [
    subjects,
    gradeLevels,
    effectiveSections,
    assignments,
    selectedSchoolYear,
    searchQuery,
    onlyUnassigned,
  ]);

  // Overall counts for quick stats
  const stats = useMemo(() => {
    let total = 0;
    let assigned = 0;
    let unassigned = 0;
    groupedData.forEach((s) => {
      total += s.totalSections;
      assigned += s.assignedCount;
      unassigned += s.unassignedCount;
    });
    return { total, assigned, unassigned };
  }, [groupedData]);

  // Toggle subject open/closed (defaults to closed for a clean, calm scan)
  function isSubjectOpen(subjectId) {
    if (expandedSubjects[subjectId] !== undefined) {
      return expandedSubjects[subjectId];
    }
    // Auto-open only if user is actively filtering with a search query
    if ((searchQuery || "").trim().length > 0) {
      return true;
    }
    return false;
  }

  function toggleSubject(subjectId) {
    setExpandedSubjects((prev) => ({
      ...prev,
      [subjectId]: !isSubjectOpen(subjectId),
    }));
  }

  function expandAll() {
    const next = {};
    groupedData.forEach((s) => {
      next[s.subject.id] = true;
    });
    setExpandedSubjects(next);
  }

  function collapseAll() {
    const next = {};
    groupedData.forEach((s) => {
      next[s.subject.id] = false;
    });
    setExpandedSubjects(next);
  }

  return (
    <div className="space-y-3.5">
      {/* 1. FILTER & SEARCH TOOLBAR */}
      <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-[var(--card)]">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search subject, section, or teacher name..."
            className="h-8.5 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-[12px] text-slate-800 placeholder-slate-400 outline-none transition focus:border-cnhs-green-dark dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* School Year Select */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="text-[11px] font-medium text-slate-500">School Year:</span>
            <select
              value={selectedSchoolYear}
              onChange={(e) => onSchoolYearChange(e.target.value)}
              className="h-8.5 cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-slate-800 outline-none transition hover:border-slate-300 dark:border-white/10 dark:bg-slate-900 dark:text-slate-100"
            >
              {schoolYears.map((sy) => (
                <option key={sy} value={sy}>
                  {sy}
                </option>
              ))}
            </select>
          </div>

          {/* Show Unassigned Only Toggle */}
          <label className="inline-flex h-8.5 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
            <input
              type="checkbox"
              checked={onlyUnassigned}
              onChange={(e) => setOnlyUnassigned(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-cnhs-green-dark accent-[#166534]"
            />
            <span>Unassigned only</span>
          </label>

          {/* Expand / Collapse Controls */}
          <div className="hidden items-center gap-1 sm:flex">
            <button
              type="button"
              onClick={expandAll}
              className="h-8.5 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
            >
              Expand all
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="h-8.5 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300"
            >
              Collapse all
            </button>
          </div>
        </div>
      </div>

      {/* 2. GROUPED LIST: SUBJECT -> GRADE LEVEL -> SECTIONS */}
      {groupedData.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-400 dark:border-white/10 dark:bg-[var(--card)]">
          No class slots found matching your criteria.
        </div>
      ) : (
        <div className="space-y-3">
          {groupedData.map(({ subject, totalSections, assignedCount, unassignedCount, grades }) => {
            const isOpen = isSubjectOpen(subject.id);

            return (
              <div
                key={subject.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-white/10 dark:bg-[var(--card)]"
              >
                {/* SUBJECT ACCORDION HEADER */}
                <button
                  type="button"
                  onClick={() => toggleSubject(subject.id)}
                  className="flex w-full cursor-pointer items-center justify-between border-b border-slate-100 bg-white px-4 py-3 text-left transition hover:bg-slate-50/60 dark:border-white/5 dark:bg-transparent dark:hover:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-2.5">
                    {isOpen ? (
                      <ChevronDown size={16} className="text-slate-400" />
                    ) : (
                      <ChevronRight size={16} className="text-slate-400" />
                    )}
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {subject.subject_name}
                      </h3>
                      {subject.subject_code ? (
                        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                          {subject.subject_code}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {assignedCount} / {totalSections} Assigned
                    </span>
                    {unassignedCount > 0 ? (
                      <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                        {unassignedCount} Unassigned
                      </span>
                    ) : (
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                        Complete
                      </span>
                    )}
                  </div>
                </button>

                {/* GRADE GROUPS */}
                {isOpen && (
                  <div className="divide-y divide-slate-100 dark:divide-white/5">
                    {grades.map((gradeGroup) => {
                      if (gradeGroup.rows.length === 0) return null;

                      return (
                        <div key={gradeGroup.grade} className="p-3.5 sm:p-4">
                          {/* Grade Summary Bar */}
                          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-white/5">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                              {gradeGroup.gradeLabel}
                            </h4>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              <span>{gradeGroup.totalSections} Sections</span>
                              <span className="mx-1.5 text-slate-300 dark:text-white/20">·</span>
                              <span>{gradeGroup.assignedCount} Assigned</span>
                              {gradeGroup.unassignedCount > 0 ? (
                                <>
                                  <span className="mx-1.5 text-slate-300 dark:text-white/20">·</span>
                                  <span className="font-semibold text-amber-800 dark:text-amber-400">
                                    {gradeGroup.unassignedCount} Unassigned
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </div>

                          {/* 4-COLUMN TABLE */}
                          <div className="overflow-x-auto rounded-lg border border-slate-200/80 bg-white dark:border-white/10 dark:bg-slate-900/60">
                            <table className="w-full border-collapse text-left text-xs">
                              <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-white/[0.02] dark:text-slate-400">
                                  <th className="px-3.5 py-2 w-[28%]">Section</th>
                                  <th className="px-3.5 py-2 w-[42%]">Assigned Teacher</th>
                                  <th className="px-3.5 py-2 w-[15%]">Status</th>
                                  <th className="px-3.5 py-2 w-[15%] text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {gradeGroup.rows.map((row) => (
                                  <tr
                                    key={row.section.id}
                                    className="transition-colors hover:bg-slate-50/60 dark:hover:bg-white/[0.02]"
                                  >
                                    {/* Column 1: Section */}
                                    <td className="px-3.5 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                                      {row.section.section_name}
                                    </td>

                                    {/* Column 2: Assigned Teacher */}
                                    <td className="px-3.5 py-2.5">
                                      {row.isAssigned ? (
                                        <span className="font-medium text-slate-900 dark:text-slate-100">
                                          {row.teacherName}
                                        </span>
                                      ) : (
                                        <span className="italic text-slate-400 dark:text-slate-500">
                                          No teacher assigned
                                        </span>
                                      )}
                                    </td>

                                    {/* Column 3: Status */}
                                    <td className="px-3.5 py-2.5">
                                      {row.isAssigned ? (
                                        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                                          Assigned
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                                          Unassigned
                                        </span>
                                      )}
                                    </td>

                                    {/* Column 4: Action */}
                                    <td className="px-3.5 py-2.5 text-right">
                                      {row.isAssigned ? (
                                        <div className="inline-flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => onEdit?.(row.assignment)}
                                            className="inline-flex h-7 cursor-pointer items-center rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                                          >
                                            Change
                                          </button>
                                          {onDelete && row.assignment ? (
                                            <button
                                              type="button"
                                              disabled={busy}
                                              title="Remove class assignment"
                                              onClick={() => onDelete?.(row.assignment)}
                                              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 dark:border-white/10 dark:bg-slate-800"
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          ) : null}
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled={busy}
                                          onClick={() =>
                                            onAssign?.({
                                              subjectId: subject.id,
                                              gradeLevel: gradeGroup.grade,
                                              sectionId: row.section.id,
                                              schoolYear: selectedSchoolYear,
                                            })
                                          }
                                          className="inline-flex h-7 cursor-pointer items-center rounded-md bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white shadow-xs transition hover:bg-[#165a3e] disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                          Assign
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
