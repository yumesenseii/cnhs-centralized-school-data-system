import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

function unwrap(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * Resolve the logged-in student profile + students row.
 */
export async function getCurrentStudentSession() {
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
    .select("id, auth_user_id, full_name, role, is_active")
    .eq("auth_user_id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      data: null,
      error: profileError ?? new Error("Unable to load student profile."),
    };
  }

  if (profile.role !== "student") {
    return {
      data: null,
      error: new Error("Student account required to view the student portal."),
    };
  }

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select(
      `
      id,
      user_id,
      student_number,
      first_name,
      middle_name,
      last_name,
      sex,
      birthdate,
      status,
      section_id,
      sections (
        id,
        section_name,
        grade_level,
        school_year
      )
    `
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (studentError || !student) {
    return {
      data: null,
      error:
        studentError ??
        new Error("Student record is not linked to this account yet."),
    };
  }

  return {
    data: {
      user,
      profile,
      student: {
        ...student,
        sections: unwrap(student.sections),
      },
    },
    error: null,
  };
}

/**
 * Enrollments + grades + monitoring for the signed-in student.
 */
export async function getStudentPortalData() {
  const session = await getCurrentStudentSession();
  if (session.error || !session.data) {
    return { data: null, error: session.error };
  }

  const { student, profile } = session.data;
  const studentId = student.id;

  const [
    enrollmentsResult,
    gradesResult,
    monitoringResult,
    remedialResult,
    attendanceResult,
  ] = await Promise.all([
      supabase
        .from("class_students")
        .select(
          `
          id,
          class_id,
          classes (
            id,
            school_year,
            quarter,
            subject_id,
            section_id,
            subjects (
              id,
              subject_name,
              subject_code
            ),
            sections (
              id,
              section_name,
              grade_level,
              school_year
            )
          )
        `
        )
        .eq("student_id", studentId),
      supabase
        .from("grades")
        .select(
          `
          id,
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
        .eq("student_id", studentId)
        .order("school_year", { ascending: false })
        .order("quarter", { ascending: false }),
      supabase
        .from("monitoring_records")
        .select(
          `
          id,
          class_id,
          observation_date,
          intervention_given,
          teacher_remarks,
          student_progress,
          follow_up_needed,
          monitoring_status,
          school_year,
          quarter,
          created_at
        `
        )
        .eq("student_id", studentId)
        .order("observation_date", { ascending: false })
        .limit(20),
      supabase.rpc("get_my_classroom_remedial_flags"),
      supabase
        .from("attendance_records")
        .select(
          `
          id,
          student_id,
          section_id,
          school_year,
          month,
          present_days,
          absent_days,
          late_days,
          school_days,
          created_at
        `
        )
        .eq("student_id", studentId)
        .order("school_year", { ascending: false })
        .order("month", { ascending: false }),
    ]);

  if (enrollmentsResult.error) {
    return { data: null, error: enrollmentsResult.error };
  }
  if (gradesResult.error) {
    return { data: null, error: gradesResult.error };
  }
  if (monitoringResult.error) {
    return { data: null, error: monitoringResult.error };
  }
  if (remedialResult.error) {
    return { data: null, error: remedialResult.error };
  }
  if (attendanceResult.error) {
    return { data: null, error: attendanceResult.error };
  }

  const enrollments = (enrollmentsResult.data ?? []).map((row) => {
    const classRow = unwrap(row.classes);
    return {
      id: row.id,
      classId: row.class_id,
      schoolYear: classRow?.school_year ?? null,
      quarter: classRow?.quarter ?? null,
      subject: unwrap(classRow?.subjects),
      section: unwrap(classRow?.sections),
    };
  });

  const grades = (gradesResult.data ?? []).map((row) => ({
    id: row.id,
    classId: row.class_id,
    subjectId: row.subject_id,
    quarter: row.quarter,
    finalGrade:
      row.final_grade === null || row.final_grade === undefined
        ? null
        : Number(row.final_grade),
    schoolYear: row.school_year,
    subject: unwrap(row.subjects),
  }));

  return {
    data: {
      profile,
      student,
      enrollments,
      grades,
      monitoringRecords: monitoringResult.data ?? [],
      classroomRemedial: remedialResult.data ?? [],
      attendanceRecords: attendanceResult.data ?? [],
    },
    error: null,
  };
}
