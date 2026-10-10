"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Minus,
  ClipboardList,
  Eye,
  Check,
} from "lucide-react";
import LearnerName from "@/components/shared/LearnerName";
import AppSelect from "@/components/shared/AppSelect";
import MonitoringTablePagination from "@/components/teacher/monitoring/MonitoringTablePagination";
import { RiskPill, PriorityCue } from "@/components/teacher/monitoring/shared";
import ReviewRecommendedModal from "@/components/teacher/monitoring/ReviewRecommendedModal";
import {
  buildReadingReviewSummary,
  isReadingReviewCandidate,
} from "@/lib/monitoring/readingReviewSummary";
import { useAppToast } from "@/components/shared/AppToast";
import { referLearnerToAral } from "@/lib/supabase/queries/monitoring";
import { submitAralRecommendationForReview } from "@/lib/supabase/queries/aralApprovals";
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

// Stable key per roster row (one row per learner per subject enrollment).
function rowKey(row) {
  return (
    row.id || `${row.studentId || row.studentNumber}::${row.subject}::${row.section}`
  );
}

function learnerInitials(row) {
  const parts = [row.firstName, row.lastName].filter(Boolean);
  if (parts.length) {
    return parts.map((w) => String(w).trim()[0]).join("").toUpperCase().slice(0, 2);
  }
  return String(row.name || "?")
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// System-assisted shortlist lives in lib/monitoring/readingReviewSummary.js
// (isReadingReviewCandidate). Prioritization only — NOT ARAL eligibility.

function isAlreadyReferred(row) {
  if (!row) return false;
  if (row.alreadyReferred) return true;
  if (row.candidateStatus === "Referred to ARAL") return true;
  const approval = String(row.aralApprovalStatus || "");
  return /submitted|approved|for your review|pending principal review|approved for assessment/i.test(approval);
}

const TRIAGE_META = {
  confirmed: {
    label: "Reading concern",
    className: "bg-amber-50 text-amber-800 ring-amber-200/70",
  },
  not_reading: {
    label: "Not reading-related",
    className: "bg-slate-100 text-slate-500 ring-slate-200",
  },
  needs_review: {
    label: "Needs detailed review",
    className: "bg-blue-50 text-blue-800 ring-blue-200/70",
  },
};

export default function ClassRemedialsSection({
  students = [],
  currentQuarterNumber = 1,
  quarterFilter = "All quarters",
  onQuarterFilterChange,
  availableQuarters = [],
  onViewLearner,
  onNavigateToAral,
  onRefresh,
}) {
  const { showToast } = useAppToast();
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("All sections");
  const [subject, setSubject] = useState("All subjects");
  const [supportFilter, setSupportFilter] = useState("All support");
  const [page, setPage] = useState(1);

  // Batch reading-concern triage (UI state only — selection never creates
  // ARAL records; referrals are submitted explicitly per learner).
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [triageByKey, setTriageByKey] = useState({});
  const [triageDetail, setTriageDetail] = useState({});
  const [batchWorking, setBatchWorking] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

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

  // Rows arrive pre-aggregated (one learner per section per quarter) from
  // MonitoringDashboard. This component filters and renders only.
  // Extract filter options
  const filterOptions = useMemo(() => {
    const sections = [...new Set(students.map((s) => s.section).filter(Boolean))].sort();
    const subjects = [...new Set((students.flatMap((s) => s.subjects ?? [s.subject]) ?? []).filter(Boolean))].sort();
    return { sections, subjects };
  }, [students]);

  // Filter student rows (school year + quarter already applied upstream)
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

    if (subject !== "All subjects") {
      list = list.filter((s) =>
        (s.subjects ?? [s.subject]).includes(subject)
      );
    }

    if (supportFilter === "Learners for Reading Review") {
      list = list.filter((s) => isReadingReviewCandidate(s));
    } else if (supportFilter !== "All support") {
      list = list.filter((s) => (s.recommendedSupport || "None") === supportFilter);
    }

    return list;
  }, [students, search, section, subject, supportFilter]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
    setTriageByKey({});
    setTriageDetail({});
  }, [search, section, quarterFilter, subject, supportFilter]);

  const rowsByKey = useMemo(() => {
    const map = new Map();
    for (const row of students) map.set(rowKey(row), row);
    return map;
  }, [students]);

  function toggleSelect(key) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // Derived review summary over the current filter (all counts dynamic).
  const reviewSummary = useMemo(
    () =>
      buildReadingReviewSummary(filteredRows, {
        termLabel: quarterFilter !== "All quarters" ? quarterFilter : "",
      }),
    [filteredRows, quarterFilter]
  );

  // Apply a modal batch decision to individual learner records.
  function handleApplyReview({ keys, decision, concern, note }) {
    if (!keys?.length) return;
    setTriageByKey((prev) => {
      const next = { ...prev };
      for (const key of keys) next[key] = decision;
      return next;
    });
    if (decision === "confirmed") {
      setTriageDetail((prev) => {
        const next = { ...prev };
        for (const key of keys) next[key] = { concern, note };
        return next;
      });
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const key of keys) next.add(key);
      return next;
    });
    setReviewModalOpen(false);
    if (decision === "needs_review") {
      const row = rowsByKey.get(keys[0]);
      if (row) onViewLearner?.(row);
    }
  }

  function applyTriage(status) {
    if (selectedIds.size === 0) return;
    setTriageByKey((prev) => {
      const next = { ...prev };
      for (const key of selectedIds) next[key] = status;
      return next;
    });
    if (status === "needs_review") {
      const firstKey = [...selectedIds][0];
      const row = rowsByKey.get(firstKey);
      if (row) onViewLearner?.(row);
    }
  }

  const selectedCount = selectedIds.size;
  const confirmedKeys = useMemo(
    () =>
      [...selectedIds].filter(
        (key) => triageByKey[key] === "confirmed" && !isAlreadyReferred(rowsByKey.get(key) || {})
      ),
    [selectedIds, triageByKey, rowsByKey]
  );
  const recommendedCount = reviewSummary.total;

  async function handleSubmitReferrals() {
    if (confirmedKeys.length === 0 || batchWorking) return;
    setBatchWorking(true);
    let created = 0;
    let skipped = 0;
    const failures = [];
    try {
      for (const key of confirmedKeys) {
        const row = rowsByKey.get(key);
        // Refer the concern subject's class (aggregated rows span subjects).
        const targetClassId = row?.readingReview?.concernClassId || row?.classId;
        const concernSubject = row?.readingReview?.concernSubject || row?.subject;
        if (!row?.studentId || !targetClassId) {
          skipped += 1;
          continue;
        }
        if (isAlreadyReferred(row)) {
          skipped += 1;
          continue;
        }
        try {
          const detail = triageDetail[key] || {};
          const referralNote = [
            `Teacher-confirmed reading concern (${concernSubject}) from Academic Monitoring batch triage.`,
            detail.concern ? `Main concern: ${detail.concern}.` : "",
            detail.note ? `Teacher note: ${detail.note}` : "",
          ]
            .filter(Boolean)
            .join(" ");
          // Legacy triage trail (monitoring record + candidate status).
          await referLearnerToAral({
            studentId: row.studentId,
            classId: targetClassId,
            notes: referralNote,
          });
          // Principal queue record (one row per learner, duplicate-guarded).
          const submitResult = await submitAralRecommendationForReview({
            studentId: row.studentId,
            classId: targetClassId,
            schoolYear: row.schoolYear || "SY 2026-2027",
            quarter: row.quarterNumber ?? row.quarter ?? currentQuarterNumber,
          });
          if (submitResult?.error) {
            failures.push(row.name || row.studentNumber || "Learner");
          } else {
            created += 1;
          }
        } catch {
          failures.push(row.name || row.studentNumber || "Learner");
        }
      }
      if (created > 0) {
        showToast("success", `Submitted ${created} ARAL referral${created === 1 ? "" : "s"} for Principal review.`);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const key of confirmedKeys) next.delete(key);
          return next;
        });
        onRefresh?.();
      }
      if (skipped > 0 && created === 0 && failures.length === 0) {
        showToast("success", "Selected learners were already referred. No duplicates created.");
      } else if (skipped > 0) {
        showToast("success", `${skipped} already-referred learner${skipped === 1 ? "" : "s"} skipped.`);
      }
      if (failures.length > 0) {
        showToast("error", `Could not submit referral for: ${failures.join(", ")}.`);
      }
    } finally {
      setBatchWorking(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE) || 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pagedRows = useMemo(() => {
    return filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  }, [filteredRows, safePage]);

  return (
    <div className="space-y-4">
      {/* 4 PRIMARY CARDS: FOR REVIEW, HIGH PRIORITY, UNDER SUPPORT, IMPROVING */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
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

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              High Priority
            </p>
            <p className="mt-1 text-[26px] font-bold leading-none tracking-tight text-red-700">
              {highPriorityCount}
            </p>
            <p className="mt-1.5 text-[11px] leading-4 text-slate-400">Immediate attention needed</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Under Support
            </p>
            <p className="mt-1 text-[26px] font-bold leading-none tracking-tight text-blue-700">
              {underSupportCount}
            </p>
            <p className="mt-1.5 text-[11px] leading-4 text-slate-400">Active remediation / intervention</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Improving
            </p>
            <p className="mt-1 text-[26px] font-bold leading-none tracking-tight text-emerald-700">
              {improvingCount}
            </p>
            <p className="mt-1.5 text-[11px] leading-4 text-slate-400">Positive performance trend</p>
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

              {availableQuarters.length > 0 ? (
                <AppSelect
                  label="All quarters"
                  value={quarterFilter}
                  onChange={onQuarterFilterChange}
                  options={["All quarters", ...availableQuarters]}
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
                  "Learners for Reading Review",
                  "None",
                ]}
                size="pill"
                triggerClassName="h-8.5 text-[11px] font-semibold"
              />
            </div>
          </div>
        </div>

        {/* Table Sub-bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-white px-4 py-2 text-[11px] text-slate-500">
          <span>
            Showing <strong className="text-slate-700">{filteredRows.length}</strong> enrolled learner{filteredRows.length === 1 ? "" : "s"}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden text-[10.5px] text-slate-400 xl:inline">
              Click row or Review to open continuous Learner Profile
            </span>
            <button
              type="button"
              onClick={() => setReviewModalOpen(true)}
              disabled={recommendedCount === 0}
              title="Open teacher review for system-recommended learners"
              className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ClipboardList size={12} strokeWidth={1.9} />
              Review Recommended ({recommendedCount})
            </button>
          </div>
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
                  const key = rowKey(row);
                  const selected = selectedIds.has(key);
                  const triage = triageByKey[key] || null;
                  const triageMeta = triage ? TRIAGE_META[triage] : null;
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
                      aria-selected={selected}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-slate-50/80",
                        selected && "bg-cnhs-green-soft/50 hover:bg-cnhs-green-soft/60"
                      )}
                    >
                      {/* Learner */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelect(key);
                            }}
                            aria-pressed={selected}
                            title={selected ? "Deselect learner" : "Select learner for reading-concern triage"}
                            className={cn(
                              "group flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-all",
                              selected
                                ? "bg-cnhs-green-dark text-white shadow-xs"
                                : "bg-slate-100 text-[11px] font-bold text-slate-600 hover:bg-slate-200"
                            )}
                          >
                            {selected ? (
                              <Check size={15} strokeWidth={2.5} />
                            ) : (
                              <>
                                <span className="block group-hover:hidden">
                                  {learnerInitials(row)}
                                </span>
                                <span className="hidden h-[18px] w-[18px] rounded-[5px] border-2 border-slate-300 bg-white transition-colors group-hover:block group-hover:border-cnhs-green-dark/60" />
                              </>
                            )}
                          </button>
                          <div className="min-w-0">
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
                            {triageMeta ? (
                              <span className={cn("mt-1 inline-flex items-center rounded-full px-2 py-px text-[10px] font-semibold ring-1", triageMeta.className)}>
                                {triageMeta.label}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* Subject (merged across the learner's standings) */}
                      <td className="py-2.5 px-3">
                        <span className="block text-[12px] font-medium text-slate-700">
                          {row.subject || "—"}
                        </span>
                        {(row.subjects?.length ?? 0) > 1 && row.primarySubject ? (
                          <span className="mt-0.5 block text-[10px] font-semibold text-amber-700">
                            Focus: {row.primarySubject}
                          </span>
                        ) : null}
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

        {/* Sticky batch triage bar */}
        {selectedCount > 0 ? (
          <div className="sticky bottom-3 z-10 mx-3 mb-1 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/95 px-4 py-2.5 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.25)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[12px] text-slate-600">
              <strong className="font-bold text-slate-900">{selectedCount}</strong> learner{selectedCount === 1 ? "" : "s"} selected
              {confirmedKeys.length > 0 ? (
                <span className="ml-1.5 text-[11px] text-amber-700">
                  · {confirmedKeys.length} confirmed reading concern{confirmedKeys.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyTriage("confirmed")}
                className="inline-flex h-8 cursor-pointer items-center rounded-lg bg-amber-500 px-3 text-[11px] font-semibold text-white shadow-xs transition hover:bg-amber-600"
              >
                Confirm Reading Concern
              </button>
              <button
                type="button"
                onClick={() => applyTriage("not_reading")}
                className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Not Reading-Related
              </button>
              <button
                type="button"
                onClick={() => applyTriage("needs_review")}
                className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-[11px] font-semibold text-blue-800 transition hover:bg-blue-100"
              >
                Needs Detailed Review
              </button>
              {confirmedKeys.length > 0 ? (
                <button
                  type="button"
                  onClick={handleSubmitReferrals}
                  disabled={batchWorking}
                  className="inline-flex h-8 cursor-pointer items-center rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white shadow-xs transition hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {batchWorking ? "Submitting…" : `Submit ARAL Referrals (${confirmedKeys.length})`}
                </button>
              ) : null}
              <button
                type="button"
                onClick={clearSelection}
                className="inline-flex h-8 cursor-pointer items-center rounded-lg px-2.5 text-[11px] font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                Clear Selection
              </button>
            </div>
          </div>
        ) : null}

        {/* Pagination */}
        <MonitoringTablePagination
          page={safePage}
          pageSize={PAGE_SIZE}
          total={filteredRows.length}
          onPageChange={setPage}
        />
      </div>

      {/* Centered teacher-review modal for system-recommended learners */}
      <ReviewRecommendedModal
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        recommended={reviewSummary.recommended}
        termLabel={reviewSummary.termLabel}
        onApply={handleApplyReview}
      />
    </div>
  );
}
