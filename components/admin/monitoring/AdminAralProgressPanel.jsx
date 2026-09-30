"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Folder,
  Layers,
  Loader2,
  MessageSquare,
  Search,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import AralAssessmentComments from "@/components/teacher/aral-program/AralAssessmentComments";
import AralAssessmentReadonlyGrid from "@/components/teacher/aral-program/AralAssessmentReadonlyGrid";
import {
  Pill,
  interventionStyles,
  monitoringStatusStyles,
} from "@/components/teacher/monitoring/shared";
import {
  ARAL_ASSESSMENT_PHASE,
  ARAL_ASSESSMENT_RESULT,
  normalizeAralAssessmentPhase,
  uniqueAralLearners,
} from "@/lib/monitoring/aralAssessments";
import { isAralProgramLearner } from "@/lib/monitoring/aralProgress";
import { getAdminSession } from "@/lib/supabase/queries/adminAuth";
import {
  ensureActiveAralBatch,
  listAralAssessmentScoresForSection,
} from "@/lib/supabase/queries/aralProgram";
import { cn } from "@/lib/utils";
import TablePagination from "@/components/academic-records/TablePagination";

const PAGE_SIZE = 10;

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

function gradeSortKey(grade) {
  const n = Number(String(grade).replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 999;
}

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
        sectionName,
        learners: [],
        schoolYear: row.schoolYear || "",
        facilitatorName: "",
        facilitatorId: null,
      });
    }
    const group = bySection.get(sectionKey);
    group.learners.push(row);
    if (!group.schoolYear && row.schoolYear) group.schoolYear = row.schoolYear;
    if (row.aralFacilitatorName && row.aralFacilitatorName !== "—") {
      group.facilitatorName = row.aralFacilitatorName;
    }
    if (row.aralFacilitatorTeacherId) {
      group.facilitatorId = row.aralFacilitatorTeacherId;
    }
  }

  return [...bySection.values()]
    .map((group) => ({
      ...group,
      count: group.learners.length,
      assignedCount: group.learners.filter((l) => l.aralFacilitatorTeacherId).length,
    }))
    .sort((a, b) => {
      const gDiff = gradeSortKey(a.grade) - gradeSortKey(b.grade);
      if (gDiff !== 0) return gDiff;
      return a.sectionName.localeCompare(b.sectionName);
    });
}

const DETAIL_TABS = [
  { id: "all", label: "Progress Summary Tracker" },
  { id: "pre", label: "Pre-Test (Baseline)" },
  { id: "mid", label: "Mid-Test" },
  { id: "post", label: "Post-Test (Exit)" },
];

export default function AdminAralProgressPanel({
  students = [],
  onViewStudent,
  onNavigateTab,
}) {
  const aralLearners = useMemo(
    () => students.filter(isAralProgramLearner),
    [students]
  );

  const sectionGroups = useMemo(
    () => buildSectionGroups(aralLearners),
    [aralLearners]
  );

  const availableGrades = useMemo(() => {
    const set = new Set(sectionGroups.map((g) => g.grade));
    return ["All Grades", ...Array.from(set).sort((a, b) => gradeSortKey(a) - gradeSortKey(b))];
  }, [sectionGroups]);

  const [selectedGrade, setSelectedGrade] = useState("All Grades");
  const [activeSectionKey, setActiveSectionKey] = useState(null);
  const [detailTab, setDetailTab] = useState("all");
  const [batchId, setBatchId] = useState(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [profileId, setProfileId] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showNotesDrawer, setShowNotesDrawer] = useState(false);

  // Assessment scores state
  const [scoresMap, setScoresMap] = useState(new Map());
  const [scoresLoading, setScoresLoading] = useState(false);

  // Set default active section once groups are loaded
  useEffect(() => {
    if (sectionGroups.length > 0 && !activeSectionKey) {
      setActiveSectionKey(sectionGroups[0].sectionKey);
    }
  }, [sectionGroups, activeSectionKey]);

  const activeSection = useMemo(
    () =>
      sectionGroups.find((g) => g.sectionKey === activeSectionKey) ??
      sectionGroups[0] ??
      null,
    [sectionGroups, activeSectionKey]
  );

  const schoolYearHint =
    activeSection?.schoolYear ||
    sectionGroups[0]?.schoolYear ||
    aralLearners[0]?.schoolYear ||
    "SY 2026-2027";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBatchLoading(true);
      const [batchResult, session] = await Promise.all([
        ensureActiveAralBatch(schoolYearHint),
        getAdminSession(),
      ]);
      if (cancelled) return;
      setBatchId(batchResult.data?.id ?? null);
      setProfileId(session.data?.id ?? null);
      setBatchLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [schoolYearHint]);

  // Load all assessment scores for the active section
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!batchId || !activeSection?.gradeSection) {
        setScoresMap(new Map());
        return;
      }
      setScoresLoading(true);
      const result = await listAralAssessmentScoresForSection({
        batchId,
        gradeSection: activeSection.gradeSection,
      });
      if (cancelled) return;
      if (!result.error && Array.isArray(result.data)) {
        // Group by studentId -> { pre: scoreObj, mid: scoreObj, post: scoreObj }
        const map = new Map();
        for (const row of result.data) {
          const sid = row.studentId;
          if (!map.has(sid)) map.set(sid, {});
          const studentScores = map.get(sid);
          const p = normalizeAralAssessmentPhase(row.phase);
          studentScores[p] = row;
        }
        setScoresMap(map);
      } else {
        setScoresMap(new Map());
      }
      setScoresLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [batchId, activeSection?.gradeSection]);

  const uniqueLearnersList = useMemo(() => {
    if (!activeSection) return [];
    return uniqueAralLearners(activeSection.learners);
  }, [activeSection]);

  // Filtered learners in active section
  const filteredLearners = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return uniqueLearnersList;
    return uniqueLearnersList.filter(
      (l) =>
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.studentNumber && String(l.studentNumber).toLowerCase().includes(q))
    );
  }, [uniqueLearnersList, search]);

  const totalPages = Math.max(1, Math.ceil(filteredLearners.length / PAGE_SIZE));
  const pagedLearners = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredLearners.slice(start, start + PAGE_SIZE);
  }, [filteredLearners, page]);

  // Section summary metrics
  const sectionSummary = useMemo(() => {
    if (!activeSection) return { preCount: 0, midCount: 0, postCount: 0, completedCount: 0 };
    let preCount = 0;
    let midCount = 0;
    let postCount = 0;
    let completedCount = 0;

    for (const l of uniqueLearnersList) {
      const id = l.studentId || l.id;
      const scores = scoresMap.get(id) || {};
      if (scores.pre?.score != null) preCount += 1;
      if (scores.mid?.score != null) midCount += 1;
      if (scores.post?.score != null) postCount += 1;
      if (
        scores.post?.result === ARAL_ASSESSMENT_RESULT.PASSED ||
        l.monitoringStatus === "Completed / Exited" ||
        l.monitoringStatus === "Completed Intervention / Exited"
      ) {
        completedCount += 1;
      }
    }

    return {
      preCount,
      midCount,
      postCount,
      completedCount,
    };
  }, [activeSection, uniqueLearnersList, scoresMap]);

  if (!sectionGroups.length) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-xs dark:border-white/5 dark:bg-[var(--card)]">
        <Clock3 size={32} className="mx-auto text-slate-300" />
        <h3 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">
          No Learners in ARAL Program Yet
        </h3>
        <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
          Learners are placed into ARAL once English or Filipino teachers submit endorsements and the Principal approves them.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {/* Top Header & Section Selector Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-white/5 dark:bg-[var(--card)] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Select Section:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {sectionGroups.map((group) => {
              const isSelected = activeSection?.sectionKey === group.sectionKey;
              const gradeNum = String(group.grade).replace(/\D/g, "");
              return (
                <button
                  key={group.sectionKey}
                  type="button"
                  onClick={() => {
                    setActiveSectionKey(group.sectionKey);
                    setPage(1);
                  }}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                    isSelected
                      ? "bg-cnhs-green-dark text-white shadow-xs"
                      : "border border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-bold",
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-cnhs-green-soft text-cnhs-green-dark"
                    )}
                  >
                    {gradeNum || "G"}
                  </span>
                  {group.sectionName}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px]",
                      isSelected ? "bg-white/20 text-white" : "bg-slate-200/80 text-slate-600"
                    )}
                  >
                    {group.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500">
            {aralLearners.length} learners across {sectionGroups.length} sections
          </span>
        </div>
      </div>

      {activeSection ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/5 dark:bg-[var(--card)]">
          {/* Active Section Summary Header Card */}
          <div className="border-b border-slate-100 bg-slate-50/60 p-4 dark:border-white/5 dark:bg-white/[0.02]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {activeSection.grade} — {activeSection.sectionName}
                  </h3>
                  <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-700 dark:bg-purple-500/10 dark:text-purple-300">
                    ARAL Program Class
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <UserCheck size={13} className="text-emerald-600" />
                  Assigned Facilitator:{" "}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {activeSection.facilitatorName || "None (Unassigned)"}
                  </span>
                </p>
              </div>

              {/* Assessment Progress Snapshot */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-center shadow-xs dark:border-white/10 dark:bg-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Pre-Test Done
                  </p>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {sectionSummary.preCount} / {uniqueLearnersList.length}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-center shadow-xs dark:border-white/10 dark:bg-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Mid-Test Done
                  </p>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {sectionSummary.midCount} / {uniqueLearnersList.length}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-center shadow-xs dark:border-white/10 dark:bg-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Post-Test (Exit)
                  </p>
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {sectionSummary.postCount} / {uniqueLearnersList.length}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNotesDrawer((prev) => !prev)}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-xs transition-colors",
                    showNotesDrawer
                      ? "border-cnhs-green-dark bg-cnhs-green-dark text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                  )}
                >
                  <MessageSquare size={13} />
                  Facilitator Guidance & Notes
                  <ChevronDown
                    size={12}
                    className={cn(
                      "transition-transform",
                      showNotesDrawer ? "rotate-180" : ""
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Collapsible Guidance & Notes Card */}
            {showNotesDrawer ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-white/10 dark:bg-slate-900/40">
                <AralAssessmentComments
                  batchId={batchId}
                  gradeSection={activeSection.gradeSection}
                  canPost
                  profileId={profileId}
                  title="Principal Guidance & Facilitator Communication"
                />
              </div>
            ) : null}
          </div>

          {/* Subtabs for Views */}
          <div className="flex flex-col gap-2 border-b border-slate-100 px-4 pt-2 sm:flex-row sm:items-center sm:justify-between dark:border-white/5">
            <div
              className="flex items-end gap-3 overflow-x-auto"
              role="tablist"
              aria-label="ARAL Assessment view tabs"
            >
              {DETAIL_TABS.map((tab) => {
                const selected = detailTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => {
                      setDetailTab(tab.id);
                      setPage(1);
                    }}
                    className={cn(
                      "-mb-px shrink-0 cursor-pointer border-b-2 px-1 pb-2.5 text-xs transition-colors",
                      selected
                        ? "border-cnhs-green-dark font-bold text-cnhs-green-dark dark:border-cnhs-green dark:text-cnhs-green"
                        : "border-transparent font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400"
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {detailTab === "all" ? (
              <div className="relative pb-2 sm:pb-0">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search student…"
                  className="h-8 w-48 rounded-lg border border-slate-200 bg-slate-50/50 pl-8 pr-2.5 text-xs outline-none focus:border-cnhs-green focus:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                />
              </div>
            ) : null}
          </div>

          {/* Main Content Area */}
          <div className="p-3 sm:p-4">
            {scoresLoading || batchLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500">
                <Loader2 size={15} className="animate-spin text-cnhs-green-dark" />
                Loading assessment and learning progress…
              </div>
            ) : detailTab === "all" ? (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-white/[0.03] dark:text-slate-400">
                        <th className="px-3 py-2.5">Learner</th>
                        <th className="px-3 py-2.5">Target Subject</th>
                        <th className="px-3 py-2.5 text-center">Pre-Test (Baseline)</th>
                        <th className="px-3 py-2.5 text-center">Mid-Test</th>
                        <th className="px-3 py-2.5 text-center">Post-Test (Exit)</th>
                        <th className="px-3 py-2.5 text-center">Learning Progress</th>
                        <th className="px-3 py-2.5 text-center">Intervention Status</th>
                        <th className="px-3 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {pagedLearners.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-10 text-center text-slate-400">
                            No learners match your search.
                          </td>
                        </tr>
                      ) : (
                        pagedLearners.map((learner) => {
                          const sid = learner.studentId || learner.id;
                          const s = scoresMap.get(sid) || {};
                          const pre = s.pre;
                          const mid = s.mid;
                          const post = s.post;

                          // Compute net score improvement
                          const hasPreScore = pre?.score != null;
                          const hasPostScore = post?.score != null;
                          const hasMidScore = mid?.score != null;
                          const latestScore = hasPostScore ? post.score : hasMidScore ? mid.score : null;
                          const improvement =
                            hasPreScore && latestScore != null
                              ? latestScore - pre.score
                              : null;

                          return (
                            <tr
                              key={sid}
                              className="transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[0.02]"
                            >
                              <td className="px-3 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                                <p className="font-semibold">{learner.name}</p>
                                <p className="text-[10px] text-slate-400">{learner.studentNumber}</p>
                              </td>

                              <td className="px-3 py-2.5">
                                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-300">
                                  {learner.subject || "English / Filipino"}
                                </span>
                              </td>

                              <td className="px-3 py-2.5 text-center">
                                {hasPreScore ? (
                                  <div>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                      {pre.score} / {pre.maxScore || 20}
                                    </span>
                                    {pre.result ? (
                                      <p className="text-[10px] text-slate-500">{pre.result}</p>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-slate-400">Pending</span>
                                )}
                              </td>

                              <td className="px-3 py-2.5 text-center">
                                {hasMidScore ? (
                                  <div>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                      {mid.score} / {mid.maxScore || 20}
                                    </span>
                                    {mid.result ? (
                                      <p className="text-[10px] text-slate-500">{mid.result}</p>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-slate-400">—</span>
                                )}
                              </td>

                              <td className="px-3 py-2.5 text-center">
                                {hasPostScore ? (
                                  <div>
                                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                      {post.score} / {post.maxScore || 20}
                                    </span>
                                    {post.result ? (
                                      <p className="text-[10px] font-semibold text-emerald-600">
                                        {post.result}
                                      </p>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-slate-400">Pending</span>
                                )}
                              </td>

                              <td className="px-3 py-2.5 text-center">
                                {improvement != null ? (
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold",
                                      improvement > 0
                                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                                        : improvement === 0
                                          ? "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400"
                                          : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                                    )}
                                  >
                                    {improvement > 0 ? (
                                      <TrendingUp size={10} />
                                    ) : null}
                                    {improvement > 0 ? `+${improvement}` : improvement} pts
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-400">
                                    {learner.weeklyUpdateCount
                                      ? `${learner.weeklyUpdateCount} session update(s)`
                                      : "Ongoing sessions"}
                                  </span>
                                )}
                              </td>

                              <td className="px-3 py-2.5 text-center">
                                <Pill
                                  value={
                                    learner.monitoringStatus === "Completed / Exited" ||
                                    learner.monitoringStatus === "Completed Intervention / Exited"
                                      ? "Completed & Exited"
                                      : learner.monitoringStatus || "Ongoing"
                                  }
                                  styles={monitoringStatusStyles}
                                />
                              </td>

                              <td className="px-3 py-2.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => onViewStudent?.(learner)}
                                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
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

                {filteredLearners.length > PAGE_SIZE ? (
                  <div className="border-t border-slate-100 pt-3 dark:border-white/5">
                    <TablePagination
                      page={page}
                      totalPages={totalPages}
                      onPageChange={setPage}
                      totalItems={filteredLearners.length}
                      pageSize={PAGE_SIZE}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                <AralAssessmentReadonlyGrid
                  learners={uniqueLearnersList}
                  batchId={batchId}
                  gradeSection={activeSection.gradeSection}
                  phase={
                    detailTab === "mid"
                      ? ARAL_ASSESSMENT_PHASE.MID
                      : detailTab === "post"
                        ? ARAL_ASSESSMENT_PHASE.POST
                        : ARAL_ASSESSMENT_PHASE.PRE
                  }
                />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
