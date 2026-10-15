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
import { RiskPill } from "@/components/teacher/monitoring/shared";
import ReviewRecommendedModal from "@/components/teacher/monitoring/ReviewRecommendedModal";
import BulkActionConfirmModal from "@/components/teacher/monitoring/BulkActionConfirmModal";
import { saveOrUpdateCanonicalMonitoringRecord } from "@/lib/supabase/queries/monitoring";
import { learnerIdentityKey } from "@/lib/monitoring/academicLearnerAggregation";
import {
  buildReadingReviewSummary,
  isReadingReviewCandidate,
} from "@/lib/monitoring/readingReviewSummary";
import { useAppToast } from "@/components/shared/AppToast";
import { submitAralReferralCanonical } from "@/lib/monitoring/aralAcademicStatus";
import {
  calculateMonitoringSummaryCards,
  deriveLearnerMonitoringState,
  deriveCurrentSupport,
  deriveAcademicProgress,
  deriveAcademicRisk,
  isHighPriority,
} from "@/lib/monitoring/academicMonitoringState";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function ProgressIndicator({ progress }) {
  if (progress === "Improving") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
        <TrendingUp size={12} className="text-emerald-600" />
        <span>Improving</span>
      </span>
    );
  }
  if (progress === "Declining") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800">
        <TrendingDown size={12} className="text-amber-700" />
        <span>Declining</span>
      </span>
    );
  }
  if (progress === "No clear change") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
        <Minus size={12} className="text-slate-400" />
        <span>No clear change</span>
      </span>
    );
  }
  return <span className="text-[11px] text-slate-400">—</span>;
}

function CurrentSupportBadge({ row }) {
  const support = deriveCurrentSupport(row);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold",
        support.badgeStyle
      )}
    >
      {support.label}
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
  onUpdateSupport = null,
}) {
  const { showToast } = useAppToast();
  const [search, setSearch] = useState("");
  const [section, setSection] = useState("All sections");
  const [subject, setSubject] = useState("All subjects");
  const [supportFilter, setSupportFilter] = useState("All support");
  const [page, setPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState(null);
  const [bulkWorking, setBulkWorking] = useState(false);

  // Batch reading-concern triage (UI state only — selection never creates
  // ARAL records; referrals are submitted explicitly per learner).
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [triageByKey, setTriageByKey] = useState({});
  const [triageDetail, setTriageDetail] = useState({});
  const [batchWorking, setBatchWorking] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  // 4 Primary Summary Cards (Academic Focus)
  const summaryCards = useMemo(() => {
    return calculateMonitoringSummaryCards(students);
  }, [students]);

  const [activeSummaryCard, setActiveSummaryCard] = useState(null);

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

    // Active summary card filter
    if (activeSummaryCard === "for_review") {
      list = list.filter((s) => deriveCurrentSupport(s).key === "needs_review");
    } else if (activeSummaryCard === "high_priority") {
      list = list.filter((s) => isHighPriority(s));
    } else if (activeSummaryCard === "under_support") {
      list = list.filter((s) => deriveCurrentSupport(s).isUnderSupport);
    } else if (activeSummaryCard === "improving") {
      list = list.filter(
        (s) =>
          deriveAcademicProgress(
            s.classSubjectGrade ?? s.currentGrade,
            s.previousGrade
          ).progress === "Improving"
      );
    }

    if (supportFilter === "Learners for Reading Review") {
      list = list.filter((s) => isReadingReviewCandidate(s));
    } else if (supportFilter !== "All support") {
      list = list.filter((s) => deriveCurrentSupport(s).label === supportFilter);
    }

    return list;
  }, [students, search, section, subject, activeSummaryCard, supportFilter]);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
    setTriageByKey({});
    setTriageDetail({});
  }, [search, section, quarterFilter, subject, supportFilter, activeSummaryCard]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE) || 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pagedRows = useMemo(() => {
    return filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  }, [filteredRows, safePage]);

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
    setTriageByKey({});
    setTriageDetail({});
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
          const submitResult = await submitAralReferralCanonical({
            studentId: row.studentId,
            classId: targetClassId,
            schoolYear: row.schoolYear || "SY 2026-2027",
            quarter: row.quarterNumber ?? row.quarter ?? currentQuarterNumber,
            notes: detail.note || "",
            reviewConcern: detail.concern || "",
          });
          if (!submitResult?.success) {
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

  const selectedLearners = useMemo(() => {
    return [...selectedIds].map((id) => rowsByKey.get(id)).filter(Boolean);
  }, [selectedIds, rowsByKey]);

  const allVisibleSelected = useMemo(() => {
    if (!pagedRows?.length) return false;
    return pagedRows.every((r) => selectedIds.has(rowKey(r)));
  }, [pagedRows, selectedIds]);

  function handleToggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const r of pagedRows) next.delete(rowKey(r));
      } else {
        for (const r of pagedRows) next.add(rowKey(r));
      }
      return next;
    });
  }

  const bulkEligibility = useMemo(() => {
    const count = selectedLearners.length;
    if (!count) {
      return {
        canMonitoring: false,
        canRemedial: false,
        monitoringReason: null,
        remedialReason: null,
        warning: null,
      };
    }

    let underSupportCount = 0;
    let alreadyMonitoringCount = 0;
    let needsReviewCount = 0;

    for (const l of selectedLearners) {
      const support = deriveCurrentSupport(l);
      if (
        support.isUnderSupport ||
        support.key === "under_class_support" ||
        support.key === "under_aral_support"
      ) {
        underSupportCount++;
      } else if (support.key === "monitoring") {
        alreadyMonitoringCount++;
      } else {
        needsReviewCount++;
      }
    }

    // Continue Monitoring: enabled ONLY when every selected learner can legitimately transition to Monitoring.
    // Needs Review -> allowed
    // Already Monitoring -> no new action needed
    // Under Class Support -> not allowed
    const canMonitoring = count > 0 && underSupportCount === 0 && needsReviewCount === count;

    let monitoringReason = null;
    if (!canMonitoring) {
      if (underSupportCount > 0) {
        monitoringReason = `${underSupportCount} learner${underSupportCount === 1 ? " is" : "s are"} already under active support.`;
      } else if (alreadyMonitoringCount === count) {
        monitoringReason = "Selected learners are already under monitoring.";
      } else if (alreadyMonitoringCount > 0) {
        monitoringReason = `${alreadyMonitoringCount} learner${alreadyMonitoringCount === 1 ? " is" : "s are"} already under monitoring.`;
      } else {
        monitoringReason = "Continue Monitoring is only valid for learners needing review.";
      }
    }

    // Start Class Remedial: allowed for valid Needs Review / Monitoring learners if the existing lifecycle permits it.
    // Under Class Support -> never allow starting remedial again.
    const canRemedial = count > 0 && underSupportCount === 0;

    let remedialReason = null;
    if (!canRemedial) {
      if (underSupportCount > 0) {
        remedialReason = `${underSupportCount} learner${underSupportCount === 1 ? " is" : "s are"} already under class support.`;
      } else {
        remedialReason = "Cannot start remedial for selected learners.";
      }
    }

    const warning = remedialReason || monitoringReason || null;

    return {
      canMonitoring,
      canRemedial,
      monitoringReason,
      remedialReason,
      warning,
    };
  }, [selectedLearners]);

  async function handleExecuteBulkAction() {
    if (!confirmAction || bulkWorking || !selectedLearners.length) return;

    setBulkWorking(true);
    const action = confirmAction;
    const isRemedial = action === "remedial";

    const interventionGiven = isRemedial ? "Class Remedial" : "Monitoring";
    const defaultRemarks = isRemedial
      ? "Started classroom remedial support."
      : "Teacher confirmed continued classroom monitoring.";
    const targetRemedialStatus = isRemedial ? "Active" : "Monitoring";
    const targetSupportLabel = isRemedial ? "Under Class Support" : "Monitoring";

    const results = await Promise.allSettled(
      selectedLearners.map(async (row) => {
        const canonicalKey = rowKey(row);
        const studentId = row.studentId || row.student_id;
        const classId = row.classId || row.primaryClassId;
        const teacherId = row.teacherId || row.primaryTeacherId;
        const schoolYear = row.schoolYear || "SY 2026-2027";
        const quarter = row.quarterNumber ?? row.quarter ?? currentQuarterNumber;

        const res = await saveOrUpdateCanonicalMonitoringRecord({
          student_id: studentId,
          class_id: classId,
          teacher_id: teacherId,
          school_year: schoolYear,
          quarter: quarter,
          observation_date: new Date().toISOString().split("T")[0],
          intervention_given: interventionGiven,
          teacher_remarks: defaultRemarks,
          student_progress: "Ongoing",
          monitoring_status: "Ongoing",
          follow_up_needed: false,
        });

        if (res?.error) {
          throw res.error;
        }

        return {
          row,
          canonicalKey,
          persistedData: res?.data || null,
        };
      })
    );

    const succeeded = [];
    const failedKeys = new Set();

    results.forEach((r, idx) => {
      const learner = selectedLearners[idx];
      const key = rowKey(learner);
      if (r.status === "fulfilled") {
        const persisted = r.value.persistedData;
        succeeded.push({
          studentId: learner.studentId || learner.student_id,
          classId: learner.classId || learner.primaryClassId,
          subject: learner.primarySubject || learner.subject,
          schoolYear: learner.schoolYear,
          quarter: learner.quarterNumber ?? learner.quarter,
          remedialStatus:
            persisted?.intervention_given === "Class Remedial"
              ? "Active"
              : persisted?.intervention_given === "Monitoring"
              ? "Monitoring"
              : targetRemedialStatus,
          monitoringStatus: persisted?.monitoring_status || "Ongoing",
          currentSupport:
            persisted?.intervention_given === "Class Remedial"
              ? "Under Class Support"
              : targetSupportLabel,
          interventionGiven: persisted?.intervention_given || interventionGiven,
          intervention_given: persisted?.intervention_given || interventionGiven,
          remarks: persisted?.teacher_remarks || defaultRemarks,
          observationDate:
            persisted?.observation_date ||
            new Date().toISOString().split("T")[0],
        });
      } else {
        failedKeys.add(key);
      }
    });

    const successCount = succeeded.length;
    const failCount = failedKeys.size;

    // Apply UI state patches using persisted results and recalculate summary cards
    if (successCount > 0 && onUpdateSupport) {
      onUpdateSupport(succeeded);
    }

    // Keep failed learners selected, remove succeeded ones
    setSelectedIds((prev) => {
      const next = new Set();
      for (const k of prev) {
        if (failedKeys.has(k)) {
          next.add(k);
        }
      }
      return next;
    });

    // Close modal
    setConfirmAction(null);
    setBulkWorking(false);

    // Toast notifications strictly adhering to Safeguard 6
    if (failCount === 0 && successCount > 0) {
      // All succeeded
      if (isRemedial) {
        showToast({
          title: "Class remedial started",
          message: `${successCount} learner${successCount === 1 ? " is" : "s are"} now under class support.`,
          tone: "success",
        });
      } else {
        showToast({
          title: "Monitoring continued",
          message: `${successCount} learner${successCount === 1 ? " will" : "s will"} remain under teacher monitoring.`,
          tone: "success",
        });
      }
    } else if (successCount > 0 && failCount > 0) {
      // Partial success
      showToast({
        title: `${successCount} learner${successCount === 1 ? "" : "s"} updated`,
        message: `${failCount} learner${failCount === 1 ? "" : "s"} could not be updated. Please try again.`,
        tone: "warning",
      });
    } else {
      // All failed
      showToast({
        title: "Could not update learner support",
        message: "Please try again.",
        tone: "error",
      });
    }

    // Background refresh for verification
    if (successCount > 0 && onRefresh) {
      onRefresh();
    }
  }

  return (
    <div className="space-y-4">
      {/* 4 PRIMARY CARDS: FOR REVIEW, HIGH PRIORITY, UNDER SUPPORT, IMPROVING */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <button
          type="button"
          onClick={() =>
            setActiveSummaryCard((prev) => (prev === "for_review" ? null : "for_review"))
          }
          className={cn(
            "rounded-xl border bg-white p-4 shadow-xs text-left transition sm:p-5 cursor-pointer hover:border-slate-300",
            activeSummaryCard === "for_review"
              ? "border-amber-400 ring-2 ring-amber-400/30 bg-amber-50/20"
              : "border-slate-200"
          )}
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              For Review
            </p>
            <p className="mt-1 text-[26px] font-bold leading-none tracking-tight text-slate-900">
              {summaryCards.forReviewCount}
            </p>
            <p className="mt-1.5 text-[11px] leading-4 text-slate-400">Requires teacher review</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveSummaryCard((prev) => (prev === "high_priority" ? null : "high_priority"))
          }
          className={cn(
            "rounded-xl border bg-white p-4 shadow-xs text-left transition sm:p-5 cursor-pointer hover:border-slate-300",
            activeSummaryCard === "high_priority"
              ? "border-red-400 ring-2 ring-red-400/30 bg-red-50/20"
              : "border-slate-200"
          )}
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              High Priority
            </p>
            <p className="mt-1 text-[26px] font-bold leading-none tracking-tight text-red-700">
              {summaryCards.highPriorityCount}
            </p>
            <p className="mt-1.5 text-[11px] leading-4 text-slate-400">Immediate attention needed</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveSummaryCard((prev) => (prev === "under_support" ? null : "under_support"))
          }
          className={cn(
            "rounded-xl border bg-white p-4 shadow-xs text-left transition sm:p-5 cursor-pointer hover:border-slate-300",
            activeSummaryCard === "under_support"
              ? "border-blue-400 ring-2 ring-blue-400/30 bg-blue-50/20"
              : "border-slate-200"
          )}
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Under Support
            </p>
            <p className="mt-1 text-[26px] font-bold leading-none tracking-tight text-blue-700">
              {summaryCards.underSupportCount}
            </p>
            <p className="mt-1.5 text-[11px] leading-4 text-slate-400">Active remediation / intervention</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveSummaryCard((prev) => (prev === "improving" ? null : "improving"))
          }
          className={cn(
            "rounded-xl border bg-white p-4 shadow-xs text-left transition sm:p-5 cursor-pointer hover:border-slate-300",
            activeSummaryCard === "improving"
              ? "border-emerald-400 ring-2 ring-emerald-400/30 bg-emerald-50/20"
              : "border-slate-200"
          )}
        >
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Improving
            </p>
            <p className="mt-1 text-[26px] font-bold leading-none tracking-tight text-emerald-700">
              {summaryCards.improvingCount}
            </p>
            <p className="mt-1.5 text-[11px] leading-4 text-slate-400">Positive performance trend</p>
          </div>
        </button>
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
                  "Needs Review",
                  "Monitoring",
                  "Under Class Support",
                  "Under ARAL Support",
                  "Learners for Reading Review",
                ]}
                size="pill"
                triggerClassName="h-8.5 text-[11px] font-semibold"
              />
            </div>
          </div>
        </div>

        {/* Compact Bulk Action Bar - Appears ONLY when selectedCount > 0 */}
        {selectedCount > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-emerald-100 bg-emerald-50/40 px-4 py-2 transition-all duration-150">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-slate-800">
                <strong className="font-bold text-slate-900">{selectedCount}</strong> learner{selectedCount === 1 ? "" : "s"} selected
              </span>
              {bulkEligibility.warning ? (
                <span className="hidden text-[11px] font-medium text-amber-700 sm:inline">
                  • {bulkEligibility.warning}
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction("monitoring")}
                disabled={!bulkEligibility.canMonitoring}
                title={bulkEligibility.monitoringReason || "Continue Monitoring for selected learners"}
                className="inline-flex h-7.5 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 shadow-2xs transition-colors duration-150 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue Monitoring
              </button>

              <button
                type="button"
                onClick={() => setConfirmAction("remedial")}
                disabled={!bulkEligibility.canRemedial}
                title={bulkEligibility.remedialReason || "Start Class Remedial for selected learners"}
                className="inline-flex h-7.5 cursor-pointer items-center rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white shadow-2xs transition-colors duration-150 hover:bg-[#1b5842] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start Class Remedial
              </button>

              <button
                type="button"
                onClick={clearSelection}
                className="inline-flex h-7.5 cursor-pointer items-center rounded-lg border border-transparent px-2.5 text-[11px] font-semibold text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={handleToggleSelectAllVisible}
                className="inline-flex h-7.5 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 shadow-2xs transition-colors duration-150 hover:bg-slate-50"
              >
                {allVisibleSelected ? "Deselect all visible" : "Select all visible"}
              </button>

              {confirmedKeys.length > 0 ? (
                <button
                  type="button"
                  onClick={handleSubmitReferrals}
                  disabled={batchWorking}
                  className="inline-flex h-7.5 cursor-pointer items-center rounded-lg bg-amber-500 px-3 text-[11px] font-semibold text-white shadow-2xs transition-colors duration-150 hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {batchWorking ? "Submitting…" : `Submit ARAL (${confirmedKeys.length})`}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

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
                <th className="py-2.5 px-3">Progress</th>
                <th className="py-2.5 px-3 text-center">Risk</th>
                <th className="py-2.5 px-3 text-center">Current Support</th>
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
                      key={key}
                      onClick={() => onViewLearner?.(row)}
                      aria-selected={selected}
                      className={cn(
                        "cursor-pointer transition-colors duration-150 hover:bg-slate-50/80",
                        selected && "bg-emerald-50/35 hover:bg-emerald-50/50"
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
                            title={selected ? "Deselect learner" : "Select learner for bulk actions"}
                            className={cn(
                              "group flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-150",
                              selected
                                ? "bg-cnhs-green text-white shadow-2xs"
                                : "bg-slate-100 text-[11px] font-bold text-slate-600 hover:bg-slate-200"
                            )}
                          >
                            {selected ? (
                              <Check size={14} strokeWidth={2.5} />
                            ) : (
                              <>
                                <span className="block group-hover:hidden">
                                  {learnerInitials(row)}
                                </span>
                                <span className="hidden h-[18px] w-[18px] rounded-[5px] border-2 border-slate-300 bg-white transition-colors duration-150 group-hover:block group-hover:border-cnhs-green/70" />
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

                      {/* Academic Progress */}
                      <td className="py-2.5 px-3">
                        <ProgressIndicator
                          progress={deriveAcademicProgress(curGrade, prevGrade).progress}
                        />
                      </td>

                      {/* Academic Risk */}
                      <td className="py-2.5 px-3 text-center">
                        <RiskPill value={deriveAcademicRisk(row, curGrade)} />
                      </td>

                      {/* Current Support */}
                      <td className="py-2.5 px-3 text-center">
                        <CurrentSupportBadge row={row} />
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
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
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

      {/* Centered teacher-review modal for system-recommended learners */}
      <ReviewRecommendedModal
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        recommended={reviewSummary.recommended}
        termLabel={reviewSummary.termLabel}
        onApply={handleApplyReview}
      />

      {/* Bulk action confirmation modal */}
      <BulkActionConfirmModal
        isOpen={Boolean(confirmAction)}
        action={confirmAction}
        count={selectedCount}
        working={bulkWorking}
        onConfirm={handleExecuteBulkAction}
        onCancel={() => {
          if (!bulkWorking) setConfirmAction(null);
        }}
      />
    </div>
  );
}
