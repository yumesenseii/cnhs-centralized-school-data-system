/**
 * Authoritative aggregation, eligibility, and deduplication for ARAL Reading Assessment.
 *
 * Implements strict workflow safeguards:
 * 1. Eligibility: Roster comes from existing canonical class enrollments in English/Filipino classes.
 *    Non-language classes (Math, Science, AP, etc.) are excluded from language reading assessment ownership.
 * 2. Deduplication: One authoritative row per learner + language + school year.
 * 3. Step Derivation: Mutually exclusive, accurate current steps.
 */

import { isAralLanguageSubject } from "./aralAcademicStatus.js";
import { evaluateGstScore, formatGradeSection } from "./philIriEvaluation.js";

export const ARAL_STEP_DEFINITIONS = {
  absent_reschedule: {
    key: "absent_reschedule",
    label: "Absent / For Reschedule",
    badgeClass: "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-slate-800 dark:text-slate-300",
    actionLabel: "Reschedule Assessment",
    actionType: "start_screening",
    helperText: "Learner was absent during screening. Scheduled for reschedule.",
  },
  gst_under_review: {
    key: "gst_under_review",
    label: "GST Under Review",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
    actionLabel: "Review Result",
    actionType: "continue_assessment",
    helperText: "Screening score flagged for teacher review or observation.",
  },
  waiting_for_assessment: {
    key: "waiting_for_assessment",
    label: "Needs Screening Test",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
    actionLabel: "Start Assessment",
    actionType: "start_screening",
    helperText: "Initial reading screening test has not yet been recorded.",
  },
  needs_individual_assessment: {
    key: "needs_individual_assessment",
    label: "Needs Reading Assessment",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
    actionLabel: "Continue Assessment",
    actionType: "continue_assessment",
    helperText: "Screening indicates a more detailed reading assessment is needed.",
  },
  screening_complete_at_grade: {
    key: "screening_complete_at_grade",
    label: "Screening Complete — At Grade Level",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    actionLabel: "View Reading Record",
    actionType: "view_result",
    helperText: "GST score 28–40. At grade level; no individual reading assessment required.",
  },
  assessment_complete: {
    key: "assessment_complete",
    label: "Reading Assessment Complete",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    actionLabel: "View Reading Record",
    actionType: "view_result",
    helperText: "Individual Reading Assessment (Form 3) has been completed.",
  },
  for_review: {
    key: "for_review",
    label: "For Further Review",
    badgeClass: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300",
    actionLabel: "View Reading Record",
    actionType: "view_result",
    helperText: "End of School Year: Reading need remains. For further review (Possible ARAL Summer Consideration).",
    guidanceNote: "Possible ARAL Summer Consideration",
  },
  // Backward compatibility aliases
  support_review: {
    key: "support_review",
    label: "Reading Assessment Complete",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    actionLabel: "View Reading Record",
    actionType: "view_result",
    helperText: "Reading assessment is complete.",
  },
  completed: {
    key: "completed",
    label: "Screening Complete — At Grade Level",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    actionLabel: "View Reading Record",
    actionType: "view_result",
    helperText: "Reading assessment is complete.",
  },
  assessment_complete_no_support: {
    key: "assessment_complete_no_support",
    label: "Screening Complete — At Grade Level",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    actionLabel: "View Reading Record",
    actionType: "view_result",
    helperText: "Reading assessment is complete.",
  },
  reading_profile_available: {
    key: "reading_profile_available",
    label: "Reading Assessment Complete",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    actionLabel: "View Reading Record",
    actionType: "view_result",
    helperText: "Reading assessment is complete.",
  },
  waiting_for_facilitator: {
    key: "waiting_for_facilitator",
    label: "Reading Assessment Complete",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    actionLabel: "View Reading Record",
    actionType: "view_result",
    helperText: "Reading assessment is complete.",
  },
  waiting_for_support: {
    key: "waiting_for_support",
    label: "Reading Assessment Complete",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    actionLabel: "View Reading Record",
    actionType: "view_result",
    helperText: "Reading assessment is complete.",
  },
  under_aral_support: {
    key: "under_aral_support",
    label: "Reading Assessment Complete",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    actionLabel: "View Reading Record",
    actionType: "view_result",
    helperText: "Reading assessment is complete.",
  },
  progress_check_due: {
    key: "progress_check_due",
    label: "Reading Assessment Complete",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    actionLabel: "View Reading Record",
    actionType: "view_result",
    helperText: "Reading assessment is complete.",
  },
};

/**
 * Checks if a row represents a valid Phil-IRI reading-assessment case for teacher monitoring.
 * In DepEd CNHS LEARN:
 * - English and Filipino Subject Teachers administer reading assessments for all enrolled students in their language classes.
 * - Prior referral is not required to take GST.
 */
export function isValidAralCase(learner, currentTeacherId = null) {
  if (!learner) return false;

  const rawSubj = learner.subject || learner.classSubject || learner.displaySubject || learner.language || "";
  if (isAralLanguageSubject(rawSubj)) return true;
  if (learner.language && isAralLanguageSubject(learner.language)) return true;
  if (learner.philIriScore != null) return true;

  return false;
}

/**
 * Derives the authoritative, mutually exclusive current step for a learner.
 * Follows strict DepEd Phil-IRI rules:
 * - Absent: "Absent / For Reschedule" (no score 0, not failed)
 * - Review: "GST Under Review" (score preserved with audit reason)
 * - Missing GST -> strictly "Needs Screening Test"
 * - GST 28–40 -> "Screening Complete — At Grade Level" (never labeled Independent from GST alone)
 * - GST < 28 without Form 3 -> "Needs Reading Assessment"
 * - Form 3 completed:
 *   - At EOSY (Term 3) if Instructional or Frustration: "For Further Review" (with guidance: "Possible ARAL Summer Consideration")
 *   - Otherwise: "Reading Assessment Complete"
 */
export function deriveLearnerCurrentStep(learner) {
  // 1. Absent check: learner marked absent for reschedule (not treated as 0 or failed)
  if (
    learner.isAbsent ||
    learner.candidateStatus === "Absent / For Reschedule" ||
    learner.screeningStatus === "Absent / For Reschedule" ||
    learner.rawPayload?.isAbsent ||
    learner.rawPayload?.screeningStatus === "Absent / For Reschedule"
  ) {
    return "absent_reschedule";
  }

  // 2. Teacher Review check: learner GST score flagged for teacher review with preserved score
  if (
    learner.candidateStatus === "For Review" &&
    (learner.rawPayload?.teacherReviewReason || learner.teacherReviewReason)
  ) {
    return "gst_under_review";
  }

  // 3. MUST have recorded GST to proceed past screening
  if (learner.philIriScore == null) {
    return "waiting_for_assessment"; // "Needs Screening Test"
  }

  const evalRes = evaluateGstScore({
    score: learner.philIriScore,
    language: learner.language || learner.subject || "English",
  });

  if (!evalRes.isEvaluated) {
    return evalRes.nextStepKey || "waiting_for_assessment";
  }

  // 4. GST 28-40: At Grade Level -> "Screening Complete — At Grade Level"
  if (!evalRes.needsIndividualAssessment) {
    return "screening_complete_at_grade";
  }

  // 5. GST < 28: Check if Form 3 (Individual Reading Assessment) is completed
  const readingProfile = learner.readingLevel || learner.oralReadingProfile || null;
  const hasIra = Boolean(
    learner.iraCompleted ||
    (readingProfile &&
      readingProfile !== "Not Screened" &&
      readingProfile !== "Not Assessed" &&
      readingProfile !== "Pending Oral Profile" &&
      readingProfile !== "Not Set" &&
      readingProfile !== "Pending Individual Assessment")
  );

  if (!hasIra) {
    return "needs_individual_assessment"; // "Needs Reading Assessment"
  }

  // 6. Form 3 completed:
  // If End of School Year (Term 3 / EOSY) and reading need remains (Instructional or Frustration),
  // return "for_review" (For Further Review · Possible ARAL Summer Consideration)
  const termStr = String(
    learner.assessmentPeriod ||
    learner.aralPeriod ||
    learner.term ||
    learner.quarter ||
    ""
  ).toUpperCase();
  const isEosy =
    termStr.includes("EOSY") ||
    termStr.includes("TERM 3") ||
    termStr.includes("TERM3") ||
    termStr.includes("END") ||
    termStr === "Q4" ||
    termStr === "4";

  const isReadingNeed =
    readingProfile === "Frustration" || readingProfile === "Instructional";

  if (isEosy && isReadingNeed) {
    return "for_review";
  }

  return "assessment_complete"; // "Reading Assessment Complete"
}

/**
 * Format reading assessment display string according to simplified rules:
 * - Absent: "Absent / For Reschedule"
 * - Teacher Review: "Screening: XX/40 (Under Review)"
 * - Graded Passage / Form 3 administered: show actual Reading Profile (Independent / Instructional / Frustration)
 * - GST only: "Screening: 28/40 — At Grade Level" or "Screening: 18/40 — Needs Assessment"
 * - None yet: "Not yet recorded"
 */
export function formatReadingAssessmentDisplay(learner) {
  if (!learner) return "Not yet recorded";

  if (
    learner.isAbsent ||
    learner.candidateStatus === "Absent / For Reschedule" ||
    learner.screeningStatus === "Absent / For Reschedule" ||
    learner.rawPayload?.isAbsent ||
    learner.rawPayload?.screeningStatus === "Absent / For Reschedule"
  ) {
    return "Absent / For Reschedule";
  }

  if (
    learner.candidateStatus === "For Review" &&
    (learner.rawPayload?.teacherReviewReason || learner.teacherReviewReason)
  ) {
    const s = learner.philIriScore != null ? `${learner.philIriScore}/40 ` : "";
    return `Screening: ${s}(Under Review)`;
  }

  const readingProfile = learner.readingLevel || learner.oralReadingProfile || learner.reading_level_or_placement || null;
  const hasIra = Boolean(
    learner.iraCompleted ||
    (readingProfile &&
      readingProfile !== "Not Screened" &&
      readingProfile !== "Not Assessed" &&
      readingProfile !== "Pending Oral Profile" &&
      readingProfile !== "Not Set" &&
      readingProfile !== "Pending Individual Assessment")
  );

  if (hasIra && readingProfile) {
    return readingProfile;
  }

  if (learner.philIriScore != null) {
    const score = Number(learner.philIriScore);
    if (score >= 28) {
      return `Screening: ${score}/40 — At Grade Level`;
    }
    return `Screening: ${score}/40 — Needs Assessment`;
  }

  return "Not yet recorded";
}

/**
 * Teacher-confirmed reading concern or reason.
 * Does NOT use "Final Grade / Average below 75".
 * Shows actual teacher observation or formatted language reading concern.
 */
export function formatTeacherReadingConcern(learner) {
  if (!learner) return "Reading Concern";

  const teacherRemark =
    learner.teacherRemarks ||
    learner.teacher_remarks ||
    learner.readingConcern ||
    learner.skillFocus ||
    learner.skill_focus ||
    learner.notes ||
    learner.referralReason;

  if (teacherRemark && String(teacherRemark).trim().length > 0) {
    const clean = String(teacherRemark).trim();
    if (!/below 75|grade.*75|average.*75/i.test(clean)) {
      return clean;
    }
  }

  const subject = learner.language || learner.subject || "English";
  return `${subject} Reading Concern`;
}

/**
 * Aggregates and deduplicates learners for ARAL Reading Assessment.
 * Exactly 1 row per learner + language + school year.
 * Strict Assessor Resolution:
 * - English case → learner's English Subject Teacher
 * - Filipino case → learner's Filipino Subject Teacher
 * - No valid subject teacher found → "Reading assessment teacher not found." (flagged for admin review)
 * - Class teacher / adviser is strictly excluded from being an assessor fallback!
 */
export function aggregateAralLearners(
  students = [],
  {
    currentTeacherId = null,
    schoolYear = "SY 2026-2027",
    role = null,
    scope = null,
  } = {}
) {
  if (!Array.isArray(students) || !students.length) return [];

  const isSchoolWide =
    role === "principal" ||
    role === "admin" ||
    scope === "school-wide" ||
    (!currentTeacherId && role !== "teacher");

  // Pre-pass: Map subject teachers strictly from class rosters
  const subjectTeacherByStudentLang = new Map();
  const subjectTeacherBySectionLang = new Map();

  for (const s of students) {
    const studentId = String(s.studentId || s.id || s.lrn || s.studentNumber || "").trim();
    const rawSubj = String(s.subject || s.classSubject || s.displaySubject || "").trim();
    const normLang = rawSubj.toLowerCase().includes("fil") ? "Filipino" : (rawSubj.toLowerCase().includes("eng") ? "English" : null);
    const sectionKey = String(s.gradeSection || s.section || "").trim();

    // Subject teacher:
    // If this row represents an English or Filipino class, its teacherId is the Subject Teacher.
    // Class adviser is strictly excluded from being an assessor fallback.
    const isExplicitAdviser = Boolean(
      s.isAdviser ||
      (s.adviserId && (s.adviserId === s.teacherId || s.adviserId === s.teacher_id) && !s.subjectTeacherId && !s.isSubjectTeacher)
    );
    const subTeacherId = s.subjectTeacherId || (!isExplicitAdviser ? (s.teacherId || s.teacher_id) : null);
    const subTeacherName = s.subjectTeacherName || (!isExplicitAdviser ? (s.teacherName) : null);

    if (normLang && subTeacherId) {
      const studentLangKey = `${studentId}_${normLang}`;
      if (studentId && (!subjectTeacherByStudentLang.has(studentLangKey) || s.subjectTeacherId)) {
        subjectTeacherByStudentLang.set(studentLangKey, { id: subTeacherId, name: subTeacherName });
      }
      const sectionLangKey = `${sectionKey}_${normLang}`;
      if (sectionKey && (!subjectTeacherBySectionLang.has(sectionLangKey) || s.subjectTeacherId)) {
        subjectTeacherBySectionLang.set(sectionLangKey, { id: subTeacherId, name: subTeacherName });
      }
    }
  }

  const map = new Map();

  for (const s of students) {
    if (!isValidAralCase(s, currentTeacherId)) {
      continue;
    }

    const studentId = String(s.studentId || s.id || s.lrn || s.studentNumber || "").trim();
    if (!studentId) continue;

    const normalizedLang = String(s.subject || "English").toLowerCase().includes("fil")
      ? "Filipino"
      : "English";

    // Deduplication identity key: learner + language + school year
    const key = `${studentId}_${normalizedLang}_${s.schoolYear || schoolYear}`;

    // Resolve assessor strictly according to DepEd Phil-IRI responsibilities:
    // 1. English GST -> English Subject Teacher
    // 2. Filipino GST -> Filipino Subject Teacher
    // 3. If none -> "Reading assessment teacher not found." (NEVER class adviser / classTeacherId)
    const resolvedSubjectTeacher =
      subjectTeacherByStudentLang.get(`${studentId}_${normalizedLang}`) ||
      subjectTeacherBySectionLang.get(`${String(s.gradeSection || s.section || "").trim()}_${normalizedLang}`);

    let assessorTeacherId = null;
    let assessorTeacherName = "Reading assessment teacher not found.";
    let assessorRole = "Unassigned";
    let isMissingLanguageTeacher = true;

    if (resolvedSubjectTeacher?.id) {
      assessorTeacherId = resolvedSubjectTeacher.id;
      assessorTeacherName = resolvedSubjectTeacher.name
        ? `${resolvedSubjectTeacher.name} (${normalizedLang} Teacher)`
        : `${normalizedLang} Teacher`;
      assessorRole = `${normalizedLang} Subject Teacher`;
      isMissingLanguageTeacher = false;
    }

    const isAssessor = Boolean(
      currentTeacherId &&
      (assessorTeacherId === currentTeacherId ||
        s.teacherId === currentTeacherId ||
        s.teacher_id === currentTeacherId)
    );

    // In teacher mode, only show learners from the teacher's assigned language classes
    if (!isSchoolWide && currentTeacherId && !isAssessor) {
      continue;
    }

    const canEditAssessment = !isSchoolWide && isAssessor; // Principal is strictly read-only
    const isAssignedToMe = isAssessor;
    const userRoleInCase = isAssessor ? "Assessor" : "Observer";

    if (!map.has(key)) {
      const stepKey = deriveLearnerCurrentStep(s);
      const stepMeta = ARAL_STEP_DEFINITIONS[stepKey] || ARAL_STEP_DEFINITIONS.waiting_for_assessment;

      map.set(key, {
        ...s,
        id: s.id || studentId,
        studentId,
        lrn: s.lrn || s.studentNumber || "—",
        language: normalizedLang,
        subject: normalizedLang,
        gradeSectionDisplay: formatGradeSection(s.grade, s.section),
        currentStepKey: stepKey,
        currentStepLabel: stepMeta.label,
        currentStepMeta: stepMeta,
        assessorTeacherId,
        assessorTeacherName,
        assessorRole,
        isMissingLanguageTeacher,
        needsAdminReview: isMissingLanguageTeacher,
        isAssessor,
        canEditAssessment,
        isAssignedToMe,
        userRoleInCase,
        isAbsent: Boolean(s.isAbsent || s.candidateStatus === "Absent / For Reschedule" || s.rawPayload?.isAbsent || s.raw_payload?.isAbsent),
        teacherReviewReason: s.teacherReviewReason || s.rawPayload?.teacherReviewReason || s.raw_payload?.teacherReviewReason || null,
        teacherReviewDate: s.teacherReviewDate || s.rawPayload?.teacherReviewDate || s.raw_payload?.teacherReviewDate || null,
        iraMetrics: s.iraMetrics || s.rawPayload?.iraMetrics || s.raw_payload?.iraMetrics || null,
        rawPayload: s.rawPayload || s.raw_payload || null,
      });
    } else {
      // Merge records: if secondary record has an assessment score or active intervention, prefer it
      const existing = map.get(key);

      if (existing.philIriScore == null && s.philIriScore != null) {
        existing.philIriScore = s.philIriScore;
        existing.readingLevel = s.readingLevel;
        existing.screeningInterpretation = s.screeningInterpretation;
      }

      if (s.isAbsent || s.candidateStatus === "Absent / For Reschedule" || s.rawPayload?.isAbsent || s.raw_payload?.isAbsent) {
        existing.isAbsent = true;
        existing.candidateStatus = "Absent / For Reschedule";
      }

      if (s.teacherReviewReason || s.rawPayload?.teacherReviewReason || s.raw_payload?.teacherReviewReason) {
        existing.teacherReviewReason = s.teacherReviewReason || s.rawPayload?.teacherReviewReason || s.raw_payload?.teacherReviewReason;
        existing.teacherReviewDate = s.teacherReviewDate || s.rawPayload?.teacherReviewDate || s.raw_payload?.teacherReviewDate;
      }

      if (s.iraMetrics || s.rawPayload?.iraMetrics || s.raw_payload?.iraMetrics) {
        existing.iraMetrics = s.iraMetrics || s.rawPayload?.iraMetrics || s.raw_payload?.iraMetrics;
      }

      if (s.rawPayload || s.raw_payload) {
        existing.rawPayload = { ...(existing.rawPayload || {}), ...(s.rawPayload || s.raw_payload || {}) };
      }

      if (s.inAralProgram && !existing.inAralProgram) {
        existing.inAralProgram = true;
      }

      if (s.aralFacilitatorAssigned) {
        existing.aralFacilitatorAssigned = true;
        existing.aralFacilitatorName = s.aralFacilitatorName || existing.aralFacilitatorName;
        existing.aralFacilitatorTeacherId = s.aralFacilitatorTeacherId || existing.aralFacilitatorTeacherId;
      }

      // Re-evaluate assessor & roles if secondary record has teacher info
      if (!existing.assessorTeacherId && assessorTeacherId) {
        existing.assessorTeacherId = assessorTeacherId;
        existing.assessorTeacherName = assessorTeacherName;
        existing.assessorRole = assessorRole;
        existing.isMissingLanguageTeacher = isMissingLanguageTeacher;
        existing.needsAdminReview = isMissingLanguageTeacher;
      }

      existing.isAssessor = Boolean(currentTeacherId && existing.assessorTeacherId === currentTeacherId);
      existing.canEditAssessment = existing.isAssessor;
      existing.isFacilitator = Boolean(
        existing.aralFacilitatorAssigned &&
        (!currentTeacherId || existing.aralFacilitatorTeacherId === currentTeacherId)
      );
      existing.isAssignedToMe = existing.isAssessor || existing.isFacilitator;

      if (existing.isAssessor && existing.isFacilitator) {
        existing.userRoleInCase = "Both Assessor & Facilitator";
      } else if (existing.isAssessor) {
        existing.userRoleInCase = "Assessor";
      } else if (existing.isFacilitator) {
        existing.userRoleInCase = "Facilitator";
      } else {
        existing.userRoleInCase = "Observer";
      }

      // Re-evaluate step
      const stepKey = deriveLearnerCurrentStep(existing);
      const stepMeta = ARAL_STEP_DEFINITIONS[stepKey] || ARAL_STEP_DEFINITIONS.waiting_for_assessment;
      existing.currentStepKey = stepKey;
      existing.currentStepLabel = stepMeta.label;
      existing.currentStepMeta = stepMeta;
    }
  }

  return Array.from(map.values());
}

/**
 * Computes pure Phil-IRI reading assessment summary metrics.
 */
export function computeAralMetrics(learners = []) {
  let waitingForAssessmentCount = 0;
  let absentCount = 0;
  let needsIndividualAssessmentCount = 0;
  let screeningCompleteCount = 0;
  let assessmentCompleteCount = 0;
  let forReviewCount = 0;

  for (const learner of learners) {
    const step = learner.currentStepKey || deriveLearnerCurrentStep(learner);
    if (step === "absent_reschedule") {
      absentCount++;
      waitingForAssessmentCount++;
    } else if (step === "waiting_for_assessment") {
      waitingForAssessmentCount++;
    } else if (step === "needs_individual_assessment" || step === "gst_under_review") {
      needsIndividualAssessmentCount++;
    } else if (step === "screening_complete_at_grade") {
      screeningCompleteCount++;
    } else if (step === "assessment_complete") {
      assessmentCompleteCount++;
    } else if (step === "for_review") {
      forReviewCount++;
    }
  }

  const totalCompleteCount = screeningCompleteCount + assessmentCompleteCount;
  const pendingCount = waitingForAssessmentCount - absentCount;

  return {
    total: learners.length,
    waitingForAssessmentCount,
    pendingCount,
    absentCount,
    needsIndividualAssessmentCount,
    needsReadingAssessmentCount: needsIndividualAssessmentCount,
    screeningCompleteCount,
    assessmentCompleteCount,
    totalCompleteCount,
    forReviewCount,
    // Backwards compatibility aliases
    underAralSupportCount: totalCompleteCount,
    progressCheckDueCount: 0,
  };
}

/**
 * Filter ARAL learners based on minimal, teacher-friendly filters.
 */
export function filterAralLearners(
  learners = [],
  {
    searchTerm = "",
    currentStep = "All Steps",
    grade = "All Grades",
    language = "All Languages",
  } = {}
) {
  return (learners || []).filter((row) => {
    // 1. Search term
    const q = (searchTerm || "").toLowerCase().trim();
    if (q) {
      const nameHit = (row.name || `${row.lastName || ""} ${row.firstName || ""}`)
        .toLowerCase()
        .includes(q);
      const lrnHit = String(row.studentNumber || row.lrn || "")
        .toLowerCase()
        .includes(q);
      const sectionHit = String(row.section || row.gradeSectionDisplay || "")
        .toLowerCase()
        .includes(q);
      if (!nameHit && !lrnHit && !sectionHit) return false;
    }

    // 2. Current Step
    if (currentStep && currentStep !== "All Steps") {
      if (
        row.currentStepKey !== currentStep &&
        row.currentStepLabel !== currentStep
      ) {
        return false;
      }
    }

    // 3. Grade
    if (grade && grade !== "All Grades") {
      const cleanTargetGrade = String(grade).replace(/^Grade\s+/i, "").trim();
      const cleanRowGrade = String(row.grade || "").replace(/^Grade\s+/i, "").trim();
      if (cleanRowGrade !== cleanTargetGrade) return false;
    }

    // 4. Language
    if (language && language !== "All Languages") {
      if (row.language?.toLowerCase() !== language.toLowerCase()) return false;
    }

    return true;
  });
}
