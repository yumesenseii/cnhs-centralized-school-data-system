"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Folder,
  Loader2,
  X,
} from "lucide-react";
import {
  ARAL_APPROVAL_DB,
  ARAL_APPROVAL_STATUS,
  aralApprovalDisplayLabel,
  isAralHtTrackedLearner,
  isPendingPrincipal,
} from "@/lib/monitoring/aralApproval";
import {
  reviewAralRecommendation,
} from "@/lib/supabase/queries/aralApprovals";
import { getAdminSession } from "@/lib/supabase/queries/adminAuth";
import {
  formatTeacherReadingConcern,
} from "@/lib/monitoring/aralLearnerAggregation";
import AdminAralReviewModal from "@/components/admin/monitoring/AdminAralReviewModal";
import AdminTablePagination from "@/components/shared/AdminTablePagination";
import { useAppToast } from "@/components/shared/AppToast";
import { cn } from "@/lib/utils";

const SECTIONS_PAGE_SIZE = 10;

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

function formatFullSectionName(grade, rawSection) {
  const stripped = String(rawSection || "")
    .replace(/^Grade\s+\d+\s*[—–-]?\s*/i, "")
    .trim();
  const cleanSection = stripped || rawSection || "Section";
  return grade && !cleanSection.toLowerCase().startsWith(grade.toLowerCase())
    ? `${grade} – ${cleanSection}`
    : cleanSection;
}

function gradeSortKey(grade) {
  const n = Number(String(grade).replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 999;
}

function isApprovedLocked(learner) {
  return learner?.displayStatus === ARAL_APPROVAL_STATUS.APPROVED;
}

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
        identifiedSubjects: row.subject
          ? [{ subject: row.subject, grade: row.classSubjectGrade ?? null }]
          : [],
        statuses: [status],
        note: row.aralApprovalNote || "",
        sourceRows: [row],
        selectKey: `${sectionKey}::${studentId}`,
      });
      continue;
    }

    if (row.subject && !existing.subjects.includes(row.subject)) {
      existing.subjects.push(row.subject);
      existing.identifiedSubjects.push({
        subject: row.subject,
        grade: row.classSubjectGrade ?? null,
      });
    }
    existing.statuses.push(status);
    existing.sourceRows.push(row);
    if (row.aralApprovalNote && !existing.note) {
      existing.note = row.aralApprovalNote;
    }
  }

  return [...bySection.entries()]
    .map(([gradeSection, learnerMap]) => {
      const learners = [...learnerMap.values()]
        .map((learner) => {
          const displayStatus = learner.statuses.includes(ARAL_APPROVAL_STATUS.RETURNED)
            ? ARAL_APPROVAL_STATUS.RETURNED
            : learner.statuses.includes(ARAL_APPROVAL_STATUS.SUBMITTED)
              ? ARAL_APPROVAL_STATUS.SUBMITTED
              : learner.statuses.includes(ARAL_APPROVAL_STATUS.APPROVED)
                ? ARAL_APPROVAL_STATUS.APPROVED
                : ARAL_APPROVAL_STATUS.SUGGESTED;
          return { ...learner, displayStatus };
        })
        .sort((a, b) => String(a.name).localeCompare(String(b.name)));

      const pending = learners.filter((l) => isPendingPrincipal(l.displayStatus)).length;
      const sample = learners[0];
      const grade = parseGradeLabel(gradeSection, sample?.gradeLevel);
      return {
        gradeSection,
        grade,
        sectionName: formatFullSectionName(grade, sectionDisplayName(gradeSection, grade)),
        learners,
        count: learners.length,
        pending,
      };
    })
    .sort((a, b) => String(a.gradeSection).localeCompare(String(b.gradeSection)));
}

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

  const [statusFilter, setStatusFilter] = useState("pending");

  const visibleGroups = useMemo(() => {
    if (statusFilter !== "pending") return sectionGroups;
    return sectionGroups
      .map((group) => {
        const learners = group.learners.filter((l) =>
          isPendingPrincipal(l.displayStatus)
        );
        return {
          ...group,
          learners,
          count: learners.length,
          pending: learners.length,
        };
      })
      .filter((group) => group.learners.length > 0);
  }, [sectionGroups, statusFilter]);

  const gradeFolders = useMemo(
    () => buildGradeFolders(visibleGroups),
    [visibleGroups]
  );

  const [selectedGrade, setSelectedGrade] = useState(null);
  const [openSections, setOpenSections] = useState({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set());
  const [busyKey, setBusyKey] = useState("");
  const [batchBusy, setBatchBusy] = useState(false);
  const [reviewingLearner, setReviewingLearner] = useState(null);
  const [reviewNote, setReviewNote] = useState("");
  const { showToast } = useAppToast();

  const activeFolder = useMemo(
    () => gradeFolders.find((f) => f.grade === selectedGrade) ?? null,
    [gradeFolders, selectedGrade]
  );

  const visibleSections = activeFolder?.sections ?? [];

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
    setOpenSections({});
  }, [visibleGroups]);

  useEffect(() => {
    setPage(1);
    setOpenSections({});
  }, [selectedGrade]);

  const totalPages = Math.max(
    1,
    Math.ceil(visibleSections.length / SECTIONS_PAGE_SIZE) || 1
  );
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pagedSections = useMemo(() => {
    const start = (safePage - 1) * SECTIONS_PAGE_SIZE;
    return visibleSections.slice(start, start + SECTIONS_PAGE_SIZE);
  }, [visibleSections, safePage]);

  function toggleSection(key) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleOne(selectKey, locked = false, isActionable = true) {
    if (locked || !isActionable) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(selectKey)) next.delete(selectKey);
      else next.add(selectKey);
      return next;
    });
  }

  function toggleSectionAll(group) {
    const keys = group.learners
      .filter((l) => !isApprovedLocked(l) && isPendingPrincipal(l.displayStatus))
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

  async function handleSingleApprove(learner) {
    if (!learner) return;
    if (!isPendingPrincipal(learner.displayStatus)) {
      showToast({
        title: "Cannot Approve",
        message: "Only referrals submitted by the teacher may be approved.",
        tone: "warning",
      });
      return;
    }
    setBusyKey(learner.selectKey);
    const session = await getAdminSession();
    const profileId = session.data?.id ?? null;

    let failed = null;
    for (const row of learner.sourceRows) {
      const result = await reviewAralRecommendation({
        studentId: row.studentId,
        classId: row.classId,
        schoolYear: row.schoolYear,
        quarter: row.quarterNumber ?? row.quarter,
        status: ARAL_APPROVAL_DB.APPROVED,
        reviewNote: null,
        profileId,
      });
      if (result.error) {
        failed = result.error.message;
        break;
      }
    }

    setBusyKey("");
    if (failed) {
      showToast({
        title: "Review Error",
        message: failed,
        tone: "error",
      });
      return;
    }

    showToast({
      title: "Referral Approved",
      message: `${learner.name} is now approved for reading assessment.`,
      tone: "success",
    });
    setReviewingLearner(null);
    onChanged?.();
  }

  async function handleSingleReturn(learner, noteText) {
    if (!learner) return;
    setBusyKey(learner.selectKey);
    const session = await getAdminSession();
    const profileId = session.data?.id ?? null;

    let failed = null;
    for (const row of learner.sourceRows) {
      const result = await reviewAralRecommendation({
        studentId: row.studentId,
        classId: row.classId,
        schoolYear: row.schoolYear,
        quarter: row.quarterNumber ?? row.quarter,
        status: ARAL_APPROVAL_DB.RETURNED,
        reviewNote: noteText || null,
        profileId,
      });
      if (result.error) {
        failed = result.error.message;
        break;
      }
    }

    setBusyKey("");
    if (failed) {
      showToast({
        title: "Review Error",
        message: failed,
        tone: "error",
      });
      return;
    }

    showToast({
      title: "Returned to Teacher",
      message: `${learner.name}'s referral has been returned to the teacher.`,
      tone: "info",
    });
    setReviewingLearner(null);
    onChanged?.();
  }

  // Bulk Approve Selected Learners
  async function handleBulkApprove() {
    if (selected.size === 0) return;
    setBatchBusy(true);

    const allLearners = [];
    for (const group of visibleGroups) {
      for (const l of group.learners) {
        if (selected.has(l.selectKey) && isPendingPrincipal(l.displayStatus)) {
          allLearners.push(l);
        }
      }
    }

    if (!allLearners.length) {
      showToast({
        title: "No Submitted Referrals",
        message: "Only referrals submitted by the teacher may be approved.",
        tone: "warning",
      });
      setBatchBusy(false);
      return;
    }

    const session = await getAdminSession();
    const profileId = session.data?.id ?? null;
    let approvedCount = 0;
    let failed = null;

    for (const learner of allLearners) {
      for (const row of learner.sourceRows) {
        const result = await reviewAralRecommendation({
          studentId: row.studentId,
          classId: row.classId,
          schoolYear: row.schoolYear,
          quarter: row.quarterNumber ?? row.quarter,
          status: ARAL_APPROVAL_DB.APPROVED,
          reviewNote: null,
          profileId,
        });
        if (result.error) {
          failed = result.error.message;
          break;
        }
      }
      if (failed) break;
      approvedCount++;
    }

    setBatchBusy(false);
    if (failed) {
      showToast({
        title: "Bulk Approval Error",
        message: failed,
        tone: "error",
      });
      onChanged?.();
      return;
    }

    showToast({
      title: "Referrals Approved",
      message: `${approvedCount} learner${approvedCount === 1 ? "" : "s"} approved for assessment.`,
      tone: "success",
    });
    setSelected(new Set());
    onChanged?.();
  }

  if (!sectionGroups.length) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500 shadow-xs">
        No ARAL reading referrals found. Referrals appear when English or Filipino teachers submit reading review candidates.
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-white/5 dark:bg-[var(--card)]">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5 dark:border-white/5">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Review Reading Referrals
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Review teacher reading endorsements for English and Filipino learners.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {["pending", "all"].map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              aria-pressed={statusFilter === filter}
              className={cn(
                "h-8 cursor-pointer rounded-full px-3 text-xs font-semibold transition-all",
                statusFilter === filter
                  ? "bg-cnhs-green-dark text-white shadow-xs"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {filter === "pending" ? "Waiting for Review" : "All Referrals"}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Action Bar (When learners are selected) */}
      {selected.size > 0 ? (
        <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-cnhs-green/30 bg-emerald-50/90 px-4 py-2.5 backdrop-blur-sm dark:bg-emerald-950/80">
          <div className="flex items-center gap-2 text-xs font-semibold text-cnhs-green-dark dark:text-emerald-300">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cnhs-green-dark text-[10px] text-white">
              {selected.size}
            </span>
            <span>learner{selected.size === 1 ? "" : "s"} selected</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={batchBusy}
              onClick={handleBulkApprove}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#246f54] active:scale-95 disabled:opacity-50"
            >
              {batchBusy ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <CheckCircle2 size={13} />
              )}
              Approve Selected ({selected.size})
            </button>
          </div>
        </div>
      ) : null}

      {/* Main Content: Grade folders or Section Accordions */}
      {selectedGrade === null ? (
        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gradeFolders.map((folder) => {
              const hasPending = folder.pending > 0;
              return (
                <button
                  key={folder.grade}
                  type="button"
                  onClick={() => setSelectedGrade(folder.grade)}
                  className="group relative flex cursor-pointer flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs transition-all hover:border-cnhs-green/50 hover:bg-cnhs-green-soft/10 active:scale-[0.99] dark:border-white/5 dark:bg-[var(--card)]"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cnhs-green-soft text-cnhs-green-dark">
                        <Folder size={18} />
                      </div>
                      {hasPending ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          {folder.pending} Waiting
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          All Clear
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-sm font-bold text-slate-900 dark:text-slate-100">
                      {folder.grade}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {folder.count} learner{folder.count === 1 ? "" : "s"} · {folder.sections.length} section{folder.sections.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs font-semibold text-cnhs-green-dark dark:border-white/5">
                    <span>Open Sections</span>
                    <span className="transition-transform group-hover:translate-x-0.5">→</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-4 p-4 sm:p-5">
          {/* Breadcrumb Back */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSelectedGrade(null)}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
            >
              <ChevronLeft size={13} />
              All Grades
            </button>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {selectedGrade} ({activeFolder?.count ?? 0} learners)
            </span>
          </div>

          {/* Section Accordions */}
          <div className="space-y-3">
            {pagedSections.map((group) => {
              const open = Boolean(openSections[group.gradeSection]);
              const sectionKeys = group.learners
                .filter((l) => !isApprovedLocked(l))
                .map((l) => l.selectKey);
              const allSectionSelected =
                sectionKeys.length > 0 &&
                sectionKeys.every((k) => selected.has(k));

              return (
                <div
                  key={group.gradeSection}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs dark:border-white/5 dark:bg-[var(--card)]"
                >
                  <button
                    type="button"
                    onClick={() => toggleSection(group.gradeSection)}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 bg-slate-50/60 p-3.5 text-left transition hover:bg-slate-100/60 dark:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-2.5">
                      <ChevronDown
                        size={16}
                        className={cn(
                          "text-slate-400 transition-transform",
                          open ? "rotate-180" : ""
                        )}
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {group.sectionName}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {group.count} learner{group.count === 1 ? "" : "s"}
                          {group.pending > 0
                            ? ` · ${group.pending} waiting for review`
                            : " · all reviewed"}
                        </p>
                      </div>
                    </div>
                    {group.pending > 0 ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800">
                        {group.pending} Waiting
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                        Approved
                      </span>
                    )}
                  </button>

                  {open ? (
                    <div className="border-t border-slate-100 dark:border-white/5">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[700px] border-collapse text-left text-xs">
                          <thead className="border-b border-slate-100 bg-slate-50/80 font-bold uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-white/[0.02]">
                            <tr>
                              <th className="w-10 px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={allSectionSelected}
                                  disabled={sectionKeys.length === 0}
                                  onChange={() => toggleSectionAll(group)}
                                  className="rounded border-slate-300 text-cnhs-green focus:ring-cnhs-green"
                                />
                              </th>
                              <th className="px-4 py-3">Learner</th>
                              <th className="px-4 py-3">Grade & Section</th>
                              <th className="px-4 py-3">Reading Concern</th>
                              <th className="px-4 py-3">Status</th>
                              <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {group.learners.map((learner) => {
                              const locked = isApprovedLocked(learner);
                              const isChecked = !locked && selected.has(learner.selectKey);
                              const concern = formatTeacherReadingConcern(learner);

                              return (
                                <tr
                                  key={learner.selectKey}
                                  className={cn(
                                    "transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[0.02]",
                                    isChecked ? "bg-emerald-50/40 dark:bg-emerald-950/20" : ""
                                  )}
                                >
                                  <td className="px-4 py-3">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      disabled={locked || !isPendingPrincipal(learner.displayStatus)}
                                      onChange={() => toggleOne(learner.selectKey, locked, isPendingPrincipal(learner.displayStatus))}
                                      className="rounded border-slate-300 text-cnhs-green focus:ring-cnhs-green disabled:opacity-30"
                                    />
                                  </td>
                                  <td className="px-4 py-3">
                                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                                      {learner.name}
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                      LRN: {learner.studentNumber || learner.lrn || "—"}
                                    </p>
                                  </td>
                                  <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                                    {group.sectionName}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="inline-flex rounded-lg bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                                      {concern}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    {locked ? (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                        <CheckCircle2 size={11} />
                                        Approved
                                      </span>
                                    ) : learner.displayStatus === ARAL_APPROVAL_STATUS.RETURNED ? (
                                      <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-semibold text-orange-700 ring-1 ring-orange-200">
                                        Returned
                                      </span>
                                    ) : learner.displayStatus === ARAL_APPROVAL_STATUS.SUBMITTED ? (
                                      <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
                                        Submitted for Approval
                                      </span>
                                    ) : (
                                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                                        Awaiting Teacher Review
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReviewingLearner(learner);
                                        setReviewNote(learner.note || "");
                                      }}
                                      className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-slate-900 active:scale-95"
                                    >
                                      <Eye size={12} />
                                      Review
                                    </button>
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

          <AdminTablePagination
            page={safePage}
            pageSize={SECTIONS_PAGE_SIZE}
            total={visibleSections.length}
            onPageChange={setPage}
            itemLabel="sections"
          />
        </div>
      )}

      {/* Centered Review Modal */}
      {reviewingLearner ? (
        <AdminAralReviewModal
          learner={reviewingLearner}
          locked={isApprovedLocked(reviewingLearner)}
          busy={busyKey === reviewingLearner.selectKey}
          note={reviewNote}
          onNoteChange={setReviewNote}
          onApprove={() => handleSingleApprove(reviewingLearner)}
          onReturn={() => handleSingleReturn(reviewingLearner, reviewNote)}
          onClose={() => setReviewingLearner(null)}
        />
      ) : null}
    </section>
  );
}
