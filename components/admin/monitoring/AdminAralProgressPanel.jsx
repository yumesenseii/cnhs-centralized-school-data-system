"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  Folder,
  Layers,
  Search,
  Users,
} from "lucide-react";
import {
  deriveLearnerCurrentStep,
  formatReadingAssessmentDisplay,
} from "@/lib/monitoring/aralLearnerAggregation";
import { isAralProgramLearner } from "@/lib/monitoring/aralProgress";
import AdminTablePagination from "@/components/shared/AdminTablePagination";
import { cn } from "@/lib/utils";

const SECTIONS_PAGE_SIZE = 9;
const LEARNERS_PAGE_SIZE = 10;

function parseGradeLabel(gradeSection, gradeLevel) {
  if (gradeLevel != null && gradeLevel !== "") {
    const raw = String(gradeLevel).trim();
    const num = raw.replace(/\D/g, "");
    if (num) return `Grade ${num}`;
    return raw;
  }
  const m = String(gradeSection || "").match(/Grade\s*(\d+)/i);
  return m ? `Grade ${m[1]}` : "Other";
}

function parseCleanSectionName(rawSection) {
  let s = String(rawSection || "Unassigned").trim();
  s = s.replace(/^(Grade\s*\d+\s*[-—–:]*\s*)+/i, "").trim();
  return s || rawSection || "Unassigned";
}

function formatFullSectionName(grade, rawSection) {
  const stripped = parseCleanSectionName(rawSection);
  return grade && !stripped.toLowerCase().startsWith(grade.toLowerCase())
    ? `${grade} – ${stripped}`
    : stripped;
}

function gradeSortKey(grade) {
  const n = Number(String(grade).replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 999;
}

/**
 * 6 Simplified, familiar statuses for Principal monitoring:
 * - Waiting for Facilitator
 * - Waiting for Assessment
 * - Needs Individual Assessment
 * - Under ARAL Support
 * - Progress Check Due
 * - Completed
 */
function derivePrincipalStatus(learner) {
  if (!learner.aralFacilitatorTeacherId) {
    return "Waiting for Facilitator";
  }

  const step = deriveLearnerCurrentStep(learner);

  if (step === "completed") {
    return "Completed";
  }
  if (step === "progress_check_due") {
    return "Progress Check Due";
  }
  if (step === "under_aral_support") {
    return "Under ARAL Support";
  }
  if (step === "needs_individual_assessment") {
    return "Needs Individual Assessment";
  }
  return "Waiting for Assessment";
}

const STATUS_TONES = {
  "Waiting for Facilitator": "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  "Waiting for Assessment": "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
  "Needs Individual Assessment": "bg-blue-50 text-blue-800 ring-1 ring-blue-200",
  "Under ARAL Support": "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
  "Progress Check Due": "bg-rose-50 text-rose-800 ring-1 ring-rose-200",
  "Completed": "bg-slate-50 text-slate-600 ring-1 ring-slate-200",
};

function buildSectionGroups(aralRows = []) {
  const bySection = new Map();

  for (const row of aralRows) {
    const rawSection = row.gradeSection || "Unassigned section";
    const sectionName = parseCleanSectionName(rawSection);
    const gradeLabel = parseGradeLabel(rawSection, row.gradeLevel);
    const sectionKey = `${gradeLabel} — ${sectionName}`;

    if (!bySection.has(sectionKey)) {
      bySection.set(sectionKey, {
        sectionKey,
        gradeSection: rawSection,
        grade: gradeLabel,
        sectionName: formatFullSectionName(gradeLabel, sectionName),
        learners: [],
        facilitatorName: "",
        facilitatorId: null,
      });
    }
    const group = bySection.get(sectionKey);
    group.learners.push(row);
    if (row.aralFacilitatorName && row.aralFacilitatorName !== "—") {
      group.facilitatorName = row.aralFacilitatorName;
    }
    if (row.aralFacilitatorTeacherId) {
      group.facilitatorId = row.aralFacilitatorTeacherId;
    }
  }

  return [...bySection.values()]
    .map((group) => {
      let waitingAssessment = 0;
      let needsIndividual = 0;
      let underSupport = 0;
      let completed = 0;

      for (const l of group.learners) {
        const st = derivePrincipalStatus(l);
        if (st === "Waiting for Assessment" || st === "Waiting for Facilitator") {
          waitingAssessment++;
        } else if (st === "Needs Individual Assessment") {
          needsIndividual++;
        } else if (st === "Under ARAL Support" || st === "Progress Check Due") {
          underSupport++;
        } else if (st === "Completed") {
          completed++;
        }
      }

      return {
        ...group,
        count: group.learners.length,
        waitingAssessment,
        needsIndividual,
        underSupport,
        completed,
      };
    })
    .sort((a, b) => {
      const gDiff = gradeSortKey(a.grade) - gradeSortKey(b.grade);
      if (gDiff !== 0) return gDiff;
      return a.sectionName.localeCompare(b.sectionName);
    });
}

/**
 * Monitor Assessment & Support Panel (Principal Flow 3):
 * - Default Section Cards view with 4 summary counts
 * - Detailed learner table with only 6 clean columns:
 *   Learner | Reading Assessment | Current Support | Facilitator | Status | Action
 * - Logic safeguards: GST formatted clearly ("GST: 12 — Needs Individual Assessment"),
 *   Reading Profile only appears after individual reading assessment,
 *   Under ARAL Support strictly requires actual started support.
 */
export default function AdminAralProgressPanel({
  students = [],
  onViewStudent,
  onNavigateTab,
  outcomeFilter = "all",
}) {
  const aralLearners = useMemo(() => {
    const base = students.filter(isAralProgramLearner);
    if (outcomeFilter === "completed") {
      return base.filter(
        (s) =>
          s.monitoringStatus === "Completed" ||
          s.aralStatus === "Completed" ||
          s.movementOutcome === "Promoted"
      );
    }
    if (outcomeFilter === "continued") {
      return base.filter(
        (s) =>
          s.monitoringStatus === "Needs Further Support" ||
          s.monitoringStatus === "For Further Monitoring" ||
          s.monitoringStatus === "Referred"
      );
    }
    return base;
  }, [students, outcomeFilter]);

  const sectionGroups = useMemo(
    () => buildSectionGroups(aralLearners),
    [aralLearners]
  );

  const [activeSection, setActiveSection] = useState(null);
  const [page, setPage] = useState(1);
  const [learnerPage, setLearnerPage] = useState(1);
  const [search, setSearch] = useState("");

  const totalPages = Math.max(
    1,
    Math.ceil(sectionGroups.length / SECTIONS_PAGE_SIZE) || 1
  );
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pagedSections = useMemo(() => {
    const start = (safePage - 1) * SECTIONS_PAGE_SIZE;
    return sectionGroups.slice(start, start + SECTIONS_PAGE_SIZE);
  }, [sectionGroups, safePage]);

  // Section learners filtered by search
  const filteredLearners = useMemo(() => {
    if (!activeSection) return [];
    const q = search.trim().toLowerCase();
    if (!q) return activeSection.learners;
    return activeSection.learners.filter(
      (l) =>
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.studentNumber && l.studentNumber.toLowerCase().includes(q)) ||
        (l.lrn && l.lrn.toLowerCase().includes(q))
    );
  }, [activeSection, search]);

  const learnerTotalPages = Math.max(
    1,
    Math.ceil(filteredLearners.length / LEARNERS_PAGE_SIZE) || 1
  );
  const safeLearnerPage = Math.min(Math.max(learnerPage, 1), learnerTotalPages);
  const pagedLearners = useMemo(() => {
    const start = (safeLearnerPage - 1) * LEARNERS_PAGE_SIZE;
    return filteredLearners.slice(start, start + LEARNERS_PAGE_SIZE);
  }, [filteredLearners, safeLearnerPage]);

  if (!sectionGroups.length) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500 shadow-xs">
        No learners currently in assessment or support cohorts.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {!activeSection ? (
        /* Section Cards Default View */
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pagedSections.map((group) => {
              const hasFacilitator = Boolean(group.facilitatorId || group.facilitatorName);

              return (
                <div
                  key={group.gradeSection}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-cnhs-green/40 hover:shadow-md dark:border-white/5 dark:bg-[var(--card)]"
                >
                  <div>
                    {/* Header: Grade & Section Name */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {group.grade}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                          {group.sectionName}
                        </h3>
                      </div>
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-300">
                        {group.count} learner{group.count === 1 ? "" : "s"}
                      </span>
                    </div>

                    {/* Assigned Facilitator */}
                    <div className="mt-3.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-white/5 dark:bg-white/[0.02]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Assigned Facilitator
                      </span>
                      <p
                        className={cn(
                          "mt-1 text-xs font-semibold truncate",
                          hasFacilitator
                            ? "text-slate-900 dark:text-slate-100"
                            : "text-amber-700 dark:text-amber-400"
                        )}
                      >
                        {group.facilitatorName || "None (Unassigned)"}
                      </p>
                    </div>

                    {/* 4 Clean Summary Counts */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2 dark:border-white/5">
                        <span className="block text-[10px] font-medium text-slate-500">
                          Waiting Assessment
                        </span>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          {group.waitingAssessment}
                        </span>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2 dark:border-white/5">
                        <span className="block text-[10px] font-medium text-slate-500">
                          Needs Individual
                        </span>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          {group.needsIndividual}
                        </span>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2 dark:border-white/5">
                        <span className="block text-[10px] font-medium text-slate-500">
                          Under Support
                        </span>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          {group.underSupport}
                        </span>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-2 dark:border-white/5">
                        <span className="block text-[10px] font-medium text-slate-500">
                          Completed
                        </span>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          {group.completed}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action */}
                  <div className="mt-5 border-t border-slate-100 pt-3.5 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSection(group);
                        setLearnerPage(1);
                        setSearch("");
                      }}
                      className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-cnhs-green-dark px-3 text-xs font-bold text-white shadow-xs transition hover:bg-[#246f54] active:scale-95"
                    >
                      <Eye size={13} />
                      View Section Learners
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <AdminTablePagination
            page={safePage}
            pageSize={SECTIONS_PAGE_SIZE}
            total={sectionGroups.length}
            onPageChange={setPage}
            itemLabel="sections"
          />
        </div>
      ) : (
        /* Detailed Learner Table (Only 6 Clean Columns) */
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-white/5 dark:bg-[var(--card)]">
          {/* Section Detail Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/50 px-5 py-3.5 dark:border-white/5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveSection(null)}
                className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 shadow-xs transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
              >
                <ChevronLeft size={13} />
                All Sections
              </button>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {activeSection.sectionName}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Facilitator: {activeSection.facilitatorName || "None (Unassigned)"} · {activeSection.count} learners
                </p>
              </div>
            </div>

            <div className="relative w-64">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setLearnerPage(1);
                }}
                placeholder="Search learner or LRN..."
                className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-cnhs-green dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
              />
            </div>
          </div>

          {/* 6 Clean Columns Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/80 font-bold uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-white/[0.02]">
                <tr>
                  <th className="px-5 py-3">Learner</th>
                  <th className="px-5 py-3">Reading Assessment</th>
                  <th className="px-5 py-3">Current Support</th>
                  <th className="px-5 py-3">Facilitator</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {pagedLearners.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                      No matching learners in this section.
                    </td>
                  </tr>
                ) : (
                  pagedLearners.map((learner) => {
                    const status = derivePrincipalStatus(learner);
                    const assessmentDisplay = formatReadingAssessmentDisplay(learner);

                    // Current support display logic (guard against "Ongoing sessions" when not started)
                    const hasUpdates = Number(learner.weeklyUpdateCount) > 0;
                    const supportDisplay = hasUpdates
                      ? `${learner.weeklyUpdateCount} session update(s)`
                      : learner.supportStarted
                        ? "Active Support"
                        : status === "Waiting for Facilitator"
                          ? "None (Waiting for Facilitator)"
                          : "None (Waiting for Assessment)";

                    return (
                      <tr
                        key={learner.studentId || learner.id}
                        className="transition-colors hover:bg-slate-50/60 dark:hover:bg-white/[0.02]"
                      >
                        {/* 1. Learner */}
                        <td className="px-5 py-3">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {learner.name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            LRN: {learner.studentNumber || learner.lrn || "—"}
                          </p>
                        </td>

                        {/* 2. Reading Assessment */}
                        <td className="px-5 py-3">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {assessmentDisplay}
                          </span>
                        </td>

                        {/* 3. Current Support */}
                        <td className="px-5 py-3">
                          <span
                            className={cn(
                              "text-xs",
                              hasUpdates || learner.supportStarted
                                ? "font-semibold text-emerald-700 dark:text-emerald-400"
                                : "text-slate-400 dark:text-slate-500"
                            )}
                          >
                            {supportDisplay}
                          </span>
                        </td>

                        {/* 4. Facilitator */}
                        <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-200">
                          {learner.aralFacilitatorName || "None (Unassigned)"}
                        </td>

                        {/* 5. Status */}
                        <td className="px-5 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                              STATUS_TONES[status] || "bg-slate-100 text-slate-600"
                            )}
                          >
                            {status}
                          </span>
                        </td>

                        {/* 6. Action */}
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              onViewStudent?.(learner.sourceRows?.[0] || learner)
                            }
                            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-slate-900 active:scale-95"
                          >
                            <Eye size={12} />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-100 px-5 py-3 dark:border-white/5">
            <AdminTablePagination
              page={safeLearnerPage}
              pageSize={LEARNERS_PAGE_SIZE}
              total={filteredLearners.length}
              onPageChange={setLearnerPage}
              itemLabel="learners"
            />
          </div>
        </div>
      )}
    </section>
  );
}
