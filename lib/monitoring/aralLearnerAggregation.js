/**
 * Authoritative aggregation, eligibility, and deduplication for Teacher ARAL Monitoring.
 *
 * Implements strict workflow safeguards:
 * 1. Eligibility: Only language reading cases with a valid ARAL case appear (Path A referral or Path B school assignment).
 *    Non-language academic concerns (Math, Science, AP, etc.) and general English/Filipino class enrollments are excluded.
 * 2. Deduplication: One authoritative row per learner + language + school year.
 * 3. Step Derivation: Mutually exclusive, accurate current steps.
 */

import { isAralLanguageSubject } from "./aralAcademicStatus.js";
import { evaluateGstScore, formatGradeSection } from "./philIriEvaluation.js";

export const ARAL_STEP_DEFINITIONS = {
  waiting_for_assessment: {
    key: "waiting_for_assessment",
    label: "Needs Screening Test",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
    actionLabel: "Start Screening",
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
  support_review: {
    key: "support_review",
    label: "Assessment Complete",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
    actionLabel: "View Result",
    actionType: "view_result",
    helperText: "Reading assessment is complete and awaiting final review.",
  },
  waiting_for_facilitator: {
    key: "waiting_for_facilitator",
    label: "Waiting for Teacher Assignment",
    badgeClass: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
    actionLabel: "View Result",
    actionType: "view_result",
    helperText: "Waiting for the school head to assign a reading support teacher.",
  },
  waiting_for_support: {
    key: "waiting_for_support",
    label: "Ready for Reading Support",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
    actionLabel: "Start Reading Support",
    actionType: "start_support",
    helperText: "The reading assessment is complete. Reading support may now begin.",
  },
  under_aral_support: {
    key: "under_aral_support",
    label: "Receiving Reading Support",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    actionLabel: "Add Progress Update",
    actionType: "add_progress",
    helperText: "Learner is actively receiving reading support sessions.",
  },
  progress_check_due: {
    key: "progress_check_due",
    label: "Progress Update Needed",
    badgeClass: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300",
    actionLabel: "Add Progress Update",
    actionType: "add_progress",
    helperText: "A regular progress update is needed for this learner.",
  },
  completed: {
    key: "completed",
    label: "Completed",
    badgeClass: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400",
    actionLabel: "View Result",
    actionType: "view_result",
    helperText: "Assessment or reading support intervention is completed.",
  },
  // Backward compatibility aliases
  assessment_complete_no_support: {
    key: "assessment_complete_no_support",
    label: "Assessment Complete",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
    actionLabel: "View Result",
    actionType: "view_result",
    helperText: "Reading assessment is complete.",
  },
  reading_profile_available: {
    key: "reading_profile_available",
    label: "Assessment Complete",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
    actionLabel: "View Result",
    actionType: "view_result",
    helperText: "Reading assessment is complete.",
  },
};

/**
 * Checks if a row represents a valid ARAL reading-assessment case for teacher monitoring.
 */
export function isValidAralCase(learner, currentTeacherId = null) {
  if (!learner) return false;

  // 1. Must be a language subject or have explicit language tagging
  const rawSubj = learner.subject || learner.classSubject || learner.displaySubject || "";
  const isLanguage = isAralLanguageSubject(rawSubj);

  // 2. Must satisfy at least ONE valid entry path (not mere enrollment)
  const isApprovedReferral = /approved/i.test(
    String(learner.aralApprovalStatus || learner.aralApprovalDbStatus || "")
  );

  const isAssignedAssessor = Boolean(
    learner.aralFacilitatorAssigned &&
    (!currentTeacherId || learner.aralFacilitatorTeacherId === currentTeacherId)
  );

  const hasRecordedAssessment = learner.philIriScore != null;

  const st = String(learner.interventionStatus || learner.aralStatus || "");
  const hasActiveIntervention =
    learner.inAralProgram === true ||
    /Active Intervention|Progressing|In Progress|Assigned|For Midline|For EOSY/i.test(st);

  const isCompleted = /Completed|Exit ARAL/i.test(st);

  const isSchoolBOSYAssigned = Boolean(
    learner.bosyAssigned ||
    learner.assessmentBatchId ||
    learner.hasReadingAssessmentCase ||
    learner.assignedForAssessment
  );

  // If not a language subject, ONLY allow if they have an approved referral, school assignment, or facilitator assignment
  if (!isLanguage && !isApprovedReferral && !isAssignedAssessor && !isSchoolBOSYAssigned) {
    return false;
  }

  // Enrollment alone is not enough: must have at least one valid ARAL case condition
  return (
    isApprovedReferral ||
    isAssignedAssessor ||
    isSchoolBOSYAssigned ||
    hasRecordedAssessment ||
    hasActiveIntervention ||
    isCompleted
  );
}

/**
 * Derives the authoritative, mutually exclusive current step for a learner.
 * Follows strict state rules:
 * - Missing GST -> strictly "Needs Screening Test" (never shows Ready for Reading Support without GST)
 * - GST >= 28 -> "Assessment Complete" (submits result for Authorized Review, not automatically finalized)
 * - GST < 28 without Form 3 -> "Needs Reading Assessment"
 * - Form 3 completed -> "Assessment Complete" (submits recommendation for Authorized Review, not automatically finalized even if Independent)
 * - Once review approves for support -> "Ready for Reading Support" or "Waiting for Teacher Assignment"
 * - Once support sessions begin -> "Receiving Reading Support" or "Progress Update Needed"
 * - Once finalized in Authorized Review / completed -> "Completed"
 */
export function deriveLearnerCurrentStep(learner) {
  const st = String(learner.interventionStatus || learner.aralStatus || "").trim();

  // 1. Explicitly Completed / Exit ARAL (Authorized Review / Finalized)
  if (/Completed|Exit ARAL/i.test(st) || learner.monitoringStatus === "Completed") {
    return "completed";
  }

  // 2. MUST have recorded GST to proceed past screening
  // (Prevents impossible state: never "Ready for Reading Support" while GST is not recorded)
  if (learner.philIriScore == null) {
    return "waiting_for_assessment"; // "Needs Screening Test"
  }

  const evalRes = evaluateGstScore({
    score: learner.philIriScore,
    language: learner.language || learner.subject || "English",
  });

  // 3. GST 28-40: At Grade Level -> Assessment Complete (Pending Authorized Review)
  // (Do NOT automatically finalize GST 28-40 as completed without review)
  if (!evalRes.needsIndividualAssessment) {
    if (learner.candidateStatus === "Exit ARAL" || learner.monitoringStatus === "Completed") {
      return "completed";
    }
    return "support_review"; // "Assessment Complete"
  }

  // 4. GST < 28: Check if Form 3 (Individual Reading Assessment) is completed
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

  // 5. Form 3 is completed: Check support status
  const hasStartedSupport = Boolean(
    learner.supportStarted ||
    learner.date_started ||
    (Number(learner.weeklyUpdateCount) > 0) ||
    (Number(learner.activeSessionsCount) > 0) ||
    (Number(learner.attendance_sessions_attended) > 0)
  );

  const isInterventionActive =
    learner.inAralProgram === true ||
    /Active Intervention|Progressing|In Progress/i.test(st) ||
    learner.candidateStatus === "ARAL Candidate";

  // Active Support sessions running
  if (isInterventionActive && hasStartedSupport) {
    if (learner.progressCheckDue === true) {
      return "progress_check_due"; // "Progress Update Needed"
    }
    return "under_aral_support"; // "Receiving Reading Support"
  }

  // Approved for support but sessions not yet started
  if (isInterventionActive) {
    if (learner.aralFacilitatorTeacherId || learner.aralFacilitatorAssigned) {
      return "waiting_for_support"; // "Ready for Reading Support"
    }
    return "waiting_for_facilitator"; // "Waiting for Teacher Assignment"
  }

  // Form 3 completed, awaiting Support Review / Teacher Recommendation / Authorized Review
  // (Applies to ALL profiles including Independent — does NOT jump to completed)
  return "support_review"; // "Assessment Complete"
}

/**
 * Format reading assessment display string according to simplified rules:
 * - Graded Passage / Form 3 administered: show actual Reading Profile (Independent / Instructional / Frustration)
 * - GST only: "Screening: 28/40 — At Grade Level" or "Screening: 18/40 — Needs Assessment"
 * - None yet: "Not yet recorded"
 */
export function formatReadingAssessmentDisplay(learner) {
  if (!learner) return "Not yet recorded";

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
 * Aggregates and deduplicates learners for Teacher ARAL Monitoring.
 * Exactly 1 row per learner + language + school year.
 * Strict Assessor Resolution:
 * - English case → English Subject Teacher
 * - Filipino case → Filipino Subject Teacher
 * - Explicit override → authorized Master Teacher
 * - No valid subject teacher found → Needs Assessor Assignment
 * - Class teacher / adviser is NEVER used as an automatic assessor fallback!
 */
export function aggregateAralLearners(students = [], { currentTeacherId = null, schoolYear = "SY 2026-2027" } = {}) {
  if (!Array.isArray(students) || !students.length) return [];

  // Pre-pass: Map subject teachers and explicit assessor overrides
  const subjectTeacherByStudentLang = new Map();
  const subjectTeacherBySectionLang = new Map();
  const explicitAssessorByStudentLang = new Map();

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

    // Explicit assessor override (e.g. Master Teacher):
    const assessorOverrideId = s.assessorTeacherId || s.assessorTeacherOverrideId || s.masterTeacherId || null;
    const assessorOverrideName = s.assessorTeacherName || s.assessorTeacherOverrideName || null;
    if (assessorOverrideId && normLang && studentId) {
      explicitAssessorByStudentLang.set(`${studentId}_${normLang}`, {
        id: assessorOverrideId,
        name: assessorOverrideName,
      });
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
    // 1. Explicit assessor override (Master Teacher)
    // 2. Appropriate Subject Teacher for that language
    // 3. If none -> Needs Assessor Assignment (NEVER classTeacherId / adviser)
    const overrideAssessor = explicitAssessorByStudentLang.get(`${studentId}_${normalizedLang}`);
    const resolvedSubjectTeacher =
      subjectTeacherByStudentLang.get(`${studentId}_${normalizedLang}`) ||
      subjectTeacherBySectionLang.get(`${String(s.gradeSection || s.section || "").trim()}_${normalizedLang}`);

    let assessorTeacherId = null;
    let assessorTeacherName = "Needs Assessor Assignment";
    let assessorRole = "Unassigned";

    if (overrideAssessor?.id) {
      assessorTeacherId = overrideAssessor.id;
      assessorTeacherName = overrideAssessor.name || "Authorized Master Teacher";
      assessorRole = "Master Teacher / Authorized Assessor";
    } else if (resolvedSubjectTeacher?.id) {
      assessorTeacherId = resolvedSubjectTeacher.id;
      assessorTeacherName = resolvedSubjectTeacher.name
        ? `${resolvedSubjectTeacher.name} (${normalizedLang} Teacher)`
        : `${normalizedLang} Teacher`;
      assessorRole = `${normalizedLang} Subject Teacher`;
    }

    const isAssessor = Boolean(currentTeacherId && assessorTeacherId === currentTeacherId);
    const isFacilitator = Boolean(
      s.aralFacilitatorAssigned &&
      (!currentTeacherId || s.aralFacilitatorTeacherId === currentTeacherId)
    );
    const isAssignedToMe = isAssessor || isFacilitator;

    let userRoleInCase = "Observer";
    if (isAssessor && isFacilitator) {
      userRoleInCase = "Both Assessor & Facilitator";
    } else if (isAssessor) {
      userRoleInCase = "Assessor";
    } else if (isFacilitator) {
      userRoleInCase = "Facilitator";
    }

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
        isAssessor,
        isFacilitator,
        isAssignedToMe,
        userRoleInCase,
      });
    } else {
      // Merge records: if secondary record has an assessment score or active intervention, prefer it
      const existing = map.get(key);

      if (existing.philIriScore == null && s.philIriScore != null) {
        existing.philIriScore = s.philIriScore;
        existing.readingLevel = s.readingLevel;
        existing.screeningInterpretation = s.screeningInterpretation;
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
      }

      existing.isAssessor = Boolean(currentTeacherId && existing.assessorTeacherId === currentTeacherId);
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
 * Computes the 3 mutually understandable summary metrics (+ optional progress check).
 */
export function computeAralMetrics(learners = []) {
  let waitingForAssessmentCount = 0;
  let needsIndividualAssessmentCount = 0;
  let underAralSupportCount = 0;
  let progressCheckDueCount = 0;

  for (const learner of learners) {
    const step = learner.currentStepKey;
    if (step === "waiting_for_assessment") {
      waitingForAssessmentCount++;
    } else if (step === "needs_individual_assessment") {
      needsIndividualAssessmentCount++;
    } else if (step === "under_aral_support") {
      underAralSupportCount++;
    } else if (step === "progress_check_due") {
      progressCheckDueCount++;
      underAralSupportCount++; // Also receiving support
    }
  }

  return {
    total: learners.length,
    waitingForAssessmentCount,
    needsIndividualAssessmentCount,
    underAralSupportCount,
    progressCheckDueCount,
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
      if (!nameHit && !lrnHit) return false;
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
