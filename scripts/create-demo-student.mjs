/**
 * One-off: create live student auth account + link students row + seed demo grades.
 * Usage: node scripts/create-demo-student.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = loadEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const LRN = "104793482917";
const EMAIL = `${LRN}@student.cnhs.local`;
const PASSWORD = "CnhsStudent2026!";
const FIRST = "Akissia Kaith";
const MIDDLE = "Yamsuan";
const LAST = "Santos";
const FULL_NAME = `${FIRST} ${MIDDLE} ${LAST}`;

// Science · Grade 10 Ponce
const CLASS_ID = "a7da292d-58d8-4907-a607-a5c4017a14cd";
const SUBJECT_ID = "d7a4e1b0-57f6-473b-887d-881d4a901a8d";
const SECTION_ID = "4b9b710a-8c6d-4670-81c7-bb34c3c75ca2";
const SCHOOL_YEAR = "SY 2026-2027";
const QUARTER = 1;
const DEMO_GRADE = 72;

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: FULL_NAME,
      role: "student",
      portal_role: "student",
      portal_active: true,
    },
  });

  if (authError || !authData.user) {
    console.error("Auth create failed:", authError?.message);
    process.exit(1);
  }

  const authUserId = authData.user.id;

  try {
    const { error: userError } = await admin.from("users").insert({
      id: authUserId,
      username: LRN,
      email: EMAIL,
      password_hash: "supabase-auth-managed",
      role: "student",
      status: "active",
    });
    if (userError) throw userError;

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        auth_user_id: authUserId,
        full_name: FULL_NAME,
        role: "student",
        is_active: true,
      },
      { onConflict: "auth_user_id" }
    );
    if (profileError) throw profileError;

    const { data: student, error: studentError } = await admin
      .from("students")
      .insert({
        user_id: authUserId,
        student_number: LRN,
        first_name: FIRST,
        middle_name: MIDDLE,
        last_name: LAST,
        section_id: SECTION_ID,
        status: "active",
      })
      .select("id")
      .single();
    if (studentError) throw studentError;

    const studentId = student.id;

    // Enroll in every class for this section / period (graded + ungraded subjects).
    const { data: sectionClasses, error: classesError } = await admin
      .from("classes")
      .select("id, subject_id")
      .eq("section_id", SECTION_ID)
      .eq("school_year", SCHOOL_YEAR)
      .eq("quarter", QUARTER);
    if (classesError) throw classesError;

    const classRows = sectionClasses?.length
      ? sectionClasses
      : [{ id: CLASS_ID, subject_id: SUBJECT_ID }];

    const { error: enrollError } = await admin.from("class_students").insert(
      classRows.map((row) => ({
        class_id: row.id,
        student_id: studentId,
      }))
    );
    if (enrollError) throw enrollError;

    const { error: gradeError } = await admin.from("grades").insert({
      student_id: studentId,
      class_id: CLASS_ID,
      subject_id: SUBJECT_ID,
      quarter: QUARTER,
      final_grade: DEMO_GRADE,
      school_year: SCHOOL_YEAR,
    });
    if (gradeError) throw gradeError;

    console.log(JSON.stringify({
      ok: true,
      email: EMAIL,
      password: PASSWORD,
      lrn: LRN,
      fullName: FULL_NAME,
      studentId,
      authUserId,
      enrolledClasses: classRows.length,
      demoGradeSubject: "Science · Grade 10 Ponce",
      demoGrade: DEMO_GRADE,
    }, null, 2));
  } catch (error) {
    console.error("Rollback due to:", error?.message ?? error);
    const { data: existing } = await admin
      .from("students")
      .select("id")
      .eq("user_id", authUserId)
      .maybeSingle();
    if (existing?.id) {
      await admin.from("grades").delete().eq("student_id", existing.id);
      await admin.from("class_students").delete().eq("student_id", existing.id);
      await admin.from("students").delete().eq("id", existing.id);
    }
    await admin.from("profiles").delete().eq("auth_user_id", authUserId);
    await admin.from("users").delete().eq("id", authUserId);
    await admin.auth.admin.deleteUser(authUserId);
    process.exit(1);
  }
}

main();
