import { createClient } from "@/lib/supabase/client";
import { splitLearnerName } from "@/lib/teacher/myClassesMappers";
import { cacheKey, withTtlCache, invalidateTtlCache } from "@/lib/cache/ttlCache";

// Shared singleton from lib/supabase/client.js (do not create a second GoTrue client).
const supabase = createClient();
const AUTH_TTL_MS = 30_000;

const CLASS_SELECT = `
  id,
  subject_id,
  teacher_id,
  section_id,
  school_year,
  quarter,
  created_at,
  subjects (
    id,
    subject_name,
    subject_code
  ),
  sections (
    id,
    section_name,
    grade_level,
    school_year,
    adviser_id
  ),
  teachers (
    id,
    user_id,
    first_name,
    last_name,
    middle_name
  ),
  class_students (
    id,
    student_id,
    created_at
  )
`;

/**
 * Resolve the logged-in profile and linked teachers row.
 * classes.teacher_id references teachers.id.
 * teachers.user_id references public.users.id (also tries auth/profile ids).
 */
export async function getCurrentTeacherSession() {
  return withTtlCache(
    cacheKey(["auth:teacher:session"]),
    async () => {
      // Ensure the shared browser client has recovered the persisted session
      // before querying (avoids empty lesson_plans / classes results).
      await supabase.auth.getSession();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return { data: null, error: userError ?? new Error("Not authenticated") };
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select(
          "id, auth_user_id, full_name, role, is_active, must_change_password, temp_password"
        )
        .eq("auth_user_id", user.id)
        .single();

      if (profileError || !profile) {
        return {
          data: null,
          error: profileError ?? new Error("Unable to load teacher profile."),
        };
      }

      if (profile.role !== "teacher") {
        return {
          data: null,
          error: new Error("Teacher account required to view assigned classes."),
        };
      }

      const teacherSelect =
        "id, user_id, first_name, last_name, middle_name, email, status, employee_number, learning_area, contact_number";

      let teacher = null;
      let teacherError = null;

      const candidateUserIds = [profile.auth_user_id, profile.id].filter(Boolean);

      if (user.email) {
        const { data: appUser } = await supabase
          .from("users")
          .select("id")
          .eq("email", user.email)
          .maybeSingle();
        if (appUser?.id) candidateUserIds.push(appUser.id);
      }

      for (const candidateId of [...new Set(candidateUserIds)]) {
        const result = await supabase
          .from("teachers")
          .select(teacherSelect)
          .eq("user_id", candidateId)
          .maybeSingle();

        if (result.error) {
          teacherError = result.error;
          break;
        }
        if (result.data) {
          teacher = result.data;
          break;
        }
      }

      if (teacherError) {
        return { data: null, error: teacherError };
      }

      if (!teacher) {
        return {
          data: null,
          error: new Error(
            "No teacher record is linked to this account. Ask an administrator to create your teachers row and assign classes."
          ),
        };
      }

      return {
        data: {
          profile,
          teacher,
          teacherId: teacher.id,
        },
        error: null,
      };
    },
    AUTH_TTL_MS
  );
}

export function invalidateTeacherSessionCache() {
  invalidateTtlCache("auth:teacher");
}

/** @deprecated Prefer getCurrentTeacherSession — kept for call sites that only need the profile. */
export async function getCurrentProfile() {
  return withTtlCache(
    cacheKey(["auth:teacher:profile"]),
    async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        return { data: null, error: userError ?? new Error("Not authenticated") };
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, auth_user_id, full_name, role, is_active")
        .eq("auth_user_id", user.id)
        .single();

      return { data, error };
    },
    AUTH_TTL_MS
  );
}

export async function getTeacherClasses(teacherId) {
  if (!teacherId) {
    return { data: [], error: new Error("Teacher id is required.") };
  }

  return withTtlCache(
    cacheKey(["teacher:classes", teacherId]),
    async () => {
      const { data, error } = await supabase
        .from("classes")
        .select(CLASS_SELECT)
        .eq("teacher_id", teacherId)
        .order("created_at", { ascending: true });

      return { data: data ?? [], error };
    }
  );
}

export async function getClassById(classId, { teacherId = null } = {}) {
  let query = supabase
    .from("classes")
    .select(CLASS_SELECT)
    .eq("id", classId);

  if (teacherId) {
    query = query.eq("teacher_id", teacherId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) return { data: null, error };
  if (!data) {
    return {
      data: null,
      error: new Error(
        teacherId
          ? "Class not found or not assigned to you."
          : "Class not found."
      ),
    };
  }

  return { data, error: null };
}

export async function getClassStudents(classId, { teacherId = null } = {}) {
  if (teacherId) {
    const ownership = await getClassById(classId, { teacherId });
    if (ownership.error || !ownership.data) {
      return { data: [], error: ownership.error };
    }
  }

  const { data, error } = await supabase
    .from("class_students")
    .select(
      `
      id,
      class_id,
      student_id,
      created_at,
      students (
        id,
        student_number,
        first_name,
        middle_name,
        last_name,
        sex,
        birthdate,
        section_id,
        status
      )
    `
    )
    .eq("class_id", classId)
    .order("created_at", { ascending: true });

  return { data: data ?? [], error };
}

export async function getStudentInClass(classId, studentId, { teacherId = null } = {}) {
  if (teacherId) {
    const ownership = await getClassById(classId, { teacherId });
    if (ownership.error || !ownership.data) {
      return { data: null, error: ownership.error };
    }
  }

  const { data, error } = await supabase
    .from("class_students")
    .select(
      `
      id,
      class_id,
      student_id,
      created_at,
      students (
        id,
        student_number,
        first_name,
        middle_name,
        last_name,
        sex,
        birthdate,
        section_id,
        status
      )
    `
    )
    .eq("class_id", classId)
    .eq("student_id", studentId)
    .maybeSingle();

  return { data, error };
}

export async function getStudentGrades(
  classId,
  studentId,
  { quarter = null, schoolYear = null } = {}
) {
  let query = supabase
    .from("grades")
    .select(
      `
      id,
      student_id,
      class_id,
      subject_id,
      quarter,
      final_grade,
      school_year,
      created_at,
      updated_at,
      subjects (
        id,
        subject_name,
        subject_code
      )
    `
    )
    .eq("class_id", classId)
    .eq("student_id", studentId)
    .order("created_at", { ascending: true });

  if (quarter !== null && quarter !== undefined && quarter !== "") {
    query = query.eq("quarter", Number(quarter));
  }
  if (schoolYear) {
    query = query.eq("school_year", schoolYear);
  }

  const { data, error } = await query;
  return { data: data ?? [], error };
}

export async function getClassGrades(
  classId,
  { quarter = null, schoolYear = null } = {}
) {
  let query = supabase
    .from("grades")
    .select(
      `
      id,
      student_id,
      class_id,
      subject_id,
      quarter,
      final_grade,
      school_year,
      subjects (
        id,
        subject_name,
        subject_code
      )
    `
    )
    .eq("class_id", classId);

  if (quarter !== null && quarter !== undefined && quarter !== "") {
    query = query.eq("quarter", Number(quarter));
  }
  if (schoolYear) {
    query = query.eq("school_year", schoolYear);
  }

  const { data, error } = await query;
  return { data: data ?? [], error };
}

/**
 * Upsert using unique (student_id, class_id, subject_id, quarter, school_year).
 */
export async function upsertGrade(gradeRow) {
  const payload = {
    student_id: gradeRow.student_id,
    class_id: gradeRow.class_id,
    subject_id: gradeRow.subject_id,
    quarter: Number(gradeRow.quarter),
    final_grade:
      gradeRow.final_grade === null || gradeRow.final_grade === undefined
        ? null
        : Number(gradeRow.final_grade),
    school_year: gradeRow.school_year,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("grades")
    .upsert(payload, {
      onConflict: "student_id,class_id,subject_id,quarter,school_year",
    })
    .select(
      `
      id,
      student_id,
      class_id,
      subject_id,
      quarter,
      final_grade,
      school_year,
      created_at,
      updated_at
    `
    )
    .single();

  return { data, error };
}

export async function findStudentByNumber(studentNumber) {
  const { data, error } = await supabase
    .from("students")
    .select(
      "id, student_number, first_name, middle_name, last_name, sex, birthdate, section_id, status"
    )
    .eq("student_number", studentNumber)
    .maybeSingle();

  return { data, error };
}

const STUDENT_VARCHAR_LIMITS = {
  student_number: 30,
  first_name: 50,
  middle_name: 50,
  last_name: 50,
  sex: 10,
  status: 20,
};

const LOOKUP_CHUNK = 80;
const WRITE_CHUNK = 100;

function buildStudentInsertPayload(student) {
  const names =
    student.first_name && student.last_name
      ? {
          first_name: student.first_name,
          middle_name: student.middle_name ?? null,
          last_name: student.last_name,
        }
      : splitLearnerName(student.full_name);

  const payload = {
    student_number: student.student_number,
    first_name: names.first_name,
    middle_name: names.middle_name,
    last_name: names.last_name,
    sex: student.sex ?? student.gender ?? null,
    section_id: student.section_id ?? null,
    ...(student.status ? { status: student.status } : {}),
  };

  for (const [column, limit] of Object.entries(STUDENT_VARCHAR_LIMITS)) {
    const value = payload[column];
    if (value === null || value === undefined) continue;
    const text = String(value);
    if (text.length > limit) {
      return {
        payload: null,
        error: new Error(
          `Table: students\nColumn: ${column}\nValue: ${text}\nLength: ${text.length}`
        ),
      };
    }
  }

  return { payload, error: null };
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function createStudent(student) {
  const built = buildStudentInsertPayload(student);
  if (built.error) return { data: null, error: built.error };

  const { data, error } = await supabase
    .from("students")
    .insert(built.payload)
    .select(
      "id, student_number, first_name, middle_name, last_name, sex, birthdate, section_id, status"
    )
    .single();

  if (error) {
    console.error("[E-Class] students INSERT failed", {
      message: error.message,
      details: error.details,
      payload: built.payload,
    });
  }

  return { data, error };
}

export async function findStudentsByNumbers(studentNumbers) {
  const unique = [
    ...new Set((studentNumbers ?? []).map((n) => String(n ?? "").trim()).filter(Boolean)),
  ];
  if (!unique.length) return { data: [], error: null };

  const rows = [];
  for (const chunk of chunkArray(unique, LOOKUP_CHUNK)) {
    const { data, error } = await supabase
      .from("students")
      .select("id, student_number")
      .in("student_number", chunk);
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
  }

  return { data: rows, error: null };
}

export async function createStudents(students) {
  if (!students?.length) return { data: [], error: null };

  const payloads = [];
  for (const student of students) {
    const built = buildStudentInsertPayload(student);
    if (built.error) return { data: [], error: built.error };
    payloads.push(built.payload);
  }

  const rows = [];
  for (const chunk of chunkArray(payloads, WRITE_CHUNK)) {
    const { data, error } = await supabase
      .from("students")
      .insert(chunk)
      .select("id, student_number");
    if (error) return { data: rows, error };
    rows.push(...(data ?? []));
  }

  return { data: rows, error: null };
}

export async function ensureClassStudents(links) {
  const unique = [];
  const seen = new Set();
  for (const link of links ?? []) {
    if (!link?.class_id || !link?.student_id) continue;
    const key = `${link.class_id}:${link.student_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ class_id: link.class_id, student_id: link.student_id });
  }
  if (!unique.length) return { error: null };

  for (const chunk of chunkArray(unique, WRITE_CHUNK)) {
    const { error } = await supabase.from("class_students").upsert(chunk, {
      onConflict: "class_id,student_id",
      ignoreDuplicates: true,
    });
    if (error) return { error };
  }

  return { error: null };
}

export async function upsertGrades(gradeRows) {
  if (!gradeRows?.length) return { data: [], error: null };

  const nowIso = new Date().toISOString();
  const payloads = gradeRows.map((gradeRow) => ({
    student_id: gradeRow.student_id,
    class_id: gradeRow.class_id,
    subject_id: gradeRow.subject_id,
    quarter: Number(gradeRow.quarter),
    final_grade:
      gradeRow.final_grade === null || gradeRow.final_grade === undefined
        ? null
        : Number(gradeRow.final_grade),
    school_year: gradeRow.school_year,
    updated_at: nowIso,
  }));

  let upserted = 0;
  for (const chunk of chunkArray(payloads, WRITE_CHUNK)) {
    const { error } = await supabase.from("grades").upsert(chunk, {
      onConflict: "student_id,class_id,subject_id,quarter,school_year",
    });
    if (error) return { data: [], error, count: upserted };
    upserted += chunk.length;
  }

  return { data: payloads, error: null, count: upserted };
}

/**
 * Link a student to a class. Unique on (class_id, student_id) — check first
 * and skip duplicates.
 */
export async function ensureClassStudent(classId, studentId) {
  const existing = await supabase
    .from("class_students")
    .select("id, class_id, student_id, created_at")
    .eq("class_id", classId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (existing.error) {
    return { data: null, error: existing.error };
  }

  if (existing.data) {
    return { data: existing.data, error: null, created: false };
  }

  const { data, error } = await supabase
    .from("class_students")
    .insert({
      class_id: classId,
      student_id: studentId,
    })
    .select("id, class_id, student_id, created_at")
    .single();

  return { data, error, created: true };
}

/** @deprecated Use ensureClassStudent — enrollment metrics columns do not exist. */
export async function upsertEnrollment(enrollment) {
  return ensureClassStudent(enrollment.class_id, enrollment.student_id);
}
