"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight, Eye, User } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MasterClassListTab({
  classItem = {},
  students = [],
  currentTerm = 1,
  initialStatusFilter = "all",
}) {
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState("all"); // "all" | "male" | "female"
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter); // "all" | "passed" | "below75"
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        String(s.studentNumber || "").toLowerCase().includes(q);

      const matchesGender =
        genderFilter === "all" ||
        (genderFilter === "male" && String(s.sex).toLowerCase().startsWith("m")) ||
        (genderFilter === "female" && String(s.sex).toLowerCase().startsWith("f"));

      const grade = Number(s.averageGrade);
      const isFailing = Number.isFinite(grade) && grade < 75;
      const isPassing = Number.isFinite(grade) && grade >= 75;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "passed" && isPassing) ||
        (statusFilter === "below75" && isFailing);

      return matchesSearch && matchesGender && matchesStatus;
    });
  }, [students, search, genderFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs dark:border-white/10 dark:bg-white/[0.02]">
      {/* Search and Filters Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/5">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search learner name or LRN..."
            className="h-8.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-8.5 pr-3 text-xs text-slate-800 outline-none focus:border-cnhs-green focus:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Gender Filter */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 dark:border-white/10 dark:bg-white/5">
            {[
              { id: "all", label: "All" },
              { id: "male", label: "Male" },
              { id: "female", label: "Female" },
            ].map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  setGenderFilter(g.id);
                  setPage(1);
                }}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer",
                  genderFilter === g.id
                    ? "bg-white text-slate-800 shadow-2xs dark:bg-white/10 dark:text-white"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                )}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 dark:border-white/10 dark:bg-white/5">
            {[
              { id: "all", label: "All Grades" },
              { id: "passed", label: "Passed (≥75)" },
              { id: "below75", label: "Need Support (<75)" },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => {
                  setStatusFilter(st.id);
                  setPage(1);
                }}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-semibold rounded-md transition cursor-pointer",
                  statusFilter === st.id
                    ? "bg-white text-slate-800 shadow-2xs dark:bg-white/10 dark:text-white"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                )}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Learners Table */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-white/[0.02] dark:text-slate-400">
              <th className="py-2.5 px-3">Learner</th>
              <th className="py-2.5 px-3">LRN</th>
              <th className="py-2.5 px-3 text-center">Sex</th>
              <th className="py-2.5 px-3 text-center">T1</th>
              <th className="py-2.5 px-3 text-center">T2</th>
              <th className="py-2.5 px-3 text-center">T3</th>
              <th className="py-2.5 px-3 text-center">Current Grade</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-500">
                  No learners match your search.
                </td>
              </tr>
            ) : (
              paginated.map((student) => {
                const termGrades = student.termGrades ?? {};
                const currentGrade = Number(student.averageGrade);
                const isFailing = Number.isFinite(currentGrade) && currentGrade < 75;
                const isBorderline =
                  Number.isFinite(currentGrade) &&
                  (currentGrade === 75 || currentGrade === 76);

                return (
                  <tr
                    key={student.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-white/[0.01] transition"
                  >
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                          {student.initials || "LN"}
                        </span>
                        <span className="truncate max-w-[200px]">{student.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                      {student.studentNumber || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600 font-medium">
                      {student.sex ? student.sex[0].toUpperCase() : "—"}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600">
                      {termGrades[1] ?? "—"}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600">
                      {termGrades[2] ?? "—"}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-600">
                      {termGrades[3] ?? "—"}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold">
                      <span
                        className={cn(
                          "inline-block rounded-md px-1.5 py-0.5 text-xs",
                          isFailing
                            ? "bg-red-50 text-red-700 font-bold"
                            : isBorderline
                            ? "bg-amber-50 text-amber-700 font-bold"
                            : "text-slate-800 dark:text-white"
                        )}
                      >
                        {student.averageGrade ?? "—"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {isFailing ? (
                        <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 border border-red-200">
                          Need Support
                        </span>
                      ) : isBorderline ? (
                        <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                          Needs Monitoring
                        </span>
                      ) : Number.isFinite(currentGrade) ? (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                          Passed
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">Ungraded</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Link
                        href={`/teacher/my-classes/${classItem.id}/students/${student.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs dark:border-white/10 dark:bg-white/5"
                      >
                        <Eye size={12} />
                        <span>Review</span>
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="mt-3 flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500 dark:border-white/5">
        <span>
          Showing {paginated.length} of {filtered.length} learners
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition dark:border-white/10 dark:bg-white/5"
          >
            <ChevronLeft size={12} />
            Prev
          </button>
          <span className="px-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition dark:border-white/10 dark:bg-white/5"
          >
            Next
            <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </section>
  );
}
