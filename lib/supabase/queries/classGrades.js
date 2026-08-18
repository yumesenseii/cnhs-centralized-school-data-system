import { createClient } from "@/lib/supabase/client";
import { requireAdmin } from "@/lib/supabase/queries/adminAuth";

const supabase = createClient();

/**
 * Admin recovery: clear imported ECR grades (+ class enrollments) for one class.
 * Keeps the class assignment, lesson plans, and student master rows.
 *
 * @param {string} classId
 * @returns {Promise<{ data: { classId: string, gradesDeleted: number, enrollmentsDeleted: number } | null, error: Error | null }>}
 */
export async function clearGradesForClass(classId) {
  const auth = await requireAdmin("clear class grades");
  if (!auth.ok) return { data: null, error: auth.error };

  const id = String(classId ?? "").trim();
  if (!id) {
    return { data: null, error: new Error("Class id is required.") };
  }

  const classCheck = await supabase
    .from("classes")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (classCheck.error) {
    return { data: null, error: classCheck.error };
  }
  if (!classCheck.data) {
    return { data: null, error: new Error("Class assignment not found.") };
  }

  // Grades first (depend on class + student).
  const gradesResult = await supabase
    .from("grades")
    .delete()
    .eq("class_id", id)
    .select("id");

  if (gradesResult.error) {
    return { data: null, error: gradesResult.error };
  }

  // Detach enrollments for this class only — do not delete public.students.
  const enrollResult = await supabase
    .from("class_students")
    .delete()
    .eq("class_id", id)
    .select("id");

  if (enrollResult.error) {
    return { data: null, error: enrollResult.error };
  }

  return {
    data: {
      classId: id,
      gradesDeleted: gradesResult.data?.length ?? 0,
      enrollmentsDeleted: enrollResult.data?.length ?? 0,
    },
    error: null,
  };
}

/**
 * Demo reset: clear imported grades + enrollments for a school year
 * (or every class if schoolYear is empty). Keeps assignments and students.
 */
export async function clearAllImportedGrades({ schoolYear = null } = {}) {
  const auth = await requireAdmin("clear all class grades");
  if (!auth.ok) return { data: null, error: auth.error };

  const year = String(schoolYear ?? "").trim();
  let classesQuery = supabase.from("classes").select("id");
  if (year) classesQuery = classesQuery.eq("school_year", year);

  const { data: classRows, error: classError } = await classesQuery;
  if (classError) return { data: null, error: classError };

  const classIds = [...new Set((classRows ?? []).map((row) => row.id).filter(Boolean))];
  if (!classIds.length) {
    return {
      data: { gradesDeleted: 0, enrollmentsDeleted: 0, classCount: 0 },
      error: null,
    };
  }

  let gradesDeleted = 0;
  let enrollmentsDeleted = 0;
  const chunkSize = 80;

  for (let i = 0; i < classIds.length; i += chunkSize) {
    const chunk = classIds.slice(i, i + chunkSize);
    const gradesResult = await supabase
      .from("grades")
      .delete()
      .in("class_id", chunk)
      .select("id");
    if (gradesResult.error) return { data: null, error: gradesResult.error };
    gradesDeleted += gradesResult.data?.length ?? 0;

    const enrollResult = await supabase
      .from("class_students")
      .delete()
      .in("class_id", chunk)
      .select("id");
    if (enrollResult.error) return { data: null, error: enrollResult.error };
    enrollmentsDeleted += enrollResult.data?.length ?? 0;
  }

  return {
    data: {
      gradesDeleted,
      enrollmentsDeleted,
      classCount: classIds.length,
    },
    error: null,
  };
}
