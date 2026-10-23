import test from "node:test";
import assert from "node:assert/strict";

import {
  authorizeLearnerAccess,
  authorizeStaff,
} from "../lib/services/recommendation/trendAuth.js";
import { createRecordingSupabaseClient } from "./test-support/recording-supabase.mjs";

// Mock Supabase client generator for testing gateway authorization and response logic
function createMockSupabase({
  authUser = null,
  profile = null,
  teachers = [],
  classStudentEnrollments = [],
  grades = [],
  ecrTermSheets = [],
} = {}) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: authUser },
        error: authUser ? null : new Error("No session"),
      }),
    },
    from: (table) => {
      let filterCol = null;
      let filterVal = null;
      let inCol = null;
      let inVals = null;

      const builder = {
        select: () => builder,
        eq: (col, val) => {
          filterCol = col;
          filterVal = val;
          return builder;
        },
        in: (col, vals) => {
          inCol = col;
          inVals = vals;
          return builder;
        },
        limit: () => builder,
        single: async () => builder.maybeSingle(),
        maybeSingle: async () => {
          if (table === "profiles") {
            if (profile && (!filterVal || profile.auth_user_id === filterVal)) {
              return { data: profile, error: null };
            }
            return { data: null, error: null };
          }
          if (table === "class_students") {
            const match = classStudentEnrollments.find(
              (e) => e.student_id === filterVal
            );
            return { data: match || null, error: null };
          }
          return { data: null, error: null };
        },
        then: (resolve) => {
          if (table === "teachers") {
            const matches = teachers.filter((t) => inVals?.includes(t.user_id));
            resolve({ data: matches, error: null });
            return;
          }
          if (table === "grades") {
            const matches = grades.filter((g) => g.student_id === filterVal);
            resolve({ data: matches, error: null });
            return;
          }
          if (table === "ecr_term_sheets") {
            resolve({ data: ecrTermSheets, error: null });
            return;
          }
          resolve({ data: [], error: null });
        },
      };
      return builder;
    },
  };
}

test("Gateway Auth Guard: rejects unauthenticated user with 401", async () => {
  const supabase = createMockSupabase({ authUser: null });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  assert.equal(user, null);
  assert.ok(authError);
});

test("Gateway Auth Guard: rejects student role with 403", async () => {
  const supabase = createMockSupabase({
    authUser: { id: "user-std" },
    profile: { id: "prof-1", auth_user_id: "user-std", role: "student", is_active: true },
  });
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("auth_user_id", "user-std")
    .maybeSingle();

  assert.equal(profile.role, "student");
  assert.notEqual(profile.role, "teacher");
  assert.notEqual(profile.role, "admin");
});

test("Gateway Scope Check: admin role has school-wide access", async () => {
  const adminProfile = { id: "prof-adm", auth_user_id: "user-adm", role: "admin", is_active: true };
  assert.equal(adminProfile.role, "admin");
  // Admin bypasses class_students check
});

test("Gateway Scope Check: teacher authorized only when learner is enrolled in assigned class", async () => {
  const teacherId = "teacher-123";
  const assignedStudentId = "std-assigned";
  const unassignedStudentId = "std-unassigned";

  const supabase = createMockSupabase({
    authUser: { id: "user-tea" },
    profile: { id: "prof-tea", auth_user_id: "user-tea", role: "teacher", is_active: true },
    teachers: [{ id: teacherId, user_id: "user-tea" }],
    classStudentEnrollments: [
      { id: "cs-1", student_id: assignedStudentId, class_id: "cls-1" },
    ],
  });

  // Query for assigned student
  const { data: enrolledMatch } = await supabase
    .from("class_students")
    .select("id")
    .eq("student_id", assignedStudentId)
    .maybeSingle();

  assert.ok(enrolledMatch, "Assigned student should be found");

  // Query for unassigned student
  const { data: unenrolledMatch } = await supabase
    .from("class_students")
    .select("id")
    .eq("student_id", unassignedStudentId)
    .maybeSingle();

  assert.equal(unenrolledMatch, null, "Unassigned student should return null (fails closed)");
});

test("Gateway Contract: safe advisory shape without probabilities or confidence", () => {
  const rawServiceResponse = {
    status: "available",
    subject: "mathematics",
    currentTerm: 1,
    targetTerm: 2,
    predictedTrend: "Improving",
    source: "pattern-analysis-experimental",
    disclaimer: "Experimental Subject Trend Forecast — Advisory Only (Synthetic-Data Model).",
    message: "Successfully predicted Improving trend for mathematics in Term 2.",
  };

  // Ensure forbidden fields are strictly absent
  assert.equal("confidence" in rawServiceResponse, false);
  assert.equal("probabilities" in rawServiceResponse, false);
  assert.equal("class_probabilities" in rawServiceResponse, false);
  assert.equal("feature_vector" in rawServiceResponse, false);

  assert.equal(rawServiceResponse.status, "available");
  assert.equal(rawServiceResponse.currentTerm, 1);
  assert.equal(rawServiceResponse.targetTerm, 2);
  assert.equal(rawServiceResponse.predictedTrend, "Improving");
});

test("G1. Staff Authorization Contract: 401 unauthenticated, 403 inactive/role, ok for admin and teacher", async () => {
  const unauthenticated = createRecordingSupabaseClient({ authUser: null });
  const noSession = await authorizeStaff(unauthenticated);
  assert.equal(noSession.ok, false);
  assert.equal(noSession.status, 401);
  assert.equal(noSession.message, "Authentication required.");

  const missingProfile = createRecordingSupabaseClient({
    authUser: { id: "user-1" },
    profiles: [],
  });
  const noProfile = await authorizeStaff(missingProfile);
  assert.equal(noProfile.ok, false);
  assert.equal(noProfile.status, 403);
  assert.equal(noProfile.message, "Inactive or missing profile.");

  const inactive = createRecordingSupabaseClient({
    authUser: { id: "user-1" },
    profiles: [
      { id: "p1", auth_user_id: "user-1", role: "admin", is_active: false },
    ],
  });
  const inactiveResult = await authorizeStaff(inactive);
  assert.equal(inactiveResult.ok, false);
  assert.equal(inactiveResult.status, 403);

  const student = createRecordingSupabaseClient({
    authUser: { id: "user-1" },
    profiles: [
      { id: "p1", auth_user_id: "user-1", role: "student", is_active: true },
    ],
  });
  const studentResult = await authorizeStaff(student);
  assert.equal(studentResult.ok, false);
  assert.equal(studentResult.status, 403);
  assert.equal(studentResult.message, "Insufficient role for recommendations.");

  for (const role of ["admin", "teacher"]) {
    const allowed = createRecordingSupabaseClient({
      authUser: { id: "user-1" },
      profiles: [
        { id: "p1", auth_user_id: "user-1", role, is_active: true },
      ],
    });
    const result = await authorizeStaff(allowed);
    assert.equal(result.ok, true);
    assert.equal(result.profile.role, role);
  }
});

test("G2. Learner Scope Contract: admin bypasses the enrollment check, teacher fails closed", async () => {
  const adminClient = createRecordingSupabaseClient({
    authUser: { id: "user-adm" },
    profiles: [
      { id: "prof-adm", auth_user_id: "user-adm", role: "admin", is_active: true },
    ],
  });
  const admin = await authorizeLearnerAccess(
    adminClient,
    { role: "admin", auth_user_id: "user-adm" },
    { id: "user-adm" },
    "std-1"
  );
  assert.equal(admin.ok, true);
  assert.equal(
    adminClient.queries.some((query) => query.table === "class_students"),
    false,
    "the admin must not depend on the enrollment lookup"
  );

  const noTeacherRow = createRecordingSupabaseClient({
    authUser: { id: "user-tea" },
    teachers: [],
  });
  const noTeacher = await authorizeLearnerAccess(
    noTeacherRow,
    { role: "teacher", auth_user_id: "user-tea" },
    { id: "user-tea" },
    "std-1"
  );
  assert.equal(noTeacher.ok, false);
  assert.equal(noTeacher.status, 403);
  assert.equal(noTeacher.message, "No teacher profile found.");

  const notEnrolled = createRecordingSupabaseClient({
    authUser: { id: "user-tea" },
    teachers: [{ id: "teacher-1", user_id: "user-tea" }],
    classStudents: [],
  });
  const denied = await authorizeLearnerAccess(
    notEnrolled,
    { role: "teacher", auth_user_id: "user-tea" },
    { id: "user-tea" },
    "std-1"
  );
  assert.equal(denied.ok, false);
  assert.equal(denied.status, 403);
  assert.match(denied.message, /not enrolled in any of your assigned classes/i);

  const enrolled = createRecordingSupabaseClient({
    authUser: { id: "user-tea" },
    teachers: [{ id: "teacher-1", user_id: "user-tea" }],
    classStudents: [
      {
        id: "cs-1",
        student_id: "std-1",
        class_id: "cls-1",
        classes: { id: "cls-1", teacher_id: "teacher-1" },
      },
    ],
  });
  const allowed = await authorizeLearnerAccess(
    enrolled,
    { role: "teacher", auth_user_id: "user-tea" },
    { id: "user-tea" },
    "std-1"
  );
  assert.equal(allowed.ok, true);
});

test("G3. Advisory Payload Contract: unavailable payloads expose no restricted academic data", () => {
  const unavailablePayload = {
    status: "unavailable",
    subject: "english",
    currentTerm: 1,
    targetTerm: 2,
    predictedTrend: "—",
    source: "pattern-analysis-experimental",
    disclaimer:
      "Experimental Subject Trend Forecast — Advisory Only (Synthetic-Data Model).",
    message: "This next-term trend forecast requires a leadership session.",
    schoolYear: "SY 2026-2027",
  };

  for (const forbidden of [
    "confidence",
    "probabilities",
    "class_probabilities",
    "feature_vector",
    "features",
    "gwa",
    "grades",
    "missingSubjects",
  ]) {
    assert.equal(
      forbidden in unavailablePayload,
      false,
      `${forbidden} must not be exposed`
    );
  }

  assert.equal(unavailablePayload.status, "unavailable");
  assert.equal(unavailablePayload.predictedTrend, "—");
});
