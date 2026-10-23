import test from "node:test";
import assert from "node:assert/strict";

import {
  generateDraftPlp,
  generateAcademicContent,
  generateReadingContent,
  resolveAcademicPeriods,
  validatePlpShape,
  PLP_PLAN_TYPE,
  PLP_STATUS,
} from "../lib/monitoring/plpGenerator.js";
import { FEATURE_PLP_PERSISTENCE } from "../lib/supabase/queries/plpQueries.js";

// ============================================================================
// CNHS LEARN P0-01 VERIFICATION HARNESS: TERM CONSISTENCY & SEPARATION OF
// EVIDENCE PERIOD VS TARGET TERM
// ============================================================================

test("1. Term 1-3 academic evidence with no target term leaves target_term null and does not fabricate term label", () => {
  const result = generateDraftPlp({
    student: { id: "s-t1", name: "Student T1", gradeLevel: 7 },
    schoolYear: "2026-2027",
    academicContext: {
      classId: "cls-01",
      evidencePeriod: 1, // Term 1 evidence
      subjectName: "Mathematics",
      subjectGrade: 70,
      overallRisk: "High Risk",
    },
  });

  assert.equal(result.success, true);
  const plan = result.plan;
  assert.equal(plan.academic_term, null, "Target term must not be automatically assumed from evidencePeriod");
  assert.equal(plan.academic_evidence?.evidence_period, 1);
  assert.equal(plan.academic_evidence?.evidence_period_label, "Term 1");

  // Objective must NOT claim "for Term 1" when target term was not specified
  const obj = plan.target_objectives[0];
  assert.ok(obj.target.includes("Mathematics"), "Objective targets subject");
  assert.ok(!obj.target.includes("Term 1"), `Objective must not fabricate target term label: ${obj.target}`);
});

test("2. Distinct Evidence Period and Target Term: Term 1 evidence informing Term 2 intervention", () => {
  const result = generateDraftPlp({
    student: { id: "s-t1-t2", name: "Student T1 to T2", gradeLevel: 7 },
    schoolYear: "2026-2027",
    academicContext: {
      classId: "cls-01",
      evidencePeriod: 1, // Recorded in Term 1
      targetTerm: 2,     // Intervention targeting Term 2
      subjectName: "English",
      subjectGrade: 68,
      overallRisk: "High Risk",
    },
  });

  assert.equal(result.success, true);
  const plan = result.plan;
  assert.equal(plan.academic_term, 2, "plan.academic_term must strictly reflect targetTerm (Term 2)");
  assert.equal(plan.academic_evidence?.evidence_period, 1, "Evidence period must remain Term 1");
  assert.equal(plan.academic_evidence?.target_term, 2);

  // Target objective must specify Term 2
  const obj = plan.target_objectives[0];
  assert.ok(obj.target.includes("for Term 2."), `Objective must specify target Term 2, got: ${obj.target}`);

  // Learning need notes the historical evidence context
  const need = plan.learning_needs[0];
  assert.ok(need.description.includes("Term 1"), `Learning need should note evidence period, got: ${need.description}`);
});

test("3. quarter=4 Final Grade evidence: NEVER becomes an instructional target term", () => {
  const result = generateDraftPlp({
    student: { id: "s-q4", name: "Student Final Grade", gradeLevel: 8 },
    schoolYear: "2026-2027",
    academicContext: {
      classId: "cls-sci-8",
      quarterNumber: 4, // Legacy quarter=4 (Final Grade)
      subjectName: "Science",
      subjectGrade: 72,
      overallRisk: "High Risk",
    },
  });

  assert.equal(result.success, true);
  const plan = result.plan;
  assert.equal(plan.academic_term, null, "quarter=4 Final Grade must NEVER map to instructional academic_term");
  assert.equal(plan.academic_evidence?.is_final_grade_evidence, true);
  assert.equal(plan.academic_evidence?.evidence_period, 4);
  assert.equal(plan.academic_evidence?.evidence_period_label, "Final Grade / Average");

  // Objective must NOT say "Term 4" or "Final Grade" as an instructional target term
  for (const obj of plan.target_objectives) {
    assert.ok(!obj.target.includes("Term 4"), `Objective must not contain Term 4: ${obj.target}`);
    assert.ok(!obj.target.includes("for Final"), `Objective must not treat Final Grade as a term: ${obj.target}`);
  }
});

test("4. Missing academic evidence: does NOT fabricate academic objectives", () => {
  const result = generateDraftPlp({
    student: { id: "s-no-evidence", name: "Student No Grade", gradeLevel: 7 },
    schoolYear: "2026-2027",
    academicContext: {
      classId: "cls-esp-7",
      subjectName: "Edukasyon sa Pagpapakatao",
      subjectGrade: null, // No recorded grade
      failingSubjects: [],
      isProvisional: false,
    },
  });

  assert.equal(result.success, true);
  const plan = result.plan;
  assert.equal(plan.target_objectives.length, 0, "No academic objectives may be fabricated without evidence");
  assert.equal(plan.overall_risk_level, "Pending Academic Evidence");
  assert.equal(plan.recommended_support_level, "Awaiting Academic Evidence");
  assert.ok(plan.learning_needs[0].description.includes("No recorded grade"));
});

test("5. Reading-Only BOSY PLP generation: preserved with null academic_term", () => {
  const result = generateDraftPlp({
    student: { id: "s-bosy-read", name: "BOSY Reader", gradeLevel: 7 },
    schoolYear: "2026-2027",
    readingContext: {
      readingPeriod: "BOSY",
      language: "English",
      gstScore: 16,
      form3ReadingProfile: "Frustration",
      gradeLevel: 7,
    },
  });

  assert.equal(result.success, true);
  const plan = result.plan;
  assert.equal(plan.plan_type, PLP_PLAN_TYPE.READING_ARAL);
  assert.equal(plan.academic_term, null, "Reading ARAL plan must have null academic_term");
  assert.equal(plan.class_id, null, "Reading ARAL plan must have null class_id");
  assert.equal(plan.reading_period, "BOSY");
  assert.ok(plan.target_objectives.length > 0, "Reading objectives must be generated from Form 3 Frustration");
  assert.equal(validatePlpShape(plan).valid, true, "Validates against Migration 056 shape");
});

test("6. Composite plan with explicit target term validates strictly against Migration 056 shape", () => {
  const result = generateDraftPlp({
    student: { id: "s-composite", name: "Composite Learner", gradeLevel: 7 },
    schoolYear: "2026-2027",
    academicContext: {
      classId: "cls-math-7",
      evidencePeriod: 1,
      targetTerm: 1, // Explicit instructional target
      subjectName: "Mathematics",
      subjectGrade: 71,
      overallRisk: "High Risk",
    },
    readingContext: {
      readingPeriod: "BOSY",
      language: "English",
      gstScore: 18,
      form3ReadingProfile: "Frustration",
      gradeLevel: 7,
    },
  });

  assert.equal(result.success, true);
  const plan = result.plan;
  assert.equal(plan.plan_type, PLP_PLAN_TYPE.COMPOSITE);
  assert.equal(plan.academic_term, 1);
  assert.equal(plan.reading_period, "BOSY");
  assert.equal(validatePlpShape(plan, { requireTargetTerm: true }).valid, true);
});

test("7. Safety Invariant: FEATURE_PLP_PERSISTENCE remains false and DB mutations are locked", () => {
  assert.strictEqual(FEATURE_PLP_PERSISTENCE, false, "FEATURE_PLP_PERSISTENCE must remain strictly false");
});
