"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  FileText,
  Pencil,
  Loader2,
  TrendingDown,
  TrendingUp,
  Minus,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  GraduationCap,
  ArrowUpRight,
  BookOpen,
  Calendar,
} from "lucide-react";
import { saveSinglePhilIriResult, createMonitoringRecord, referLearnerToAral } from "@/lib/supabase/queries/monitoring";
import { submitAralRecommendationForReview } from "@/lib/supabase/queries/aralApprovals";
import AppSelect from "@/components/shared/AppSelect";
import {
  READING_CONCERN_OPTIONS,
  deriveLearnerReviewReasons,
  isReadingReviewCandidate,
  reviewReasonLabel,
} from "@/lib/monitoring/readingReviewSummary";
import {
  aralPeriodLabel,
  normalizeAralPeriod,
} from "@/lib/monitoring/assessmentTimeline";
import { RiskPill } from "@/components/teacher/monitoring/shared";
import { getAssessmentPermissions, ASSESSMENT_TERMS, ASSESSMENT_STAGES } from "@/lib/monitoring/assessmentTimeline";
import { useAppToast } from "@/components/shared/AppToast";
import { cn } from "@/lib/utils";

export default function StudentMonitoringSidePanel({
  learner,
  isOpen,
  onClose,
  onRefresh,
  onNavigateToAral,
  isLanguageTeacher = false,
  currentQuarterNumber = 1,
  // Workflow context: "academic" (risk detection, remedial, referral) or
  // "aral" (approved reading cases, assessment, intervention progress).
  context = "academic",
  // Authoritative ARAL assessment period (BOSY/MOSY/EOSY). Baseline saves
  // are BOSY-gated in the backend; null preserves legacy behavior.
  aralPeriod = null,
}) {
  const pathname = usePathname();
  const [isEditingPhilIri, setIsEditingPhilIri] = useState(false);
  const [editGstScore, setEditGstScore] = useState("");
  const [editReadingLevel, setEditReadingLevel] = useState("Instructional");
  const [savingEdit, setSavingEdit] = useState(false);

  // Class Remedial Lifecycle State
  const [remedialStatus, setRemedialStatus] = useState("Recommended");
  const [updatingRemedial, setUpdatingRemedial] = useState(false);

  // New Observation / Progress log state
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteProgress, setNoteProgress] = useState("Needs Follow-up");
  const [noteIntervention, setNoteIntervention] = useState("");
  const [noteRemarks, setNoteRemarks] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Teacher Review state (academic context, subject-dependent)
  const [reviewDecision, setReviewDecision] = useState(null);
  const [reviewConcern, setReviewConcern] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [continuingMonitoring, setContinuingMonitoring] = useState(false);

  // ARAL referral submission state (single-flight + pending visibility)
  const [recommendingAral, setRecommendingAral] = useState(false);

  // Calculate Active Term using assessmentTimeline
  const activeTerm = currentQuarterNumber === 1 ? ASSESSMENT_TERMS.TERM_1 : currentQuarterNumber === 2 ? ASSESSMENT_TERMS.TERM_2 : ASSESSMENT_TERMS.TERM_3;
  const permissions = getAssessmentPermissions(activeTerm);
  
  // Determine which phase is currently editable
  const currentPhase = permissions[ASSESSMENT_STAGES.BEG].editable ? "BOSY (Beginning)" : permissions[ASSESSMENT_STAGES.MID].editable ? "MOSY (Midline)" : "EOSY (End)";

  // Strict module separation: academic hides ARAL assessment workflow and
  // ARAL-specific editing; ARAL hides academic referral/remedial controls.
  const isAralContext = context === "aral";

  // Single source of truth for assessment edit permission (unknown term →
  // every phase hidden → no editing anywhere).
  const canEditAssessment =
    permissions[ASSESSMENT_STAGES.BEG]?.editable === true ||
    permissions[ASSESSMENT_STAGES.MID]?.editable === true ||
    permissions[ASSESSMENT_STAGES.END]?.editable === true;

  // Baseline screening belongs to BOSY. Once the authoritative period
  // advances, the baseline is historical and read-only here.
  const baselineEditable =
    canEditAssessment &&
    (!aralPeriod || normalizeAralPeriod(aralPeriod) === "BOSY");
  const assessmentPeriodLabel = aralPeriod
    ? aralPeriodLabel(aralPeriod)
    : currentPhase;

  const { showToast } = useAppToast();

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

  useEffect(() => {
    setIsEditingPhilIri(false);
    setIsAddingNote(false);
    setReviewConcern("");
    setReviewNote("");
    if (learner) {
      setRemedialStatus(
        learner.remedialStatus ||
          learner.interventionStatus ||
          learner.monitoringStatus ||
          "Recommended"
      );
      // A learner already in the referral pipeline opens as confirmed.
      const alreadyInPipeline =
        learner.candidateStatus === "Referred to ARAL" ||
        /submitted|approved|for your review|pending principal review|approved for assessment/i.test(
          String(learner.aralApprovalStatus || "")
        );
      setReviewDecision(alreadyInPipeline ? "confirmed" : null);
    } else {
      setReviewDecision(null);
    }
  }, [learner?.id, learner?.studentId, isOpen, learner]);

  if (!isOpen || !learner) return null;

  async function handleUpdateRemedialStatus(newStatus, extraRemarks = "") {
    if (updatingRemedial) return;
    setUpdatingRemedial(true);
    try {
      const studentId = learner.studentId || learner.id;
      const classId = learner.classId || null;
      const remarks = `Class Remedial status confirmed as ${newStatus}.${extraRemarks ? ` Teacher note: ${extraRemarks}` : ""}`;
      await createMonitoringRecord({
        student_id: studentId,
        class_id: classId,
        observation_date: new Date().toISOString().split("T")[0],
        intervention_given: "Class Remedial",
        teacher_remarks: remarks,
        student_progress: newStatus === "Completed" ? "Improving" : "Ongoing",
        follow_up_needed: newStatus === "Needs Continued Support",
        monitoring_status: newStatus,
        school_year: learner.schoolYear || "SY 2026-2027",
        quarter: currentQuarterNumber,
      });
      setRemedialStatus(newStatus);
      setReviewNote("");
      showToast("success", `Class Remedial status updated to ${newStatus}.`);
      onRefresh?.();
    } catch (err) {
      console.error(err);
      showToast("error", "Failed to update Class Remedial status.");
    } finally {
      setUpdatingRemedial(false);
    }
  }

  const studentFullName =
    learner.name ||
    `${learner.lastName || ""}, ${learner.firstName || ""}`.trim() ||
    "Student Name";
  const studentLrn = learner.studentNumber || learner.lrn || "—";
  const studentGrade = learner.grade || "Grade 7";
  const studentSection = learner.section || "Section";
  const studentAdviser = learner.adviserName || learner.adviser || "Adviser";

  const curGrade = learner.classSubjectGrade ?? learner.currentGrade ?? null;
  const prevGrade =
    learner.previousGrade ??
    (currentQuarterNumber > 1 ? learner.termGrades?.[currentQuarterNumber - 1] : null);
  const perfTrend = learner.performanceTrend || "Stable";
  const attRate = learner.attendanceRate || "92%";

  const isReadingSubject = /english|filipino/i.test(learner.subject || "");
  const canManageReading = isLanguageTeacher || isReadingSubject;

  // Phil-IRI values
  const hasGstScore =
    learner.philIriScore != null && !Number.isNaN(Number(learner.philIriScore));
  const gstScore = hasGstScore ? Number(learner.philIriScore) : null;
  const readingLevelDisplay =
    learner.readingLevel && learner.readingLevel !== "Not Assessed" && learner.readingLevel !== "N/A"
      ? learner.readingLevel
      : hasGstScore ? "Instructional" : "Not Assessed";

  const screeningInterpretation =
    learner.screeningInterpretation ||
    (gstScore != null && gstScore <= 15
      ? "Individualized Assessment (Starting point: 3 grade levels below)"
      : gstScore != null && gstScore <= 27
      ? "Individualized Assessment (Starting point: 2 grade levels below)"
      : gstScore != null
      ? "No further individualized assessment from GST"
      : "Not Assessed");

  // Support / Recommended Pathway
  const recommendedSupport = learner.recommendedSupport || "Class Remedial";
  const supportReason =
    learner.supportReason ||
    (recommendedSupport === "ARAL Screening"
      ? "Academic performance and applicable reading assessment results indicate the learner requires further reading intervention screening."
      : recommendedSupport === "Class Remedial"
      ? `Recent academic performance shows continued difficulty in ${learner.subject || "the subject"}.`
      : recommendedSupport === "Review"
      ? "Performance trend indicates need for close teacher monitoring and review."
      : "Learner is performing satisfactorily with consistent academic progress.");

  // Decision Support
  const decisionSupport = learner.decisionSupport || {
    riskLevel: learner.riskLevel ? learner.riskLevel.replace(/\s*Risk$/i, "") : "Moderate",
    modelConfidenceDisplay: "82%",
    contributingIndicators: [
      "Declining academic performance",
      "Low recent assessment result",
      "Previous performance trend baseline",
    ],
    disclaimer:
      "Random Forest serves as analytical decision support and does not supersede official DepEd assessment rules.",
  };

  function handleStartEdit() {
    setEditGstScore(hasGstScore ? String(gstScore) : "");
    setEditReadingLevel(readingLevelDisplay);
    setIsEditingPhilIri(true);
  }

  async function handleSaveEdit(e) {
    e?.preventDefault?.();
    const numericScore = editGstScore === "" ? null : Number(editGstScore);
    if (numericScore !== null && (numericScore < 0 || numericScore > 40)) {
      showToast("error", "GST raw score must be between 0 and 40.");
      return;
    }

    setSavingEdit(true);
    try {
      const studentId = learner.studentId || learner.id;
      const classId = learner.classId || null;

      const interpretation =
        numericScore === null
          ? "Screening Pending"
          : numericScore <= 15
          ? "Individualized Assessment (Starting point: 3 grade levels below)"
          : numericScore <= 27
          ? "Individualized Assessment (Starting point: 2 grade levels below)"
          : "No further individualized assessment from GST";

      const res = await saveSinglePhilIriResult({
        studentId,
        classId,
        quarter: currentQuarterNumber,
        subject: learner.subject || "English",
        gstScore: numericScore,
        individualAssessmentRequired: numericScore !== null && numericScore <= 27,
        readingLevel: editReadingLevel,
        screeningInterpretation: interpretation,
        assessmentPeriod: aralPeriod,
      });

      if (res?.error) {
        showToast("error", res.error.message || "Failed to update assessment.");
        return;
      }

      showToast("success", "Assessment result updated.");
      setIsEditingPhilIri(false);
      onRefresh?.();
    } catch (err) {
      console.error(err);
      showToast("error", "Failed to update assessment result.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleSaveObservation(e) {
    e?.preventDefault?.();
    if (!noteIntervention.trim() && !noteRemarks.trim()) {
      showToast("error", "Please enter intervention provided or teacher remarks.");
      return;
    }

    setSavingNote(true);
    try {
      const studentId = learner.studentId || learner.id;
      const classId = learner.classId || null;

      await createMonitoringRecord({
        student_id: studentId,
        class_id: classId,
        observation_date: new Date().toISOString().split("T")[0],
        intervention_given: noteIntervention.trim() || recommendedSupport,
        teacher_remarks: noteRemarks.trim() || "Regular monitoring observation recorded.",
        student_progress: noteProgress,
        followUpNeeded: noteProgress === "Needs Follow-up",
        monitoring_status: "Ongoing",
        school_year: learner.schoolYear || "SY 2026-2027",
        quarter: currentQuarterNumber,
      });

      showToast("success", "Observation record saved.");
      setIsAddingNote(false);
      setNoteIntervention("");
      setNoteRemarks("");
      onRefresh?.();
    } catch (err) {
      console.error(err);
      showToast("error", "Failed to save observation record.");
    } finally {
      setSavingNote(false);
    }
  }

  // Existing Principal-queue state for this learner (DB = submitted,
  // UI label = Pending Principal Review). Guards duplicate referrals.
  const aralApprovalRaw = String(learner.aralApprovalStatus || "");
  const aralReferralPending =
    learner.candidateStatus === "Referred to ARAL" ||
    /submitted|for your review|pending principal review/i.test(aralApprovalRaw);
  const aralReferralApproved =
    /approved|approved for assessment/i.test(aralApprovalRaw);

  // Subject-context pathway: English/Filipino learners meeting reading-review
  // conditions get the reading-review pathway; all others get class remedial.
  const isReadingPath =
    isReadingSubject && isReadingReviewCandidate(learner);

  // Compact Reading Intervention status (teacher-friendly labels only).
  const readingStatusLabel = learner.inAralProgram
    ? "Under Reading Intervention"
    : aralReferralApproved
      ? hasGstScore
        ? "Approved for Assessment"
        : "Waiting for Reading Assessment"
      : aralReferralPending
        ? "Pending Principal Review"
        : "Not yet referred";

  // Friendly reasons derived from existing roster outputs (never hardcoded).
  const reviewReasons = deriveLearnerReviewReasons(learner);

  // Referral requires an explicit confirmed reading concern in academic flow.
  const referralEligible =
    (!learner.aralStatus || learner.aralStatus === "Not Referred") &&
    isReadingSubject &&
    Number(curGrade) < 75;
  const canRecommendAral =
    referralEligible &&
    !aralReferralPending &&
    !aralReferralApproved &&
    reviewDecision === "confirmed";

  async function handleRecommendAral() {
    if (recommendingAral) return;
    const studentId = learner.studentId || learner.id;
    const classId = learner.classId || null;
    if (!studentId || !classId) {
      showToast("error", "Missing learner or class record. Cannot submit referral.");
      return;
    }
    if (aralReferralPending || aralReferralApproved) {
      showToast("success", "ARAL referral already submitted. Pending Principal review.");
      return;
    }
    setRecommendingAral(true);
    try {
      const referralNote = [
        `Teacher-confirmed reading concern${reviewConcern ? `: ${reviewConcern}` : ""}.`,
        reviewNote.trim() ? `Teacher note: ${reviewNote.trim()}` : "",
      ]
        .filter(Boolean)
        .join(" ");
      // Legacy triage trail (monitoring record + candidate status).
      await referLearnerToAral({
        studentId,
        classId,
        notes: referralNote,
      });
      // Principal queue record (duplicate-guarded by upsert + approved check).
      const submitResult = await submitAralRecommendationForReview({
        studentId,
        classId,
        schoolYear: learner.schoolYear || "SY 2026-2027",
        quarter: learner.quarterNumber ?? currentQuarterNumber,
      });
      if (submitResult?.error) {
        showToast("error", submitResult.error.message || "Failed to submit ARAL referral.");
        return;
      }
      showToast("success", "ARAL referral submitted. Pending Principal review.");
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

  async function handleContinueMonitoring() {
    if (continuingMonitoring) return;
    const studentId = learner.studentId || learner.id;
    const classId = learner.classId || null;
    if (!studentId) {
      showToast("error", "Missing learner record. Cannot continue monitoring.");
      return;
    }
    setContinuingMonitoring(true);
    try {
      await createMonitoringRecord({
        student_id: studentId,
        class_id: classId,
        observation_date: new Date().toISOString().split("T")[0],
        intervention_given: recommendedSupport || "Classroom Monitoring",
        teacher_remarks:
          reviewNote.trim() ||
          "Teacher continued monitoring with no change in intervention.",
        student_progress: "Ongoing",
        follow_up_needed: false,
        monitoring_status: "Ongoing",
        school_year: learner.schoolYear || "SY 2026-2027",
        quarter: currentQuarterNumber,
      });
      showToast("success", "Monitoring continued for this learner.");
      setReviewNote("");
      onRefresh?.();
    } catch (err) {
      console.error(err);
      showToast("error", "Failed to continue monitoring.");
    } finally {
      setContinuingMonitoring(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="learner-profile-title"
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-5 bg-slate-900/50 backdrop-blur-[2px] overflow-y-auto"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.16, ease: "easeOut" }}
        className="relative w-full max-w-[920px] max-h-[90vh] bg-white rounded-2xl border border-slate-200 shadow-[0_24px_64px_-12px_rgba(15,23,42,0.35)] flex flex-col overflow-hidden m-auto"
      >
        {/* ENTERPRISE RECORD HEADER — learner identity + workflow context */}
        <div className="border-b border-slate-200 bg-white px-5 sm:px-6 pt-4 sm:pt-5 pb-4 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3.5">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cnhs-green-soft text-[13px] font-bold text-cnhs-green-dark ring-1 ring-emerald-200/60"
              >
                {String(studentFullName || "?")
                  .split(/[\s,]+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cnhs-green-dark border border-emerald-200/80">
                    <GraduationCap size={12} />
                    CNHS Learn Record
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {learner.schoolYear || "SY 2026-2027"} · Term {currentQuarterNumber}
                  </span>
                </div>
                <h2
                  id="learner-profile-title"
                  className="mt-1 truncate text-lg sm:text-xl font-bold tracking-tight text-slate-900"
                >
                  {studentFullName}
                </h2>
                <p className="mt-0.5 truncate text-[12px] text-slate-500">
                  LRN <span className="font-mono font-medium text-slate-600">{studentLrn}</span>
                  <span className="mx-1.5 text-slate-300">•</span>
                  {studentGrade} · {studentSection}
                  {learner.subject ? (
                    <>
                      <span className="mx-1.5 text-slate-300">•</span>
                      {learner.subject}
                    </>
                  ) : null}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <RiskPill value={learner.riskLevel || "—"} />
                  {learner.monitoringStatus ? (
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                      {learner.monitoringStatus}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {pathname?.includes("aral-monitoring") ? (
                <Link
                  href={`/teacher/monitoring?studentId=${learner?.studentId || learner?.id || ""}`}
                  title="View complete academic performance profile"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition"
                >
                  <span>View Academic Performance</span>
                  <ArrowUpRight size={13} className="text-slate-500" />
                </Link>
              ) : (
                (hasGstScore ||
                  learner?.interventionStatus === "ARAL Candidate" ||
                  aralReferralApproved ||
                  learner.inAralProgram) && (
                  <Link
                    href={`/teacher/aral-monitoring?studentId=${learner?.studentId || learner?.id || ""}`}
                    title="View in ARAL Monitoring workspace"
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-cnhs-green-dark shadow-2xs hover:bg-emerald-100 transition"
                  >
                    <span>View in ARAL Monitoring</span>
                    <ArrowUpRight size={13} className="text-cnhs-green-dark" />
                  </Link>
                )
              )}

              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition cursor-pointer"
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
              </div>
            </div>
          </div>

        {/* DOCUMENT BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-6 sm:pb-8 space-y-4 sm:space-y-5 bg-slate-100/60">
          <div className="flex flex-col gap-4 sm:gap-5">
            <div className={cn(!isAralContext && "hidden")}>
{/* 1. STUDENT INFORMATION (Formal Document Surface) */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-cnhs-green-dark border-b border-slate-100 pb-2">
              1. Student Information
            </h3>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Learner Name
                </span>
                <span className="mt-0.5 text-sm font-bold text-slate-900 block truncate">
                  {studentFullName}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Learner Reference No.
                </span>
                <span className="mt-0.5 font-mono font-medium text-slate-800 block text-xs">
                  {studentLrn}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Grade & Section
                </span>
                <span className="mt-0.5 font-semibold text-slate-800 block">
                  {studentGrade} · {studentSection}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                  Class Adviser
                </span>
                <span className="mt-0.5 text-slate-700 block truncate">
                  {studentAdviser}
                </span>
              </div>
            </div>
            {learner.subject ? (
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>
                  Subject Handled: <strong className="text-slate-800">{learner.subject}</strong>
                </span>
                <span>
                  Teacher: <strong className="text-slate-800">{learner.teacherName || "—"}</strong>
                </span>
              </div>
            ) : null}
          </div>
            </div>

            {/* 2. CURRENT ACADEMIC SITUATION (academic context only) */}
            <div className={cn(!isAralContext && "contents", isAralContext && "hidden")}>
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-cnhs-green-dark border-b border-slate-100 pb-2">
                  Current Academic Situation
                </h3>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5 text-xs">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Subject
                    </span>
                    <span className="mt-1 block text-sm font-bold text-slate-900">
                      {learner.subject || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Current Grade
                    </span>
                    <span className={cn(
                      "mt-1 block text-sm font-bold",
                      curGrade != null && Number(curGrade) < 75 ? "text-amber-800" : "text-slate-900"
                    )}>
                      {curGrade != null ? curGrade : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Previous Grade
                    </span>
                    <span className="mt-1 block text-sm font-bold text-slate-700">
                      {prevGrade != null ? prevGrade : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Trend
                    </span>
                    <span className="mt-1 flex items-center gap-1 text-sm font-bold text-slate-800">
                      {perfTrend === "Improving" ? (
                        <TrendingUp size={14} className="text-emerald-600" />
                      ) : perfTrend === "Declining" ? (
                        <TrendingDown size={14} className="text-amber-700" />
                      ) : (
                        <Minus size={14} className="text-slate-400" />
                      )}
                      {perfTrend}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Academic Risk
                    </span>
                    <span className="mt-1 block">
                      <RiskPill value={learner.riskLevel || "—"} />
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. WHY THIS LEARNER NEEDS REVIEW (academic context only) */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-cnhs-green-dark border-b border-slate-100 pb-2">
                  Why This Learner Needs Review
                </h3>
                {reviewReasons.length ? (
                  <ul className="mt-3 space-y-1.5">
                    {reviewReasons.map((code) => (
                      <li key={code} className="flex items-start gap-2 text-[12px] text-slate-700">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                        <span className="font-medium">{reviewReasonLabel(code)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-[12px] text-slate-500">
                    No specific concerns flagged. Continue regular monitoring.
                  </p>
                )}
                {supportReason ? (
                  <p className="mt-2.5 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-[12px] leading-5 text-slate-600">
                    {supportReason}
                  </p>
                ) : null}
                {decisionSupport?.contributingIndicators?.length ? (
                  <div className="mt-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Recent Academic Evidence
                    </span>
                    <ul className="mt-1.5 space-y-1">
                      {decisionSupport.contributingIndicators.map((ind, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-600">
                          <span className="text-slate-300">•</span>
                          <span>{ind}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-[10.5px] leading-4 text-slate-400">
                      Risk factors serve as academic evidence and do not supersede official DepEd assessment rules.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
            
            <div className="contents">
{/* 4. ACADEMIC PERFORMANCE — subject grids (academic context only) */}
          <div className={cn("rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm", isAralContext && "hidden")}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-cnhs-green-dark">
                {isAralContext ? "2. Academic Performance" : "4. Academic Performance"}
              </h3>
              <span className="text-[10.5px] text-slate-400">Quarterly & Subject Standing</span>
            </div>
            <div className={cn("mt-3 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-xs", !isAralContext && "hidden")}>
              <div className="pr-4 py-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Current Grade {learner.subject ? `(${learner.subject})` : ""}
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span
                    className={cn(
                      "text-3xl font-extrabold tracking-tight leading-none",
                      curGrade != null && Number(curGrade) < 75
                        ? "text-amber-800"
                        : "text-slate-900"
                    )}
                  >
                    {curGrade != null ? curGrade : "—"}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    / 100
                  </span>
                </div>
                <span className="mt-1 block text-[10.5px] text-slate-400">
                  {curGrade != null && Number(curGrade) < 75 ? "Below Passing (75)" : "Passing Standard"}
                </span>
              </div>

              <div className="px-4 py-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Previous Grade
                </span>
                <span className="mt-2 text-xl font-bold text-slate-700 block">
                  {prevGrade != null ? prevGrade : "No previous data"}
                </span>
                <span className="text-[10.5px] text-slate-400 mt-1 block">
                  Quarter {currentQuarterNumber > 1 ? currentQuarterNumber - 1 : 1} baseline
                </span>
              </div>

              <div className="pl-4 py-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Performance Trend
                </span>
                <div className="mt-2 flex items-center gap-1.5">
                  {perfTrend === "Improving" ? (
                    <TrendingUp size={16} className="text-emerald-600" />
                  ) : perfTrend === "Declining" ? (
                    <TrendingDown size={16} className="text-amber-700" />
                  ) : (
                    <Minus size={16} className="text-slate-400" />
                  )}
                  <span
                    className={cn(
                      "text-sm font-bold",
                      perfTrend === "Improving"
                        ? "text-emerald-700"
                        : perfTrend === "Declining"
                        ? "text-amber-800"
                        : "text-slate-700"
                    )}
                  >
                    {perfTrend} {learner.subject ? `in ${learner.subject}` : ""}
                  </span>
                </div>
                <span className="text-[10.5px] text-slate-400 mt-1 block">
                  Term-over-term trajectory
                </span>
              </div>
            </div>

            {/* Subject-level performance grid if available */}
            {learner.subjectGrades && learner.subjectGrades.length > 0 ? (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Subject-Level Performance
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {learner.subjectGrades.map((sg, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded border px-2.5 py-1.5 flex items-center justify-between",
                        Number(sg.grade) < 75
                          ? "border-amber-200 bg-amber-50/60"
                          : "border-slate-200 bg-slate-50/40"
                      )}
                    >
                      <span className="font-medium text-slate-700 truncate pr-1">{sg.subject}</span>
                      <span
                        className={cn(
                          "font-bold font-mono",
                          Number(sg.grade) < 75 ? "text-amber-800" : "text-slate-900"
                        )}
                      >
                        {sg.grade ?? "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Per-subject risk/trend/status preserved after roster aggregation */}
            {Array.isArray(learner.subjectStandings) && learner.subjectStandings.length > 1 ? (
              <div className="mt-3 pt-3 border-t border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                  Per-Subject Standing
                </span>
                <div className="space-y-1.5">
                  {learner.subjectStandings.map((st, i) => (
                    <div
                      key={`${st.subject}-${st.classId || i}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-2.5 py-1.5 text-[11px]"
                    >
                      <span className="font-semibold text-slate-800">{st.subject}</span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-slate-500">
                        <span>Grade <strong className="font-mono text-slate-800">{st.grade ?? "—"}</strong></span>
                        <span className="text-slate-300">•</span>
                        <span className={cn(
                          "font-semibold",
                          /high/i.test(st.riskLevel || "") ? "text-red-700"
                          : /moderate/i.test(st.riskLevel || "") ? "text-amber-700"
                          : "text-emerald-700"
                        )}>
                          {st.riskLevel || "—"}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span>{st.trend || "—"}</span>
                        <span className="text-slate-300">•</span>
                        <span>{st.monitoringStatus || "—"}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
{/* 4. ASSESSMENT EVIDENCE (PHIL-IRI) — ARAL context only; academic uses the compact status in Teacher Review */}
          <div className={cn("rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm", !isAralContext && "hidden")}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-cnhs-green-dark">
                4. Beginning Assessment (BOSY Screening)
              </h3>
              {isAralContext && canManageReading && baselineEditable && !isEditingPhilIri ? (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-cnhs-green-dark hover:underline"
                >
                  <Pencil size={11} />
                  <span>Update Assessment</span>
                </button>
              ) : null}
            </div>

            {isEditingPhilIri && isAralContext ? (
              <form onSubmit={handleSaveEdit} className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600">
                      GST Raw Score (0–40)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="40"
                      value={editGstScore}
                      onChange={(e) => setEditGstScore(e.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs"
                      placeholder="e.g. 12"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600">
                      Reading Level
                    </label>
                    <select
                      value={editReadingLevel}
                      onChange={(e) => setEditReadingLevel(e.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs"
                    >
                      <option value="Frustration">Frustration</option>
                      <option value="Instructional">Instructional</option>
                      <option value="Independent">Independent</option>
                    </select>
                  </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-600">
                        Assessment Period
                      </label>
                      <input
                        type="text"
                        disabled
                        value={assessmentPeriodLabel}
                        className="mt-1 w-full rounded border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 cursor-not-allowed"
                      />
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsEditingPhilIri(false)}
                    className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded bg-cnhs-green-dark px-3.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-[#246f54] disabled:opacity-50"
                  >
                    {savingEdit ? <Loader2 size={12} className="animate-spin" /> : null}
                    <span>Save Result</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-xs">
                <div className="pr-4 py-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Phil-IRI Status
                  </span>
                  <span className="mt-1 text-sm font-semibold text-slate-900 block">
                    {hasGstScore ? "Assessed" : "Not Assessed"}
                  </span>
                  <span className="text-[10.5px] text-slate-400 mt-0.5 block">
                    Group Screening
                  </span>
                </div>
                <div className="px-4 py-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    GST Result
                  </span>
                  <span className="mt-1 text-sm font-bold text-slate-900 block">
                    {hasGstScore ? `${gstScore} / 20` : "Not Recorded"}
                  </span>
                  <span className="text-[10.5px] text-slate-400 mt-0.5 block">
                    Raw Score
                  </span>
                </div>
                <div className="px-4 py-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Reading Assessment
                  </span>
                  <span className="mt-1 text-xs font-medium text-slate-700 block">
                    {hasGstScore 
                      ? (gstScore <= 27 ? "Further assessment indicated" : "No further individualized assessment from GST")
                      : "—"}
                  </span>
                </div>
                <div className="pl-4 py-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Action
                  </span>
                  <Link
                    href={`/teacher/aral-monitoring?studentId=${learner?.studentId || learner?.id || ""}`}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-cnhs-green-dark hover:underline"
                  >
                    View in ARAL Monitoring <ArrowUpRight size={11} />
                  </Link>
                </div>
              </div>
            )}

            {/* Evidence Flow Note */}
            <div className="mt-3 rounded border border-slate-100 bg-slate-50/70 p-2.5 text-[11px] text-slate-600 flex items-start gap-2">
              <CheckCircle2 size={14} className="text-cnhs-green-dark shrink-0 mt-0.5" />
              <span>
                <strong>Evidence Connection:</strong> Academic performance indicates subject standing (Grade: {curGrade || "—"}).
                Phil-IRI reading assessment provides secondary evidence ({readingLevelDisplay}), supporting the recommended intervention pathway below without overriding official grading rules.
              </span>
            </div>
          </div>
{/* 6. CURRENT SUPPORT & RECENT ACTIVITY (academic context only) */}
          <div className={cn("rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm", isAralContext && "hidden")}>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-cnhs-green-dark border-b border-slate-100 pb-2">
              6. Current Support & Recent Activity
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
              <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Monitoring Status
                </span>
                <span className="mt-0.5 block text-sm font-bold text-slate-900">
                  {learner.monitoringStatus || "Monitoring"}
                </span>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Class Remedial
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">{remedialStatus}</span>
                  <select
                    value={remedialStatus}
                    onChange={(e) => handleUpdateRemedialStatus(e.target.value, reviewNote.trim())}
                    disabled={updatingRemedial}
                    aria-label="Update class remedial status"
                    className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-700"
                  >
                    <option value="Recommended">Recommended</option>
                    <option value="Active">Active</option>
                    <option value="Progressing">Progressing</option>
                    <option value="Completed">Completed</option>
                    <option value="Needs Continued Support">Needs Continued Support</option>
                  </select>
                </span>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  {isReadingPath ? "Reading Referral" : "Support Pathway"}
                </span>
                <span className="mt-0.5 block text-sm font-bold text-slate-900">
                  {isReadingPath ? readingStatusLabel : (recommendedSupport || "—")}
                </span>
              </div>
            </div>
          </div>
{/* 9. PROGRESS HISTORY & OBSERVATIONS (Recent Activity in academic) */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-cnhs-green-dark">
                {isAralContext ? "9. Progress History & Teacher Observations" : "Recent Activity"}
              </h3>
              {!isAddingNote ? (
                <button
                  type="button"
                  onClick={() => setIsAddingNote(true)}
                  className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-cnhs-green-dark hover:underline"
                >
                  <Pencil size={11} />
                  <span>Add Observation Note</span>
                </button>
              ) : null}
            </div>

            {isAddingNote ? (
              <form onSubmit={handleSaveObservation} className="mt-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600">
                      Intervention Given
                    </label>
                    <input
                      type="text"
                      value={noteIntervention}
                      onChange={(e) => setNoteIntervention(e.target.value)}
                      placeholder="e.g. Small group guided reading / Skill review"
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-600">
                      Progress Evaluation
                    </label>
                    <select
                      value={noteProgress}
                      onChange={(e) => setNoteProgress(e.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1 text-xs"
                    >
                      <option value="Improving">Improving</option>
                      <option value="Satisfactory">Satisfactory</option>
                      <option value="Needs Follow-up">Needs Follow-up</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-600">
                    Teacher Remarks / Next Steps
                  </label>
                  <textarea
                    rows={2}
                    value={noteRemarks}
                    onChange={(e) => setNoteRemarks(e.target.value)}
                    placeholder="Enter observation notes, learner response, and next monitoring milestone..."
                    className="mt-1 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsAddingNote(false)}
                    className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingNote}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded bg-cnhs-green-dark px-3.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-[#246f54] disabled:opacity-50"
                  >
                    {savingNote ? <Loader2 size={12} className="animate-spin" /> : null}
                    <span>Save Note</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-3">
                {learner.records && learner.records.length > 0 ? (
                  <div className="divide-y divide-slate-100 text-xs">
                    {learner.records.map((rec) => (
                      <div key={rec.id} className="py-2.5 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-900">
                            {rec.interventionGiven || "Classroom Remediation"}
                          </span>
                          <span className="text-slate-400 font-mono">
                            {rec.observationDate || rec.createdAt}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-600 text-[11px] leading-relaxed">
                          {rec.teacherRemarks}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                          <span>Status: <strong className="text-slate-600">{rec.studentProgress || "Ongoing"}</strong></span>
                          {rec.teacherName ? <span>• By {rec.teacherName}</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 py-2">
                    No historical observation notes recorded for this quarter yet.
                    Use &ldquo;Add Observation Note&rdquo; above to record remediation progress.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
            </div>

            <div className="contents">
{/* 3. ATTENDANCE — ARAL context only; academic uses Additional Information below */}
          <div className={cn("rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm", !isAralContext && "hidden")}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-cnhs-green-dark">
                3. Attendance Records
              </h3>
              <span className="text-[10.5px] text-slate-400">Learner Engagement</span>
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Attendance Rate
                </span>
                <span className="mt-1 text-2xl font-bold font-mono text-slate-900 block">
                  {attRate}
                </span>
                <span className="text-[10.5px] text-slate-500 mt-0.5 block">
                  {parseInt(attRate, 10) >= 90 ? "Regular School Attendance" : "Attendance Concern Identified"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Attendance Status
                </span>
                <span
                  className={cn(
                    "mt-2 inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold border",
                    parseInt(attRate, 10) >= 90
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  )}
                >
                  {parseInt(attRate, 10) >= 90 ? "Satisfactory" : "At-Risk (Absences)"}
                </span>
                <span className="text-[10.5px] text-slate-400 mt-1 block">
                  DepEd attendance threshold: 80%
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Observation Period
                </span>
                <span className="mt-2 text-xs font-semibold text-slate-800 block">
                  {learner.schoolYear || "SY 2026-2027"}
                </span>
                <span className="text-[10.5px] text-slate-400 mt-0.5 block">
                  School Days Monitored
                </span>
              </div>
            </div>
          </div>
{/* ADDITIONAL INFORMATION (academic context only; attendance lives here) */}
          {!isAralContext ? (
            <details className="rounded-xl border border-slate-200/80 bg-white px-5 py-3 shadow-sm">
              <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-wider text-cnhs-green-dark">
                Additional Information
              </summary>
              <div className="mt-2.5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-2.5 text-xs sm:grid-cols-3">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Attendance Rate
                  </span>
                  <span className="mt-0.5 block text-sm font-bold text-slate-900">{attRate}</span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Attendance Status
                  </span>
                  <span className="mt-0.5 block text-sm font-bold text-slate-800">
                    {parseInt(attRate, 10) >= 90 ? "Satisfactory" : "At-Risk (Absences)"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Observation Period
                  </span>
                  <span className="mt-0.5 block text-sm font-semibold text-slate-800">
                    {learner.schoolYear || "SY 2026-2027"}
                  </span>
                </div>
              </div>
            </details>
          ) : null}
{/* 5. TEACHER REVIEW (academic context only; subject-dependent) */}
          <div className={cn("rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm", isAralContext && "hidden")}>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-cnhs-green-dark border-b border-slate-100 pb-2">
              5. Teacher Review
            </h3>
            {isReadingPath ? (
              <div className="mt-3">
                <p className="text-[12px] text-slate-600">
                  Does this learner show a reading-related concern?
                </p>
                <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2" role="radiogroup" aria-label="Reading concern decision">
                  {[
                    { id: "confirmed", label: "Reading concern confirmed" },
                    { id: "not_reading", label: "Not related to reading" },
                  ].map((option) => {
                    const active = reviewDecision === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setReviewDecision(option.id)}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12px] font-semibold transition",
                          active
                            ? "border-cnhs-green-dark/60 bg-cnhs-green-soft/30 text-cnhs-green-dark"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        <span className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                          active ? "border-cnhs-green-dark" : "border-slate-300"
                        )}>
                          {active ? <span className="h-2 w-2 rounded-full bg-cnhs-green-dark" /> : null}
                        </span>
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                {reviewDecision === "confirmed" ? (
                  <div className="mt-3 space-y-2.5 border-t border-slate-100 pt-3">
                    <div className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">
                        Main concern
                      </span>
                      <AppSelect
                        label="Main concern"
                        value={reviewConcern}
                        onChange={setReviewConcern}
                        placeholder="Select concern"
                        options={[
                          { value: "", label: "Select concern" },
                          ...READING_CONCERN_OPTIONS.map((item) => ({ value: item, label: item })),
                        ]}
                        triggerClassName="h-9 text-[12px]"
                      />
                    </div>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-600">
                        Teacher note <span className="font-normal text-slate-400">(optional)</span>
                      </span>
                      <textarea
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                        rows={2}
                        placeholder="Optional note saved with referrals and updates…"
                        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-cnhs-green"
                      />
                    </label>
                  </div>
                ) : null}

                {(aralReferralPending || aralReferralApproved || canRecommendAral || !reviewDecision) ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                    {aralReferralPending || aralReferralApproved ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-[12px] font-semibold text-amber-800">
                        {aralReferralApproved ? "ARAL Referral Approved" : "Pending Principal Review"}
                      </span>
                    ) : canRecommendAral ? (
                      <button
                        type="button"
                        onClick={handleRecommendAral}
                        disabled={recommendingAral}
                        className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-blue-600 px-3.5 text-[12px] font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {recommendingAral ? "Submitting…" : "Recommend for ARAL Assessment"}
                      </button>
                    ) : !reviewDecision ? (
                      <span className="text-[11px] text-slate-400">
                        Confirm a reading concern above to enable referral.
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-[12px] text-slate-600">
                  Recommended support:{" "}
                  <strong className="text-slate-900">{recommendedSupport}</strong>
                </p>
                <label className="mt-2.5 block">
                  <span className="mb-1 block text-[11px] font-semibold text-slate-600">
                    Teacher note <span className="font-normal text-slate-400">(optional)</span>
                  </span>
                  <textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    rows={2}
                    placeholder="Optional note saved with updates…"
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-cnhs-green"
                  />
                </label>
              </div>
            )}
          </div>
{/* 7. RECOMMENDED INTERVENTION (ARAL context only; academic uses Teacher Review above) */}
          <div className={cn("rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm", !isAralContext && "hidden")}>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-cnhs-green-dark border-b border-slate-100 pb-2">
              7. Recommended Intervention & Pathways
            </h3>

            <div className="mt-3 space-y-4">
              {/* CLASS REMEDIAL WORKFLOW */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Subject Intervention
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">
                      Class Remedial ({learner.subject || "Subject"})
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-500">Status:</span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold border",
                        remedialStatus === "Recommended"
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : remedialStatus === "Active"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : remedialStatus === "Progressing"
                          ? "border-blue-300 bg-blue-50 text-blue-800"
                          : remedialStatus === "Completed"
                          ? "border-slate-300 bg-slate-100 text-slate-800"
                          : "border-red-300 bg-red-50 text-red-800"
                      )}
                    >
                      {remedialStatus}
                    </span>
                  </div>
                </div>

                {/* Status transition controls (academic context; read-only in ARAL) */}
                {!isAralContext ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-slate-600">Update Status:</span>
                    <select
                      value={remedialStatus}
                      onChange={(e) => handleUpdateRemedialStatus(e.target.value)}
                      disabled={updatingRemedial}
                      className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 shadow-2xs"
                    >
                      <option value="Recommended">Recommended</option>
                      <option value="Active">Active</option>
                      <option value="Progressing">Progressing</option>
                      <option value="Completed">Completed</option>
                      <option value="Needs Continued Support">Needs Continued Support</option>
                    </select>
                    {updatingRemedial ? <Loader2 size={13} className="animate-spin text-cnhs-green-dark" /> : null}
                  </div>

                  {remedialStatus === "Recommended" ? (
                    <button
                      type="button"
                      onClick={() => handleUpdateRemedialStatus("Active")}
                      disabled={updatingRemedial}
                      className="inline-flex cursor-pointer items-center gap-1 rounded bg-cnhs-green-dark px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-[#246f54] transition disabled:opacity-50"
                    >
                      Confirm Intervention (Set to Active)
                    </button>
                  ) : null}
                </div>
                ) : (
                <p className="mt-3 text-[11px] text-slate-400">
                  Class remedial status is managed from Academic Monitoring.
                </p>
                )}

                {/* Important System Boundary Disclaimer */}
                <div className="mt-3 rounded border border-slate-200 bg-white p-2.5 text-[11px] text-slate-500">
                  <strong>System Boundary Notice:</strong> The system records intervention status and progress evidence. The system does <em>not</em> deliver actual remedial instruction, lessons, quizzes, or teaching activities. Remedial instruction remains with the subject teacher.
                </div>
              </div>

              {/* ARAL MONITORING CONNECTION */}
              {(recommendedSupport === "ARAL Screening" ||
                learner.supportPathway === "ARAL Program" ||
                isReadingSubject) && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3.5 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-blue-100 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-800">
                          <BookOpen size={11} />
                          Reading Intervention Pathway
                        </span>
                        <span className="text-[11px] font-semibold text-blue-900">Phil-IRI Reading Intervention</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-700">
                        {isReadingSubject
                          ? "Identified reading-related concern from English/Filipino performance and Phil-IRI diagnostic evidence."
                          : "Specialized reading intervention screening connected to academic performance."}
                      </p>
                    </div>

                    {onNavigateToAral ? (
                      <button
                        type="button"
                        onClick={() => {
                          onNavigateToAral?.(learner);
                          onClose?.();
                        }}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-bold text-blue-800 shadow-xs hover:bg-blue-50 transition"
                      >
                        <span>View in ARAL Monitoring</span>
                        <ArrowUpRight size={13} />
                      </button>
                    ) : null}
                  </div>

                  {/* Inside ARAL Monitoring status preview */}
                  <div className="mt-3 grid grid-cols-3 gap-3 text-xs bg-white rounded-md border border-blue-100 p-2.5">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Phil-IRI
                      </span>
                      <span className="mt-0.5 font-semibold text-slate-900 block">
                        {hasGstScore ? "Status: Completed" : "Status: Pending"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Reading Level
                      </span>
                      <span className="mt-0.5 font-bold text-amber-800 block">
                        {readingLevelDisplay}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        Intervention Status
                      </span>
                      <span className="mt-0.5 font-semibold text-blue-800 block">
                        {!hasGstScore ? "Awaiting Phil-IRI" : (learner.aralApprovalStatus || learner.aralStatus || "Needs Review")}
                      </span>
                    </div>
                  </div>

                  <p className="mt-2 text-[10.5px] text-slate-500">
                    Academic performance is supporting evidence. Official reading placement is governed by Phil-IRI assessment and authorized facilitator review.
                  </p>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>

{/* FOOTER — primary actions live here. The X icon is the only close
    control for reading-subject review; non-reading keeps Close Record. */}
        {!isAralContext ? (
          <div className="border-t border-slate-200 bg-slate-50/80 px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <span className="text-[11px] font-medium text-slate-500">
              CNHS Learn · Learner Academic & Intervention Record
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleContinueMonitoring}
                disabled={continuingMonitoring}
                className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3.5 text-[12px] font-semibold text-slate-600 shadow-xs transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {continuingMonitoring ? "Continuing…" : "Continue Monitoring"}
              </button>
              {isReadingPath ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleUpdateRemedialStatus("Active", reviewNote.trim())}
                    disabled={updatingRemedial}
                    className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-emerald-600 px-3.5 text-[12px] font-semibold text-white shadow-xs transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Start Class Remedial
                  </button>
                  {(aralReferralApproved || learner.inAralProgram) && (
                    <span className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-[12px] font-semibold text-emerald-800">
                      {aralReferralApproved ? "ARAL Referral Approved" : "Under Reading Intervention"}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleUpdateRemedialStatus(
                      remedialStatus === "Recommended" ? "Active" : remedialStatus,
                      reviewNote.trim()
                    )}
                    disabled={updatingRemedial}
                    className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-emerald-600 px-3.5 text-[12px] font-semibold text-white shadow-xs transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {remedialStatus === "Recommended" ? "Start Class Remedial" : "Continue Class Remedial"}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-100 transition cursor-pointer"
                  >
                    Close Record
                  </button>
                </>
              )}
            </div>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
