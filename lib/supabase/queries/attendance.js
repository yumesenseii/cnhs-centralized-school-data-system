import { createClient } from "@/lib/supabase/client";
import { parseSf2Workbook } from "@/lib/attendance/parseSf2";
import {
  aggregateAttendanceRecords,
  computeAttendanceMetrics,
  monthLabel,
} from "@/lib/attendance/constants";
import { cacheKey, withTtlCache, invalidateTtlCache } from "@/lib/cache/ttlCache";

const supabase = createClient();

/**
 * Attendance records for one student (history).
 */
export async function getStudentAttendanceHistory(studentId) {
  if (!studentId) {
    return { data: null, error: new Error("Student id required.") };
  }

  const { data, error } = await supabase
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
      created_at,
      sections ( section_name, grade_level )
    `
    )
    .eq("student_id", studentId)
    .order("school_year", { ascending: false })
    .order("month", { ascending: false });

  if (error) return { data: null, error };

  const records = (data ?? []).map((row) => {
    const metrics = computeAttendanceMetrics(row);
    const section = Array.isArray(row.sections) ? row.sections[0] : row.sections;
    return {
      ...row,
      section,
      monthName: monthLabel(row.month),
      ...metrics,
    };
  });

  return {
    data: {
      records,
      summary: aggregateAttendanceRecords(data ?? []),
    },
    error: null,
  };
}

/**
 * School-wide / filterable attendance analytics for dashboards.
 */
export async function getAttendanceAnalytics({
  schoolYear = null,
  month = null,
} = {}) {
  return withTtlCache(
    cacheKey(["attendance:analytics", schoolYear, month]),
    async () => {
  let query = supabase.from("attendance_records").select(`
      id,
      student_id,
      section_id,
      school_year,
      month,
      present_days,
      absent_days,
      late_days,
      school_days,
      students (
        id,
        student_number,
        first_name,
        middle_name,
        last_name
      ),
      sections (
        section_name,
        grade_level
      )
    `);

  if (schoolYear) query = query.eq("school_year", schoolYear);
  if (month) query = query.eq("month", Number(month));

  const { data, error } = await query;
  if (error) return { data: null, error };

  const rows = data ?? [];
  const withMetrics = rows.map((row) => {
    const metrics = computeAttendanceMetrics(row);
    const student = Array.isArray(row.students) ? row.students[0] : row.students;
    const section = Array.isArray(row.sections) ? row.sections[0] : row.sections;
    const name = student
      ? [student.last_name, student.first_name, student.middle_name]
          .filter(Boolean)
          .join(", ")
      : "Learner";
    return {
      ...row,
      student,
      section,
      learnerName: name,
      ...metrics,
    };
  });

  const nearThreshold = withMetrics.filter((r) => r.nearThreshold);
  const totalPresent = withMetrics.reduce((s, r) => s + r.present, 0);
  const totalAbsent = withMetrics.reduce((s, r) => s + r.absent, 0);
  const totalSchool = withMetrics.reduce((s, r) => s + r.schoolDays, 0);
  const monthlyRate =
    totalSchool > 0
      ? Math.round(((totalPresent / totalSchool) * 1000) / 10)
      : null;

  const byMonth = new Map();
  for (const row of withMetrics) {
    const key = `${row.school_year}|${row.month}`;
    const bucket = byMonth.get(key) || {
      schoolYear: row.school_year,
      month: row.month,
      monthName: monthLabel(row.month),
      present: 0,
      absent: 0,
      schoolDays: 0,
    };
    bucket.present += row.present;
    bucket.absent += row.absent;
    bucket.schoolDays += row.schoolDays;
    byMonth.set(key, bucket);
  }

  const trends = [...byMonth.values()]
    .map((b) => ({
      ...b,
      rate:
        b.schoolDays > 0
          ? Math.round(((b.present / b.schoolDays) * 1000) / 10)
          : null,
    }))
    .sort((a, b) => {
      if (a.schoolYear !== b.schoolYear) {
        return String(a.schoolYear).localeCompare(String(b.schoolYear));
      }
      return a.month - b.month;
    });

  return {
    data: {
      records: withMetrics,
      monthlyAttendanceRate: monthlyRate,
      presentTotal: totalPresent,
      absentTotal: totalAbsent,
      nearThresholdCount: nearThreshold.length,
      nearThresholdLearners: nearThreshold
        .slice()
        .sort((a, b) => (b.absenceRate ?? 0) - (a.absenceRate ?? 0))
        .slice(0, 12),
      trends,
      presentVsAbsent: [
        { name: "Present", value: totalPresent, color: "#52b788" },
        { name: "Absent", value: totalAbsent, color: "#e76f51" },
      ],
    },
    error: null,
  };
    }
  );
}

export function invalidateAttendanceAnalyticsCache() {
  invalidateTtlCache("attendance:");
}

/**
 * Import SF2 workbook into attendance_records for a section + month.
 */
export async function importSf2Attendance({
  fileBuffer,
  fileName,
  sectionId,
  schoolYear,
  month,
  teacherId = null,
  profileId = null,
}) {
  const parsed = parseSf2Workbook(fileBuffer);
  if (!parsed.rows.length) {
    return {
      data: null,
      error: new Error(parsed.errors[0] || "No valid attendance rows found."),
    };
  }

  const studentNumbers = parsed.rows.map((r) => r.studentNumber);
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, student_number")
    .in("student_number", studentNumbers);

  if (studentsError) return { data: null, error: studentsError };

  const byNumber = new Map(
    (students ?? []).map((s) => [String(s.student_number), s.id])
  );

  const matched = [];
  const unmatched = [];
  for (const row of parsed.rows) {
    const studentId = byNumber.get(row.studentNumber);
    if (!studentId) {
      unmatched.push(row.studentNumber);
      continue;
    }
    matched.push({ ...row, studentId });
  }

  if (!matched.length) {
    return {
      data: null,
      error: new Error(
        "None of the LRNs in the file matched enrolled students."
      ),
    };
  }

  const { data: upload, error: uploadError } = await supabase
    .from("attendance_uploads")
    .insert({
      uploaded_by: profileId,
      teacher_id: teacherId,
      section_id: sectionId || null,
      school_year: schoolYear,
      month: Number(month),
      file_name: fileName || "sf2-upload.xlsx",
      status: unmatched.length ? "partial" : "imported",
      row_count: matched.length,
      notes: unmatched.length
        ? `Unmatched LRNs: ${unmatched.slice(0, 10).join(", ")}`
        : null,
    })
    .select("id")
    .single();

  if (uploadError) return { data: null, error: uploadError };

  const payload = matched.map((row) => ({
    student_id: row.studentId,
    section_id: sectionId || null,
    school_year: schoolYear,
    month: Number(month),
    present_days: row.presentDays,
    absent_days: row.absentDays,
    late_days: row.lateDays,
    school_days: row.schoolDays,
    upload_id: upload.id,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await supabase
    .from("attendance_records")
    .upsert(payload, { onConflict: "student_id,school_year,month" });

  if (upsertError) return { data: null, error: upsertError };

  invalidateAttendanceAnalyticsCache();

  return {
    data: {
      uploadId: upload.id,
      imported: matched.length,
      unmatched,
      parseErrors: parsed.errors,
    },
    error: null,
  };
}

export async function listAttendanceUploads(limit = 20) {
  const { data, error } = await supabase
    .from("attendance_uploads")
    .select(
      `
      id,
      school_year,
      month,
      file_name,
      status,
      row_count,
      notes,
      created_at,
      sections ( section_name, grade_level )
    `
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { data: null, error };
  return {
    data: (data ?? []).map((row) => ({
      ...row,
      monthName: monthLabel(row.month),
      section: Array.isArray(row.sections) ? row.sections[0] : row.sections,
    })),
    error: null,
  };
}
