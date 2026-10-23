import test from "node:test";
import assert from "node:assert/strict";

import {
  generateDraftPlp,
  generateAcademicContent,
  generateReadingContent,
  validatePlpShape,
  PLP_PLAN_TYPE,
  PLP_STATUS,
} from "../lib/monitoring/plpGenerator.js";
import {
  buildPlpReportFilename,
  exportPlpPdf,
} from "../lib/reports/plpReportExport.js";
import { FEATURE_PLP_PERSISTENCE } from "../lib/supabase/queries/plpQueries.js";

// ============================================================================
// 1. CONTENT INTEGRITY: ENGLISH 69 + GST 29/40
// ============================================================================

test("PLP Integrity: English grade 69 + GST 29/40 generates Academic-Only plan (NOT Composite)", () => {
  const result = generateDraftPlp({
    student: { id: "stud-eng-69", name: "Marco Polo", gradeLevel: 7 },
    schoolYear: "2026-2027",
    academicContext: {
      classId: "cls-eng-7",
      term: 4,
      subjectName: "English",
      subjectGrade: 69,
      overallRisk: "High Risk",
    },
    readingContext: {
      readingPeriod: "BOSY",
      language: "English",
      gstScore: 29, // Benchmark is 28; 29/40 means benchmark met
      needsIndividualAssessment: false,
      form3ReadingProfile: null,
      gradeLevel: 7,
      hasActiveReferral: false,
    },
  });

  assert.equal(result.success, true);
  const plan = result.plan;

  // Must be academic_remedial, NEVER composite when reading benchmark is met
  assert.equal(
    plan.plan_type,
    PLP_PLAN_TYPE.ACADEMIC_REMEDIAL,
    "Learner with met reading benchmark must receive an academic remedial plan, NOT composite"
  );
  assert.equal(plan.class_id, "cls-eng-7");
  assert.equal(plan.academic_term, null, "Final Grade (term 4) evidence must never become target academic_term");
  assert.equal(plan.reading_period, null, "academic_remedial plan must have null reading_period");

  // Must NOT infer Independent Reader classification from GST alone
  const independentNeed = plan.learning_needs.find(
    (n) => n.category === "Independent Reader" || (n.profile && n.profile.includes("Independent"))
  );
  assert.equal(
    independentNeed,
    undefined,
    "GST score alone must not infer an Independent Reader classification"
  );

  // Must NOT assign Tier 3 ARAL reading enrichment
  assert.ok(
    !plan.recommended_support_level.includes("ARAL"),
    "Learner with GST 29/40 must not be assigned to ARAL"
  );
  assert.ok(
    !plan.recommended_support_level.includes("Tier 3"),
    "Academic remedial plan must not prescribe Tier 3 reading enrichment"
  );
  assert.ok(
    plan.recommended_support_level.includes("Remediation"),
    "Must prescribe academic remediation for failing grade"
  );

  // Conforms to Migration 056 shape (drafts allow unassigned target term)
  const validation = validatePlpShape(plan, { requireTargetTerm: false });
  assert.equal(validation.valid, true, "Generated plan must strictly conform to Migration 056 constraints");
});

test("PLP Integrity: GST >= 28 alone does not infer Independent Reader in generateReadingContent", () => {
  const content = generateReadingContent({
    readingPeriod: "BOSY",
    language: "English",
    gstScore: 31,
    needsIndividualAssessment: false,
    form3ReadingProfile: null,
    gradeLevel: 7,
  });

  assert.equal(content.overallRiskLevel, "Low Risk");
  assert.ok(
    content.recommendedSupportLevel.includes("Benchmark Met"),
    "Must state benchmark is met, not certify Independent Reader"
  );
  assert.ok(
    !content.recommendedSupportLevel.includes("Tier 3"),
    "GST alone must not assign Tier 3 reading enrichment"
  );

  const need = content.learningNeeds[0];
  assert.ok(
    need.category.includes("Benchmark Met"),
    "Category must reflect screening benchmark met, not Form 3 level"
  );
  assert.ok(
    need.description.includes("screening benchmark"),
    "Description must clarify no individual assessment is required"
  );
});

// ============================================================================
// 2. CONTENT INTEGRITY: GST BELOW 28 WITHOUT COMPLETED FORM 3
// ============================================================================

test("PLP Integrity: GST below 28 without completed Form 3 generates assessment follow-up (no premature ARAL)", () => {
  const result = generateDraftPlp({
    student: { id: "stud-gst-low", name: "David Santos", gradeLevel: 8 },
    schoolYear: "2026-2027",
    readingContext: {
      readingPeriod: "BOSY",
      language: "Filipino",
      gstScore: 19,
      needsIndividualAssessment: true,
      form3ReadingProfile: null,
      gradeLevel: 8,
    },
  });

  assert.equal(result.success, true);
  const plan = result.plan;
  assert.equal(plan.plan_type, PLP_PLAN_TYPE.READING_ARAL);
  assert.equal(plan.overall_risk_level, "Pending Reading Profile");
  assert.equal(
    plan.recommended_support_level,
    "Phil-IRI Form 3 Diagnostic Administration"
  );
  assert.ok(
    !plan.recommended_support_level.includes("ARAL Intensive"),
    "Must not assign ARAL intervention before Form 3 verification"
  );

  const objective = plan.target_objectives[0];
  assert.ok(
    objective.target.includes("Administer Phil-IRI Form 3"),
    "Objective must target administering diagnostic assessment"
  );
});

// ============================================================================
// 3. VERIFIED FORM 3 READING DIFFICULTY
// ============================================================================

test("PLP Integrity: Verified Form 3 Frustration + Failing Grade generates Composite Plan", () => {
  const result = generateDraftPlp({
    student: { id: "stud-comp", name: "Carla Cruz", gradeLevel: 7 },
    schoolYear: "2026-2027",
    academicContext: {
      classId: "cls-math-7",
      term: 2,
      targetTerm: 2,
      subjectName: "Mathematics",
      subjectGrade: 70,
      overallRisk: "High Risk",
    },
    readingContext: {
      readingPeriod: "BOSY",
      language: "English",
      gstScore: 15,
      form3ReadingProfile: "Frustration",
      gradeLevel: 7,
    },
  });

  assert.equal(result.success, true);
  const plan = result.plan;
  assert.equal(plan.plan_type, PLP_PLAN_TYPE.COMPOSITE);
  assert.equal(plan.class_id, "cls-math-7");
  assert.equal(plan.academic_term, 2);
  assert.equal(plan.reading_period, "BOSY");
  assert.equal(plan.overall_risk_level, "High Risk");
  assert.ok(plan.recommended_support_level.includes("Remediation"));
  assert.ok(plan.recommended_support_level.includes("ARAL"));

  const validation = validatePlpShape(plan);
  assert.equal(validation.valid, true);
});

test("PLP Integrity: Verified Form 3 Reading-Only generates Reading ARAL plan", () => {
  const result = generateDraftPlp({
    student: { id: "stud-read-only", name: "Bea Alonzo", gradeLevel: 7 },
    schoolYear: "2026-2027",
    academicContext: null,
    readingContext: {
      readingPeriod: "BOSY",
      language: "English",
      gstScore: 17,
      form3ReadingProfile: "Instructional",
      gradeLevel: 7,
    },
  });

  assert.equal(result.success, true);
  const plan = result.plan;
  assert.equal(plan.plan_type, PLP_PLAN_TYPE.READING_ARAL);
  assert.equal(plan.class_id, null);
  assert.equal(plan.academic_term, null);
  assert.equal(plan.reading_period, "BOSY");
  assert.ok(plan.recommended_support_level.includes("ARAL Targeted Reading Support (Tier 2)"));

  const validation = validatePlpShape(plan);
  assert.equal(validation.valid, true);
});

// ============================================================================
// 4. ACADEMIC TERM CONSISTENCY
// ============================================================================

test("PLP Term Consistency: When academicContext has quarter 4 (Final Grade), objective does NOT target Term 4", () => {
  const result = generateDraftPlp({
    student: { id: "stud-term-4", name: "Francesca Evangelista", gradeLevel: 7 },
    schoolYear: "2026-2027",
    academicContext: {
      classId: "cls-eng-7",
      term: 4, // Final Grade evidence
      subjectName: "English",
      subjectGrade: 69,
      overallRisk: "High Risk",
    },
    readingContext: {
      readingPeriod: "BOSY",
      language: "English",
      gstScore: 29,
      needsIndividualAssessment: false,
      form3ReadingProfile: null,
      gradeLevel: 7,
    },
  });

  assert.equal(result.success, true);
  const plan = result.plan;
  assert.equal(plan.academic_term, null, "Final Grade evidence must NOT become target academic_term");

  const targetObjective = plan.target_objectives[0];
  assert.ok(
    !targetObjective.target.includes("Term 4"),
    `Target objective must NOT state 'Term 4', got: ${targetObjective.target}`
  );
  assert.ok(
    !targetObjective.target.includes("Term 1"),
    "Target objective must NOT default to Term 1 when evidence was Final Grade"
  );
});

// ============================================================================
// 5. PDF CONTENT INTEGRITY & ZERO [object Object]
// ============================================================================

test("PLP PDF Export: Renders structured objects as formatted text without [object Object]", () => {
  const plp = {
    plan_type: "academic_remedial",
    overall_risk_level: "High Risk",
    recommended_support_level: "Intensive Academic Remediation",
    school_year: "SY 2026-2027",
    status: "draft",
    learning_needs: [
      {
        category: "Foundational Competency Gap",
        subject: "English",
        grade: 69,
        description: "Intensive remediation required for foundational competencies in English (Current Grade: 69).",
      },
    ],
    target_objectives: [
      {
        target: "Attain a passing mark (≥ 75%) in English for Quarter / Term 4.",
        competencyFocus: "Essential curriculum competencies in English.",
      },
    ],
    recommended_activities: [
      {
        type: "Remedial Instruction",
        title: "English Classroom Remediation",
        description: "Teacher-guided differentiated instructional drills.",
      },
    ],
    monitoring_indicators: [
      {
        metric: "Formative Quizzes",
        frequency: "Weekly",
        target: "Score at least 75% on formative check-ins.",
      },
    ],
  };

  const exportResult = exportPlpPdf({
    plp,
    learner: {
      name: "Francesca J. Evangelista",
      studentNumber: "LRN-1029384",
      gradeSection: "Grade 7 - Diamond",
    },
    teacherName: "Maria Clara",
  });

  assert.equal(exportResult.success, true);
  assert.ok(exportResult.filename.includes("CNHS_PLP"), "Filename must start with CNHS_PLP");
  assert.ok(exportResult.filename.endsWith(".pdf"), "Filename must end with .pdf");

  // Critical check: HTML MUST NOT contain '[object Object]'
  assert.ok(
    !exportResult.html.includes("[object Object]"),
    "Exported HTML must cleanly format structured objects and never output '[object Object]'"
  );

  // Verify formatted text elements are present
  assert.ok(exportResult.html.includes("Intensive remediation required"));
  assert.ok(exportResult.html.includes("Attain a passing mark (≥ 75%) in English for Quarter / Term 4."));
  assert.ok(exportResult.html.includes("English Classroom Remediation"));
  assert.ok(exportResult.html.includes("Formative Quizzes"));

  // Verify honest unsaved educator draft preview notice
  assert.ok(
    exportResult.html.includes("Working educator draft preview (unsaved)"),
    "PDF must include honest working educator draft preview notice"
  );
});

// ============================================================================
// 6. SAFETY INVARIANTS
// ============================================================================

test("PLP Safety Invariant: FEATURE_PLP_PERSISTENCE remains strictly false", () => {
  assert.strictEqual(
    FEATURE_PLP_PERSISTENCE,
    false,
    "FEATURE_PLP_PERSISTENCE must remain strictly false (zero database mutations)"
  );
});
