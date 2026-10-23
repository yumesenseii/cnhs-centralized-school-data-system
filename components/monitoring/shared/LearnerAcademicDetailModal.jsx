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
  Sparkles,
  ChevronDown,
  ChevronUp,
  BookOpen,
  GraduationCap,
  Clock,
  Brain,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import AppSelect from "@/components/shared/AppSelect";
import { RiskPill } from "@/components/teacher/monitoring/shared";
import { useAppToast } from "@/components/shared/AppToast";
import PlpDocumentModal from "@/components/monitoring/plp/PlpDocumentModal";
import { termLabel } from "@/lib/academic/termLabels";
import { READING_CONCERN_OPTIONS } from "@/lib/monitoring/readingReviewSummary";
import {
  createMonitoringRecord,
  routeReadingConcernToLanguageTeacher,
} from "@/lib/supabase/queries/monitoring";
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
import { evaluateAcademicAndReadingGuidance } from "@/lib/monitoring/academicAndReadingGuidance";

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

  // Non-language teacher: Flag Reading Concern state
  const [showFlagReadingConcern, setShowFlagReadingConcern] = useState(false);
  const [flaggedLanguage, setFlaggedLanguage] = useState("English");
  const [flaggedConcern, setFlaggedConcern] = useState("Reading Comprehension");
  const [flaggedNote, setFlaggedNote] = useState("");
  const [routingConcern, setRoutingConcern] = useState(false);
  const [showPlpModal, setShowPlpModal] = useState(false);

  // Expandable secondary details state
  const [expandedSections, setExpandedSections] = useState({
    gradeHistory: false,
    readingDetails: false,
    recentActivity: false,
    advancedMl: false,
  });

  const [trendData, setTrendData] = useState(null);
  const [loadingTrend, setLoadingTrend] = useState(false);

  function toggleSection(key) {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

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

  // Overall academic risk must strictly be derived from the authoritative complete per-term GWA,
  // NEVER from an individual subject grade.
  const authoritativeGwa = parseRecordedGrade(
    activeLearner.authoritativeGwa ??
      activeLearner.finalGwa ??
      (activeLearner.evaluationStatus === "complete" ? activeLearner.generalAverage : null)
  );

  const academicRisk = deriveAcademicRisk(monitoredLearner, authoritativeGwa);
  const progressInfo = deriveAcademicProgress(curGrade, prevGrade);
  const currentSupport = deriveCurrentSupport(monitoredLearner);

  const rfData = useMemo(() => {
    if (activeLearner?.rfAnalysis) {
      if (
        activeLearner.rfAnalysis.status === "available" &&
        activeLearner.rfAnalysis.predictedRisk &&
        activeLearner.rfAnalysis.predictedRisk !== "—" &&
        activeLearner.rfAnalysis.source !== "rule-based-fallback"
      ) {
        return activeLearner.rfAnalysis;
      }
      if (activeLearner.rfAnalysis.status === "pending_evidence") {
        return activeLearner.rfAnalysis;
      }
    }
    return {
      status: "unavailable",
      predictedRisk: "—",
      confidence: null,
      probabilities: null,
      source: "pattern-analysis-experimental",
      modelDescription: "Pattern Analysis (Same-Term Model / Experimental)",
      disclaimer:
        "Random Forest provides experimental same-term pattern analysis for decision support and does not represent a validated next-term forecast or supersede official DepEd assessment rules.",
      message:
        "Random Forest ML prediction service is currently unavailable. Academic monitoring is operating on authoritative rule-based evaluation.",
    };
  }, [activeLearner]);

  // Lazy fetch per-subject trend forecast only when Advanced ML is expanded
  useEffect(() => {
    if (!expandedSections.advancedMl || !activeLearner) return;

    const studentId = activeLearner.studentId || activeLearner.id;
    const subject = studentSubject;
    const term = Number(currentQuarterNumber) || 1;

    if (!studentId || !subject || subject === "—") {
      setTrendData({
        status: "unavailable",
        message: "No specific subject assigned for trend forecasting.",
      });
      return;
    }

    if (term !== 1 && term !== 2) {
      setTrendData({
        status: "unavailable",
        currentTerm: term,
        targetTerm: null,
        predictedTrend: "—",
        message: `Trend forecasting is restricted to Term 1 → Term 2 and Term 2 → Term 3 transitions (current: ${termLabel(term)}).`,
      });
      return;
    }

    let isSubscribed = true;
    setLoadingTrend(true);

    fetch("/api/recommendations/predict_subject_trend", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        learnerId: studentId,
        subject,
        currentTerm: term,
        // The server validates this request against the learner's authorized
        // academic context; it is never trusted as-is.
        schoolYear: activeLearner?.schoolYear || schoolYear,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!isSubscribed) return;
        setTrendData(data);
      })
      .catch((err) => {
        if (!isSubscribed) return;
        setTrendData({
          status: "unavailable",
          message: err?.message || "Failed to contact forecast service.",
        });
      })
      .finally(() => {
        if (isSubscribed) setLoadingTrend(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [expandedSections.advancedMl, activeLearner, studentSubject, currentQuarterNumber, schoolYear]);

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

  const readingGstScore =
    activeLearner.philIriScore != null ? activeLearner.philIriScore : null;
  const readingLevelValue = activeLearner.readingLevel || null;
  const hasReadingFlag = Boolean(
    activeLearner.teacherRemarks?.includes("Flagged Reading Concern") ||
    activeLearner.interventionGiven === "Flagged Reading Concern" ||
    activeLearner.intervention_given === "Flagged Reading Concern"
  );

  const guidanceInfo = useMemo(() => {
    return evaluateAcademicAndReadingGuidance({
      grade: curGrade,
      gstScore: readingGstScore,
      readingLevel: readingLevelValue,
      hasFlaggedConcern: hasReadingFlag,
    });
  }, [curGrade, readingGstScore, readingLevelValue, hasReadingFlag]);

  const readingLang =
    activeLearner.readingLanguage ||
    (String(studentSubject).toLowerCase().includes("fil") ? "Filipino" : "English");

  const readingGstDisplay =
    readingGstScore !== null && readingGstScore !== undefined
      ? `${readingGstScore} / 40 (${Number(readingGstScore) >= 28 ? "At Grade Level" : "Needs Individual Assessment"})`
      : "Not yet recorded";

  const readingIraStatus = useMemo(() => {
    if (readingGstScore !== null && Number(readingGstScore) >= 28) {
      return "Not Needed (Met GST Benchmark)";
    }
    if (
      readingLevelValue &&
      readingLevelValue !== "Not Screened" &&
      readingLevelValue !== "Not Assessed" &&
      readingLevelValue !== "Not Set"
    ) {
      return "Completed";
    }
    if (readingGstScore !== null) {
      return "Pending Assessment";
    }
    return "Not yet assessed";
  }, [readingGstScore, readingLevelValue]);

  const readingProfileValue =
    readingLevelValue &&
    readingLevelValue !== "Not Screened" &&
    readingLevelValue !== "Not Assessed" &&
    readingLevelValue !== "Not Set"
      ? readingLevelValue
      : readingGstScore !== null && Number(readingGstScore) >= 28
      ? "At Grade Level"
      : "Not yet recorded";

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

  // Main concern headline for 5-second teacher clarity
  const mainConcernHeadline = useMemo(() => {
    if (curGrade !== null && curGrade < 75) {
      return `Needs Academic Support: Grade below passing in ${studentSubject}`;
    }
    if (academicRisk === "High Risk" || academicRisk === "Moderate Risk") {
      return `Academic attention recommended for ${studentSubject}`;
    }
    if (activeLearner?.isProvisional || academicRisk === "Pending Academic Risk") {
      return "Pending full-term evaluation";
    }
    return "Learner performing within grade expectations";
  }, [curGrade, studentSubject, academicRisk, activeLearner?.isProvisional]);

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

  async function handleRouteReadingConcern() {
    if (routingConcern) return;
    const studentId = activeLearner.studentId || activeLearner.id;
    const sectionId =
      activeLearner.sectionId ||
      activeLearner.section_id ||
      activeLearner.classes?.section_id;

    if (!studentId || !sectionId) {
      showToast("error", "Missing student or section information.");
      return;
    }

    setRoutingConcern(true);
    try {
      const res = await routeReadingConcernToLanguageTeacher({
        studentId,
        studentName: studentFullName,
        sectionId,
        gradeSection: studentSection,
        language: flaggedLanguage,
        concernCategory: flaggedConcern,
        teacherRemarks: flaggedNote,
        referringTeacherId: teacherId,
        referringTeacherName: activeLearner.teacherName || "Subject Teacher",
        schoolYear,
        quarter: currentQuarterNumber,
      });

      if (res.error) {
        if (res.missingTeacher) {
          showToast(
            "error",
            `Reading assessment teacher not found for ${flaggedLanguage} in ${studentSection}. Case flagged for admin review.`
          );
        } else {
          showToast("error", res.error.message || "Failed to route reading concern.");
        }
        return;
      }

      showToast(
        "success",
        `Reading concern routed to ${res.data.languageTeacherName} (${res.data.language} Teacher).`
      );
      setShowFlagReadingConcern(false);
      setFlaggedNote("");
      onRefresh?.();
      onClose?.();
    } catch (err) {
      console.error(err);
      showToast("error", "An unexpected error occurred while routing concern.");
    } finally {
      setRoutingConcern(false);
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
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs dark:border-blue-900/30 dark:bg-blue-950/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-blue-900/70 dark:text-blue-300">
                  Current Remedial Status
                </span>
                <span className="mt-0.5 block font-bold text-blue-950 dark:text-blue-100">
                  Active Support {activeStartedDate ? `· Started ${activeStartedDate}` : ""}
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-blue-900/70 dark:text-blue-300">
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
              Update Learner Support:
            </span>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAddProgressNote}
                disabled={updatingRemedial}
                className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              >
                {updatingRemedial ? <Loader2 size={13} className="animate-spin" /> : null}
                <span>Add Progress Note</span>
              </button>
              <button
                type="button"
                onClick={handleCompleteRemedial}
                disabled={updatingRemedial}
                className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-cnhs-green-dark px-3.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#1b5842] disabled:opacity-50"
              >
                {updatingRemedial ? <Loader2 size={13} className="animate-spin" /> : null}
                <span>Mark Support Completed</span>
              </button>
            </div>
          </div>

          <label className="block pt-1">
            <span className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Observation / Progress Note (Optional)
            </span>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={2}
              placeholder="Record observation notes or next remedial milestones..."
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-cnhs-green dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
          </label>
        </div>
      );
    }

    if (isClassRemedialCompleted) {
      return (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-white/10 dark:bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
              <span className="font-bold text-slate-900 dark:text-slate-100">
                Classroom Remedial Completed
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Learner has completed classroom remedial support and continues under regular observation.
            </p>
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Next Step:
            </span>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleContinueMonitoring}
                disabled={updatingRemedial}
                className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              >
                {updatingRemedial ? <Loader2 size={13} className="animate-spin" /> : null}
                <span>Continue Monitoring</span>
              </button>
            </div>
          </div>

          <label className="block pt-1">
            <span className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Observation Note (Optional)
            </span>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={2}
              placeholder="Enter a short observation note..."
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-cnhs-green dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
          </label>
        </div>
      );
    }

    // Default / Initial State: Not started
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-xs dark:bg-white/[0.02]">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Recommended Support
            </span>
            <span className="mt-0.5 block text-xs font-bold text-slate-900 dark:text-slate-100">
              {recommendedSupportText}
            </span>
          </div>
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-2 py-0.5 text-[10.5px] font-semibold",
              guidanceInfo.badgeStyle
            )}
          >
            {guidanceInfo.label}
          </span>
        </div>

        <div>
          <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            Select Teacher Action:
          </span>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleStartRemedial}
              disabled={updatingRemedial || routingConcern}
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-cnhs-green-dark px-3.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#1b5842] disabled:opacity-50"
            >
              {updatingRemedial ? <Loader2 size={13} className="animate-spin" /> : null}
              <span>Start Class Remedial</span>
            </button>
            <button
              type="button"
              onClick={handleContinueMonitoring}
              disabled={updatingRemedial || routingConcern}
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
            >
              {updatingRemedial ? <Loader2 size={13} className="animate-spin" /> : null}
              <span>Continue Monitoring</span>
            </button>
            <button
              type="button"
              onClick={() => setShowFlagReadingConcern((prev) => !prev)}
              disabled={updatingRemedial || routingConcern}
              className={cn(
                "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold transition shadow-2xs",
                showFlagReadingConcern
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              )}
            >
              <span>Flag Reading Concern</span>
            </button>
          </div>
        </div>

        {showFlagReadingConcern ? (
          <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-xs dark:border-blue-900/50 dark:bg-blue-950/20">
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                Flag Reading Concern &amp; Route to Language Teacher
              </span>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                Non-language teachers do not administer the Phil-IRI Screening Test (GST) directly. This action routes your reading observation to the learner’s English or Filipino Subject Teacher.
              </p>
            </div>

            <div>
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Target Language
              </span>
              <div className="flex items-center gap-2">
                {["English", "Filipino"].map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setFlaggedLanguage(lang)}
                    className={cn(
                      "inline-flex h-8 cursor-pointer items-center rounded-lg px-3 text-xs font-semibold transition border",
                      flaggedLanguage === lang
                        ? "border-[#246f54] bg-[#246f54] text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                    )}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Main Reading Concern Focus
              </span>
              <AppSelect
                label="Reading Concern Focus"
                value={flaggedConcern}
                onChange={setFlaggedConcern}
                options={READING_CONCERN_OPTIONS.map((c) => ({
                  value: c,
                  label: c,
                }))}
                triggerClassName="h-9 text-xs bg-white dark:bg-slate-900"
              />
            </div>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                Teacher Observation Note
              </span>
              <textarea
                value={flaggedNote}
                onChange={(e) => setFlaggedNote(e.target.value)}
                rows={2}
                placeholder={`Describe reading difficulties observed in ${studentSubject || "class"} (e.g., struggles to comprehend word problems)...`}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-cnhs-green dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
              />
            </label>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowFlagReadingConcern(false)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRouteReadingConcern}
                disabled={routingConcern}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-blue-700 disabled:opacity-50"
              >
                {routingConcern ? <Loader2 size={12} className="animate-spin" /> : null}
                <span>Route to {flaggedLanguage} Subject Teacher</span>
              </button>
            </div>
          </div>
        ) : (
          <label className="block pt-1">
            <span className="mb-1 block text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Observation / Progress Note (Optional)
            </span>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={2}
              placeholder="Enter a short observation note..."
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-cnhs-green dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            />
          </label>
        )}
      </div>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-[1px] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="learner-academic-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="relative z-10 flex max-h-[88vh] w-[min(780px,96vw)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[var(--card)]">
        {/* 1. SIMPLE LEARNER HEADER */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4 dark:border-white/5 dark:bg-transparent sm:px-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2
                id="learner-academic-detail-title"
                className="truncate text-lg font-bold tracking-tight text-slate-900 dark:text-white sm:text-xl"
              >
                {studentFullName}
              </h2>
              {/* Single primary authoritative attention status */}
              <RiskPill value={academicRisk} />
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-200">{studentSection}</span>
              {" · "}
              <span>Subject: <strong className="text-slate-800 dark:text-slate-100">{studentSubject}</strong></span>
              {studentLrn && studentLrn !== "—" ? ` · LRN: ${studentLrn}` : ""}
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
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/50 p-5 dark:bg-black/10 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin text-cnhs-green-dark" />
              Loading academic details…
            </div>
          ) : (
            <>
              {/* 1. LEARNER SUMMARY */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/5 dark:bg-[var(--card)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-white/5">
                  <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200 text-xs">
                    <GraduationCap size={15} className="text-cnhs-green-dark" />
                    <span>Learner Summary</span>
                    <span className="text-[11px] font-normal text-slate-500">
                      ({termLabel(currentQuarterNumber)})
                    </span>
                  </div>
                  <RiskPill value={academicRisk} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-slate-50/70 p-2.5 dark:bg-white/[0.02]">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Learner
                    </span>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {studentFullName}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      {studentSection}
                      {studentLrn && studentLrn !== "—" ? ` · LRN: ${studentLrn}` : ""}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50/70 p-2.5 dark:bg-white/[0.02]">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Current Term Performance · {studentSubject}
                    </span>
                    <div className="mt-1 flex flex-wrap items-center gap-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400">Grade</span>
                          {curGrade !== null && curGrade < 75 ? (
                            <span className="inline-flex items-center rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                              Needs Academic Support
                            </span>
                          ) : null}
                        </div>
                        <div
                          className={cn(
                            "text-base font-bold",
                            curGrade !== null && curGrade < 75
                              ? "text-amber-800 dark:text-amber-400"
                              : "text-slate-900 dark:text-slate-100"
                          )}
                        >
                          {curGrade !== null ? `${curGrade} / 100` : "—"}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Trend</span>
                        <div className={cn("inline-flex items-center gap-1 font-semibold text-xs", progressExplanation.progressStyle)}>
                          {progressInfo.progress === "Improving" ? (
                            <TrendingUp size={12} className="text-emerald-600" />
                          ) : progressInfo.progress === "Declining" ? (
                            <TrendingDown size={12} className="text-amber-700" />
                          ) : progressInfo.progress === "No clear change" ? (
                            <Minus size={12} className="text-slate-400" />
                          ) : null}
                          <span>{progressExplanation.progressDisplay}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400">Support</span>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {currentSupport.label}
                        </div>
                      </div>
                    </div>
                    {(prevGrade !== null || progressInfo.hasPreviousGrade) ? (
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Previous: {progressExplanation.previousDisplay}
                        {historicalLabel ? ` (${historicalLabel})` : ""}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* 2. ACADEMIC CONCERN */}
              <div
                className={cn(
                  "rounded-2xl border p-4 shadow-2xs transition",
                  curGrade !== null && curGrade < 75
                    ? "border-amber-200/90 bg-amber-50/60 dark:border-amber-900/30 dark:bg-amber-950/20"
                    : "border-slate-200/80 bg-white dark:border-white/5 dark:bg-[var(--card)]"
                )}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                      curGrade !== null && curGrade < 75
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
                        : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300"
                    )}
                  >
                    <Info size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900 dark:text-white">
                      Academic Concern
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {mainConcernHeadline}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                      {attentionReason}
                    </p>
                    {guidanceInfo.sentence ? (
                      <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {guidanceInfo.sentence}
                      </p>
                    ) : null}
                    <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      Official GWA/term risk is based on school rules; individual subject weaknesses are noted separately.
                    </p>
                  </div>
                </div>
              </div>

              {/* 3. RECOMMENDED NEXT STEP */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/5 dark:bg-[var(--card)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-white/5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cnhs-green-dark">
                    Recommended Next Step
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isPrincipal ? "For review (read-only)" : "Teacher Action"}
                  </span>
                </div>

                {isTeacher ? (
                  <div className="space-y-3">
                    {referralState.hasActiveReferral ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2 text-xs font-semibold text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-300">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="text-amber-600 shrink-0" />
                          <span>
                            ARAL Reading Program: {referralState.isApproved ? "Approved for Assessment" : "Referral Pending Review"}
                          </span>
                        </div>
                        {onNavigateToAral ? (
                          <button
                            type="button"
                            onClick={() => onNavigateToAral?.(activeLearner)}
                            className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-cnhs-green-dark hover:underline"
                          >
                            <span>Open in ARAL Reading Assessment</span>
                            <ArrowUpRight size={12} />
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {renderClassRemedialActions()}
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/[0.02]">
                      <span className="text-slate-500">Current academic support</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {currentSupport.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Recommendations are teacher-reviewed drafts. This view is for principal review only.
                    </p>
                    {activeLearner.teacherRemarks ? (
                      <div className="rounded-xl bg-slate-50 px-3 py-2 text-slate-600 dark:bg-white/[0.02] dark:text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Teacher note:</span> {activeLearner.teacherRemarks}
                      </div>
                    ) : null}
                    {referralState.isLanguageSubject && referralState.hasActiveReferral ? (
                      <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
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
                            <span>View in ARAL Reading Assessment</span>
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
                            <span>View in ARAL Reading Assessment</span>
                            <ArrowUpRight size={12} />
                          </Link>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* 4. LEARNING PLAN */}
              <div className="rounded-2xl border border-emerald-200/80 bg-white p-4 shadow-2xs dark:border-emerald-900/30 dark:bg-[var(--card)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100/70 pb-2.5 dark:border-emerald-900/30">
                  <div className="flex items-center gap-2">
                    <Sparkles size={15} className="text-emerald-700 dark:text-emerald-300" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
                      Learning Plan
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Teacher-reviewed draft · {isPrincipal ? "For review" : "Editable by teacher"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    View the simplified PLP with reason for support, learning goal, suggested activities, progress monitoring, and notes.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowPlpModal(true)}
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-emerald-800"
                  >
                    <Sparkles size={12} />
                    <span>View Learning Plan</span>
                  </button>
                </div>
              </div>

              {/* OPTIONAL COLLAPSED DETAILS */}
              <div className="space-y-2 pt-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Optional Details
                </div>

                {/* ACCORDION A: GRADE & PROGRESS HISTORY */}
                <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/5 dark:bg-[var(--card)]">
                  <button
                    type="button"
                    onClick={() => toggleSection("gradeHistory")}
                    className="flex w-full cursor-pointer items-center justify-between p-3.5 text-left text-xs font-semibold text-slate-800 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-2">
                      <GraduationCap size={15} className="text-slate-500" />
                      <span>Grade &amp; Progress History</span>
                      <span className="text-[10.5px] font-normal text-slate-400">
                        ({progressExplanation.progressDisplay})
                      </span>
                    </div>
                    {expandedSections.gradeHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {expandedSections.gradeHistory ? (
                    <div className="border-t border-slate-100 p-4 text-xs dark:border-white/5 space-y-3">
                      <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 dark:bg-white/[0.02]">
                        <div>
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Previous Grade
                          </span>
                          <span className="mt-1 block font-mono text-sm font-bold text-slate-800 dark:text-slate-200">
                            {progressExplanation.previousDisplay}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Current Grade
                          </span>
                          <span className="mt-1 block font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                            {progressExplanation.currentDisplay}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Progress Trend
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

                      <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {progressExplanation.sentence} {historicalLabel ? `Comparison based on ${historicalLabel}.` : ""}
                      </p>

                      {subjectGradesList.length > 0 ? (
                        <div className="pt-2 border-t border-slate-100 dark:border-white/5">
                          <span className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                            Quarterly Subject Breakdown
                          </span>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {subjectGradesList.map((sg, idx) => (
                              <div
                                key={idx}
                                className="rounded-lg border border-slate-100 bg-slate-50/50 p-2 dark:border-white/5 dark:bg-white/[0.02]"
                              >
                                <span className="block truncate text-[10px] text-slate-500">{sg.subject || sg.subjectName}</span>
                                <span className="block font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                                  {sg.grade ?? sg.quarterGrade ?? "—"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>



                {/* ACCORDION C: SUPPORT & OBSERVATION LOGS */}
                {activityRecords.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/5 dark:bg-[var(--card)]">
                    <button
                      type="button"
                      onClick={() => toggleSection("recentActivity")}
                      className="flex w-full cursor-pointer items-center justify-between p-3.5 text-left text-xs font-semibold text-slate-800 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/[0.02]"
                    >
                      <div className="flex items-center gap-2">
                        <Clock size={15} className="text-slate-500" />
                        <span>Support Activity &amp; Observation History</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                          {activityRecords.length}
                        </span>
                      </div>
                      {expandedSections.recentActivity ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {expandedSections.recentActivity ? (
                      <div className="border-t border-slate-100 p-4 text-xs dark:border-white/5">
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
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
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {/* ACCORDION D: NEXT-TERM SUBJECT TREND FORECAST (SELECTED) */}
                <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white dark:border-white/5 dark:bg-[var(--card)]">
                  <button
                    type="button"
                    onClick={() => toggleSection("advancedMl")}
                    className="flex w-full cursor-pointer items-center justify-between p-3.5 text-left text-xs font-semibold text-slate-800 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-2">
                      <TrendingUp size={15} className="text-slate-500" />
                      <span>Next-term subject trend forecast (selected)</span>
                      <span className="text-[10.5px] font-normal text-slate-400">Optional</span>
                    </div>
                    {expandedSections.advancedMl ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {expandedSections.advancedMl ? (
                    <div className="border-t border-slate-100 p-4 text-xs dark:border-white/5 space-y-2">
                      {loadingTrend ? (
                        <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-xs text-slate-500 dark:border-white/5 dark:bg-white/[0.02]">
                          <Loader2 size={13} className="animate-spin text-cnhs-green-dark" />
                          <span>Checking forecast for {studentSubject}...</span>
                        </div>
                      ) : trendData?.status === "available" && trendData.predictedTrend && trendData.predictedTrend !== "—" ? (
                        <div className="rounded-lg border border-slate-100 bg-white p-3 text-xs dark:border-white/5 dark:bg-white/[0.02] space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                              {studentSubject} · Term {trendData.currentTerm} → Term {trendData.targetTerm}
                            </span>
                            <span
                              className={cn(
                                "rounded-md px-2 py-0.5 text-xs font-semibold",
                                trendData.predictedTrend === "Improving"
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : trendData.predictedTrend === "Declining"
                                  ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              )}
                            >
                              {trendData.predictedTrend}
                            </span>
                          </div>
                          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                            Advisory only. Does not affect official academic risk or intervention placement.
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-xs dark:border-white/5 dark:bg-white/[0.02] space-y-1">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-400">
                            <Info size={13} className="text-slate-400" />
                            <span>Forecast not available for the selected term/subject</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            {trendData?.message || "A valid next-term trend forecast is not available with the current records for this learner, subject, and term."}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex shrink-0 items-center justify-end border-t border-slate-100 bg-white px-5 py-3 dark:border-white/5 dark:bg-transparent sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>

      {showPlpModal ? (
        <PlpDocumentModal
          isOpen={showPlpModal}
          onClose={() => setShowPlpModal(false)}
          learner={{
            studentId: targetStudentId,
            studentName: studentFullName,
            gradeLevel: activeLearner?.gradeLevel || activeLearner?.grade || 7,
            sectionLabel: studentSection,
          }}
          academicContext={{
            classId: targetClassId || "class-preview",
            teacherId: targetTeacherId,
            evidencePeriod: activeLearner?.quarterNumber ?? currentQuarterNumber,
            // legacy fallback keys for compatibility
            term: activeLearner?.quarterNumber ?? currentQuarterNumber,
            academicTerm: activeLearner?.quarterNumber ?? currentQuarterNumber,
            targetTerm: null, // target term is independent from evidence period
            subjectName: studentSubject,
            subjectGrade: curGrade,
            overallRisk: academicRisk,
            gwa: activeLearner?.gwa || null,
            failingSubjects:
              curGrade !== null && curGrade < 75
                ? [{ subjectName: studentSubject, grade: curGrade }]
                : [],
            isProvisional: activeLearner?.isProvisional || false,
          }}
          readingContext={null}
          schoolYear={activeLearner?.schoolYear || schoolYear}
        />
      ) : null}
    </>
  );
}
