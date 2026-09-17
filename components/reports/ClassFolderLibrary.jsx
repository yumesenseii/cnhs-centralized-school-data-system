"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Folder,
  LayoutGrid,
  List,
  Search,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { groupClassReportsForFolderLibrary } from "@/lib/reports/groupClassFolders";
import { isAralEligibleSubject } from "@/lib/services/recommendation/subjectCapabilities";

/**
 * Hybrid class browse for Admin Reports → School Performance → By Class.
 * On All Terms, multi-term siblings (Terms 1–3) collapse into one folder card.
 */

function classNeedsAttention(row = {}) {
  return (
    Number(row.highRisk ?? 0) > 0 ||
    Number(row.requiringIntervention ?? 0) > 0 ||
    Number(row.atRisk ?? 0) > 0
  );
}

function isAralEligibleClass(row = {}) {
  if (row.aralEligible === true) return true;
  if (row.aralEligible === false) return false;
  return isAralEligibleSubject(row.subject);
}

function classHasAral(row = {}) {
  if (!isAralEligibleClass(row)) return false;
  return Number(row.aralScreening ?? 0) > 0;
}

/** At Risk/ARAL filter: Eng/Fil only (not Science/other remediation track). */
function matchesAtRiskAralFilter(row = {}) {
  if (!isAralEligibleClass(row)) return false;
  return classNeedsAttention(row) || classHasAral(row);
}

function matchesQuery(row, query) {
  if (!query) return true;
  const hay = [
    row.className,
    row.gradeSection,
    row.subject,
    row.teacherName,
    row.teacher,
    ...(row.termLabels ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(query);
}

function resolveActionRow(folder) {
  return folder?.primaryRow ?? folder;
}

export default function ClassFolderLibrary({
  reports = [],
  onDetails,
  onExport,
  onGenerateSystemReport,
  searchPlaceholder = "Search classes by name, subject, or teacher…",
  /** When true (All Terms), group Term 1–3 siblings into one folder. */
  groupMultiTerm = false,
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("grid");

  const normalizedQuery = query.trim().toLowerCase();

  const folders = useMemo(
    () =>
      groupClassReportsForFolderLibrary(reports, {
        groupMultiTerm: Boolean(groupMultiTerm),
      }),
    [reports, groupMultiTerm]
  );

  const counts = useMemo(() => {
    let atRiskAral = 0;
    for (const row of folders) {
      if (matchesAtRiskAralFilter(row)) atRiskAral += 1;
    }
    return { all: folders.length, atRiskAral };
  }, [folders]);

  const filtered = useMemo(() => {
    return folders.filter((row) => {
      if (!matchesQuery(row, normalizedQuery)) return false;
      if (filter === "at-risk-aral") {
        return matchesAtRiskAralFilter(row);
      }
      return true;
    });
  }, [folders, normalizedQuery, filter]);

  const pills = [
    { id: "all", label: "All", count: counts.all },
    {
      id: "at-risk-aral",
      label: "At Risk/ARAL",
      count: counts.atRiskAral,
    },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-[0_4px_12px_rgba(15,23,42,0.03)] dark:border-white/5 dark:bg-[var(--card)] dark:shadow-none">
          <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Classes
          </p>
          <p className="mt-0.5 text-sm font-semibold tracking-[-0.02em] text-slate-900 dark:text-slate-100">
            {counts.all} folder{counts.all === 1 ? "" : "s"}
          </p>
          {groupMultiTerm ? (
            <p className="mt-0.5 text-[9px] text-slate-400">
              Multi-term grouped · Terms 1–3
            </p>
          ) : null}
        </div>
        <div className="rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-[0_4px_12px_rgba(15,23,42,0.03)] dark:border-white/5 dark:bg-[var(--card)] dark:shadow-none">
          <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Showing
          </p>
          <p className="mt-0.5 text-sm font-semibold tracking-[-0.02em] text-slate-900 dark:text-slate-100">
            {filtered.length} of {counts.all}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white p-2 shadow-[0_4px_12px_rgba(15,23,42,0.03)] dark:border-white/5 dark:bg-[var(--card)] dark:shadow-none sm:p-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search classes</span>
            <Search
              size={13}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/80 pl-8 pr-2.5 text-[11px] text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-cnhs-green focus:bg-white dark:border-white/5 dark:bg-transparent dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-white/5"
            />
          </label>

          <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
            <button
              type="button"
              aria-label="Grid view"
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
              className={cn(
                "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors",
                view === "grid"
                  ? "bg-cnhs-green-dark text-white"
                  : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-white/5 dark:bg-transparent dark:text-slate-400 dark:hover:bg-white/5"
              )}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              aria-label="List view"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
              className={cn(
                "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors",
                view === "list"
                  ? "bg-cnhs-green-dark text-white"
                  : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-white/5 dark:bg-transparent dark:text-slate-400 dark:hover:bg-white/5"
              )}
            >
              <List size={14} />
            </button>
          </div>
        </div>

        <div className="mt-1.5 flex flex-wrap gap-1">
          {pills.map((pill) => {
            const active = filter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setFilter(pill.id)}
                className={cn(
                  "inline-flex h-7 cursor-pointer items-center gap-1 rounded-full px-2.5 text-[10px] font-semibold transition-colors",
                  active
                    ? "bg-cnhs-green-dark text-white"
                    : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-white/5 dark:bg-transparent dark:text-slate-400 dark:hover:bg-white/5"
                )}
              >
                {pill.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                    active
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"
                  )}
                >
                  {pill.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {!filtered.length ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-xs text-slate-500 dark:border-white/5 dark:bg-transparent">
          No classes match the selected filters.
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 justify-items-start gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((row) => {
            const atRisk = Number(row.highRisk ?? 0);
            const aral = classHasAral(row)
              ? Number(row.aralScreening ?? 0)
              : 0;
            const attention = classNeedsAttention(row);
            const actionRow = resolveActionRow(row);

            return (
              <motion.button
                key={
                  row.isTermGroup
                    ? `group-${row.relatedClassIds?.join("-") || row.id}`
                    : row.id
                }
                type="button"
                whileHover={{ y: -1 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                onClick={() => onDetails?.(actionRow)}
                className="group flex w-full max-w-sm cursor-pointer flex-col rounded-xl border border-slate-100 bg-white p-3 text-left shadow-[0_4px_12px_rgba(15,23,42,0.04)] transition-colors hover:border-cnhs-green-dark/30 hover:bg-cnhs-green-soft/20 dark:border-white/5 dark:bg-[var(--card)] dark:shadow-none dark:hover:bg-white/5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cnhs-green-soft text-cnhs-green-dark ring-1 ring-cnhs-green-dark/20 dark:bg-cnhs-green-dark/20 dark:text-cnhs-green dark:ring-cnhs-green/30">
                    <Folder size={15} strokeWidth={1.75} />
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                      attention
                        ? "bg-orange-50 text-cnhs-orange ring-1 ring-orange-200/80 dark:bg-transparent dark:ring-cnhs-orange/40"
                        : "bg-green-50 text-cnhs-green-dark ring-1 ring-green-200/80 dark:bg-transparent dark:ring-cnhs-green/40 dark:text-cnhs-green"
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        attention ? "bg-cnhs-orange" : "bg-cnhs-green"
                      )}
                    />
                    {attention ? "Attention" : "Active"}
                  </span>
                </div>

                <p className="mt-2 truncate text-[12px] font-semibold tracking-[-0.01em] text-slate-900 dark:text-slate-100">
                  {row.className || "Class"}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-slate-500">
                  {row.subject || "—"}
                  {row.isTermGroup
                    ? ` · ${row.termCount} terms`
                    : row.averageGrade != null && row.averageGrade !== ""
                      ? ` · Avg ${row.averageGrade}`
                      : ""}
                </p>

                {row.isTermGroup && row.termLabels?.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-0.5">
                    {row.termLabels.map((label) => (
                      <span
                        key={label}
                        className="rounded bg-slate-50 px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-100 dark:bg-transparent dark:text-slate-400 dark:ring-white/5"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-2 flex flex-wrap gap-1">
                  <span className="rounded-full bg-slate-50 px-1.5 py-0.5 text-[9px] font-medium text-slate-600 ring-1 ring-slate-100 dark:bg-transparent dark:text-slate-400 dark:ring-white/5">
                    {row.students ?? 0} learners
                  </span>
                  {!row.isTermGroup &&
                  row.averageGrade != null &&
                  row.averageGrade !== "" ? (
                    <span className="rounded-full bg-slate-50 px-1.5 py-0.5 text-[9px] font-medium text-slate-600 ring-1 ring-slate-100 dark:bg-transparent dark:text-slate-400 dark:ring-white/5">
                      Avg {row.averageGrade}
                    </span>
                  ) : null}
                  {atRisk > 0 ? (
                    <span className="rounded-full bg-orange-50 px-1.5 py-0.5 text-[9px] font-medium text-cnhs-orange ring-1 ring-orange-100 dark:bg-transparent dark:ring-cnhs-orange/40">
                      {atRisk} high risk
                    </span>
                  ) : null}
                  {aral > 0 ? (
                    <span className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[9px] font-medium text-sky-700 dark:bg-transparent dark:text-sky-400 dark:ring-1 dark:ring-sky-500/30">
                      {aral} ARAL
                    </span>
                  ) : null}
                </div>

                <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-50 pt-2 dark:border-white/5">
                  <span className="inline-flex min-w-0 items-center gap-1 text-[10px] text-slate-500">
                    <UserRound size={11} className="shrink-0 text-slate-400" />
                    <span className="truncate">
                      {row.teacherName || row.teacher || "—"}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {onGenerateSystemReport ? (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onGenerateSystemReport(actionRow);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            onGenerateSystemReport(actionRow);
                          }
                        }}
                        className="text-[10px] font-semibold text-slate-500 opacity-0 transition-opacity hover:text-cnhs-green-dark group-hover:opacity-100 dark:text-slate-400 dark:hover:text-cnhs-green"
                      >
                        Generate
                      </span>
                    ) : null}
                    <span className="text-[10px] font-semibold text-cnhs-green-dark opacity-0 transition-opacity group-hover:opacity-100 dark:text-cnhs-green">
                      Preview →
                    </span>
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.03)] dark:border-white/5 dark:bg-[var(--card)] dark:shadow-none">
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-transparent">
                  {[
                    "Class",
                    "Subject",
                    "Terms",
                    "Teacher",
                    "Learners",
                    "Risk / ARAL",
                    "Action",
                  ].map((column) => (
                    <th
                      key={column}
                      className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const actionRow = resolveActionRow(row);
                  return (
                    <tr
                      key={
                        row.isTermGroup
                          ? `group-${row.relatedClassIds?.join("-") || row.id}`
                          : row.id
                      }
                      className="border-t border-slate-100 transition-colors hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/5"
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cnhs-green-soft text-cnhs-green-dark dark:bg-cnhs-green-dark/20 dark:text-cnhs-green">
                            <Folder size={14} />
                          </span>
                          <span className="text-[12px] font-semibold text-slate-800 dark:text-slate-100">
                            {row.className}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-slate-600">
                        {row.subject}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-slate-600">
                        {row.isTermGroup
                          ? row.termLabels?.join(" · ") || `${row.termCount} terms`
                          : row.quarter || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-slate-600">
                        {row.teacherName || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] font-semibold text-slate-700">
                        {row.students ?? 0}
                      </td>
                      <td className="px-3 py-2.5 text-[12px] text-slate-600">
                        {row.highRisk ?? 0} high ·{" "}
                        {classHasAral(row) ? row.aralScreening ?? 0 : 0} ARAL
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onDetails?.(actionRow)}
                            className="cursor-pointer text-[11px] font-semibold text-cnhs-green-dark hover:underline"
                          >
                            Preview
                          </button>
                          {onGenerateSystemReport ? (
                            <button
                              type="button"
                              onClick={() =>
                                onGenerateSystemReport(actionRow)
                              }
                              className="cursor-pointer text-[11px] font-semibold text-cnhs-green-dark hover:underline"
                            >
                              Generate
                            </button>
                          ) : null}
                          {onExport ? (
                            <button
                              type="button"
                              onClick={() => onExport?.(actionRow)}
                              className="cursor-pointer text-[11px] font-semibold text-slate-500 hover:text-slate-700 hover:underline"
                            >
                              PDF
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
