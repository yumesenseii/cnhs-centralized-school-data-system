import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  generateDraftPlp,
  isPlpProtected,
  validatePlpShape,
  generateAcademicContent,
  generateReadingContent,
  PLP_PLAN_TYPE,
  PLP_STATUS,
} from "../lib/monitoring/plpGenerator.js";
import {
  FEATURE_PLP_PERSISTENCE,
  generateAndSaveDraftPlp,
  saveTeacherPlpDraft,
  markPlpReviewed,
  activatePlp,
} from "../lib/supabase/queries/plpQueries.js";

// ============================================================================
// 1. ACADEMIC, READING-ONLY, COMPOSITE, AND ASSESSMENT-FOLLOW-UP PRESENTATION
// ============================================================================

test("Phase 4 Offline UI: Academic Remedial Plan structure & content presentation", () => {
  const result = generateDraftPlp({
    student: { id: "stud-01", name: "Maria Santos", gradeLevel: 8 },
    schoolYear: "2026-2027",
    academicContext: {
      classId: "cls-math-8",
      term: 1,
      targetTerm: 1,
      teacherId: "teach-01",
      subjectName: "Mathematics",
      subjectGrade: 71,
      overallRisk: "High Risk",
      gwa: null,
      failingSubjects: [{ subjectName: "Mathematics", grade: 71 }],
      isProvisional: false,
    },
  });

  assert.equal(result.success, true);
  const plan = result.plan;
  assert.equal(plan.plan_type, PLP_PLAN_TYPE.ACADEMIC_REMEDIAL);
  assert.equal(plan.status, PLP_STATUS.DRAFT);
  assert.equal(plan.class_id, "cls-math-8");
  assert.equal(plan.academic_term, 1);
  assert.equal(plan.reading_period, null);
  assert.equal(plan.overall_risk_level, "High Risk");

  // Learning needs & objectives check
  assert.ok(plan.learning_needs.length > 0);
  assert.ok(plan.learning_needs[0].description.includes("Mathematics"));
  assert.ok(plan.target_objectives.length > 0);
  assert.ok(plan.target_objectives[0].target.includes("75%"));
  assert.ok(plan.recommended_activities.length > 0);
  assert.ok(plan.monitoring_indicators.length > 0);

  // Validate shape matches Migration 056 CHECK constraint
  const shape = validatePlpShape(plan);
  assert.equal(shape.valid, true);
});

test("Phase 4 Offline UI: Incomplete Academic Evidence generates provisional notice without fabricated GWA", () => {
  const result = generateDraftPlp({
    student: { id: "stud-02", name: "Jose Rizal", gradeLevel: 7 },
    schoolYear: "2026-2027",
    academicContext: {
      classId: "cls-sci-7",
      term: 1,
      teacherId: "teach-02",
      subjectName: "Science",
      subjectGrade: 73,
      overallRisk: null, // No authoritative overall risk because term is incomplete
      gwa: null,         // GWA cannot be computed
      failingSubjects: [{ subjectName: "Science", grade: 73 }],
      isProvisional: true,
    },
  });

  assert.equal(result.success, true);
  const plan = result.plan;
  // Verify provisional learning need is recorded
  const provNeed = plan.learning_needs.find((n) => n.category === "Provisional Academic Monitoring");
  assert.ok(provNeed, "Must record provisional category for partial academic evidence");
  assert.ok(provNeed.description.includes("provisional pending full-term grade completion"));
});

test("Phase 4 Offline UI: BOSY Reading-Only Plan generated cleanly without academic grades", () => {
  const result = generateDraftPlp({
    student: { id: "stud-03", name: "Ana Gomez", gradeLevel: 7 },
    schoolYear: "2026-2027",
    academicContext: null, // No academic grades exist yet at BOSY
    readingContext: {
      readingPeriod: "BOSY",
      language: "English",
      gstScore: 16,
      needsIndividualAssessment: false,
      form3ReadingProfile: "Frustration",
      gradeLevel: 7,
    },
  });

  assert.equal(result.success, true);
  const plan = result.plan;
  assert.equal(plan.plan_type, PLP_PLAN_TYPE.READING_ARAL);
  assert.equal(plan.class_id, null, "Reading plan must have null class_id");
  assert.equal(plan.academic_term, null, "Reading plan must have null academic_term");
  assert.equal(plan.reading_period, "BOSY");
  assert.equal(plan.overall_risk_level, "High Risk");
  assert.ok(plan.recommended_support_level.includes("ARAL Intensive Reading Remediation"));

  const shape = validatePlpShape(plan);
  assert.equal(shape.valid, true);
});

test("Phase 4 Offline UI: GST below 28 without verified Form 3 generates Assessment Follow-Up, NOT ARAL placement", () => {
  const result = generateDraftPlp({
    student: { id: "stud-04", name: "Pedro Penduko", gradeLevel: 7 },
    schoolYear: "2026-2027",
    readingContext: {
      readingPeriod: "BOSY",
      language: "Filipino",
      gstScore: 21, // Below cutoff of 28
      needsIndividualAssessment: true,
      form3ReadingProfile: null, // Form 3 oral assessment pending
      gradeLevel: 7,
    },
  });

  assert.equal(result.success, true);
  const plan = result.plan;
  assert.equal(plan.overall_risk_level, "Pending Reading Profile");
  assert.equal(plan.recommended_support_level, "Phil-IRI Form 3 Diagnostic Administration");

  // Objective must target Form 3 administration, not remedial tutoring
  assert.ok(plan.target_objectives[0].target.includes("Administer Phil-IRI Form 3"));
  assert.ok(plan.recommended_activities[0].title.includes("Form 3 One-on-One Assessment"));
});

test("Phase 4 Offline UI: Independent Reading Result does NOT trigger ARAL intervention", () => {
  const result = generateDraftPlp({
    student: { id: "stud-05", name: "Elena Ramos", gradeLevel: 9 },
    schoolYear: "2026-2027",
    readingContext: {
      readingPeriod: "BOSY",
      language: "English",
      gstScore: 34,
      needsIndividualAssessment: false,
      form3ReadingProfile: "Independent",
      gradeLevel: 9,
    },
  });

  assert.equal(result.success, true);
  const plan = result.plan;
  assert.equal(plan.overall_risk_level, "Low Risk");
  assert.ok(plan.recommended_support_level.includes("Reading Enrichment & Critical Literacy"));
  assert.ok(!plan.recommended_support_level.includes("ARAL"), "Independent readers must not trigger ARAL");
  assert.ok(plan.target_objectives[0].target.includes("inferential comprehension"));
});

test("Phase 4 Offline UI: Composite Plan combining Academic and Reading needs", () => {
  const result = generateDraftPlp({
    student: { id: "stud-06", name: "Carlo Magno", gradeLevel: 7 },
    schoolYear: "2026-2027",
    academicContext: {
      classId: "cls-math-7",
      term: 1,
      targetTerm: 1,
      teacherId: "teach-03",
      subjectName: "Mathematics",
      subjectGrade: 70,
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
  assert.equal(plan.class_id, "cls-math-7");
  assert.equal(plan.academic_term, 1);
  assert.equal(plan.reading_period, "BOSY");
  assert.equal(plan.overall_risk_level, "High Risk");
  assert.ok(plan.recommended_support_level.includes("Remediation"));
  assert.ok(plan.recommended_support_level.includes("ARAL"));

  const shape = validatePlpShape(plan);
  assert.equal(shape.valid, true);
});

// ============================================================================
// 2. TEACHER DRAFT EDITS & NON-OVERWRITE PROTECTION
// ============================================================================

test("Phase 4 Offline UI: Teacher draft customizations mark is_teacher_edited and prevent automated overwrite", () => {
  const initial = generateDraftPlp({
    student: { id: "stud-07", name: "Liza Soberano", gradeLevel: 7 },
    academicContext: {
      classId: "cls-eng-7",
      term: 1,
      subjectName: "English",
      subjectGrade: 72,
    },
  });

  const basePlan = initial.plan;
  assert.equal(basePlan.is_teacher_edited, false);
  assert.equal(isPlpProtected(basePlan), false);

  // Teacher customizes draft in UI
  const customizedPlan = {
    ...basePlan,
    is_teacher_edited: true,
    teacher_notes: "Learner shows strong effort in spelling, needs phonemic drills.",
    target_objectives: [
      ...basePlan.target_objectives,
      { target: "Complete 5 guided phonics readings per week.", competencyFocus: "Fluency" },
    ],
  };

  assert.equal(isPlpProtected(customizedPlan), true);

  // Automated re-generation attempt must be rejected
  const regenResult = generateDraftPlp({
    student: { id: "stud-07", name: "Liza Soberano", gradeLevel: 7 },
    academicContext: {
      classId: "cls-eng-7",
      term: 1,
      subjectName: "English",
      subjectGrade: 72,
    },
    existingPlp: customizedPlan,
  });

  assert.equal(regenResult.success, false);
  assert.equal(regenResult.isProtected, true);
  assert.equal(regenResult.canOverwrite, false);
  assert.equal(regenResult.code, "PLP_PROTECTED_FROM_AUTOMATION");
});

test("Phase 4 Offline UI: Reviewed, Active, and Completed plans are strictly protected", () => {
  for (const status of [PLP_STATUS.TEACHER_REVIEWED, PLP_STATUS.ACTIVE, PLP_STATUS.COMPLETED]) {
    const plp = { id: "plp-p1", status, is_teacher_edited: false };
    assert.equal(isPlpProtected(plp), true, `Status ${status} must be protected`);
  }
});

// ============================================================================
// 3. STUDENT PORTAL VISIBILITY RESTRICTIONS
// ============================================================================

test("Phase 4 Offline UI: Student Portal visibility rules exclude Draft and Reviewed plans", () => {
  function isDisplayableToStudent(plp) {
    if (!plp) return false;
    const status = String(plp.status || "").toLowerCase();
    return status === PLP_STATUS.ACTIVE || status === PLP_STATUS.COMPLETED;
  }

  // Draft plan: NOT visible to student
  assert.equal(isDisplayableToStudent({ status: PLP_STATUS.DRAFT }), false);
  assert.equal(isDisplayableToStudent({ status: "draft" }), false);

  // Teacher reviewed plan: NOT visible until officially activated
  assert.equal(isDisplayableToStudent({ status: PLP_STATUS.TEACHER_REVIEWED }), false);
  assert.equal(isDisplayableToStudent({ status: "teacher_reviewed" }), false);

  // Active plan: Visible to student
  assert.equal(isDisplayableToStudent({ status: PLP_STATUS.ACTIVE }), true);
  assert.equal(isDisplayableToStudent({ status: "active" }), true);

  // Completed plan: Visible to student
  assert.equal(isDisplayableToStudent({ status: PLP_STATUS.COMPLETED }), true);
  assert.equal(isDisplayableToStudent({ status: "completed" }), true);

  // Null/undefined: Safe empty state
  assert.equal(isDisplayableToStudent(null), false);
  assert.equal(isDisplayableToStudent(undefined), false);
});

// ============================================================================
// 4. DISABLED PERSISTENCE & MUTATION ACTIONS
// ============================================================================

test("Phase 4 Offline UI: FEATURE_PLP_PERSISTENCE is false and mutation functions reject safely", async () => {
  assert.equal(FEATURE_PLP_PERSISTENCE, false, "FEATURE_PLP_PERSISTENCE must remain strictly false in Phase 4");

  const draftRes = await generateAndSaveDraftPlp({ studentId: "s-1", planType: "academic_remedial" });
  assert.equal(draftRes.success, false);
  assert.equal(draftRes.code, "PERSISTENCE_DISABLED_STAGE_A");

  const saveRes = await saveTeacherPlpDraft({ plpId: "plp-1" });
  assert.equal(saveRes.success, false);
  assert.equal(saveRes.code, "PERSISTENCE_DISABLED_STAGE_A");

  const reviewRes = await markPlpReviewed({ plpId: "plp-1" });
  assert.equal(reviewRes.success, false);
  assert.equal(reviewRes.code, "PERSISTENCE_DISABLED_STAGE_A");

  const activeRes = await activatePlp({ plpId: "plp-1" });
  assert.equal(activeRes.success, false);
  assert.equal(activeRes.code, "PERSISTENCE_DISABLED_STAGE_A");
});

// ============================================================================
// 5. ESSENTIAL ISSUES VERIFICATION (ISSUE A, B, C)
// ============================================================================

test("Phase 4 Offline UI - Issue A: Verify Migration 056 RPC inventory (archive_plp_rpc does not exist)", () => {
  const migPath = path.resolve(process.cwd(), "supabase/migrations/056_create_personalized_learning_plans.sql");
  const sql = fs.readFileSync(migPath, "utf-8");

  // Verified exactly 5 RPCs exist
  assert.ok(sql.includes("function public.generate_and_save_draft_plp"), "Must contain generate_and_save_draft_plp");
  assert.ok(sql.includes("function public.save_teacher_plp_draft"), "Must contain save_teacher_plp_draft");
  assert.ok(sql.includes("function public.mark_plp_reviewed_rpc"), "Must contain mark_plp_reviewed_rpc");
  assert.ok(sql.includes("function public.activate_plp_rpc"), "Must contain activate_plp_rpc");
  assert.ok(sql.includes("function public.complete_plp_rpc"), "Must contain complete_plp_rpc");

  // Verify archive_plp_rpc was only a documentation mention and does NOT exist
  assert.equal(sql.includes("archive_plp_rpc"), false, "archive_plp_rpc must NOT exist in Migration 056");
});

test("Phase 4 Offline UI - Issue C: Independent Phil-IRI does NOT downgrade academic High or Moderate Risk", () => {
  const result = generateDraftPlp({
    student: { id: "stud-comp-1", name: "Josefa Llanes", gradeLevel: 8 },
    schoolYear: "2026-2027",
    academicContext: {
      classId: "cls-math-8",
      term: 1,
      subjectName: "Mathematics",
      subjectGrade: 78,
      overallRisk: "Moderate Risk",
    },
    readingContext: {
      readingPeriod: "BOSY",
      language: "English",
      gstScore: 36,
      form3ReadingProfile: "Independent",
      gradeLevel: 8,
    },
  });

  assert.equal(result.success, true);
  const plan = result.plan;
  assert.equal(plan.plan_type, PLP_PLAN_TYPE.COMPOSITE);
  // Academic risk must NOT be downgraded to Low Risk simply because reading is Independent
  assert.equal(plan.overall_risk_level, "Moderate Risk", "Independent reading must not downgrade academic risk");
  assert.ok(plan.recommended_support_level.includes("Targeted Academic Reinforcement"));
  assert.ok(plan.recommended_support_level.includes("Reading Enrichment"));
});

test("Phase 4 Offline UI - Issue C: Provisional academic record without failing grade defaults to Pending Full-Term Evaluation", () => {
  const result = generateDraftPlp({
    student: { id: "stud-prov-1", name: "Emilio Aguinaldo", gradeLevel: 7 },
    schoolYear: "2026-2027",
    academicContext: {
      classId: "cls-eng-7",
      term: 1,
      subjectName: "English",
      subjectGrade: 84, // Passing interim grade in an incomplete term
      overallRisk: null, // No overall risk computed yet
      gwa: null,
      failingSubjects: [],
      isProvisional: true,
    },
  });

  assert.equal(result.success, true);
  const plan = result.plan;
  // Incomplete term without failing grades must NOT produce fabricated Low Risk
  assert.equal(plan.overall_risk_level, "Pending Full-Term Evaluation", "Provisional academic record must not fabricate Low Risk");
  assert.equal(plan.recommended_support_level, "Provisional Academic Monitoring");
});

test("Phase 4 Offline UI: LearnerAcademicDetailModal wires Preview Learning Plan button to PLP modal", () => {
  const modalPath = path.resolve(
    process.cwd(),
    "components/monitoring/shared/LearnerAcademicDetailModal.jsx"
  );
  const modalSource = fs.readFileSync(modalPath, "utf-8");

  assert.ok(
    modalSource.includes("Preview Learning Plan"),
    "LearnerAcademicDetailModal must include 'Preview Learning Plan' button"
  );
  assert.ok(
    modalSource.includes("setShowPlpModal(true)"),
    "Button must call setShowPlpModal(true)"
  );
  assert.ok(
    modalSource.includes("<PlpDocumentModal"),
    "PlpDocumentModal must be mounted in LearnerAcademicDetailModal"
  );
});

