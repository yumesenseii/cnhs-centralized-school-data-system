/**
 * Pure JavaScript Personalized Learning Plan (PLP) Generator.
 *
 * Implements CNHS LEARN rule-based PLP drafting for:
 * 1. Academic Remediation (failing grades, High Risk, or subject-specific needs)
 * 2. Moderate-Risk Reinforcement (developing competencies, borderline grades)
 * 3. Subject-Specific Support (passing GWA but isolated failing/struggling subjects)
 * 4. Verified Phil-IRI Reading Support (Frustration, Instructional, Independent tiers)
 * 5. BOSY Reading-Only Drafts (valid without finalized academic grades)
 * 6. Assessment-Follow-Up Drafts (GST indicates Form 3 is required, reading profile pending)
 *
 * Safety Invariant:
 * Pure logic engine with NO database calls. Teacher customizations are protected
 * and never overwritten by automated regeneration.
 */

import { generatePlpPrescription } from "@/lib/monitoring/plpRules";
import {
  parseTermNumber,
  termLabel as formatTermLabel,
} from "@/lib/academic/termLabels";

export const PLP_PLAN_TYPE = {
  ACADEMIC_REMEDIAL: "academic_remedial",
  READING_ARAL: "reading_aral",
  COMPOSITE: "composite",
};

export const PLP_STATUS = {
  DRAFT: "draft",
  TEACHER_REVIEWED: "teacher_reviewed",
  ACTIVE: "active",
  COMPLETED: "completed",
  ARCHIVED: "archived",
};

/**
 * CNHS academic period contract (P0-01):
 * - Instructional terms are Term 1, Term 2, Term 3 only.
 * - DB `quarter = 4` is legacy storage for the computed Final Grade / Average.
 *   It is valid as EVIDENCE, never as an instructional TARGET term.
 * - Migration 056 enforces `academic_term BETWEEN 1 AND 3`.
 */
export const INSTRUCTIONAL_TERMS = Object.freeze([1, 2, 3]);
export const FINAL_GRADE_QUARTER = 4;

/** Evidence period: 1–3 (term) or 4 (Final Grade), otherwise null. */
export function normalizeEvidencePeriod(value) {
  return parseTermNumber(value);
}

/** Target term: 1–3 only. Final Grade (4), invalid, or missing values return null. */
export function normalizeTargetTerm(value) {
  const n = parseTermNumber(value);
  return n !== null && INSTRUCTIONAL_TERMS.includes(n) ? n : null;
}

/**
 * Resolves Evidence Period and Target Term independently.
 *
 * - evidencePeriod: when the academic evidence was recorded. Read from
 *   `evidencePeriod`, or the legacy caller keys `term`, `academicTerm`,
 *   `academic_term`, `quarterNumber` (all treated as evidence aliases).
 * - targetTerm: the instructional period the plan addresses. Read ONLY from an
 *   explicit `targetTerm`. It is never copied from the evidence period, never
 *   defaulted to Term 1, and never set to Final Grade.
 */
export function resolveAcademicPeriods(academicContext = null) {
  const ctx = academicContext || {};
  const evidencePeriod = normalizeEvidencePeriod(
    ctx.evidencePeriod ??
      ctx.term ??
      ctx.academicTerm ??
      ctx.academic_term ??
      ctx.quarterNumber ??
      null
  );
  const targetTerm = normalizeTargetTerm(ctx.targetTerm ?? null);
  return {
    evidencePeriod,
    isFinalGradeEvidence: evidencePeriod === FINAL_GRADE_QUARTER,
    targetTerm,
  };
}

/**
 * Checks whether an existing PLP is protected against automated overwrite.
 *
 * A plan is protected if:
 * - It has been reviewed by a teacher (`teacher_reviewed`)
 * - It is currently active (`active`)
 * - It has reached terminal states (`completed`, `archived`)
 * - It has custom teacher edits (`is_teacher_edited === true`)
 */
export function isPlpProtected(plp) {
  if (!plp || typeof plp !== "object") return false;
  if (plp.is_teacher_edited === true) return true;
  const status = String(plp.status || "").toLowerCase();
  return (
    status === PLP_STATUS.TEACHER_REVIEWED ||
    status === PLP_STATUS.ACTIVE ||
    status === PLP_STATUS.COMPLETED ||
    status === PLP_STATUS.ARCHIVED
  );
}

/**
 * Validates the structural consistency constraints corresponding to Migration 056 CHECK constraints:
 * - academic_remedial: class_id is not null, academic_term is not null, reading_period is null
 * - reading_aral: class_id is null, academic_term is null, reading_period is not null
 * - composite: class_id is not null, academic_term is not null, reading_period is not null
 */
export function validatePlpShape(plp = {}, { requireTargetTerm = true } = {}) {
  const { plan_type, class_id, academic_term, reading_period } = plp;

  // academic_term is the instructional target term: 1–3 only (Migration 056 CHECK).
  if (academic_term != null && normalizeTargetTerm(academic_term) !== Number(academic_term)) {
    return {
      valid: false,
      error: "academic_term must be an instructional term (1–3). Final Grade (quarter 4) is not a valid target term.",
    };
  }
  // Draft previews may leave the target term unspecified (requireTargetTerm: false).
  const targetTermMissing = requireTargetTerm && academic_term == null;

  if (plan_type === PLP_PLAN_TYPE.ACADEMIC_REMEDIAL) {
    if (!class_id || targetTermMissing || reading_period != null) {
      return {
        valid: false,
        error: "academic_remedial plan requires class_id and academic_term, and reading_period must be null.",
      };
    }
  } else if (plan_type === PLP_PLAN_TYPE.READING_ARAL) {
    if (class_id != null || academic_term != null || !reading_period) {
      return {
        valid: false,
        error: "reading_aral plan requires reading_period, and class_id and academic_term must be null.",
      };
    }
  } else if (plan_type === PLP_PLAN_TYPE.COMPOSITE) {
    if (!class_id || targetTermMissing || !reading_period) {
      return {
        valid: false,
        error: "composite plan requires class_id, academic_term, and reading_period to all be present.",
      };
    }
  } else {
    return {
      valid: false,
      error: `Invalid plan_type '${plan_type}'. Expected one of: academic_remedial, reading_aral, composite.`,
    };
  }

  return { valid: true, error: null };
}

/**
 * Generates pedagogical goals, objectives, activities, and monitoring indicators for Academic needs.
 */
export function generateAcademicContent(academicContext = {}) {
  const ctx = academicContext || {};
  const {
    subjectName = "Subject",
    subjectGrade = null,
    overallRisk = null,
    gwa = null,
    failingSubjects: rawFailingSubjects = [],
    isProvisional = false,
  } = ctx;
  const failingSubjects = Array.isArray(rawFailingSubjects) ? rawFailingSubjects : [];

  // Evidence Period and Target Term are resolved independently (see resolveAcademicPeriods).
  // Objectives reference only the target term; evidence labels appear in learning needs.
  const { evidencePeriod, targetTerm } = resolveAcademicPeriods(ctx);
  const termLabel = targetTerm ? `Term ${targetTerm}` : "";
  const evidenceSuffix = evidencePeriod != null ? `, ${formatTermLabel(evidencePeriod)}` : "";

  const parsedGrade =
    subjectGrade !== null && subjectGrade !== undefined && subjectGrade !== ""
      ? Number(subjectGrade)
      : null;
  const numGrade = Number.isFinite(parsedGrade) ? parsedGrade : null;
  const isFailing = numGrade !== null ? numGrade < 75 : false;
  const isModerate = numGrade !== null ? numGrade >= 75 && numGrade <= 80 : false;
  const hasIsolatedFailure = failingSubjects.length > 0;

  // Without a recorded grade, failing-subject evidence, or an explicit provisional
  // state, no academic objectives are fabricated.
  const hasAcademicEvidence = numGrade !== null || hasIsolatedFailure || isProvisional === true;
  if (!hasAcademicEvidence) {
    return {
      riskLevel: overallRisk || "Pending Academic Evidence",
      recommendedSupportLevel: "Awaiting Academic Evidence",
      learningNeeds: [
        {
          category: "Academic Evidence Pending",
          subject: subjectName,
          description: `No recorded grade is available for ${subjectName}. Academic objectives are not generated until grade evidence is recorded.`,
        },
      ],
      targetObjectives: [],
      recommendedActivities: [],
      monitoringIndicators: [],
      evidencePeriod,
      targetTerm,
    };
  }

  const learningNeeds = [];
  const targetObjectives = [];
  const recommendedActivities = [];
  const monitoringIndicators = [];

  let recommendedSupportLevel = "Low-Touch Support";
  let riskLevel =
    overallRisk ||
    (isFailing
      ? "High Risk"
      : isProvisional
      ? "Pending Full-Term Evaluation"
      : isModerate
      ? "Moderate Risk"
      : "Low Risk");

  if (isProvisional) {
    learningNeeds.push({
      category: "Provisional Academic Monitoring",
      description: `Evaluation provisional pending full-term grade completion. Interim support focused on ${subjectName}.`,
    });
  }

  if (isFailing || (overallRisk === "High Risk" && !isProvisional)) {
    recommendedSupportLevel = "Intensive Academic Remediation";
    learningNeeds.push({
      category: "Foundational Competency Gap",
      subject: subjectName,
      grade: numGrade,
      description: `Intensive remediation required for foundational competencies in ${subjectName} (Current Grade: ${numGrade ?? "Failing"}${evidenceSuffix}).`,
    });
    targetObjectives.push({
      target: `Attain a passing mark (≥ 75%) in ${subjectName}` + (termLabel ? ` for ${termLabel}.` : '.'),
      competencyFocus: `Essential curriculum competencies in ${subjectName} targeted in classroom remedial instruction.`,
    });
    recommendedActivities.push({
      type: "Remedial Instruction",
      title: `${subjectName} Classroom Remediation`,
      description: "Teacher-guided differentiated instructional drills and weekly skill reinforcement worksheets.",
    });
    recommendedActivities.push({
      type: "Peer / Guided Learning",
      title: "Structured Study Partner Support",
      description: "Paired practice for problem analysis and formula / vocabulary retention.",
    });
    monitoringIndicators.push({
      metric: "Formative Quizzes",
      frequency: "Weekly",
      target: "Score at least 75% on formative check-ins.",
    });
    monitoringIndicators.push({
      metric: "Remedial Task Completion",
      frequency: "Bi-weekly",
      target: "100% completion of assigned remedial activity sheets.",
    });
  } else if ((isModerate || overallRisk === "Moderate Risk") && !isProvisional) {
    recommendedSupportLevel = "Targeted Academic Reinforcement";
    learningNeeds.push({
      category: "Developing Competency Reinforcement",
      subject: subjectName,
      grade: numGrade,
      description: `Targeted practice needed in ${subjectName} to raise borderline performance (Current Grade: ${numGrade ?? "Developing"}${evidenceSuffix}) to proficient level.`,
    });
    targetObjectives.push({
      target: `Improve academic mastery in ${subjectName} to proficient level (above 80%)` + (termLabel ? ` for ${termLabel}.` : '.'),
      competencyFocus: "Higher-order problem solving and application of concepts.",
    });
    recommendedActivities.push({
      type: "Reinforcement Activities",
      title: "Guided Practice and Problem Solving",
      description: "Supplementary exercise modules targeting complex application questions.",
    });
    monitoringIndicators.push({
      metric: "Unit Assessments",
      frequency: "Per Topic",
      target: "Consistent score of 80% or higher on chapter / unit summative tasks.",
    });
  } else if (hasIsolatedFailure) {
    recommendedSupportLevel = "Subject-Specific Remediation";
    const subjectList = failingSubjects.map((s) => s.subjectName || s).join(", ");
    learningNeeds.push({
      category: "Isolated Subject Gap",
      description: `Learner demonstrates overall acceptable standing (GWA: ${gwa ?? "Passing"}), but requires focused remediation in: ${subjectList}.`,
    });
    targetObjectives.push({
      target: `Remediate deficiencies in ${subjectList} to reach passing threshold (≥ 75%)` + (termLabel ? ` for ${termLabel}.` : '.'),
      competencyFocus: "Isolated subject-specific skill recovery.",
    });
    recommendedActivities.push({
      type: "Targeted Remedial",
      title: "Isolated Subject Recovery Session",
      description: "Dedicated remedial consultation hours with subject teacher.",
    });
    monitoringIndicators.push({
      metric: "Subject Re-assessment",
      frequency: "Bi-weekly",
      target: "Passing score on subject recovery formative evaluation.",
    });
  } else if (isProvisional) {
    recommendedSupportLevel = "Provisional Academic Monitoring";
    targetObjectives.push({
      target: `Maintain interim academic pacing in ${subjectName}` + (termLabel ? ` for ${termLabel}` : '') + ` pending full-term grade completion.`,
      competencyFocus: "Classwork pacing and interim performance monitoring.",
    });
    recommendedActivities.push({
      type: "Interim Observation",
      title: "Classroom Monitoring & Check-ins",
      description: "Teacher observation and formative tracking pending full-term evaluation.",
    });
    monitoringIndicators.push({
      metric: "Term Finalization",
      frequency: "Per Quarter",
      target: "Finalization of required term subject grades without premature risk labeling.",
    });
  } else {
    recommendedSupportLevel = "General Monitoring & Enrichment";
    learningNeeds.push({
      category: "Academic Maintenance",
      subject: subjectName,
      description: `Regular classroom pacing; reinforcement of advanced competencies.`,
    });
    targetObjectives.push({
      target: `Maintain proficient standing in ${subjectName}` + (termLabel ? ` for ${termLabel}.` : '.'),
      competencyFocus: "Curriculum pacing and enrichment.",
    });
    recommendedActivities.push({
      type: "Classroom Pacing",
      title: "Standard Instructional Pathway",
      description: "Regular classroom activities and self-directed enrichment reading.",
    });
    monitoringIndicators.push({
      metric: "Quarterly Standing",
      frequency: "Per Quarter",
      target: "Maintenance of passing / proficient performance.",
    });
  }

  return {
    riskLevel,
    recommendedSupportLevel,
    learningNeeds,
    targetObjectives,
    recommendedActivities,
    monitoringIndicators,
    evidencePeriod,
    targetTerm,
  };
}

/**
 * Generates pedagogical goals, objectives, activities, and monitoring indicators for Reading (Phil-IRI / ARAL).
 * Supports:
 * - Verified Form 3 Reading Needs (Frustration, Instructional, Independent)
 * - Assessment Follow-Up Drafts (GST indicates Form 3 needed, but Form 3 profile is pending)
 * - Screening Benchmark Met (GST >= 28 without individual assessment need)
 * - BOSY reading-only initialization
 */
export function generateReadingContent(readingContext = {}) {
  const {
    readingPeriod = "BOSY",
    language = "English",
    gstScore = null,
    needsIndividualAssessment = false,
    form3ReadingProfile = null,
    gradeLevel = 7,
  } = readingContext;

  const isFilipino = /filipino/i.test(language);
  const langLabel = isFilipino ? "Filipino" : "English";

  const learningNeeds = [];
  const targetObjectives = [];
  const recommendedActivities = [];
  const monitoringIndicators = [];

  let recommendedSupportLevel = "Reading Support";
  let overallRiskLevel = "Low Risk";

  const normalizedProfile = form3ReadingProfile ? String(form3ReadingProfile).trim() : null;
  const isProfileVerified = Boolean(
    normalizedProfile &&
    ["frustration", "instructional", "independent", "non-reader"].includes(
      normalizedProfile.toLowerCase()
    )
  );

  // CASE 1: GST indicates Form 3 is required, but Form 3 is NOT yet verified
  // Generates an Assessment Follow-Up Plan (never invents a diagnosis!)
  if (!isProfileVerified && (needsIndividualAssessment || (gstScore !== null && Number(gstScore) < 28))) {
    overallRiskLevel = "Pending Reading Profile";
    recommendedSupportLevel = "Phil-IRI Form 3 Diagnostic Administration";

    learningNeeds.push({
      category: "Reading Assessment Follow-Up Required",
      assessment: `Phil-IRI ${langLabel} GST`,
      score: gstScore,
      description: `Learner obtained GST score of ${gstScore ?? "below cutoff"} in ${langLabel}. Individual assessment (Phil-IRI Form 3) is required to identify exact reading profile.`,
    });

    targetObjectives.push({
      target: `Administer Phil-IRI Form 3 Individual Assessment (${langLabel}) within prescribed assessment window.`,
      competencyFocus: "Diagnostic Oral Reading Verification (Word Reading & Comprehension).",
    });

    recommendedActivities.push({
      type: "Diagnostic Assessment",
      title: `Phil-IRI Form 3 One-on-One Assessment (${langLabel})`,
      description: `Schedule and administer graded oral reading passage and comprehension check to identify verified reading profile (Independent, Instructional, or Frustration).`,
    });

    monitoringIndicators.push({
      metric: "Form 3 Administration",
      frequency: "Once",
      target: "Record Form 3 results in Phil-IRI module before finalizing intervention placement.",
    });

    return {
      overallRiskLevel,
      recommendedSupportLevel,
      learningNeeds,
      targetObjectives,
      recommendedActivities,
      monitoringIndicators,
      prescription: `Assessment Follow-Up: Phil-IRI ${langLabel} Form 3 Individual Assessment required.`,
      isAssessmentFollowUp: true,
    };
  }

  // CASE 2: GST meets screening cutoff (>= 28) and no Form 3 profile is recorded (screening benchmark met)
  if (!isProfileVerified && gstScore !== null && Number(gstScore) >= 28) {
    overallRiskLevel = "Low Risk";
    recommendedSupportLevel = "Regular Classroom Reading (Benchmark Met)";

    learningNeeds.push({
      category: "Reading Screening Benchmark Met",
      assessment: `Phil-IRI (${langLabel} GST)`,
      score: gstScore,
      description: `Learner obtained GST score of ${gstScore} in ${langLabel}, meeting the grade-level screening benchmark. No individual assessment (Form 3) or remedial reading intervention is required under DepEd guidelines.`,
    });

    targetObjectives.push({
      target: `Maintain age-appropriate reading fluency and comprehension within standard classroom instruction in ${langLabel}.`,
      competencyFocus: "Curriculum-aligned reading and literary engagement.",
    });

    recommendedActivities.push({
      type: "Standard Instruction",
      title: `${langLabel} Regular Classroom Reading Activities`,
      description: "Standard classroom reading tasks, independent library reading, and group comprehension discussions.",
    });

    monitoringIndicators.push({
      metric: "Quarterly Reading Progress",
      frequency: "Per Quarter",
      target: "Continued satisfactory reading performance in regular classroom instruction.",
    });

    return {
      overallRiskLevel,
      recommendedSupportLevel,
      learningNeeds,
      targetObjectives,
      recommendedActivities,
      monitoringIndicators,
      prescription: `Standard classroom reading pacing. Phil-IRI ${langLabel} GST benchmark met (${gstScore}/40).`,
      isAssessmentFollowUp: false,
    };
  }

  // CASE 3: Verified Form 3 Reading Profile
  const profileKey = normalizedProfile ? normalizedProfile.toLowerCase() : "independent";
  const prescription = generatePlpPrescription({
    learningArea: langLabel,
    readingLevel: profileKey,
    gradeLevel: Number(gradeLevel) || 7,
  });

  if (profileKey.includes("frustration") || profileKey.includes("non-reader")) {
    overallRiskLevel = "High Risk";
    recommendedSupportLevel = "ARAL Intensive Reading Remediation (Tier 1)";

    learningNeeds.push({
      category: "Verified Reading Frustration",
      assessment: `Phil-IRI Form 3 (${langLabel})`,
      profile: "Frustration Level",
      description: `Learner is reading at Frustration level in ${langLabel}. Requires intensive decoding, phonics, and guided comprehension support.`,
    });

    targetObjectives.push({
      target: `Elevate oral reading accuracy and comprehension from Frustration to Instructional level by ${readingPeriod === "BOSY" ? "MOSY" : "EOSY"}.`,
      competencyFocus: isFilipino
        ? "Pagkilala sa pantig, palabigkasan, at pagbasa ng mga payak na pangungusap."
        : "Sound-letter blending, phonemic decoding, and sight word recognition.",
    });

    recommendedActivities.push({
      type: "ARAL Tier 1 Intervention",
      title: `${langLabel} Daily Reading Remediation`,
      description: prescription,
    });

    monitoringIndicators.push({
      metric: "Oral Reading Fluency",
      frequency: "Weekly",
      target: "Weekly oral reading speed and word accuracy progression check.",
    });
  } else if (profileKey.includes("instructional")) {
    overallRiskLevel = "Moderate Risk";
    recommendedSupportLevel = "ARAL Targeted Reading Support (Tier 2)";

    learningNeeds.push({
      category: "Verified Reading Instructional Level",
      assessment: `Phil-IRI Form 3 (${langLabel})`,
      profile: "Instructional Level",
      description: `Learner is reading at Instructional level in ${langLabel}. Requires vocabulary expansion and targeted comprehension strategies.`,
    });

    targetObjectives.push({
      target: `Transition from Instructional to Independent reading level by ${readingPeriod === "BOSY" ? "MOSY" : "EOSY"}.`,
      competencyFocus: isFilipino
        ? "Pagsusuri sa kahulugan ng salita at pag-unawa sa mga pangunahing ideya."
        : "Vocabulary acquisition, literal comprehension, and oral reading expression.",
    });

    recommendedActivities.push({
      type: "ARAL Tier 2 Intervention",
      title: `${langLabel} Fluency & Comprehension Drills`,
      description: prescription,
    });

    monitoringIndicators.push({
      metric: "Comprehension Checks",
      frequency: "Bi-weekly",
      target: "Score ≥ 75% on short passage reading comprehension evaluations.",
    });
  } else {
    // Independent: Optional enrichment, not statutory ARAL eligibility
    overallRiskLevel = "Low Risk";
    recommendedSupportLevel = "Reading Enrichment & Critical Literacy (Tier 3 - Optional)";

    learningNeeds.push({
      category: "Independent Reader",
      assessment: `Phil-IRI (${langLabel})`,
      profile: "Independent Level",
      description: `Learner is reading independently at or above grade level in ${langLabel}. Optional reading enrichment provided.`,
    });

    targetObjectives.push({
      target: "Develop advanced inferential comprehension and critical textual analysis skills.",
      competencyFocus: "Analytical and evaluative reading engagement.",
    });

    recommendedActivities.push({
      type: "Enrichment",
      title: `${langLabel} Critical Literacy Circles`,
      description: prescription,
    });

    monitoringIndicators.push({
      metric: "Reflective Output",
      frequency: "Monthly",
      target: "Submission of qualitative literary reflection entries.",
    });
  }

  return {
    overallRiskLevel,
    recommendedSupportLevel,
    learningNeeds,
    targetObjectives,
    recommendedActivities,
    monitoringIndicators,
    prescription,
    isAssessmentFollowUp: false,
  };
}

/**
 * Main pure PLP generation function.
 *
 * @param {object} params
 * @param {object} params.student - Learner details { id, name, gradeLevel, sectionId }
 * @param {string} params.schoolYear - e.g. "2026-2027"
 * @param {object} [params.academicContext] - Academic information (grades, term, class_id, etc.)
 * @param {object} [params.readingContext] - Reading information (GST, Form 3, period, etc.)
 * @param {object} [params.existingPlp] - Current PLP row from database (if any)
 * @returns {object} { success: boolean, plan: object, isProtected: boolean, message?: string }
 */
export function generateDraftPlp({
  student = {},
  schoolYear = "2026-2027",
  academicContext = null,
  readingContext = null,
  existingPlp = null,
} = {}) {
  // 1. Guard against overwriting teacher customizations or finalized/active plans
  if (existingPlp && isPlpProtected(existingPlp)) {
    return {
      success: false,
      isProtected: true,
      canOverwrite: false,
      code: "PLP_PROTECTED_FROM_AUTOMATION",
      status: "protected",
      message:
        "PLP is protected from automated re-generation because it is teacher-reviewed, active, or customized.",
      plan: existingPlp,
    };
  }

  const studentId = student.id || student.student_id;
  if (!studentId) {
    throw new Error("generateDraftPlp requires student.id.");
  }

  // 2. Determine Plan Type based on verified evidence needs
  const hasAcademicContext = Boolean(academicContext && academicContext.classId);

  const normalizedReadingProfile = readingContext?.form3ReadingProfile
    ? String(readingContext.form3ReadingProfile).trim().toLowerCase()
    : null;
  const hasVerifiedReadingProfile = Boolean(normalizedReadingProfile);
  const hasReadingFollowUpNeeded = Boolean(
    readingContext?.needsIndividualAssessment ||
    (readingContext?.gstScore !== null &&
      readingContext?.gstScore !== undefined &&
      Number(readingContext.gstScore) < 28 &&
      !normalizedReadingProfile)
  );
  // Only verified Form 3 reading profile or objective need for assessment (GST < 28) qualifies as evidenced reading need.
  // An administrative referral pending review does not constitute verified reading difficulty.
  const hasEvidencedReadingNeed = Boolean(
    hasVerifiedReadingProfile || hasReadingFollowUpNeeded
  );

  const isReadingOnlyContext = Boolean(
    readingContext?.readingPeriod && !hasAcademicContext
  );

  let planType = PLP_PLAN_TYPE.ACADEMIC_REMEDIAL;

  if (isReadingOnlyContext) {
    // Pure reading / BOSY context without academic classes
    planType = PLP_PLAN_TYPE.READING_ARAL;
  } else if (hasAcademicContext && hasEvidencedReadingNeed) {
    // Both academic deficiency and evidenced reading difficulty -> Composite Plan
    planType = PLP_PLAN_TYPE.COMPOSITE;
  } else if (hasAcademicContext) {
    // Academic deficiency present, but reading benchmark met or no reading concern -> Academic Remedial Plan
    planType = PLP_PLAN_TYPE.ACADEMIC_REMEDIAL;
  } else if (readingContext?.readingPeriod) {
    planType = PLP_PLAN_TYPE.READING_ARAL;
  } else {
    planType = PLP_PLAN_TYPE.ACADEMIC_REMEDIAL;
  }

  let overallRisk = "Low Risk";
  let recommendedSupport = "Standard Instructional Support";
  let learningNeeds = [];
  let targetObjectives = [];
  let recommendedActivities = [];
  let monitoringIndicators = [];

  // Evidence Period and Target Term are independent. targetTerm is null unless an
  // explicit academicContext.targetTerm (1–3) is supplied.
  const { evidencePeriod, isFinalGradeEvidence, targetTerm } =
    resolveAcademicPeriods(academicContext);

  // 3. Assemble Academic Content
  if (planType === PLP_PLAN_TYPE.ACADEMIC_REMEDIAL || planType === PLP_PLAN_TYPE.COMPOSITE) {
    const acad = generateAcademicContent(academicContext || {});
    overallRisk = acad.riskLevel;
    recommendedSupport = acad.recommendedSupportLevel;
    learningNeeds.push(...acad.learningNeeds);
    targetObjectives.push(...acad.targetObjectives);
    recommendedActivities.push(...acad.recommendedActivities);
    monitoringIndicators.push(...acad.monitoringIndicators);
  }

  // 4. Assemble Reading Content
  if (planType === PLP_PLAN_TYPE.READING_ARAL || planType === PLP_PLAN_TYPE.COMPOSITE) {
    const read = generateReadingContent({
      ...readingContext,
      gradeLevel: student.gradeLevel || 7,
    });
    // In composite plans, elevate risk if reading risk is higher
    if (planType === PLP_PLAN_TYPE.COMPOSITE) {
      if (read.overallRiskLevel === "High Risk" || overallRisk === "High Risk") {
        overallRisk = "High Risk";
      } else if (read.overallRiskLevel === "Moderate Risk" && overallRisk !== "High Risk") {
        overallRisk = "Moderate Risk";
      }
      recommendedSupport = `${recommendedSupport} & ${read.recommendedSupportLevel}`;
    } else {
      overallRisk = read.overallRiskLevel;
      recommendedSupport = read.recommendedSupportLevel;
    }

    learningNeeds.push(...read.learningNeeds);
    targetObjectives.push(...read.targetObjectives);
    recommendedActivities.push(...read.recommendedActivities);
    monitoringIndicators.push(...read.monitoringIndicators);
  }

  // 5. Build Final PLP Object conforming to Migration 056 shape
  const draftPlan = {
    id: existingPlp?.id || undefined,
    student_id: studentId,
    class_id:
      planType === PLP_PLAN_TYPE.READING_ARAL
        ? null
        : academicContext?.classId || null,
    teacher_id: academicContext?.teacherId || null,
    school_year: schoolYear,
    academic_term:
      planType === PLP_PLAN_TYPE.READING_ARAL
        ? null
        : targetTerm,

    reading_period:
      planType === PLP_PLAN_TYPE.ACADEMIC_REMEDIAL
        ? null
        : readingContext?.readingPeriod || "BOSY",
    plan_type: planType,
    status: PLP_STATUS.DRAFT,
    overall_risk_level: overallRisk,
    recommended_support_level: recommendedSupport,
    learning_needs: learningNeeds,
    target_objectives: targetObjectives,
    recommended_activities: recommendedActivities,
    monitoring_indicators: monitoringIndicators,
    teacher_notes: existingPlp?.teacher_notes || null,
    is_teacher_edited: false,
    version: existingPlp?.version ? existingPlp.version + 1 : 1,
  };

  // Attach optional non-persisted reading summary for academic-only plans when context exists
  if (planType === PLP_PLAN_TYPE.ACADEMIC_REMEDIAL && readingContext) {
    draftPlan.reading_summary = {
      gstScore: readingContext.gstScore ?? null,
      form3ReadingProfile: readingContext.form3ReadingProfile ?? null,
      benchmarkMet: readingContext.gstScore !== null && Number(readingContext.gstScore) >= 28,
      language: readingContext.language || "English",
    };
  }

  // Attach non-persisted academic evidence metadata (not a Migration 056 column).
  if (planType !== PLP_PLAN_TYPE.READING_ARAL) {
    draftPlan.academic_evidence = {
      evidence_period: evidencePeriod,
      evidence_period_label: evidencePeriod != null ? formatTermLabel(evidencePeriod) : null,
      is_final_grade_evidence: isFinalGradeEvidence,
      target_term: targetTerm,
      target_term_status: targetTerm != null ? "specified" : "unspecified",
    };
  }

  // Validate shape against Migration 056 CHECK constraints. Drafts may leave the
  // target term unspecified; an out-of-range term (e.g. 4) is still rejected.
  const validation = validatePlpShape(draftPlan, { requireTargetTerm: false });
  if (!validation.valid) {
    throw new Error(`PLP shape validation failed: ${validation.error}`);
  }

  return {
    success: true,
    isProtected: false,
    canOverwrite: true,
    status: "draft_generated",
    plan: draftPlan,
  };
}
