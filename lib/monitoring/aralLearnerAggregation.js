/**
 * Authoritative aggregation, eligibility, and deduplication for Teacher ARAL Monitoring.
 *
 * Implements strict workflow safeguards:
 * 1. Eligibility: Only language reading cases with a valid ARAL case appear (Path A referral or Path B school assignment).
 *    Non-language academic concerns (Math, Science, AP, etc.) and general English/Filipino class enrollments are excluded.
 * 2. Deduplication: One authoritative row per learner + language + school year.
 * 3. Step Derivation: Mutually exclusive, accurate current steps.
 */

import { isAralLanguageSubject } from "@/lib/monitoring/aralAcademicStatus";
import { evaluateGstScore, formatGradeSection } from "@/lib/monitoring/philIriEvaluation";

export const ARAL_STEP_DEFINITIONS = {
  waiting_for_assessment: {
    key: "waiting_for_assessment",
    label: "Waiting for Assessment",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300",
    actionLabel: "Assess",
    actionType: "assess",
  },
  needs_individual_assessment: {
    key: "needs_individual_assessment",
    label: "Needs Individual Assessment",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
    actionLabel: "Continue",
    actionType: "continue",
  },
  assessment_complete_no_support: {
    key: "assessment_complete_no_support",
    label: "Assessment Complete — No ARAL Support Needed",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    actionLabel: "View",
    actionType: "view",
  },
  reading_profile_available: {
    key: "reading_profile_available",
    label: "Reading Profile Available",
    badgeClass: "border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-300",
    actionLabel: "Review",
    actionType: "review",
  },
  under_aral_support: {
    key: "under_aral_support",
    label: "Under ARAL Support",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
    actionLabel: "View",
    actionType: "view",
  },
  progress_check_due: {
    key: "progress_check_due",
    label: "Progress Check Due",
    badgeClass: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300",
    actionLabel: "Update",
    actionType: "update",
  },
  completed: {
    key: "completed",
    label: "Completed",
    badgeClass: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
    actionLabel: "View",
    actionType: "view",
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
 */
export function deriveLearnerCurrentStep(learner) {
  const st = String(learner.interventionStatus || learner.aralStatus || "").trim();

  // 1. Completed
  if (/Completed|Exit ARAL/i.test(st)) {
    return "completed";
  }

  // 2. Active ARAL Intervention
  const isInterventionActive =
    learner.inAralProgram === true ||
    /Active Intervention|Progressing|In Progress/i.test(st);

  if (isInterventionActive) {
    // If progress check is due (e.g. flagged or last check expired)
    if (learner.progressCheckDue === true) {
      return "progress_check_due";
    }
    return "under_aral_support";
  }

  // 3. Individual Reading Assessment (IRA) status & Reading Profile
  const readingProfile = learner.readingLevel || learner.oralReadingProfile || null;
  const iraCompleted = Boolean(
    learner.iraCompleted ||
    (readingProfile && readingProfile !== "Not Screened" && readingProfile !== "Pending Oral Profile" && readingProfile !== "Not Set")
  );

  if (iraCompleted && readingProfile) {
    if (readingProfile.toLowerCase() === "independent") {
      return "assessment_complete_no_support";
    }
    // Profile is Instructional or Frustration, support decision pending
    return "reading_profile_available";
  }

  // 4. Group Screening Test (GST) status
  if (learner.philIriScore != null) {
    const gstEval = evaluateGstScore({
      score: learner.philIriScore,
      language: learner.subject || "English",
    });

    if (gstEval.isIndependent) {
      return "assessment_complete_no_support";
    }
    return "needs_individual_assessment";
  }

  // 5. Default initial state for approved/assigned learners
  return "waiting_for_assessment";
}

/**
 * Aggregates and deduplicates learners for Teacher ARAL Monitoring.
 * Exactly 1 row per learner + language + school year.
 */
export function aggregateAralLearners(students = [], { currentTeacherId = null, schoolYear = "SY 2026-2027" } = {}) {
  if (!Array.isArray(students) || !students.length) return [];

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
        isAssignedToMe: Boolean(
          s.aralFacilitatorAssigned &&
          (!currentTeacherId || s.aralFacilitatorTeacherId === currentTeacherId)
        ),
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
        existing.isAssignedToMe = Boolean(
          !currentTeacherId || existing.aralFacilitatorTeacherId === currentTeacherId
        );
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
