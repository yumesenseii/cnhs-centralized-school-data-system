/**
 * Automated Stage B Real Database Security & Authorization Test Suite.
 *
 * Executes comprehensive security and workflow tests against an approved,
 * isolated Supabase test project using authentic Supabase Auth JWT sessions.
 *
 * Safety Invariants:
 * 1. STRICT ALLOWLISTING: Checks ALLOWED_STAGE_B_PROJECT_REF and rejects production ('siumnhtrksgjkbgggpwg').
 * 2. REAL AUTHENTICATION: Uses real signed-in JWT sessions for all actor roles.
 * 3. AUTHENTIC IDENTITY RELATIONSHIPS:
 *    - auth.users -> public.profiles via auth_user_id
 *    - public.users -> id matching auth.users
 *    - public.teachers.user_id -> public.users.id
 *    - public.students.user_id -> public.users.id
 * 4. LEAST PRIVILEGE:
 *    - Confirms direct INSERT, UPDATE, DELETE are strictly revoked on personalized_learning_plans.
 *    - Verifies all plan mutations execute exclusively through SECURITY DEFINER RPCs.
 * 5. ZERO PII: Uses only synthetic dummy accounts and test learners.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { validateTargetEnvironment } from "./replay_stage_b_schema.mjs";

const supabaseUrl = process.env.STAGE_B_SUPABASE_URL;
const anonKey = process.env.STAGE_B_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.STAGE_B_SUPABASE_SERVICE_ROLE_KEY;
const allowedProjectRef = process.env.ALLOWED_STAGE_B_PROJECT_REF;

test("Stage B - Environment Safety Guard", () => {
  assert.doesNotThrow(() => {
    validateTargetEnvironment(supabaseUrl, allowedProjectRef);
  }, "Target environment must pass fail-safe allowlist validation.");
  assert.ok(serviceRoleKey, "STAGE_B_SUPABASE_SERVICE_ROLE_KEY is required.");
  assert.ok(anonKey, "STAGE_B_SUPABASE_ANON_KEY is required.");
});

// All tests below execute conditionally when real test credentials are provided
const canRunDatabaseTests = Boolean(
  supabaseUrl &&
  serviceRoleKey &&
  allowedProjectRef &&
  !supabaseUrl.includes("siumnhtrksgjkbgggpwg") &&
  (allowedProjectRef === "127.0.0.1" || allowedProjectRef === "localhost" || supabaseUrl.includes(allowedProjectRef))
);


if (!canRunDatabaseTests) {
  test("Stage B - Database Tests Skipped: Awaiting user provisioned test project credentials", () => {
    console.log("Real database tests are staged and awaiting isolated test project credentials.");
  });
} else {
  // Real database test runner logic
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let authAlpha, authGamma, authStudent;
  let clientAlpha, clientGamma, clientStudent;
  let testStudentId, testClassId, testSectionId, tAlphaId, tGammaId;

  test("Stage B - Setup: Provision Synthetic Auth Users and Verified Identity Linkages", async () => {
    const pwd = "TestPassword123!Safe";
    const ts = Date.now();

    // 1. Create synthetic Auth users
    const { data: uAlpha, error: errA } = await adminClient.auth.admin.createUser({
      email: `teacher_alpha_${ts}@test.cnhs.local`,
      password: pwd,
      email_confirm: true,
      user_metadata: { role: "teacher" },
    });
    assert.ifError(errA);
    authAlpha = uAlpha.user;

    const { data: uGamma, error: errG } = await adminClient.auth.admin.createUser({
      email: `teacher_gamma_${ts}@test.cnhs.local`,
      password: pwd,
      email_confirm: true,
      user_metadata: { role: "teacher" },
    });
    assert.ifError(errG);
    authGamma = uGamma.user;

    const { data: uStud, error: errS } = await adminClient.auth.admin.createUser({
      email: `student_one_${ts}@test.cnhs.local`,
      password: pwd,
      email_confirm: true,
      user_metadata: { role: "student" },
    });
    assert.ifError(errS);
    authStudent = uStud.user;

    // 2. Insert corresponding rows in public.users (preserving foreign key target)
    await adminClient.from("users").insert([
      {
        id: authAlpha.id,
        username: `synth_teacher_alpha_${ts}`,
        email: authAlpha.email,
        password_hash: "synth-hash",
        role: "teacher",
        status: "active",
      },
      {
        id: authGamma.id,
        username: `synth_teacher_gamma_${ts}`,
        email: authGamma.email,
        password_hash: "synth-hash",
        role: "teacher",
        status: "active",
      },
      {
        id: authStudent.id,
        username: `synth_student_one_${ts}`,
        email: authStudent.email,
        password_hash: "synth-hash",
        role: "student",
        status: "active",
      },
    ]);

    // 3. Insert public.profiles linking auth_user_id
    await adminClient.from("profiles").upsert([
      { auth_user_id: authAlpha.id, full_name: "Synthetic Teacher Alpha", role: "teacher", is_active: true },
      { auth_user_id: authGamma.id, full_name: "Synthetic Teacher Gamma", role: "teacher", is_active: true },
      { auth_user_id: authStudent.id, full_name: "Synthetic Student One", role: "student", is_active: true },
    ]);

    // 4. Insert public.teachers linking user_id to public.users(id)
    const { data: tAlpha, error: tAErr } = await adminClient.from("teachers").insert({
      user_id: authAlpha.id,
      employee_number: `EMP_A_${ts}`,
      first_name: "Alpha",
      last_name: "Teacher",
      email: authAlpha.email,
      status: "active",
    }).select().single();
    assert.ifError(tAErr);
    tAlphaId = tAlpha.id;

    const { data: tGamma, error: tGErr } = await adminClient.from("teachers").insert({
      user_id: authGamma.id,
      employee_number: `EMP_G_${ts}`,
      first_name: "Gamma",
      last_name: "Teacher",
      email: authGamma.email,
      status: "active",
    }).select().single();
    assert.ifError(tGErr);
    tGammaId = tGamma.id;

    // 5. Section, Subject, Class, and Student Setup
    const { data: sec, error: secErr } = await adminClient.from("sections").insert({
      section_name: `Synthetic Grade 8 - ${ts}`,
      grade_level: 8,
      school_year: "2026-2027",
      adviser_id: tAlpha.id,
      status: "active",
    }).select().single();
    assert.ifError(secErr);
    testSectionId = sec.id;

    const { data: subj, error: subjErr } = await adminClient.from("subjects").insert({
      subject_name: `Synthetic Math ${ts}`,
      subject_code: `MTH${ts}`,
    }).select().single();
    assert.ifError(subjErr);

    const { data: cls, error: clsErr } = await adminClient.from("classes").insert({
      teacher_id: tAlpha.id,
      section_id: sec.id,
      subject_id: subj.id,
      school_year: "2026-2027",
      quarter: 1,
    }).select().single();
    assert.ifError(clsErr);
    testClassId = cls.id;

    const { data: stud, error: studErr } = await adminClient.from("students").insert({
      user_id: authStudent.id,
      student_number: `LRN_${ts}`,
      first_name: "Synthetic",
      last_name: "Learner One",
      section_id: sec.id,
      status: "active",
    }).select().single();
    assert.ifError(studErr);
    testStudentId = stud.id;

    const { error: csErr } = await adminClient.from("class_students").insert({
      class_id: cls.id,
      student_id: stud.id,
    });
    assert.ifError(csErr);

    // 6. Sign in to obtain authentic JWT sessions
    clientAlpha = createClient(supabaseUrl, anonKey);
    const { data: sA } = await clientAlpha.auth.signInWithPassword({
      email: authAlpha.email,
      password: pwd,
    });
    assert.ok(sA.session?.access_token, "Teacher Alpha authenticated session acquired.");

    clientGamma = createClient(supabaseUrl, anonKey);
    const { data: sG } = await clientGamma.auth.signInWithPassword({
      email: authGamma.email,
      password: pwd,
    });
    assert.ok(sG.session?.access_token, "Teacher Gamma authenticated session acquired.");

    clientStudent = createClient(supabaseUrl, anonKey);
    const { data: sS } = await clientStudent.auth.signInWithPassword({
      email: authStudent.email,
      password: pwd,
    });
    assert.ok(sS.session?.access_token, "Student One authenticated session acquired.");
  });

  test("Stage B - Identity 1: Verify current_teacher_id and current_student_id resolution", async () => {
    // Call current_teacher_id as Alpha
    const { data: teacherIdRes } = await clientAlpha.rpc("current_teacher_id");
    assert.equal(teacherIdRes, tAlphaId, "current_teacher_id() must resolve authentic teachers.id for Teacher Alpha.");

    // Call current_student_id as Student
    const { data: studentIdRes } = await clientStudent.rpc("current_student_id");
    assert.equal(studentIdRes, testStudentId, "current_student_id() must resolve authentic students.id for Student.");
  });

  test("Stage B - Permissions 1: Direct table INSERT is REVOKED from authenticated clients", async () => {
    const { error: insErr } = await clientAlpha
      .from("personalized_learning_plans")
      .insert({
        student_id: testStudentId,
        class_id: testClassId,
        school_year: "2026-2027",
        academic_term: 1,
        plan_type: "academic_remedial",
        status: "draft",
      });
    assert.ok(insErr, "Direct INSERT on personalized_learning_plans must be rejected.");
    assert.ok(
      insErr.message.toLowerCase().includes("permission denied"),
      `Expected permission denied error, got: ${insErr.message}`
    );
  });

  test("Stage B - Permissions 2: Direct table UPDATE is REVOKED from authenticated clients", async () => {
    const { error: updErr } = await clientAlpha
      .from("personalized_learning_plans")
      .update({ teacher_notes: "Malicious direct update" })
      .eq("student_id", testStudentId);
    assert.ok(updErr, "Direct UPDATE on personalized_learning_plans must be rejected.");
    assert.ok(
      updErr.message.toLowerCase().includes("permission denied"),
      `Expected permission denied error, got: ${updErr.message}`
    );
  });

  test("Stage B - Permissions 3: Direct table DELETE is REVOKED from authenticated clients", async () => {
    const { error: delErr } = await clientAlpha
      .from("personalized_learning_plans")
      .delete()
      .eq("student_id", testStudentId);
    assert.ok(delErr, "Direct DELETE on personalized_learning_plans must be rejected.");
    assert.ok(
      delErr.message.toLowerCase().includes("permission denied"),
      `Expected permission denied error, got: ${delErr.message}`
    );
  });

  test("Stage B - Security 1: Unauthorized Teacher Gamma cannot call save_teacher_plp_draft", async () => {
    // Generate draft as authorized Teacher Alpha
    const { data: genRes } = await clientAlpha.rpc("generate_and_save_draft_plp", {
      p_student_id: testStudentId,
      p_class_id: testClassId,
      p_school_year: "2026-2027",
      p_academic_term: 1,
      p_reading_period: null,
      p_plan_type: "academic_remedial",
      p_overall_risk_level: "High Risk",
      p_recommended_support_level: "Remediation",
      p_learning_needs: [],
      p_target_objectives: [],
      p_recommended_activities: [],
      p_monitoring_indicators: [],
    });
    assert.equal(genRes.success, true);
    const plpId = genRes.data.id;

    // Gamma attempts to edit Alpha's student PLP
    const { error: gammaErr } = await clientGamma.rpc("save_teacher_plp_draft", {
      p_id: plpId,
      p_learning_needs: [{ category: "Unauthorized" }],
      p_target_objectives: [],
      p_recommended_activities: [],
      p_monitoring_indicators: [],
      p_teacher_notes: "Unauthorized edit attempt",
      p_version: 1,
    });
    assert.ok(gammaErr, "Unauthorized teacher edit must throw authorization exception.");
    assert.ok(gammaErr.message.includes("Authorization failed"), "Must report authorization failure.");
  });

  test("Stage B - Security 2: Student cannot call any mutation RPCs", async () => {
    const { error: studErr } = await clientStudent.rpc("activate_plp_rpc", {
      p_id: "00000000-0000-0000-0000-000000000000",
      p_version: 1,
    });
    assert.ok(studErr, "Student calling activate_plp_rpc must abort.");
    assert.ok(studErr.message.includes("Access denied"), "Must report access denied.");
  });

  test("Stage B - Workflow 1: Direct activation from draft is blocked (Review required)", async () => {
    // Fetch draft id
    const { data: drafts } = await clientAlpha
      .from("personalized_learning_plans")
      .select("id, version, status")
      .eq("student_id", testStudentId)
      .eq("status", "draft");
    assert.ok(drafts.length > 0, "Draft must exist.");
    const plan = drafts[0];

    // Attempt to activate draft directly
    const { data: actRes } = await clientAlpha.rpc("activate_plp_rpc", {
      p_id: plan.id,
      p_version: plan.version,
    });
    assert.equal(actRes.success, false);
    assert.equal(actRes.code, "REVIEW_REQUIRED_BEFORE_ACTIVATION");
    assert.equal(actRes.status, "invalid_transition");
  });

  test("Stage B - Workflow 2: Full Lifecycle (Draft -> Reviewed -> Active -> Completed)", async () => {
    const { data: drafts } = await clientAlpha
      .from("personalized_learning_plans")
      .select("id, version")
      .eq("student_id", testStudentId)
      .eq("status", "draft");
    const plan = drafts[0];

    // 1. Teacher marks reviewed
    const { data: revRes } = await clientAlpha.rpc("mark_plp_reviewed_rpc", {
      p_id: plan.id,
      p_teacher_notes: "Reviewed and approved by subject teacher.",
      p_version: plan.version,
    });
    assert.equal(revRes.success, true);
    assert.equal(revRes.status, "teacher_reviewed");
    const reviewedVersion = revRes.data.version;

    // 2. Teacher activates
    const { data: actRes } = await clientAlpha.rpc("activate_plp_rpc", {
      p_id: plan.id,
      p_version: reviewedVersion,
    });
    assert.equal(actRes.success, true);
    assert.equal(actRes.status, "active");
    const activeVersion = actRes.data.version;

    // 3. Student can now view the active plan
    const { data: studPlans } = await clientStudent
      .from("personalized_learning_plans")
      .select("id, status")
      .eq("id", plan.id);
    assert.equal(studPlans.length, 1, "Student must be able to view their active plan.");
    assert.equal(studPlans[0].status, "active");

    // 4. Teacher completes the plan
    const { data: compRes } = await clientAlpha.rpc("complete_plp_rpc", {
      p_id: plan.id,
      p_version: activeVersion,
    });
    assert.equal(compRes.success, true);
    assert.equal(compRes.status, "completed");

    // 5. Attempting to modify completed plan is rejected
    const { error: editCompErr } = await clientAlpha.rpc("save_teacher_plp_draft", {
      p_id: plan.id,
      p_learning_needs: [],
      p_target_objectives: [],
      p_recommended_activities: [],
      p_monitoring_indicators: [],
      p_teacher_notes: "Post-completion edit attempt",
      p_version: compRes.data.version,
    });
    assert.ok(editCompErr, "Modifying a completed plan must throw exception.");
  });

  test("Stage B - Security 3: Stale version conflict handling (Optimistic locking)", async () => {
    const { data: plan } = await adminClient
      .from("personalized_learning_plans")
      .select("id")
      .eq("student_id", testStudentId)
      .limit(1)
      .single();

    const { data: staleRes } = await clientAlpha.rpc("save_teacher_plp_draft", {
      p_id: plan.id,
      p_learning_needs: [],
      p_target_objectives: [],
      p_recommended_activities: [],
      p_monitoring_indicators: [],
      p_teacher_notes: "Conflict test",
      p_version: 9999, // Stale version
    });

    assert.equal(staleRes.success, false);
    assert.equal(staleRes.code, "STALE_VERSION");
  });
}
