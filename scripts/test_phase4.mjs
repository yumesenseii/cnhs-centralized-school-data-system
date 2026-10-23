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
import { recommendationService } from "../lib/services/recommendationService.js";
import {
  buildStudentPortalView,
} from "../lib/student/portalMappers.js";
import {
  buildMonitoringRosterShell,
} from "../lib/teacher/monitoringMappers.js";
import {
  FEATURE_PLP_PERSISTENCE,
  generateAndSaveDraftPlp,
  saveTeacherPlpDraft,
  markPlpReviewed,
  activatePlp,
} from "../lib/supabase/queries/plpQueries.js";
import { RECOMMENDATION, RISK_LEVEL } from "../lib/monitoring/recommendations.js";

// ============================================================================
// 1. INTEGRATION GAP VERIFICATION
// ============================================================================

test("Phase 4 - Integration: normalizeStudentInput forwards verified required subjects and completeness", () => {
  const input = {
    studentId: "s-101",
    requiredSubjects: ["English", "Filipino", "Mathematics", "Science"],
    isCompleteTerm: true,
    gwa: 84.5,
    requireVerifiedConfig: true,
    subjects: {
      English: 85,
      Filipino: 84,
      Mathematics: 83,
      Science: 86,
    },
  };

  const normalized = recommendationService.normalizeStudentInput(input);
  assert.deepEqual(normalized.requiredSubjects, ["English", "Filipino", "Mathematics", "Science"]);
  assert.equal(normalized.isCompleteTerm, true);
  assert.equal(normalized.gwa, 84.5);
  assert.equal(normalized.requireVerifiedConfig, true);
});

test("Phase 4 - Integration: monitoringMappers forward section required subjects into recommendation input", () => {
  const classes = [
    {
      id: "c-1",
      teacher_id: "t-1",
      section_id: "sec-1",
      subject_id: "sub-1",
      subject: "Mathematics",
      schoolYear: "2026-2027",
      quarter: 1,
      aralEligible: false,
    },
  ];

  const sectionClasses = [
    { section_id: "sec-1", subject_name: "English" },
    { section_id: "sec-1", subject_name: "Mathematics" },
    { section_id: "sec-1", subject_name: "Science" },
    { section_id: "sec-1", subject_name: "Filipino" },
  ];

  const enrollments = [
    {
      class_id: "c-1",
      students: {
        id: "stud-1",
        first_name: "Juan",
        last_name: "Dela Cruz",
        section_id: "sec-1",
      },
    },
  ];

  const shell = buildMonitoringRosterShell({
    classes,
    enrollments,
    sectionClasses,
  });

  assert.equal(shell.students.length, 1);
  const student = shell.students[0];
  assert.ok(student._generateInput, "Student row must have _generateInput");
  assert.ok(
    Array.isArray(student._generateInput.requiredSubjects),
    "requiredSubjects must be forwarded in _generateInput"
  );
  assert.equal(student._generateInput.requiredSubjects.length, 4);
  assert.ok(student._generateInput.requiredSubjects.includes("English"));
  assert.ok(student._generateInput.requiredSubjects.includes("Mathematics"));
  assert.ok(student._generateInput.requiredSubjects.includes("Science"));
  assert.ok(student._generateInput.requiredSubjects.includes("Filipino"));
});

test("Phase 4 - Integration: Student Portal severing of legacy grade-based ARAL trigger", async () => {
  // A raw portal payload with a failing English grade (72)
  const raw = {
    student: {
      id: "std-portal-1",
      first_name: "Juan",
      last_name: "Luna",
      sections: { grade_level: 8, section_name: "Rizal", school_year: "2026-2027" },
    },
    grades: [
      {
        id: "g-1",
        schoolYear: "2026-2027",
        quarter: 1,
        classId: "cls-eng",
        finalGrade: 72,
        subject: { subject_name: "English" },
      },
      {
        id: "g-2",
        schoolYear: "2026-2027",
        quarter: 1,
        classId: "cls-math",
        finalGrade: 86,
        subject: { subject_name: "Mathematics" },
      },
    ],
    enrollments: [
      {
        id: "e-1",
        classId: "cls-eng",
        schoolYear: "2026-2027",
        quarter: 1,
        subject: { subject_name: "English" },
      },
      {
        id: "e-2",
        classId: "cls-math",
        schoolYear: "2026-2027",
        quarter: 1,
        subject: { subject_name: "Mathematics" },
      },
    ],
  };

  const view = await buildStudentPortalView(raw, { skipRecommendations: true });

  assert.notEqual(
    view.summary.recommendation,
    RECOMMENDATION.ARAL,
    "Failing language grade must NOT trigger ARAL recommendation in student portal"
  );
  assert.equal(
    view.summary.recommendation,
    RECOMMENDATION.REMEDIATION,
    "Failing language grade must route strictly to Classroom Remediation"
  );
});

// ============================================================================
// 2. PURE JAVASCRIPT PLP GENERATOR: ACADEMIC SCENARIOS
// ============================================================================

test("Phase 4 - PLP Generator: Academic Remediation for failing subject", () => {
  const result = generateDraftPlp({
    student: { id: "std-001", name: "Maria Clara", gradeLevel: 8 },
    schoolYear: "2026-2027",
    academicContext: {
      classId: "cls-math-8",
      subjectName: "Mathematics",
      subjectGrade: 72,
      academicTerm: 1,
      targetTerm: 1,
      overallRisk: "High Risk",
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.isProtected, false);
  const plan = result.plan;
  assert.equal(plan.plan_type, PLP_PLAN_TYPE.ACADEMIC_REMEDIAL);
  assert.equal(plan.status, PLP_STATUS.DRAFT);
  assert.equal(plan.class_id, "cls-math-8");
  assert.equal(plan.academic_term, 1);
  assert.equal(plan.reading_period, null);
  assert.equal(plan.overall_risk_level, "High Risk");
  assert.equal(plan.recommended_support_level, "Intensive Academic Remediation");
  assert.ok(plan.learning_needs.some((n) => n.category.includes("Foundational")));
  assert.ok(plan.target_objectives.some((o) => o.target.includes("≥ 75%")));
  assert.ok(plan.recommended_activities.length >= 2);
  assert.ok(plan.monitoring_indicators.length >= 2);
});

test("Phase 4 - PLP Generator: Moderate-Risk Reinforcement for developing grade", () => {
  const result = generateDraftPlp({
    student: { id: "std-002", name: "Crisostomo Ibarra", gradeLevel: 9 },
    schoolYear: "2026-2027",
    academicContext: {
      classId: "cls-sci-9",
      subjectName: "Science",
      subjectGrade: 79,
      academicTerm: 2,
      targetTerm: 2,
      overallRisk: "Moderate Risk",
    },
  });

  assert.equal(result.success, true);
  const plan = result.plan;
  assert.equal(plan.plan_type, PLP_PLAN_TYPE.ACADEMIC_REMEDIAL);
  assert.equal(plan.overall_risk_level, "Moderate Risk");
  assert.equal(plan.recommended_support_level, "Targeted Academic Reinforcement");
  assert.ok(plan.learning_needs.some((n) => n.category.includes("Developing Competency")));
  assert.ok(plan.target_objectives.some((o) => o.target.includes("80%")));
});

test("Phase 4 - PLP Generator: Subject-Specific Support with passing GWA", () => {
  const result = generateDraftPlp({
    student: { id: "std-003", name: "Elias", gradeLevel: 10 },
    schoolYear: "2026-2027",
    academicContext: {
      classId: "cls-ap-10",
      subjectName: "Araling Panlipunan",
      subjectGrade: 73,
      gwa: 86.5,
      failingSubjects: [{ subjectName: "Araling Panlipunan", grade: 73 }],
      academicTerm: 1,
    },
  });

  assert.equal(result.success, true);
  const plan = result.plan;
  assert.equal(plan.plan_type, PLP_PLAN_TYPE.ACADEMIC_REMEDIAL);
  assert.ok(
    plan.recommended_support_level.includes("Remediation"),
    "Learner with passing GWA but failing subject must get remedial support level"
  );
  assert.ok(plan.target_objectives.some((o) => o.target.includes("Araling Panlipunan")));
});

// ============================================================================
// 3. PURE JAVASCRIPT PLP GENERATOR: READING & PHIL-IRI SCENARIOS
// ============================================================================

test("Phase 4 - PLP Generator: Verified Form 3 Reading Needs (Frustration Tier 1)", () => {
  const result = generateDraftPlp({
    student: { id: "std-004", name: "Sisa", gradeLevel: 7 },
    schoolYear: "2026-2027",
    readingContext: {
      readingPeriod: "BOSY",
      language: "English",
      form3ReadingProfile: "Frustration",
      gstScore: 12,
    },
  });

  assert.equal(result.success, true);
  const plan = result.plan;
  assert.equal(plan.plan_type, PLP_PLAN_TYPE.READING_ARAL);
  assert.equal(plan.reading_period, "BOSY");
  assert.equal(plan.class_id, null);
  assert.equal(plan.academic_term, null);
  assert.equal(plan.overall_risk_level, "High Risk");
  assert.ok(plan.recommended_support_level.includes("Tier 1"));
  assert.ok(plan.learning_needs.some((n) => n.profile === "Frustration Level"));
  assert.ok(plan.recommended_activities.some((a) => a.description.includes("Tier 1 Remediation")));
});

test("Phase 4 - PLP Generator: Verified Form 3 Reading Needs (Instructional Tier 2)", () => {
  const result = generateDraftPlp({
    student: { id: "std-005", name: "Basilio", gradeLevel: 7 },
    schoolYear: "2026-2027",
    readingContext: {
      readingPeriod: "MOSY",
      language: "Filipino",
      form3ReadingProfile: "Instructional",
      gstScore: 22,
    },
  });

  assert.equal(result.success, true);
  const plan = result.plan;
  assert.equal(plan.plan_type, PLP_PLAN_TYPE.READING_ARAL);
  assert.equal(plan.overall_risk_level, "Moderate Risk");
  assert.ok(plan.recommended_support_level.includes("Tier 2"));
  assert.ok(plan.recommended_activities.some((a) => a.description.includes("Tier 2 Support (Filipino)")));
});

test("Phase 4 - PLP Generator: Assessment Follow-Up Draft (GST < 28, Form 3 unverified)", () => {
  // Requirement 3: GST indicates Form 3 needed, but profile is not yet verified
  const result = generateDraftPlp({
    student: { id: "std-006", name: "Crispin", gradeLevel: 7 },
    schoolYear: "2026-2027",
    readingContext: {
      readingPeriod: "BOSY",
      language: "English",
      gstScore: 18,
      needsIndividualAssessment: true,
      form3ReadingProfile: null, // Strictly pending
    },
  });

  assert.equal(result.success, true);
  const plan = result.plan;
  assert.equal(plan.plan_type, PLP_PLAN_TYPE.READING_ARAL);
  assert.equal(plan.overall_risk_level, "Pending Reading Profile");
  assert.equal(plan.recommended_support_level, "Phil-IRI Form 3 Diagnostic Administration");
  assert.ok(
    plan.learning_needs.some((n) => n.category.includes("Assessment Follow-Up Required")),
    "Must be flagged as assessment follow-up"
  );
  assert.ok(
    plan.target_objectives.some((o) => o.target.includes("Administer Phil-IRI Form 3")),
    "Must target Form 3 administration without fabricating a diagnosis"
  );
});

test("Phase 4 - PLP Generator: BOSY Reading-Only Draft without academic grades", () => {
  // Requirement 3: Support BOSY reading-only drafts
  const result = generateDraftPlp({
    student: { id: "std-007", name: "Isagani", gradeLevel: 7 },
    schoolYear: "2026-2027",
    academicContext: null, // No academic grades available at BOSY
    readingContext: {
      readingPeriod: "BOSY",
      language: "English",
      form3ReadingProfile: "Frustration",
    },
  });

  assert.equal(result.success, true);
  const plan = result.plan;
  assert.equal(plan.plan_type, PLP_PLAN_TYPE.READING_ARAL);
  assert.equal(plan.reading_period, "BOSY");
  assert.equal(plan.class_id, null);
  assert.equal(plan.academic_term, null);
  assert.equal(plan.status, PLP_STATUS.DRAFT);
  assert.ok(validatePlpShape(plan).valid, "BOSY reading plan shape must be valid");
});

test("Phase 4 - PLP Generator: Composite Plan combining Academic and Reading", () => {
  const result = generateDraftPlp({
    student: { id: "std-008", name: "Paulita", gradeLevel: 8 },
    schoolYear: "2026-2027",
    academicContext: {
      classId: "cls-eng-8",
      subjectName: "English",
      subjectGrade: 73,
      academicTerm: 1,
      targetTerm: 1,
    },
    readingContext: {
      readingPeriod: "BOSY",
      language: "English",
      form3ReadingProfile: "Frustration",
    },
  });

  assert.equal(result.success, true);
  const plan = result.plan;
  assert.equal(plan.plan_type, PLP_PLAN_TYPE.COMPOSITE);
  assert.equal(plan.class_id, "cls-eng-8");
  assert.equal(plan.academic_term, 1);
  assert.equal(plan.reading_period, "BOSY");
  assert.ok(validatePlpShape(plan).valid, "Composite plan shape must be valid");
  assert.ok(plan.learning_needs.length >= 2);
});

// ============================================================================
// 4. PROTECTION OF TEACHER CUSTOMIZATIONS & STATUS GUARDS
// ============================================================================

test("Phase 4 - Protection: Teacher-edited plan cannot be overwritten by automatic regeneration", () => {
  const existingEditedPlp = {
    id: "plp-111",
    student_id: "std-001",
    status: PLP_STATUS.DRAFT,
    is_teacher_edited: true,
    teacher_notes: "Teacher customized plan: focus on fractions and word problems.",
    version: 2,
  };

  assert.equal(isPlpProtected(existingEditedPlp), true);

  const result = generateDraftPlp({
    student: { id: "std-001" },
    schoolYear: "2026-2027",
    academicContext: { classId: "cls-math-8" },
    existingPlp: existingEditedPlp,
  });

  assert.equal(result.success, false);
  assert.equal(result.isProtected, true);
  assert.equal(result.canOverwrite, false);
  assert.equal(result.code, "PLP_PROTECTED_FROM_AUTOMATION");
  assert.equal(result.plan.id, "plp-111");
});

test("Phase 4 - Protection: Teacher-reviewed and active plans are strictly protected", () => {
  const reviewedPlp = {
    id: "plp-222",
    student_id: "std-002",
    status: PLP_STATUS.TEACHER_REVIEWED,
    is_teacher_edited: false,
    version: 1,
  };
  assert.equal(isPlpProtected(reviewedPlp), true);

  const activePlp = {
    id: "plp-333",
    student_id: "std-003",
    status: PLP_STATUS.ACTIVE,
    is_teacher_edited: false,
    version: 2,
  };
  assert.equal(isPlpProtected(activePlp), true);

  const completedPlp = {
    id: "plp-444",
    student_id: "std-004",
    status: PLP_STATUS.COMPLETED,
    is_teacher_edited: false,
    version: 3,
  };
  assert.equal(isPlpProtected(completedPlp), true);

  const uneditedDraft = {
    id: "plp-555",
    student_id: "std-005",
    status: PLP_STATUS.DRAFT,
    is_teacher_edited: false,
    version: 1,
  };
  assert.equal(isPlpProtected(uneditedDraft), false);
});

// ============================================================================
// 5. STAGE A RESTRICTIONS: CLIENT PERSISTENCE GUARD
// ============================================================================

test("Phase 4 - Stage A Restrictions: FEATURE_PLP_PERSISTENCE is false and write RPCs return disabled", async () => {
  assert.equal(
    FEATURE_PLP_PERSISTENCE,
    false,
    "FEATURE_PLP_PERSISTENCE must remain strictly false in Phase 4 Stage A"
  );

  const draftResult = await generateAndSaveDraftPlp({ studentId: "std-1" });
  assert.equal(draftResult.success, false);
  assert.equal(draftResult.code, "PERSISTENCE_DISABLED_STAGE_A");

  const saveResult = await saveTeacherPlpDraft({ id: "plp-1" });
  assert.equal(saveResult.success, false);
  assert.equal(saveResult.code, "PERSISTENCE_DISABLED_STAGE_A");

  const reviewResult = await markPlpReviewed({ id: "plp-1" });
  assert.equal(reviewResult.success, false);
  assert.equal(reviewResult.code, "PERSISTENCE_DISABLED_STAGE_A");

  const activateResult = await activatePlp({ id: "plp-1" });
  assert.equal(activateResult.success, false);
  assert.equal(activateResult.code, "PERSISTENCE_DISABLED_STAGE_A");
});

// ============================================================================
// 6. MIGRATION 056 SOURCE AUDIT VERIFICATION
// ============================================================================

test("Phase 4 - Migration 056: SQL source file verification", () => {
  const migrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/056_create_personalized_learning_plans.sql"
  );
  assert.ok(fs.existsSync(migrationPath), "Migration 056 source file must exist");

  const sqlContent = fs.readFileSync(migrationPath, "utf8");

  // Check table and columns
  assert.ok(sqlContent.includes("create table if not exists public.personalized_learning_plans"));
  assert.ok(sqlContent.includes("last_edited_by uuid references public.profiles(id)"));
  assert.ok(sqlContent.includes("chk_academic_plan_shape check"));
  assert.ok(sqlContent.includes("chk_reading_plan_shape check"));
  assert.ok(sqlContent.includes("chk_composite_plan_shape check"));

  // Check partial unique indexes
  assert.ok(sqlContent.includes("create unique index if not exists plp_academic_unique_idx"));
  assert.ok(sqlContent.includes("create unique index if not exists plp_reading_unique_idx"));
  assert.ok(sqlContent.includes("create unique index if not exists plp_composite_unique_idx"));

  // Check security definer helper
  assert.ok(sqlContent.includes("function public.can_teacher_manage_student_plp"));
  assert.ok(sqlContent.includes("is_section_adviser"));

  // Check triggers
  assert.ok(sqlContent.includes("trg_enforce_plp_insert_constraints"));
  assert.ok(sqlContent.includes("trg_enforce_plp_status_transitions"));
  assert.ok(
    sqlContent.includes("A draft PLP must be teacher_reviewed before it can be activated"),
    "Trigger must enforce review before activation"
  );

  // Check RLS
  assert.ok(sqlContent.includes("alter table public.personalized_learning_plans enable row level security"));
  assert.ok(sqlContent.includes("create policy plp_select_policy"));
  assert.ok(sqlContent.includes("create policy plp_insert_policy"));
  assert.ok(sqlContent.includes("create policy plp_update_policy"));

  // Check RPCs
  assert.ok(sqlContent.includes("function public.generate_and_save_draft_plp"));
  assert.ok(sqlContent.includes("function public.save_teacher_plp_draft"));
  assert.ok(sqlContent.includes("function public.mark_plp_reviewed_rpc"));
  assert.ok(sqlContent.includes("function public.activate_plp_rpc"));

  // Verify that RPCs do not take client-supplied actor/profile IDs
  assert.ok(!sqlContent.includes("p_actor_profile_id uuid"));
  assert.ok(!sqlContent.includes("p_reviewed_by uuid"));
  assert.ok(!sqlContent.includes("p_activated_by uuid"));

  // Verify search_path is set on all functions
  const searchPathCount = (sqlContent.match(/set search_path = public/g) || []).length;
  assert.ok(searchPathCount >= 6, "Every function must specify set search_path = public");
});
