"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Folder,
  Loader2,
  RotateCcw,
} from "lucide-react";
import {
  ARAL_APPROVAL_DB,
  ARAL_APPROVAL_STATUS,
  aralApprovalDisplayLabel,
  aralApprovalStyles,
  isAralHtTrackedLearner,
} from "@/lib/monitoring/aralApproval";
import {
  batchReviewAralRecommendations,
  reviewAralRecommendation,
} from "@/lib/supabase/queries/aralApprovals";
import { getAdminSession } from "@/lib/supabase/queries/adminAuth";
import { parseRecordedGrade } from "@/lib/ecr/computeGrades";
import { normalizeSubjectName } from "@/lib/services/recommendation/subjectCapabilities";
import { Pill } from "@/components/teacher/monitoring/shared";
import { cn } from "@/lib/utils";

const SECTIONS_PAGE_SIZE = 10;
const ARAL_GRADE_THRESHOLD = 75;

function resolveQuarterNumber(row = {}) {
  const n = Number(
    row.aralApprovalQuarter ??
      row.quarterNumber ??
      String(row.quarter ?? "").replace(/\D/g, "")
  );
  return Number.isFinite(n) && n >= 1 && n <= 4 ? n : null;
}

/**
 * Real class-subject grade only — never invent 0 from null/empty.
 * Prefer classSubjectGrade → termGrades[q] → subjectGrades match → aralClassSubjectGrade.
 */
function resolveSubjectGrade(row = {}) {
  const direct = parseRecordedGrade(row.classSubjectGrade);
  if (direct !== null) return direct;

  const qNum = resolveQuarterNumber(row);
  const terms = row.termGrades || {};
  if (qNum != null) {
    const fromTerm = parseRecordedGrade(terms[qNum] ?? terms[String(qNum)]);
    if (fromTerm !== null) return fromTerm;
  }
  // Any recorded term for this class subject if quarter key missed
  for (const key of [1, 2, 3, 4]) {
    const g = parseRecordedGrade(terms[key] ?? terms[String(key)]);
    if (g !== null) return g;
  }

  const target = normalizeSubjectName(row.subject);
  if (target && Array.isArray(row.subjectGrades)) {
    for (const g of row.subjectGrades) {
      const name = normalizeSubjectName(g.subject ?? g.subjectName);
      if (name !== target) continue;
      if (
        qNum != null &&
        g.quarter != null &&
        Number(g.quarter) !== qNum
      ) {
        continue;
      }
      const grade = parseRecordedGrade(g.grade ?? g.finalGrade);
      if (grade !== null) return grade;
    }
    // Same subject, any quarter
    for (const g of row.subjectGrades) {
      const name = normalizeSubjectName(g.subject ?? g.subjectName);
      if (name !== target) continue;
      const grade = parseRecordedGrade(g.grade ?? g.finalGrade);
      if (grade !== null) return grade;
    }
  }

  const aralOnly = parseRecordedGrade(row.aralClassSubjectGrade);
  if (aralOnly !== null) return aralOnly;

  return null;
}

function formatGradeDisplay(grade) {
  if (grade === null || grade === undefined) return "—";
  return Number.isInteger(grade) ? String(grade) : String(grade);
}

function buildIdentifiedEntry(row) {
  const subject = String(row.subject || "").trim();
  if (!subject) return null;
  return {
    subject,
    grade: resolveSubjectGrade(row),
    quarter: row.quarter || null,
  };
}

function upsertIdentifiedSubject(list, entry) {
  if (!entry) return list;
  const next = [...list];
  const idx = next.findIndex((e) => e.subject === entry.subject);
  if (idx === -1) {
    next.push(entry);
    return next;
  }
  const prev = next[idx];
  // Backfill grade/quarter when a later source row has real data
  next[idx] = {
    subject: entry.subject,
    grade: prev.grade !== null ? prev.grade : entry.grade,
    quarter: prev.quarter || entry.quarter,
  };
  return next;
}

/** One muted reason line under subject chips when any grade is below 75. */
function identificationReasonLine(entries = [], fallbackQuarter = null) {
  const failing = entries.filter(
    (e) => e.grade !== null && e.grade < ARAL_GRADE_THRESHOLD
  );
  if (!failing.length) return null;
  const quarter = failing[0].quarter || fallbackQuarter || null;
  const termPart = quarter ? String(quarter) : null;
  return termPart
    ? `${termPart} · below ${ARAL_GRADE_THRESHOLD}`
    : `below ${ARAL_GRADE_THRESHOLD}`;
}

function isPendingPrincipal(status) {
  return (
    status === ARAL_APPROVAL_STATUS.SUGGESTED ||
    status === ARAL_APPROVAL_STATUS.SUBMITTED ||
    !status
  );
}

/** After Principal Approve, the row is locked (no re-approve / return / note). */
function isApprovedLocked(learner) {
  return learner?.displayStatus === ARAL_APPROVAL_STATUS.APPROVED;
}

/** Prefer gradeLevel field; else parse "Grade 7 — Mabini" / "Grade 7 Mabini". */
function parseGradeLabel(gradeSection, gradeLevel) {
  const fromField = String(gradeLevel || "").trim();
  if (/^Grade\s+\d+/i.test(fromField)) {
    return fromField.match(/^(Grade\s+\d+)/i)?.[1] ?? fromField;
  }
  const m = String(gradeSection || "").match(/^(Grade\s+\d+)/i);
  return m ? m[1] : "Other";
}

function sectionDisplayName(gradeSection, grade) {
  const stripped = String(gradeSection || "")
    .replace(/^Grade\s+\d+\s*[—–-]?\s*/i, "")
    .trim();
  return stripped || gradeSection || grade || "Section";
}

function gradeSortKey(grade) {
  const n = Number(String(grade).replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 999;
}

/** Nest section groups under grade folders. */
function buildGradeFolders(sectionGroups = []) {
  const byGrade = new Map();

  for (const group of sectionGroups) {
    const grade = group.grade;
    if (!byGrade.has(grade)) {
      byGrade.set(grade, {
        grade,
        sections: [],
        count: 0,
        pending: 0,
      });
    }
    const folder = byGrade.get(grade);
    folder.sections.push(group);
    folder.count += group.count;
    folder.pending += group.pending;
  }

  return [...byGrade.values()].sort(
    (a, b) => gradeSortKey(a.grade) - gradeSortKey(b.grade)
  );
}

/**
 * Group ARAL rows by gradeSection; dedupe same student (Eng/Fil → subject chips).
 * Keep sourceRows so Approve/Return still hits each class recommendation.
 */
function buildApprovalSectionGroups(aralRows = []) {
  const bySection = new Map();

  for (const row of aralRows) {
    const sectionKey = String(row.gradeSection || "Unassigned section").trim();
    if (!bySection.has(sectionKey)) {
      bySection.set(sectionKey, new Map());
    }
    const learners = bySection.get(sectionKey);
    const studentId = row.studentId || row.id;
    const existing = learners.get(studentId);
    const status = row.aralApprovalStatus || ARAL_APPROVAL_STATUS.SUGGESTED;

    const identified = buildIdentifiedEntry(row);

    if (!existing) {
      learners.set(studentId, {
        studentId,
        name: row.name,
        studentNumber: row.studentNumber,
        gradeSection: sectionKey,
        gradeLevel: row.gradeLevel || null,
        schoolYear: row.schoolYear,
        quarter: row.quarter,
        classId: row.classId || null,
        subjects: row.subject ? [row.subject] : [],
        identifiedSubjects: identified ? [identified] : [],
        statuses: [status],
        note: row.aralApprovalNote || "",
        sourceRows: [row],
        /** Stable multi-select key for the deduped learner card */
        selectKey: `${sectionKey}::${studentId}`,
      });
      continue;
    }

    if (row.subject && !existing.subjects.includes(row.subject)) {
      existing.subjects.push(row.subject);
    }
    existing.identifiedSubjects = upsertIdentifiedSubject(
      existing.identifiedSubjects,
      identified
    );
    existing.statuses.push(status);
    existing.sourceRows.push(row);
    if (!existing.classId && row.classId) existing.classId = row.classId;
    if (row.aralApprovalNote && !existing.note) {
      existing.note = row.aralApprovalNote;
    }
  }

  return [...bySection.entries()]
    .map(([gradeSection, learnerMap]) => {
      const learners = [...learnerMap.values()]
        .map((learner) => {
          // Worst / most actionable status for display
          const displayStatus = learner.statuses.includes(
            ARAL_APPROVAL_STATUS.RETURNED
          )
            ? ARAL_APPROVAL_STATUS.RETURNED
            : learner.statuses.includes(ARAL_APPROVAL_STATUS.SUBMITTED)
              ? ARAL_APPROVAL_STATUS.SUBMITTED
              : learner.statuses.includes(ARAL_APPROVAL_STATUS.SUGGESTED)
                ? ARAL_APPROVAL_STATUS.SUGGESTED
                : learner.statuses.includes(ARAL_APPROVAL_STATUS.APPROVED)
                  ? ARAL_APPROVAL_STATUS.APPROVED
                  : ARAL_APPROVAL_STATUS.SUGGESTED;
          const reasonLine = identificationReasonLine(
            learner.identifiedSubjects,
            learner.quarter
          );
          return { ...learner, displayStatus, reasonLine };
        })
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));

      const pending = learners.filter((l) => isPendingPrincipal(l.displayStatus)).length;
      const sample = learners[0];
      const grade = parseGradeLabel(gradeSection, sample?.gradeLevel);
      return {
        gradeSection,
        grade,
        sectionName: sectionDisplayName(gradeSection, grade),
        learners,
        count: learners.length,
        pending,
      };
    })
    .sort((a, b) =>
      String(a.gradeSection).localeCompare(String(b.gradeSection))
    );
}

/**
 * Admin/HT panel: approve or return ARAL recommendations.
 * OneData-style grade folders → sections → learners.
 */
export default function AdminAralApprovalPanel({
  students = [],
  onChanged,
  onViewStudent,
}) {
  const aralRows = useMemo(
    () => students.filter(isAralHtTrackedLearner),
    [students]
  );

  const sectionGroups = useMemo(
    () => buildApprovalSectionGroups(aralRows),
    [aralRows]
  );

  const gradeFolders = useMemo(
    () => buildGradeFolders(sectionGroups),
    [sectionGroups]
  );

  const [selectedGrade, setSelectedGrade] = useState(null);
  const [openSections, setOpenSections] = useState({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set());
  const [busyKey, setBusyKey] = useState("");
  const [batchBusy, setBatchBusy] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState({});
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const activeFolder = useMemo(
    () => gradeFolders.find((f) => f.grade === selectedGrade) ?? null,
    [gradeFolders, selectedGrade]
  );

  const visibleSections = activeFolder?.sections ?? [];

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
    setOpenSections({});
  }, [sectionGroups]);

  useEffect(() => {
    setPage(1);
    setOpenSections({});
  }, [selectedGrade]);

  useEffect(() => {
    if (
      selectedGrade &&
      !gradeFolders.some((folder) => folder.grade === selectedGrade)
    ) {
      setSelectedGrade(null);
    }
  }, [gradeFolders, selectedGrade]);

  const totalPages = Math.max(
    1,
    Math.ceil(visibleSections.length / SECTIONS_PAGE_SIZE) || 1
  );
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pagedSections = useMemo(() => {
    const start = (safePage - 1) * SECTIONS_PAGE_SIZE;
    return visibleSections.slice(start, start + SECTIONS_PAGE_SIZE);
  }, [visibleSections, safePage]);

  const sectionStart =
    visibleSections.length === 0
      ? 0
      : (safePage - 1) * SECTIONS_PAGE_SIZE + 1;
  const sectionEnd = Math.min(
    safePage * SECTIONS_PAGE_SIZE,
    visibleSections.length
  );

  const uniqueLearnerCount = useMemo(() => {
    const ids = new Set();
    for (const group of sectionGroups) {
      for (const learner of group.learners) ids.add(learner.studentId);
    }
    return ids.size;
  }, [sectionGroups]);

  function openGrade(grade) {
    setSelectedGrade(grade);
  }

  function backToGrades() {
    setSelectedGrade(null);
  }

  function toggleSection(key) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleOne(selectKey, locked = false) {
    if (locked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(selectKey)) next.delete(selectKey);
      else next.add(selectKey);
      return next;
    });
  }

  function toggleSectionAll(group) {
    const keys = group.learners
      .filter((l) => !isApprovedLocked(l))
      .map((l) => l.selectKey);
    if (!keys.length) return;
    const allSelected = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const k of keys) next.delete(k);
      } else {
        for (const k of keys) next.add(k);
      }
      return next;
    });
  }

  function expandSelectedToSourceRows(scopeLearners) {
    const rows = [];
    for (const learner of scopeLearners) {
      if (isApprovedLocked(learner)) continue;
      if (!selected.has(learner.selectKey)) continue;
      for (const row of learner.sourceRows) {
        rows.push({
          ...row,
          // Per-learner note draft for this approval row
          _reviewNote:
            noteDrafts[learner.selectKey] || learner.note || null,
        });
      }
    }
    return rows;
  }

  async function runReviewLearner(learner, status) {
    if (isApprovedLocked(learner)) return;
    setBusyKey(learner.selectKey);
    setError("");
    setToast("");
    const session = await getAdminSession();
    const profileId = session.data?.id ?? null;
    const note = noteDrafts[learner.selectKey] || learner.note || null;

    let failed = null;
    for (const row of learner.sourceRows) {
      const result = await reviewAralRecommendation({
        studentId: row.studentId,
        classId: row.classId,
        schoolYear: row.schoolYear,
        quarter: row.quarterNumber ?? row.quarter,
        status,
        reviewNote: note,
        profileId,
      });
      if (result.error) {
        failed = result.error.message;
        break;
      }
    }

    setBusyKey("");
    if (failed) {
      setError(failed);
      onChanged?.();
      return;
    }
    setToast(
      status === ARAL_APPROVAL_DB.APPROVED
        ? `Approved ARAL recommendation for ${learner.name}.`
        : `Returned ARAL recommendation for ${learner.name}.`
    );
    onChanged?.();
  }

  async function runBatchForSection(group, status) {
    const sourceRows = expandSelectedToSourceRows(group.learners);
    if (!sourceRows.length) {
      setError("Select at least one learner in this section.");
      return;
    }
    setBatchBusy(true);
    setError("");
    setToast("");
    const session = await getAdminSession();
    const result = await batchReviewAralRecommendations({
      learners: sourceRows.map((row) => ({
        studentId: row.studentId,
        classId: row.classId,
        schoolYear: row.schoolYear,
        quarterNumber: row.quarterNumber ?? row.quarter,
        quarter: row.quarter,
      })),
      status,
      reviewNote: null,
      profileId: session.data?.id ?? null,
    });
    setBatchBusy(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    const n = group.learners.filter((l) => selected.has(l.selectKey)).length;
    setToast(
      status === ARAL_APPROVAL_DB.APPROVED
        ? `Approved ${n} learner(s) in ${group.gradeSection}.`
        : `Returned ${n} learner(s) in ${group.gradeSection}.`
    );
    setSelected((prev) => {
      const next = new Set(prev);
      for (const l of group.learners) next.delete(l.selectKey);
      return next;
    });
    onChanged?.();
  }

  if (!sectionGroups.length) {
    return (
      <section className="rounded-xl border border-slate-100 bg-white px-3 py-3 text-[12px] text-slate-500 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:px-4">
        No ARAL-recommended learners to approve yet. Recommendations appear after
        English / Filipino ECR grades trigger ARAL Learners.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)] dark:border-white/5 dark:bg-[var(--card)] dark:shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2.5 sm:px-4 dark:border-white/5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Approve ARAL Recommendations
          </h2>
        </div>
        <span className="inline-flex rounded-full bg-cnhs-green-soft px-2.5 py-0.5 text-[10px] font-semibold text-cnhs-green-dark">
          {uniqueLearnerCount} learner
          {uniqueLearnerCount === 1 ? "" : "s"} · {sectionGroups.length}{" "}
          section{sectionGroups.length === 1 ? "" : "s"} · {gradeFolders.length}{" "}
          grade{gradeFolders.length === 1 ? "" : "s"}
        </span>
      </div>

      {(error || toast) && (
        <div
          className={cn(
            "border-b px-3 py-2 text-[12px] sm:px-4",
            error
              ? "border-red-100 bg-red-50 text-red-600"
              : "border-emerald-100 bg-emerald-50 text-emerald-800"
          )}
        >
          {error || toast}
        </div>
      )}

      {!selectedGrade ? (
        <div className="p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {gradeFolders.map((folder) => {
              const attention = folder.pending > 0;
              return (
                <button
                  key={folder.grade}
                  type="button"
                  onClick={() => openGrade(folder.grade)}
                  className={cn(
                    "group flex cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition-colors hover:border-cnhs-green/40 hover:bg-cnhs-green-soft/20 dark:border-white/5 dark:bg-[var(--card)] dark:shadow-none dark:hover:border-cnhs-green/25 dark:hover:bg-white/[0.04]"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cnhs-green-soft text-cnhs-green-dark">
                      <Folder size={18} strokeWidth={1.75} />
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                        attention
                          ? "bg-cnhs-orange-soft text-cnhs-orange ring-cnhs-orange/30 dark:bg-cnhs-orange/15 dark:text-cnhs-orange dark:ring-0"
                          : "bg-cnhs-green-soft text-cnhs-green-dark ring-cnhs-green/25 dark:bg-cnhs-green/15 dark:text-cnhs-green dark:ring-0"
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          attention ? "bg-cnhs-orange" : "bg-cnhs-green"
                        )}
                      />
                      {attention ? "Attention" : "Clear"}
                    </span>
                  </div>

                  <p className="mt-4 text-[13px] font-semibold tracking-[-0.01em] text-slate-900 dark:text-slate-100">
                    {folder.grade}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {folder.count} learner{folder.count === 1 ? "" : "s"} ·{" "}
                    {folder.sections.length} section
                    {folder.sections.length === 1 ? "" : "s"}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {folder.pending > 0 ? (
                      <span className="rounded-full bg-cnhs-orange-soft px-2 py-0.5 text-[10px] font-medium text-cnhs-orange ring-1 ring-cnhs-orange/30 dark:bg-cnhs-orange/15 dark:text-cnhs-orange dark:ring-0">
                        {folder.pending} pending Principal review
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200 dark:bg-white/5 dark:text-slate-400 dark:ring-0">
                        None pending
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3 dark:border-white/5">
                    <span className="text-[11px] text-slate-400">
                      Open sections
                    </span>
                    <span className="text-[11px] font-semibold text-cnhs-green-dark opacity-0 transition-opacity group-hover:opacity-100">
                      Open →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4 dark:border-white/5">
            <button
              type="button"
              onClick={backToGrades}
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/5 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
            >
              <ChevronLeft size={13} />
              All grades
            </button>
            <div className="min-w-0 text-right">
              <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                {selectedGrade}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                {activeFolder?.count ?? 0} learner
                {(activeFolder?.count ?? 0) === 1 ? "" : "s"} ·{" "}
                {visibleSections.length} section
                {visibleSections.length === 1 ? "" : "s"}
                {activeFolder?.pending
                  ? ` · ${activeFolder.pending} pending Principal review`
                  : " · none pending"}
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {pagedSections.map((group) => {
              const open = Boolean(openSections[group.gradeSection]);
              const pendingLearners = group.learners.filter(
                (l) => !isApprovedLocked(l)
              );
              const sectionKeys = pendingLearners.map((l) => l.selectKey);
              const selectedInSection = sectionKeys.filter((k) =>
                selected.has(k)
              ).length;
              const allSectionSelected =
                sectionKeys.length > 0 &&
                sectionKeys.every((k) => selected.has(k));

              return (
                <div key={group.gradeSection}>
                  <button
                    type="button"
                    onClick={() => toggleSection(group.gradeSection)}
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.04] sm:px-4"
                  >
                    <ChevronDown
                      size={16}
                      className={cn(
                        "shrink-0 text-slate-400 transition-transform",
                        open ? "rotate-180" : ""
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                        {group.sectionName}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {group.count} learner{group.count === 1 ? "" : "s"}
                        {group.pending > 0
                          ? ` · ${group.pending} pending Principal review`
                          : " · none pending"}
                      </p>
                    </div>
                    {group.pending > 0 ? (
                      <span className="inline-flex rounded-full bg-cnhs-orange-soft px-2 py-0.5 text-[10px] font-semibold text-cnhs-orange ring-1 ring-cnhs-orange/30 dark:bg-cnhs-orange/15 dark:text-cnhs-orange dark:ring-0">
                        {group.pending} pending
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-cnhs-green-soft px-2 py-0.5 text-[10px] font-semibold text-cnhs-green-dark ring-1 ring-cnhs-green/25 dark:bg-cnhs-green/15 dark:text-cnhs-green dark:ring-0">
                        Clear
                      </span>
                    )}
                  </button>

                  {open ? (
                    <div className="border-t border-slate-50 bg-slate-50/40 px-3 py-3 sm:px-4 dark:border-white/5 dark:bg-white/[0.03]">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            runBatchForSection(group, ARAL_APPROVAL_DB.APPROVED)
                          }
                          disabled={batchBusy || selectedInSection === 0}
                          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {batchBusy ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={12} />
                          )}
                          Approve selected ({selectedInSection})
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            runBatchForSection(group, ARAL_APPROVAL_DB.RETURNED)
                          }
                          disabled={batchBusy || selectedInSection === 0}
                          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-cnhs-orange/35 bg-cnhs-orange-soft px-3 text-[11px] font-semibold text-cnhs-orange hover:bg-cnhs-orange/15 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <RotateCcw size={12} />
                          Return selected
                        </button>
                      </div>

                      <div className="overflow-x-auto rounded-xl border border-slate-100 bg-white dark:border-white/5 dark:bg-[var(--card)]">
                        <table className="min-w-[780px] w-full border-collapse text-left">
                          <thead>
                            <tr className="bg-slate-50/80 dark:bg-white/[0.03]">
                              <th className="px-2.5 py-1.5">
                                <input
                                  type="checkbox"
                                  checked={allSectionSelected}
                                  disabled={sectionKeys.length === 0}
                                  onChange={() => toggleSectionAll(group)}
                                  aria-label={`Select all pending in ${group.gradeSection}`}
                                  className="disabled:cursor-not-allowed disabled:opacity-40"
                                />
                              </th>
                              {[
                                "Learner",
                                "Identified in",
                                "Approval",
                                "Principal note",
                                "Actions",
                              ].map((h) => (
                                <th
                                  key={h}
                                  className="px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {group.learners.map((learner) => {
                              const busy = busyKey === learner.selectKey;
                              const locked = isApprovedLocked(learner);
                              return (
                                <tr
                                  key={learner.selectKey}
                                  className="border-t border-slate-100 hover:bg-slate-50/60 dark:border-white/5 dark:hover:bg-white/[0.03]"
                                >
                                  <td className="px-2.5 py-2">
                                    <input
                                      type="checkbox"
                                      checked={
                                        !locked && selected.has(learner.selectKey)
                                      }
                                      disabled={locked}
                                      onChange={() =>
                                        toggleOne(learner.selectKey, locked)
                                      }
                                      aria-label={`Select ${learner.name}`}
                                      className="disabled:cursor-not-allowed disabled:opacity-40"
                                    />
                                  </td>
                                  <td className="px-2.5 py-2">
                                    {typeof onViewStudent === "function" &&
                                    (learner.classId ||
                                      learner.sourceRows?.[0]?.classId) ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onViewStudent(
                                            learner.sourceRows?.[0] || learner
                                          )
                                        }
                                        className="text-left"
                                      >
                                        <p className="text-[12px] font-semibold text-slate-800 hover:text-cnhs-green-dark dark:text-slate-100 dark:hover:text-cnhs-green">
                                          {learner.name}
                                        </p>
                                        <p className="text-[10px] text-slate-400">
                                          {learner.studentNumber}
                                          {learner.quarter
                                            ? ` · ${learner.quarter}`
                                            : ""}
                                        </p>
                                      </button>
                                    ) : (
                                      <>
                                        <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-100">
                                          {learner.name}
                                        </p>
                                        <p className="text-[10px] text-slate-400">
                                          {learner.studentNumber}
                                          {learner.quarter
                                            ? ` · ${learner.quarter}`
                                            : ""}
                                        </p>
                                      </>
                                    )}
                                  </td>
                                  <td className="px-2.5 py-2">
                                    <div className="flex flex-col gap-1">
                                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        {(learner.identifiedSubjects?.length
                                          ? learner.identifiedSubjects
                                          : learner.subjects.map((subject) => ({
                                              subject,
                                              grade: null,
                                            }))
                                        ).map((entry) => {
                                          const failing =
                                            entry.grade !== null &&
                                            entry.grade < ARAL_GRADE_THRESHOLD;
                                          return (
                                            <span
                                              key={entry.subject}
                                              className="inline-flex items-center gap-1.5"
                                            >
                                              <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-0">
                                                {entry.subject}
                                              </span>
                                              <span
                                                className={cn(
                                                  "text-[11px] font-semibold tabular-nums",
                                                  entry.grade === null
                                                    ? "text-slate-400 dark:text-slate-500"
                                                    : failing
                                                      ? "text-cnhs-orange"
                                                      : "text-slate-700 dark:text-slate-200"
                                                )}
                                              >
                                                {formatGradeDisplay(entry.grade)}
                                              </span>
                                            </span>
                                          );
                                        })}
                                      </div>
                                      {learner.reasonLine ? (
                                        <p className="text-[10px] text-slate-400">
                                          {learner.reasonLine}
                                        </p>
                                      ) : null}
                                      {learner.sourceRows?.[0]?.rfPredictedRisk ? (
                                        <div className="flex items-center gap-1 text-[10px] text-purple-700 dark:text-purple-300">
                                          <span className="font-semibold">RF Pattern:</span>
                                          <span>{learner.sourceRows[0].rfPredictedRisk}</span>
                                          {learner.sourceRows[0].recommendationConfidence ? (
                                            <span className="text-slate-400">
                                              ({Math.round(learner.sourceRows[0].recommendationConfidence * 100)}%)
                                            </span>
                                          ) : null}
                                        </div>
                                      ) : null}
                                    </div>
                                  </td>
                                  <td className="px-2.5 py-2">
                                    <Pill
                                      value={aralApprovalDisplayLabel(
                                        learner.displayStatus
                                      )}
                                      styles={{
                                        ...aralApprovalStyles,
                                        [aralApprovalDisplayLabel(
                                          learner.displayStatus
                                        )]:
                                          aralApprovalStyles[
                                            learner.displayStatus
                                          ],
                                      }}
                                    />
                                  </td>
                                  <td className="px-2.5 py-2">
                                    {locked ? (
                                      (() => {
                                        const noteText = String(
                                          noteDrafts[learner.selectKey] ??
                                            learner.note ??
                                            ""
                                        ).trim();
                                        return noteText ? (
                                          <p
                                            className="max-w-[10rem] text-[11px] leading-snug text-slate-600 dark:text-slate-300"
                                            title={noteText}
                                          >
                                            {noteText}
                                          </p>
                                        ) : (
                                          <p className="text-[10px] text-slate-400">
                                            No note
                                          </p>
                                        );
                                      })()
                                    ) : (
                                      <input
                                        value={
                                          noteDrafts[learner.selectKey] ??
                                          learner.note ??
                                          ""
                                        }
                                        onChange={(e) =>
                                          setNoteDrafts((prev) => ({
                                            ...prev,
                                            [learner.selectKey]: e.target.value,
                                          }))
                                        }
                                        placeholder="Optional return / review note"
                                        className="h-7 w-44 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-cnhs-green dark:border-white/5 dark:bg-white/[0.03] dark:text-slate-200 dark:placeholder:text-slate-500"
                                      />
                                    )}
                                  </td>
                                  <td className="px-2.5 py-2">
                                    {locked ? (
                                      <span className="text-[10px] font-medium text-slate-400">
                                        Reviewed
                                      </span>
                                    ) : (
                                    <div className="flex flex-wrap gap-1">
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                          runReviewLearner(
                                            learner,
                                            ARAL_APPROVAL_DB.APPROVED
                                          )
                                        }
                                        className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full bg-cnhs-green-dark px-2.5 text-[10px] font-semibold text-white hover:bg-[#246f54] disabled:opacity-50"
                                      >
                                        {busy ? (
                                          <Loader2
                                            size={11}
                                            className="animate-spin"
                                          />
                                        ) : (
                                          <CheckCircle2 size={11} />
                                        )}
                                        Evaluate Escalation
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() =>
                                          runReviewLearner(
                                            learner,
                                            ARAL_APPROVAL_DB.RETURNED
                                          )
                                        }
                                        className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-cnhs-orange/35 bg-cnhs-orange-soft px-2.5 text-[10px] font-semibold text-cnhs-orange hover:bg-cnhs-orange/15 disabled:opacity-50"
                                      >
                                        <RotateCcw size={11} />
                                        Return
                                      </button>
                                    </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {visibleSections.length > SECTIONS_PAGE_SIZE ? (
            <div className="flex flex-col gap-2 border-t border-slate-100 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <p className="text-[11px] font-medium text-slate-500">
                Showing{" "}
                <span className="font-semibold tabular-nums text-slate-700">
                  {sectionStart}–{sectionEnd}
                </span>{" "}
                of{" "}
                <span className="font-semibold tabular-nums text-slate-700">
                  {visibleSections.length}
                </span>{" "}
                sections · {SECTIONS_PAGE_SIZE} per page
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage <= 1}
                  className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/5 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                >
                  <ChevronLeft size={13} />
                  Previous
                </button>
                <span className="min-w-[4rem] text-center text-[11px] font-semibold tabular-nums text-slate-600">
                  {safePage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage >= totalPages}
                  className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/5 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
                >
                  Next
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
