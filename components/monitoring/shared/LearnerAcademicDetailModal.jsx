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

  // Fetch per-subject trend forecast whenever the modal is open
  useEffect(() => {
    if (!isOpen || !activeLearner) return;

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

    // Term 3 is the last term of the school year: there is no next term to
    // forecast. Show the validated Term 2 -> Term 3 forecast as a retrospective
    // check against the actual Term 3 grade. Terms beyond 3 stay unavailable.
    const isRetrospective = term === 3;
    if (term !== 1 && term !== 2 && !isRetrospective) {
      setTrendData({
        status: "unavailable",
        currentTerm: term,
        targetTerm: null,
        predictedTrend: "—",
        message: `Trend forecasting is restricted to Term 1 → Term 2 and Term 2 → Term 3 transitions (current: ${termLabel(term)}).`,
      });
      return;
    }
    const sourceTerm = isRetrospective ? 2 : term;

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
        currentTerm: sourceTerm,
        schoolYear: activeLearner?.schoolYear || schoolYear,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!isSubscribed) return;
        setTrendData(isRetrospective ? { ...data, retrospective: true } : data);
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
  }, [isOpen, activeLearner, studentSubject, currentQuarterNumber, schoolYear]);

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
        {/* MODAL HEADER: LEARNER INFORMATION */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4 dark:border-white/5 dark:bg-transparent sm:px-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cnhs-green-dark">
                Learner Academic Profile
              </span>
              <span className="text-[11px] font-medium text-slate-400">
                · {termLabel(currentQuarterNumber)}
              </span>
            </div>
            <h2
              id="learner-academic-detail-title"
              className="mt-0.5 truncate text-lg font-bold tracking-tight text-slate-900 dark:text-white sm:text-xl"
            >
              {studentFullName}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-200">{studentSection}</span>
              <span>·</span>
              <span>Class Subject: <strong className="text-slate-800 dark:text-slate-100">{studentSubject}</strong></span>
              {studentLrn && studentLrn !== "—" ? (
                <>
                  <span>·</span>
                  <span>LRN: {studentLrn}</span>
                </>
              ) : null}
              {studentAdviser && studentAdviser !== "—" ? (
                <>
                  <span>·</span>
                  <span>Adviser: {studentAdviser}</span>
                </>
              ) : null}
            </div>
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

        {/* MODAL BODY: 6-LEVEL STREAMLINED HIERARCHY */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/50 p-5 dark:bg-black/10 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin text-cnhs-green-dark" />
              Loading academic details…
            </div>
          ) : (
            <>
              {/* 1. LEARNER INFORMATION CARD */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/5 dark:bg-[var(--card)]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <GraduationCap size={15} className="text-cnhs-green-dark shrink-0" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      1. Learner Information
                    </h3>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {activeLearner.schoolYear || schoolYear} · {termLabel(currentQuarterNumber)}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-white/[0.02]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Learner Name
                    </span>
                    <span className="mt-0.5 block font-bold text-slate-900 dark:text-slate-100 truncate">
                      {studentFullName}
                    </span>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-white/[0.02]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Grade &amp; Section
                    </span>
                    <span className="mt-0.5 block font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {studentSection}
                    </span>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-white/[0.02]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Class Subject
                    </span>
                    <span className="mt-0.5 block font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {studentSubject}
                    </span>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-white/[0.02]">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      LRN
                    </span>
                    <span className="mt-0.5 block font-mono text-slate-800 dark:text-slate-200 truncate">
                      {studentLrn && studentLrn !== "—" ? studentLrn : "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. ACADEMIC PERFORMANCE & RISK (PROMINENT GWA & RISK BADGE) */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/5 dark:bg-[var(--card)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <BookOpen size={15} className="text-cnhs-green-dark shrink-0" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      2. Academic Performance &amp; Risk
                    </h3>
                  </div>
                  {/* Single prominent authoritative Risk Badge */}
                  <RiskPill value={academicRisk} />
                </div>

                <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                  {/* Complete Per-Term GWA Card */}
                  <div className="flex flex-col justify-between rounded-lg border border-slate-100 bg-slate-50/70 p-3.5 dark:border-white/5 dark:bg-white/[0.02]">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Per-Term GWA ({termLabel(currentQuarterNumber)})
                        </span>
                        <span className="text-[10.5px] font-semibold text-slate-500">
                          {authoritativeGwa !== null ? "Published Complete" : "Pending ECR"}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-baseline gap-2">
                        <span className="font-mono text-2xl font-black text-slate-900 dark:text-slate-100">
                          {authoritativeGwa !== null ? authoritativeGwa.toFixed(2) : "—"}
                        </span>
                        {authoritativeGwa !== null ? (
                          <span className="text-xs font-medium text-slate-400">/ 100</span>
                        ) : (
                          <span className="text-xs font-semibold text-slate-500">
                            Awaiting full-term publication
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                      {authoritativeGwa !== null
                        ? `Official per-term General Weighted Average evaluated across all required core subjects. Maps to ${academicRisk}.`
                        : "Academic evaluation is provisional. Full-term GWA and overall academic risk remain pending until grades are published for all required learning areas."}
                    </p>
                  </div>

                  {/* Current Subject Grade & Actual Term-over-Term Progress */}
                  <div className="flex flex-col justify-between rounded-lg border border-slate-100 bg-slate-50/70 p-3.5 dark:border-white/5 dark:bg-white/[0.02]">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          {studentSubject} Grade
                        </span>
                        {curGrade !== null && curGrade < 75 ? (
                          <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            Needs Academic Support
                          </span>
                        ) : curGrade !== null ? (
                          <span className="inline-flex items-center rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                            Passing (≥ 75)
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1.5 flex items-baseline gap-2">
                        <span
                          className={cn(
                            "font-mono text-2xl font-black",
                            curGrade !== null && curGrade < 75
                              ? "text-amber-700 dark:text-amber-400"
                              : "text-slate-900 dark:text-slate-100"
                          )}
                        >
                          {curGrade !== null ? curGrade : "—"}
                        </span>
                        {curGrade !== null ? (
                          <span className="text-xs font-medium text-slate-400">/ 100</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-2 border-t border-slate-200/60 pt-2 text-[11px] dark:border-white/5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Actual Grade Progress:</span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 font-semibold",
                            progressExplanation.progressStyle
                          )}
                        >
                          {progressInfo.progress === "Improving" ? (
                            <TrendingUp size={12} className="text-emerald-600" />
                          ) : null}
                          {progressInfo.progress === "Declining" ? (
                            <TrendingDown size={12} className="text-amber-700" />
                          ) : null}
                          {progressInfo.progress === "No clear change" ? (
                            <Minus size={12} className="text-slate-400" />
                          ) : null}
                          <span>{progressExplanation.progressDisplay}</span>
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10.5px] text-slate-400">
                        {progressExplanation.sentence} {historicalLabel ? `(${historicalLabel})` : ""}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. ACADEMIC CONCERN (SUBJECT FAILURE ISOLATED FROM OVERALL GWA) */}
              <div
                className={cn(
                  "rounded-xl border p-4 shadow-2xs transition",
                  curGrade !== null && curGrade < 75
                    ? "border-amber-200 bg-amber-50/60 dark:border-amber-900/30 dark:bg-amber-950/20"
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
                  <div className="min-w-0 flex-1 text-xs">
                    <h3 className="font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      3. Academic Concern
                    </h3>
                    <p className="mt-1 font-semibold text-slate-800 dark:text-slate-200">
                      {curGrade !== null && curGrade < 75
                        ? `Subject Concern: ${studentSubject} grade is below passing (${curGrade} / 75 passing threshold)`
                        : "Learner is performing at or above passing standards in evaluated class subject"}
                    </p>
                    <p className="mt-1 leading-relaxed text-slate-600 dark:text-slate-300">
                      {attentionReason}
                    </p>
                    {activeLearner.weakSubjects?.length > 1 ? (
                      <p className="mt-1 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                        Additional subject(s) below 75: {activeLearner.weakSubjects.filter((s) => s !== studentSubject).join(", ")}
                      </p>
                    ) : null}
                    <div className="mt-2 rounded-lg bg-white/70 p-2 text-[11px] text-slate-500 dark:bg-black/20 dark:text-slate-400">
                      <strong className="text-slate-700 dark:text-slate-300">DepEd Rule Authority:</strong> Subject grades below 75 require subject-specific remediation, but are kept strictly separate from overall per-term GWA risk ({academicRisk}). Passing GWA is never overridden by an individual subject grade.
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. RECOMMENDED ACTION */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/5 dark:bg-[var(--card)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-white/5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cnhs-green-dark">
                    4. Recommended Action
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {isPrincipal ? "For review (read-only)" : "Authoritative Rule-Based Action"}
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
                      <span className="text-slate-500">Current Academic Support:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {currentSupport.label}
                      </span>
                    </div>
                    {activeLearner.teacherRemarks ? (
                      <div className="rounded-xl bg-slate-50 px-3 py-2 text-slate-600 dark:bg-white/[0.02] dark:text-slate-400">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Teacher note:</span> {activeLearner.teacherRemarks}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* 5. LEARNING PLAN (PLP) */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/5 dark:bg-[var(--card)] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <Sparkles size={15} className="text-cnhs-green-dark shrink-0" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-cnhs-green-dark">
                      5. Learning Plan
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Teacher-reviewed draft · Aligned with DepEd guidelines
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    View or update the personalized learning plan: structured support goals, targeted remedial activities, and progress indicators.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowPlpModal(true)}
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-xl bg-cnhs-green-dark px-3.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-[#1b5842]"
                  >
                    <Sparkles size={12} />
                    <span>View Learning Plan</span>
                  </button>
                </div>
              </div>

              {/* 6. GRADE HISTORY & RF FORECAST */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs dark:border-white/5 dark:bg-[var(--card)] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <GraduationCap size={15} className="text-slate-600 dark:text-slate-400 shrink-0" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      6. Grade History &amp; RF Forecast
                    </h3>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Actual Records &amp; Decision-Support Advisory
                  </span>
                </div>

                {/* Part A: Actual Grade History (Quarterly Subject Breakdown) */}
                <div>
                  <span className="mb-2 block text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                    Quarterly Subject Breakdown ({termLabel(currentQuarterNumber)})
                  </span>
                  {subjectGradesList.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {subjectGradesList.map((sg, idx) => {
                        const gradeVal = sg.grade ?? sg.quarterGrade ?? null;
                        const isBelowPassing = gradeVal !== null && gradeVal < 75;
                        return (
                          <div
                            key={idx}
                            className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 dark:border-white/5 dark:bg-white/[0.02]"
                          >
                            <span className="block truncate text-[10.5px] font-medium text-slate-500">
                              {sg.subject || sg.subjectName}
                            </span>
                            <div className="mt-1 flex items-baseline justify-between">
                              <span
                                className={cn(
                                  "font-mono text-sm font-bold",
                                  isBelowPassing
                                    ? "text-amber-700 dark:text-amber-400"
                                    : "text-slate-800 dark:text-slate-200"
                                )}
                              >
                                {gradeVal !== null ? gradeVal : "—"}
                              </span>
                              {gradeVal !== null ? (
                                <span
                                  className={cn(
                                    "text-[9.5px] font-semibold",
                                    isBelowPassing ? "text-amber-700" : "text-emerald-700"
                                  )}
                                >
                                  {isBelowPassing ? "Below 75" : "Passed"}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs italic text-slate-400">
                      No published subject breakdown recorded for this term yet.
                    </p>
                  )}
                </div>

                {/* Part B: Random Forest Subject Trend Forecast (Advisory) */}
                <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-white/5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-cnhs-green-dark" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Random Forest Trend Forecast · {studentSubject}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Experimental Advisory Only
                    </span>
                  </div>

                  {loadingTrend ? (
                    <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-xs text-slate-500 dark:border-white/5 dark:bg-white/[0.02]">
                      <Loader2 size={13} className="animate-spin text-cnhs-green-dark" />
                      <span>Evaluating next-term forecast for {studentSubject}...</span>
                    </div>
                  ) : trendData?.status === "available" ? (
                    <div className="space-y-3 rounded-xl border border-slate-200/80 bg-white p-3.5 text-xs shadow-2xs dark:border-white/5 dark:bg-white/[0.02]">
                      {/* Optional Provisional / Draft Banner */}
                      {trendData.provisional ? (
                        <div className="flex items-center gap-1.5 rounded-md border border-amber-200/80 bg-amber-50/80 px-2.5 py-1 text-[11px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300">
                          <Info size={12} className="shrink-0 text-amber-600 dark:text-amber-400" />
                          <span>
                            <strong>Provisional Advisory:</strong> Generated from current draft ECR records. Official publication pending by subject teacher.
                          </span>
                        </div>
                      ) : null}

                      {/* Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-white/5">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {trendData.retrospective
                            ? "Term 2 → Term 3 Retrospective Evaluation"
                            : `Term ${trendData.currentTerm} → Term ${trendData.targetTerm} Forecast`}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Random Forest Decision-Support
                        </span>
                      </div>

                      {/* 3-Metric Executive Grid: Current Grade | Estimated Next-Term Grade | Predicted Trend */}
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                        {/* 1. Current Grade */}
                        <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 dark:border-white/5 dark:bg-white/[0.02]">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Current Term {trendData.currentTerm}
                          </span>
                          <div className="mt-1 flex items-baseline justify-between">
                            <span className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100">
                              {trendData.currentGrade ?? curGrade ?? "—"}
                            </span>
                            <span
                              className={cn(
                                "text-[10px] font-semibold",
                                (trendData.currentGrade ?? curGrade ?? 75) < 75
                                  ? "text-amber-700 dark:text-amber-400"
                                  : "text-emerald-700 dark:text-emerald-400"
                              )}
                            >
                              {(trendData.currentGrade ?? curGrade ?? 75) < 75
                                ? "Below 75"
                                : "Passed"}
                            </span>
                          </div>
                        </div>

                        {/* 2. Estimated Next-Term Grade (Give Number) */}
                        <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-2.5 dark:border-emerald-950/40 dark:bg-emerald-950/20">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                              Estimated Term {trendData.targetTerm}
                            </span>
                            <span className="text-[9.5px] font-medium text-emerald-600 dark:text-emerald-400">
                              ±{trendData.typicalError || 3} pts
                            </span>
                          </div>
                          <div className="mt-1 flex items-baseline justify-between">
                            <span className="font-mono text-lg font-bold text-emerald-900 dark:text-emerald-100">
                              ≈ {trendData.estimatedGrade ?? "—"}
                            </span>
                            {trendData.estimatedDelta != null ? (
                              <span
                                className={cn(
                                  "font-mono text-[11px] font-semibold",
                                  trendData.estimatedDelta > 0
                                    ? "text-emerald-700 dark:text-emerald-300"
                                    : trendData.estimatedDelta < 0
                                    ? "text-amber-700 dark:text-amber-300"
                                    : "text-slate-500"
                                )}
                              >
                                {trendData.estimatedDelta > 0
                                  ? `+${trendData.estimatedDelta}`
                                  : trendData.estimatedDelta}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {/* 3. Predicted Trend */}
                        <div className="flex flex-col justify-between rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 dark:border-white/5 dark:bg-white/[0.02]">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Predicted Trend
                          </span>
                          <div className="mt-1 flex items-center justify-between">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold",
                                trendData.predictedTrend === "Improving"
                                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : trendData.predictedTrend === "Declining"
                                  ? "border border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                  : "border border-slate-200 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              )}
                            >
                              {trendData.predictedTrend === "Improving" ? <TrendingUp size={12} /> : null}
                              {trendData.predictedTrend === "Declining" ? <TrendingDown size={12} /> : null}
                              <span>{trendData.predictedTrend || "Steady"}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Advisory Disclaimer */}
                      <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                        {trendData.retrospective
                          ? "Term 3 is the final grading term of the school year. Showing verified Term 2 → Term 3 forecast for comparison against the actual Term 3 grade. "
                          : `Random Forest pattern analysis forecasts an ${String(
                              trendData.predictedTrend || "steady"
                            ).toLowerCase()} trajectory for ${studentSubject} in Term ${trendData.targetTerm} based on learning patterns. `}
                        Experimental advisory estimate only; does not replace official DepEd quarterly marks or report card records.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1 rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-xs dark:border-white/5 dark:bg-white/[0.02]">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-400">
                        <Info size={13} className="text-slate-400" />
                        <span>Forecast unavailable for current records</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                        {trendData?.message ||
                          "A next-term forecast requires at least one recorded grade for this subject in the current term."}
                      </p>
                    </div>
                  )}
                </div>

                {/* Optional Expandable Logs: Support Activity & Observation History */}
                {activityRecords.length > 0 ? (
                  <div className="border-t border-slate-100 pt-2 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => toggleSection("recentActivity")}
                      className="flex w-full cursor-pointer items-center justify-between py-1 text-left text-xs font-semibold text-slate-700 transition hover:text-slate-900 dark:text-slate-300"
                    >
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-slate-400" />
                        <span>Support Activity &amp; Observation History</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                          {activityRecords.length}
                        </span>
                      </div>
                      {expandedSections.recentActivity ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                    {expandedSections.recentActivity ? (
                      <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-xs dark:divide-white/5 dark:border-white/5 dark:bg-white/[0.02]">
                        {activityRecords.map((rec) => (
                          <div key={rec.id} className="py-2 first:pt-0 last:pb-0 text-xs">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {rec.interventionGiven || "Classroom Remediation"}
                              </span>
                              <span className="font-mono text-slate-400">
                                {rec.observationDate || rec.observation_date || rec.createdAt || "—"}
                              </span>
                            </div>
                            {rec.teacherRemarks || rec.teacher_remarks ? (
                              <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                                {rec.teacherRemarks || rec.teacher_remarks}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
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
