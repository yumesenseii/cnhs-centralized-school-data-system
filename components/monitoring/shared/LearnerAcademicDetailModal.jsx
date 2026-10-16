"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  X,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import AppSelect from "@/components/shared/AppSelect";
import { RiskPill } from "@/components/teacher/monitoring/shared";
import { useAppToast } from "@/components/shared/AppToast";
import { READING_CONCERN_OPTIONS } from "@/lib/monitoring/readingReviewSummary";
import { createMonitoringRecord } from "@/lib/supabase/queries/monitoring";
import {
  ARAL_WORDING,
  getHistoricalTermLabel,
  getLearnerAralReferralState,
  getLearnerDisplaySupport,
  getPlainLanguageAttentionReason,
  isAralLanguageSubject,
  submitAralReferralCanonical,
} from "@/lib/monitoring/aralAcademicStatus";
import { parseRecordedGrade } from "@/lib/ecr/computeGrades";
import {
  deriveAcademicRisk,
  deriveAcademicProgress,
  deriveCurrentSupport,
} from "@/lib/monitoring/academicMonitoringState";

export default function LearnerAcademicDetailModal({
  learner,
  detail = null,
  teacherId = null,
  isOpen = false,
  onClose,
  onRefresh,
  loading = false,
  role = "teacher", // "teacher" | "principal"
  currentQuarterNumber = 1,
  schoolYear = "SY 2026-2027",
  onNavigateToAral = null,
  onUpdateSupport = null,
}) {
  const { showToast } = useAppToast();

  // Combine row summary and detail record
  const activeLearner = detail || learner;

  const referralState = useMemo(() => {
    return getLearnerAralReferralState(activeLearner || {});
  }, [activeLearner]);

  // Teacher Review state
  const [reviewDecision, setReviewDecision] = useState(() => {
    const ref = getLearnerAralReferralState(activeLearner || {});
    return ref.hasActiveReferral || ref.isReturned ? "confirmed" : null;
  });
  const [reviewConcern, setReviewConcern] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [recommendingAral, setRecommendingAral] = useState(false);

  // Class Remedial state
  const [remedialStatus, setRemedialStatus] = useState(() => {
    return (
      activeLearner?.remedialStatus ||
      activeLearner?.interventionStatus ||
      (activeLearner?.intervention_given === "Class Remedial" || activeLearner?.interventionGiven === "Class Remedial"
        ? (activeLearner?.monitoringStatus === "Completed" ? "Completed" : "Active")
        : (activeLearner?.monitoringStatus === "Completed" ? "Completed" : activeLearner?.monitoringStatus)) ||
      "Recommended"
    );
  });
  const [updatingRemedial, setUpdatingRemedial] = useState(false);

  // Sync remedialStatus whenever activeLearner updates from parent refetch
  useEffect(() => {
    if (!activeLearner) return;
    const resolvedStatus =
      activeLearner.remedialStatus ||
      activeLearner.interventionStatus ||
      (activeLearner.intervention_given === "Class Remedial" || activeLearner.interventionGiven === "Class Remedial"
        ? (activeLearner.monitoringStatus === "Completed" ? "Completed" : "Active")
        : (activeLearner.monitoringStatus === "Completed" ? "Completed" : activeLearner.monitoringStatus)) ||
      "Recommended";
    setRemedialStatus(resolvedStatus);
  }, [activeLearner]);

  // Close on Escape key & lock body scroll
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose?.();
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !activeLearner) return null;

  const studentFullName =
    activeLearner.name ||
    `${activeLearner.lastName || ""}, ${activeLearner.firstName || ""}`.trim() ||
    "Learner Record";

  const studentLrn = activeLearner.studentNumber || activeLearner.lrn || "—";
  const studentSection =
    activeLearner.gradeSection ||
    activeLearner.section ||
    (activeLearner.grade ? `${activeLearner.grade}` : "—");
  const studentAdviser = activeLearner.adviser || activeLearner.adviserName || "—";
  const studentSubject =
    activeLearner.readingReview?.concernSubject ||
    activeLearner.primarySubject ||
    activeLearner.classSubject ||
    activeLearner.subject ||
    (Array.isArray(activeLearner.subjects) ? activeLearner.subjects[0] : null) ||
    "—";

  const curGrade = parseRecordedGrade(
    activeLearner.classSubjectGrade ?? activeLearner.currentGrade ?? activeLearner.generalAverage
  );
  const prevGrade = parseRecordedGrade(activeLearner.previousGrade);
  const perfTrend = activeLearner.performanceTrend || "Stable";

  const historicalLabel = getHistoricalTermLabel(activeLearner, currentQuarterNumber);
  const plainAttentionReason = getPlainLanguageAttentionReason(activeLearner);
  const displaySupport = getLearnerDisplaySupport(activeLearner);

  const monitoredLearner = useMemo(() => {
    const isRemedialActive =
      remedialStatus === "Active" || remedialStatus === "Progressing";
    const isMonitoring = remedialStatus === "Monitoring";

    return {
      ...activeLearner,
      remedialStatus,
      currentSupport: isRemedialActive
        ? "Under Class Support"
        : isMonitoring
        ? "Monitoring"
        : activeLearner?.currentSupport,
      monitoringStatus:
        isRemedialActive || isMonitoring
          ? "Ongoing"
          : activeLearner?.monitoringStatus,
      reviewedAt:
        isRemedialActive || isMonitoring
          ? activeLearner?.reviewedAt || new Date().toISOString()
          : activeLearner?.reviewedAt,
      latestObservationDate:
        isRemedialActive || isMonitoring
          ? new Date().toISOString().split("T")[0]
          : activeLearner?.latestObservationDate,
    };
  }, [activeLearner, remedialStatus]);

  const academicRisk = deriveAcademicRisk(monitoredLearner, curGrade);
  const progressInfo = deriveAcademicProgress(curGrade, prevGrade);
  const currentSupport = deriveCurrentSupport(monitoredLearner);

  const subjectGradesList = Array.isArray(activeLearner.subjectGrades)
    ? activeLearner.subjectGrades
    : [];

  const activityRecords = Array.isArray(activeLearner.records)
    ? activeLearner.records
    : Array.isArray(activeLearner.monitoringRecords)
    ? activeLearner.monitoringRecords
    : [];

  const isTeacher = role === "teacher";
  const isPrincipal = role === "principal";

  const attentionReason = useMemo(() => {
    if (curGrade !== null && curGrade < 75) {
      if (referralState.isLanguageSubject) {
        return `The learner currently has a grade of ${curGrade} in ${studentSubject}, which is below the passing grade of 75. Teacher review is recommended to determine if reading support is needed.`;
      }
      return `The learner currently has a grade of ${curGrade} in ${studentSubject}, which is below the passing grade of 75. Classroom remedial support is recommended.`;
    }
    return plainAttentionReason;
  }, [curGrade, studentSubject, referralState.isLanguageSubject, plainAttentionReason]);

  const progressExplanation = useMemo(() => {
    if (!progressInfo.hasPreviousGrade) {
      return {
        previousDisplay: "—",
        currentDisplay: curGrade !== null ? curGrade : "—",
        progressDisplay: "Not enough data yet",
        progressStyle: "text-slate-500",
        sentence: "No previous grade record is available for comparison yet.",
      };
    }

    const diff = progressInfo.diff ?? 0;
    const absDiff = Math.abs(diff);
    const unit = absDiff === 1 ? "point" : "points";

    if (diff < 0) {
      return {
        previousDisplay: prevGrade,
        currentDisplay: curGrade,
        progressDisplay: "Declining",
        progressStyle: "text-amber-800 dark:text-amber-400 font-semibold",
        sentence: `Grade decreased by ${absDiff} ${unit} from the previous comparable term.`,
      };
    }

    if (diff > 0) {
      return {
        previousDisplay: prevGrade,
        currentDisplay: curGrade,
        progressDisplay: "Improving",
        progressStyle: "text-emerald-700 dark:text-emerald-400 font-semibold",
        sentence: `Grade increased by ${absDiff} ${unit} from the previous comparable term.`,
      };
    }

    return {
      previousDisplay: prevGrade,
      currentDisplay: curGrade,
      progressDisplay: "No clear change",
      progressStyle: "text-slate-700 dark:text-slate-300 font-semibold",
      sentence: "Grade remained the same as the previous comparable term.",
    };
  }, [progressInfo, curGrade, prevGrade]);

  const isClassRemedialActive =
    currentSupport.key === "under_class_support" ||
    remedialStatus === "Active" ||
    remedialStatus === "Progressing";
  const isClassRemedialCompleted = remedialStatus === "Completed";
  const recommendedSupportText =
    activeLearner.recommendedSupport ||
    (curGrade !== null && curGrade < 75 ? "Classroom Remedial" : "Classroom Monitoring");

  const activeStartedDate = useMemo(() => {
    const startedRecord = activityRecords.find(
      (r) =>
        (r.interventionGiven || r.intervention_given) === "Class Remedial" ||
        (r.monitoringStatus || r.monitoring_status) === "Active"
    );
    const dateVal =
      startedRecord?.observationDate ||
      startedRecord?.observation_date ||
      activeLearner.latestObservationDate;
    return dateVal && dateVal !== "—" ? dateVal : null;
  }, [activityRecords, activeLearner]);

  // Actions
  async function handleRecommendAral() {
    if (recommendingAral) return;
    const studentId = activeLearner.studentId || activeLearner.id;
    const classId =
      activeLearner.readingReview?.concernClassId ||
      activeLearner.classId ||
      activeLearner.primaryClassId;

    if (!studentId || !classId) {
      showToast("error", "Missing student or class reference.");
      return;
    }

    setRecommendingAral(true);
    try {
      const res = await submitAralReferralCanonical({
        studentId,
        classId,
        schoolYear: activeLearner.schoolYear || schoolYear,
        quarter: activeLearner.quarterNumber ?? currentQuarterNumber,
        notes: reviewNote,
        reviewConcern,
      });

      if (!res.success) {
        showToast("error", res.error?.message || "Failed to submit ARAL referral.");
        return;
      }

      showToast("success", "ARAL referral submitted: Pending Principal Review.");
      setReviewNote("");
      onRefresh?.();
      onClose?.();
    } catch (err) {
      console.error(err);
      showToast("error", "Failed to submit ARAL referral.");
    } finally {
      setRecommendingAral(false);
    }
  }

  const targetStudentId = useMemo(() => {
    if (activeLearner?.studentId) return activeLearner.studentId;
    if (activeLearner?.student_id) return activeLearner.student_id;
    if (typeof activeLearner?.id === "string" && !activeLearner.id.startsWith("agg:")) {
      return activeLearner.id.includes(":") ? activeLearner.id.split(":")[1] : activeLearner.id;
    }
    return null;
  }, [activeLearner]);

  const targetClassId = useMemo(() => {
    return (
      activeLearner?.readingReview?.concernClassId ||
      activeLearner?.primaryClassId ||
      activeLearner?.classId ||
      activeLearner?.class_id ||
      (Array.isArray(activeLearner?.subjectStandings)
        ? activeLearner.subjectStandings.find((s) => s.classId)?.classId
        : null) ||
      null
    );
  }, [activeLearner]);

  const targetTeacherId = useMemo(() => {
    return (
      teacherId ||
      activeLearner?.teacherId ||
      activeLearner?.teacher_id ||
      activeLearner?.primaryTeacherId ||
      null
    );
  }, [teacherId, activeLearner]);

  async function handleStartRemedial() {
    if (updatingRemedial) return;
    if (!targetStudentId || !targetClassId) {
      showToast({
        title: "Could not update learner support",
        message: "Please try again.",
        tone: "error",
      });
      return;
    }

    setUpdatingRemedial(true);
    try {
      const res = await createMonitoringRecord({
        student_id: targetStudentId,
        class_id: targetClassId,
        teacher_id: targetTeacherId,
        observation_date: new Date().toISOString().split("T")[0],
        intervention_given: "Class Remedial",
        teacher_remarks: reviewNote.trim()
          ? reviewNote.trim()
          : "Started classroom remedial support.",
        student_progress: "Ongoing",
        follow_up_needed: false,
        monitoring_status: "Ongoing",
        school_year: activeLearner.schoolYear || schoolYear,
        quarter: currentQuarterNumber,
      });

      if (res?.error) {
        showToast({
          title: "Could not update learner support",
          message: "Please try again.",
          tone: "error",
        });
        return;
      }

      setRemedialStatus("Active");
      setReviewNote("");
      onUpdateSupport?.({
        studentId: targetStudentId,
        remedialStatus: "Active",
        monitoringStatus: "Ongoing",
        currentSupport: "Under Class Support",
        remarks: reviewNote.trim() || "Started classroom remedial support.",
      });
      showToast({
        title: "Class remedial started",
        message: "Learner is now under class support.",
        tone: "success",
      });
      await onRefresh?.();
    } catch (err) {
      console.error(err);
      showToast({
        title: "Could not update learner support",
        message: "Please try again.",
        tone: "error",
      });
    } finally {
      setUpdatingRemedial(false);
    }
  }

  async function handleAddProgressNote() {
    if (updatingRemedial) return;
    if (!targetStudentId || !targetClassId) {
      showToast({
        title: "Could not update learner support",
        message: "Please try again.",
        tone: "error",
      });
      return;
    }

    setUpdatingRemedial(true);
    try {
      const res = await createMonitoringRecord({
        student_id: targetStudentId,
        class_id: targetClassId,
        teacher_id: targetTeacherId,
        observation_date: new Date().toISOString().split("T")[0],
        intervention_given: "Class Remedial",
        teacher_remarks: reviewNote.trim()
          ? reviewNote.trim()
          : "Classroom remedial progress note recorded.",
        student_progress: progressInfo.progress || "Ongoing",
        follow_up_needed: false,
        monitoring_status: "Ongoing",
        school_year: activeLearner.schoolYear || schoolYear,
        quarter: currentQuarterNumber,
      });

      if (res?.error) {
        showToast({
          title: "Could not update learner support",
          message: "Please try again.",
          tone: "error",
        });
        return;
      }

      showToast({
        title: "Progress note recorded",
        message: "Learner observation record has been saved.",
        tone: "success",
      });
      setReviewNote("");
      await onRefresh?.();
    } catch (err) {
      console.error(err);
      showToast({
        title: "Could not update learner support",
        message: "Please try again.",
        tone: "error",
      });
    } finally {
      setUpdatingRemedial(false);
    }
  }

  async function handleCompleteRemedial() {
    if (updatingRemedial) return;
    if (!targetStudentId || !targetClassId) {
      showToast({
        title: "Could not update learner support",
        message: "Please try again.",
        tone: "error",
      });
      return;
    }

    setUpdatingRemedial(true);
    try {
      const res = await createMonitoringRecord({
        student_id: targetStudentId,
        class_id: targetClassId,
        teacher_id: targetTeacherId,
        observation_date: new Date().toISOString().split("T")[0],
        intervention_given: "Class Remedial",
        teacher_remarks: reviewNote.trim()
          ? reviewNote.trim()
          : "Classroom remedial support completed.",
        student_progress: "Improving",
        follow_up_needed: false,
        monitoring_status: "Completed",
        school_year: activeLearner.schoolYear || schoolYear,
        quarter: currentQuarterNumber,
      });

      if (res?.error) {
        showToast({
          title: "Could not update learner support",
          message: "Please try again.",
          tone: "error",
        });
        return;
      }

      setRemedialStatus("Completed");
      showToast({
        title: "Remedial completed",
        message: "Learner classroom remedial marked as completed.",
        tone: "success",
      });
      setReviewNote("");
      await onRefresh?.();
    } catch (err) {
      console.error(err);
      showToast({
        title: "Could not update learner support",
        message: "Please try again.",
        tone: "error",
      });
    } finally {
      setUpdatingRemedial(false);
    }
  }

  async function handleContinueMonitoring() {
    if (updatingRemedial) return;
    if (!targetStudentId || !targetClassId) {
      showToast({
        title: "Could not update learner support",
        message: "Please try again.",
        tone: "error",
      });
      return;
    }

    setUpdatingRemedial(true);
    try {
      const res = await createMonitoringRecord({
        student_id: targetStudentId,
        class_id: targetClassId,
        teacher_id: targetTeacherId,
        observation_date: new Date().toISOString().split("T")[0],
        intervention_given: "Classroom Monitoring",
        teacher_remarks: reviewNote.trim()
          ? reviewNote.trim()
          : "Teacher confirmed continued classroom monitoring.",
        student_progress: "Ongoing",
        follow_up_needed: false,
        monitoring_status: "Ongoing",
        school_year: activeLearner.schoolYear || schoolYear,
        quarter: currentQuarterNumber,
      });

      if (res?.error) {
        showToast({
          title: "Could not update learner support",
          message: "Please try again.",
          tone: "error",
        });
        return;
      }

      setRemedialStatus("Monitoring");
      setReviewNote("");
      onUpdateSupport?.({
        studentId: targetStudentId,
        remedialStatus: "Monitoring",
        monitoringStatus: "Ongoing",
        currentSupport: "Monitoring",
        remarks: reviewNote.trim() || "Teacher confirmed continued classroom monitoring.",
      });
      showToast({
        title: "Monitoring continued",
        message: "Learner will remain under teacher monitoring.",
        tone: "success",
      });
      await onRefresh?.();
    } catch (err) {
      console.error(err);
      showToast({
        title: "Could not update learner support",
        message: "Please try again.",
        tone: "error",
      });
    } finally {
      setUpdatingRemedial(false);
    }
  }

  function renderClassRemedialActions() {
    if (isClassRemedialActive) {
      return (
        <div className="space-y-3">
          <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-xs dark:border-blue-900/20 dark:bg-blue-950/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-blue-900/70 dark:text-blue-300">
                  Classroom Remedial
                </span>
                <span className="mt-0.5 block font-bold text-blue-900 dark:text-blue-200">
                  Active Support {activeStartedDate ? `· Started ${activeStartedDate}` : ""}
                </span>
              </div>
              <div>
                <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-blue-900/70 dark:text-blue-300">
                  Academic Progress
                </span>
                <span className={cn("mt-0.5 block font-semibold", progressExplanation.progressStyle)}>
                  {progressExplanation.progressDisplay}
                </span>
              </div>
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              What would you like to do?
            </span>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAddProgressNote}
                disabled={updatingRemedial}
                className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              >
                {updatingRemedial ? <Loader2 size={13} className="animate-spin" /> : null}
                <span>Add Progress Note</span>
              </button>
              <button
                type="button"
                onClick={handleCompleteRemedial}
                disabled={updatingRemedial}
                className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-cnhs-green-dark px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-[#1b5842] disabled:opacity-50"
              >
                {updatingRemedial ? <Loader2 size={13} className="animate-spin" /> : null}
                <span>Mark Support Completed</span>
              </button>
            </div>
          </div>

          <label className="block pt-1">
            <span className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Optional Note
            </span>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={2}
              placeholder="Enter a short note..."
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-cnhs-green dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
          </label>
        </div>
      );
    }

    if (isClassRemedialCompleted) {
      return (
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-white/10 dark:bg-white/[0.02]">
            <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
              Classroom Remedial
            </span>
            <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
              Completed
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Learner is continuing under regular teacher observation.
            </p>
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              What would you like to do?
            </span>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleContinueMonitoring}
                disabled={updatingRemedial}
                className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              >
                {updatingRemedial ? <Loader2 size={13} className="animate-spin" /> : null}
                <span>Continue Monitoring</span>
              </button>
            </div>
          </div>

          <label className="block pt-1">
            <span className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Optional Note
            </span>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={2}
              placeholder="Enter a short note..."
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-cnhs-green dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
          </label>
        </div>
      );
    }

    // Default / Initial State: Not started
    return (
      <div className="space-y-3">
        <div className="rounded-lg bg-slate-50 p-3 text-xs dark:bg-white/[0.02]">
          <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
            Recommended Support
          </span>
          <span className="mt-0.5 block text-sm font-bold text-slate-800 dark:text-slate-200">
            {recommendedSupportText}
          </span>
        </div>

        <div>
          <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            What would you like to do?
          </span>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleContinueMonitoring}
              disabled={updatingRemedial}
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              {updatingRemedial ? <Loader2 size={13} className="animate-spin" /> : null}
              <span>Continue Monitoring</span>
            </button>
            <button
              type="button"
              onClick={handleStartRemedial}
              disabled={updatingRemedial}
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-cnhs-green-dark px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-[#1b5842] disabled:opacity-50"
            >
              {updatingRemedial ? <Loader2 size={13} className="animate-spin" /> : null}
              <span>Start Class Remedial</span>
            </button>
          </div>
        </div>

        <label className="block pt-1">
          <span className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            Optional Note
          </span>
          <textarea
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            rows={2}
            placeholder="Enter a short note..."
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-cnhs-green dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
          />
        </label>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-[1px] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="learner-academic-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="relative z-10 flex max-h-[85vh] w-[min(820px,96vw)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[var(--card)]">
        {/* HEADER */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4 dark:border-white/5 dark:bg-transparent sm:px-6">
          <div className="min-w-0 flex-1">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-cnhs-green-dark">
              Academic Monitoring Record
            </span>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <h2
                id="learner-academic-detail-title"
                className="text-xl font-bold tracking-tight text-slate-900 dark:text-white"
              >
                {studentFullName}
              </h2>
              <div className="flex items-center gap-2">
                <RiskPill value={academicRisk} />
                <span
                  className={cn(
                    "inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-semibold",
                    currentSupport.badgeStyle
                  )}
                >
                  {currentSupport.label}
                </span>
              </div>
            </div>
            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              {studentSection}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-5 dark:bg-black/10 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin text-cnhs-green-dark" />
              Loading academic details…
            </div>
          ) : (
            <>
              {/* SECTION 1: CURRENT ACADEMIC CONCERN */}
              <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/5 dark:bg-[var(--card)]">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-cnhs-green-dark">
                  1. Current Academic Concern
                </h3>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-white/[0.02]">
                    <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                      Subject
                    </span>
                    <span className="mt-1 block text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {studentSubject}
                    </span>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-white/[0.02]">
                    <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                      Current Grade
                    </span>
                    <span
                      className={cn(
                        "mt-1 block text-sm font-bold",
                        curGrade !== null && curGrade < 75
                          ? "text-amber-800 dark:text-amber-400"
                          : "text-slate-900 dark:text-slate-100"
                      )}
                    >
                      {curGrade !== null ? curGrade : "—"}{" "}
                      <span className="text-[11px] font-normal text-slate-400">/ 100</span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {curGrade !== null && curGrade < 75
                        ? "Below passing standard (75)"
                        : "Passing range"}
                    </span>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-white/[0.02]">
                    <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                      Current Support
                    </span>
                    <div className="mt-1">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-semibold",
                          currentSupport.badgeStyle
                        )}
                      >
                        {currentSupport.label}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* SECTION 2: WHY THIS LEARNER NEEDS ATTENTION */}
              <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/5 dark:bg-[var(--card)]">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-cnhs-green-dark">
                  2. Why This Learner Needs Attention
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  {attentionReason}
                </p>
              </section>

              {/* SECTION 3: ACADEMIC PROGRESS */}
              <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/5 dark:bg-[var(--card)]">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-cnhs-green-dark">
                  3. Academic Progress
                </h3>

                <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-xs dark:bg-white/[0.02]">
                  <div>
                    <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                      Previous Grade
                    </span>
                    <span className="mt-1 block font-mono text-sm font-bold text-slate-800 dark:text-slate-200">
                      {progressExplanation.previousDisplay}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                      Current Grade
                    </span>
                    <span className="mt-1 block font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                      {progressExplanation.currentDisplay}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                      Progress
                    </span>
                    <span className={cn("mt-1 inline-flex items-center gap-1 text-xs", progressExplanation.progressStyle)}>
                      {progressInfo.progress === "Improving" ? (
                        <TrendingUp size={13} className="text-emerald-600" />
                      ) : progressInfo.progress === "Declining" ? (
                        <TrendingDown size={13} className="text-amber-700" />
                      ) : progressInfo.progress === "No clear change" ? (
                        <Minus size={13} className="text-slate-400" />
                      ) : null}
                      <span>{progressExplanation.progressDisplay}</span>
                    </span>
                  </div>
                </div>

                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {progressExplanation.sentence}
                </p>
              </section>

              {/* SECTION 4: TEACHER ACTION */}
              <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/5 dark:bg-[var(--card)]">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-cnhs-green-dark border-b border-slate-100 pb-2 dark:border-white/5">
                  4. Teacher Action
                </h3>

                {isTeacher ? (
                  <div className="mt-3 space-y-3">
                    {referralState.isLanguageSubject ? (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-700 dark:text-slate-300">
                          Does this learner show a reading-related concern in{" "}
                          <strong className="text-slate-900 dark:text-white">
                            {studentSubject}
                          </strong>
                          ?
                        </p>

                        <div
                          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                          role="radiogroup"
                          aria-label="Reading concern review"
                        >
                          {[
                            { id: "confirmed", label: "Reading concern confirmed" },
                            { id: "not_reading", label: "Not related to reading" },
                          ].map((opt) => {
                            const isSelected = reviewDecision === opt.id;
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                onClick={() => setReviewDecision(opt.id)}
                                className={cn(
                                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition",
                                  isSelected
                                    ? "border-cnhs-green-dark bg-green-50/60 text-cnhs-green-dark dark:bg-green-950/20"
                                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                                )}
                              >
                                <span
                                  className={cn(
                                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                                    isSelected
                                      ? "border-cnhs-green-dark"
                                      : "border-slate-300 dark:border-slate-600"
                                  )}
                                >
                                  {isSelected ? (
                                    <span className="h-2 w-2 rounded-full bg-cnhs-green-dark" />
                                  ) : null}
                                </span>
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>

                        {reviewDecision === "confirmed" ? (
                          <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-xs dark:border-white/5 dark:bg-white/[0.02]">
                            <div>
                              <span className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                Main reading concern
                              </span>
                              <AppSelect
                                label="Main reading concern"
                                value={reviewConcern}
                                onChange={setReviewConcern}
                                placeholder="Select reading concern"
                                options={[
                                  { value: "", label: "Select reading concern" },
                                  ...READING_CONCERN_OPTIONS.map((c) => ({
                                    value: c,
                                    label: c,
                                  })),
                                ]}
                                triggerClassName="h-9 text-xs"
                              />
                            </div>

                            <label className="block">
                              <span className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                Optional Note
                              </span>
                              <textarea
                                value={reviewNote}
                                onChange={(e) => setReviewNote(e.target.value)}
                                rows={2}
                                placeholder="Enter a short note..."
                                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-cnhs-green dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
                              />
                            </label>

                            <div className="pt-1">
                              {referralState.hasActiveReferral ? (
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                                    <div className="flex items-center gap-1.5">
                                      <CheckCircle2 size={14} />
                                      <span>
                                        {referralState.isApproved
                                          ? "ARAL Referral: Approved for Assessment"
                                          : "ARAL Referral: Pending Principal Review"}
                                      </span>
                                    </div>
                                    {onNavigateToAral ? (
                                      <button
                                        type="button"
                                        onClick={() => onNavigateToAral?.(activeLearner)}
                                        className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-cnhs-green-dark hover:underline"
                                      >
                                        <span>View in ARAL Monitoring</span>
                                        <ArrowUpRight size={12} />
                                      </button>
                                    ) : null}
                                  </div>
                                </div>
                              ) : referralState.isReturned ? (
                                <div className="space-y-2">
                                  <div className="rounded border border-orange-200 bg-orange-50 p-2 text-xs text-orange-800 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-300">
                                    <span className="font-bold">Returned for Teacher Review:</span>{" "}
                                    {referralState.reviewNote ||
                                      "Please review notes and revise referral."}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={handleRecommendAral}
                                    disabled={recommendingAral}
                                    className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    {recommendingAral ? (
                                      <Loader2 size={13} className="animate-spin" />
                                    ) : null}
                                    <span>Resubmit for ARAL Assessment</span>
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={handleRecommendAral}
                                  disabled={recommendingAral}
                                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50"
                                >
                                  {recommendingAral ? (
                                    <Loader2 size={13} className="animate-spin" />
                                  ) : null}
                                  <span>Recommend for ARAL Assessment</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ) : reviewDecision === "not_reading" ? (
                          renderClassRemedialActions()
                        ) : null}
                      </div>
                    ) : (
                      renderClassRemedialActions()
                    )}
                  </div>
                ) : (
                  /* PRINCIPAL ROLE (Read-only view) */
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-white/[0.02]">
                      <span className="text-slate-500">Current Academic Support:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {currentSupport.label}
                      </span>
                    </div>
                    {activeLearner.teacherRemarks ? (
                      <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600 italic dark:bg-white/[0.02] dark:text-slate-400">
                        Teacher note: &ldquo;{activeLearner.teacherRemarks}&rdquo;
                      </div>
                    ) : null}
                    {referralState.isLanguageSubject && referralState.hasActiveReferral ? (
                      <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        <span>
                          {referralState.isApproved
                            ? "ARAL Referral: Approved for Assessment"
                            : "ARAL Referral: Pending Principal Review"}
                        </span>
                        {typeof onNavigateToAral === "function" ? (
                          <button
                            type="button"
                            onClick={() => {
                              onClose?.();
                              onNavigateToAral(activeLearner);
                            }}
                            className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-cnhs-green-dark hover:underline"
                          >
                            <span>View in ARAL Monitoring</span>
                            <ArrowUpRight size={12} />
                          </button>
                        ) : (
                          <Link
                            href={
                              role === "principal" || role === "admin"
                                ? `/aral-monitoring${activeLearner?.studentId ? `?studentId=${activeLearner.studentId}` : ""}`
                                : `/teacher/aral-monitoring${activeLearner?.studentId ? `?studentId=${activeLearner.studentId}` : ""}`
                            }
                            onClick={onClose}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-cnhs-green-dark hover:underline"
                          >
                            <span>View in ARAL Monitoring</span>
                            <ArrowUpRight size={12} />
                          </Link>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </section>

              {/* RECENT SUPPORT ACTIVITY (Hidden if empty) */}
              {activityRecords.length > 0 ? (
                <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/5 dark:bg-[var(--card)]">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2 dark:border-white/5">
                    Recent Support Activity
                  </h3>
                  <div className="mt-3 divide-y divide-slate-100 text-xs dark:divide-white/5">
                    {activityRecords.map((rec) => (
                      <div key={rec.id} className="py-2.5 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {rec.interventionGiven || "Classroom Remediation"}
                          </span>
                          <span className="font-mono text-slate-400">
                            {rec.observationDate || rec.observation_date || rec.createdAt || "—"}
                          </span>
                        </div>
                        {rec.teacherRemarks || rec.teacher_remarks ? (
                          <p className="mt-1 text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-400">
                            {rec.teacherRemarks || rec.teacher_remarks}
                          </p>
                        ) : null}
                        {rec.studentProgress || rec.student_progress ? (
                          <p className="mt-0.5 text-[10.5px] text-slate-400">
                            Progress:{" "}
                            <strong className="text-slate-600 dark:text-slate-300">
                              {rec.studentProgress || rec.student_progress}
                            </strong>
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex shrink-0 justify-end border-t border-slate-100 bg-white px-5 py-3 dark:border-white/5 dark:bg-transparent sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
