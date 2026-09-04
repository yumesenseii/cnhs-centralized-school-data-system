import { createClient } from "@/lib/supabase/client";
import {
  parseSf2CompWorkbook,
  monthBlockToDbFields,
  sectionHintFromFileName,
} from "@/lib/attendance/parseSf2Comp";
import { monthLabel } from "@/lib/attendance/constants";
import { cacheKey, withTtlCache, invalidateTtlCache } from "@/lib/cache/ttlCache";

const supabase = createClient();

function mapSectionMonthRow(row) {
  const section = Array.isArray(row.sections) ? row.sections[0] : row.sections;
  return {
    ...row,
    section,
    sectionName: section?.section_name ?? "—",
    gradeLevel: section?.grade_level ?? null,
    monthName: monthLabel(row.month),
    ada: row.ada != null ? Number(row.ada) : null,
    pa: row.pa != null ? Number(row.pa) : null,
    percentage: row.percentage != null ? Number(row.percentage) : null,
    absences: Number(row.absences) || 0,
    late: Number(row.late) || 0,
    firstFriday: Number(row.first_friday) || 0,
    endOfMonth: Number(row.end_of_month) || 0,
    schoolDays: Number(row.school_days) || 0,
    fiveConsecutive: Number(row.five_consecutive) || 0,
    nls: Number(row.nls) || 0,
    transferredOut: Number(row.transferred_out) || 0,
    transferredIn: Number(row.transferred_in) || 0,
    totalAttendance: Number(row.total_attendance) || 0,
    attendanceOfMonth: Number(row.attendance_of_month) || 0,
  };
}

/**
 * List section monthly SF2-COMP summaries.
 */
export async function listSectionAttendanceMonths({
  schoolYear = null,
  month = null,
  sectionId = null,
} = {}) {
  return withTtlCache(
    cacheKey(["attendance:section-months", schoolYear, month, sectionId]),
    async () => {
      let query = supabase.from("attendance_section_months").select(`
        id,
        section_id,
        school_year,
        month,
        school_days,
        attendance_of_month,
        absences,
        total_attendance,
        first_friday,
        late,
        end_of_month,
        percentage,
        ada,
        pa,
        five_consecutive,
        nls,
        transferred_out,
        transferred_in,
        breakdown,
        upload_id,
        updated_at,
        sections ( id, section_name, grade_level, school_year )
      `);

      if (schoolYear) query = query.eq("school_year", schoolYear);
      if (month) query = query.eq("month", Number(month));
      if (sectionId) query = query.eq("section_id", sectionId);

      const { data, error } = await query
        .order("school_year", { ascending: false })
        .order("month", { ascending: true });

      if (error) return { data: null, error };
      return {
        data: (data ?? []).map(mapSectionMonthRow),
        error: null,
      };
    }
  );
}

/**
 * Analytics for dashboards from class monthly summaries.
 */
export async function getSectionAttendanceAnalytics({
  schoolYear = null,
  month = null,
  sectionId = null,
} = {}) {
  const result = await listSectionAttendanceMonths({
    schoolYear,
    month,
    sectionId,
  });
  if (result.error) return result;

  const rows = result.data ?? [];
  const hasData = rows.length > 0;

  const avg = (getter) => {
    const vals = rows.map(getter).filter((n) => n != null && Number.isFinite(n));
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  };

  const sum = (getter) =>
    rows.reduce((acc, row) => acc + (Number(getter(row)) || 0), 0);

  const trends = rows
    .slice()
    .sort((a, b) => {
      if (a.school_year !== b.school_year) {
        return String(a.school_year).localeCompare(String(b.school_year));
      }
      return a.month - b.month;
    })
    .map((row) => ({
      id: row.id,
      sectionId: row.section_id,
      sectionName: row.sectionName,
      schoolYear: row.school_year,
      month: row.month,
      monthName: row.monthName,
      ada: row.ada,
      pa: row.pa,
      absences: row.absences,
      late: row.late,
      schoolDays: row.schoolDays,
    }));

  return {
    data: {
      hasData,
      rows,
      sectionCount: new Set(rows.map((r) => r.section_id)).size,
      avgAda: avg((r) => r.ada),
      avgPa: avg((r) => r.pa),
      totalAbsences: sum((r) => r.absences),
      totalLate: sum((r) => r.late),
      flaggedSections: rows.filter(
        (r) =>
          r.fiveConsecutive > 0 ||
          r.nls > 0 ||
          r.transferredOut > 0 ||
          (r.pa != null && r.pa < 90)
      ),
      trends,
    },
    error: null,
  };
}

export function invalidateAttendanceAnalyticsCache() {
  invalidateTtlCache("attendance:");
}

/**
 * Resolve section id from hint (e.g. YAKAL) or explicit sectionId.
 */
async function resolveSectionId(sectionId, sectionHint, schoolYear) {
  if (sectionId) return { sectionId, error: null };

  const hint = String(sectionHint || "")
    .trim()
    .toLowerCase();
  if (!hint) {
    return {
      sectionId: null,
      error: new Error("Select a section or use a file named like SF2-_20YAKAL."),
    };
  }

  let query = supabase
    .from("sections")
    .select("id, section_name, school_year")
    .ilike("section_name", `%${hint}%`);
  if (schoolYear) query = query.eq("school_year", schoolYear);

  const { data, error } = await query.limit(5);
  if (error) return { sectionId: null, error };
  if (!data?.length) {
    return {
      sectionId: null,
      error: new Error(
        `No section matching "${sectionHint}"${schoolYear ? ` for ${schoolYear}` : ""}.`
      ),
    };
  }
  return { sectionId: data[0].id, error: null };
}

/**
 * Import SF2-COMP workbook into attendance_section_months (all months in file).
 */
export async function importSf2CompAttendance({
  fileBuffer,
  fileName,
  sectionId = null,
  schoolYear,
  teacherId = null,
  profileId = null,
}) {
  const parsed = parseSf2CompWorkbook(fileBuffer, { fileName });
  if (!parsed.months.length) {
    return {
      data: null,
      error: new Error(parsed.errors[0] || "No monthly SF2 blocks found."),
    };
  }

  const resolved = await resolveSectionId(
    sectionId,
    parsed.sectionHint || sectionHintFromFileName(fileName),
    schoolYear
  );
  if (resolved.error || !resolved.sectionId) {
    return { data: null, error: resolved.error };
  }

  const { data: upload, error: uploadError } = await supabase
    .from("attendance_uploads")
    .insert({
      uploaded_by: profileId,
      teacher_id: teacherId,
      section_id: resolved.sectionId,
      school_year: schoolYear,
      month: parsed.months[0]?.month || 1,
      file_name: fileName || "sf2.xlsx",
      status: "imported",
      row_count: parsed.months.length,
      notes: `SF2 months: ${parsed.months.map((m) => m.monthName).join(", ")}`,
    })
    .select("id")
    .single();

  if (uploadError) return { data: null, error: uploadError };

  const payload = parsed.months.map((block) => {
    const fields = monthBlockToDbFields(block);
    return {
      section_id: resolved.sectionId,
      school_year: schoolYear,
      ...fields,
      upload_id: upload.id,
      updated_at: new Date().toISOString(),
    };
  });

  const { error: upsertError } = await supabase
    .from("attendance_section_months")
    .upsert(payload, { onConflict: "section_id,school_year,month" });

  if (upsertError) return { data: null, error: upsertError };

  invalidateAttendanceAnalyticsCache();

  return {
    data: {
      uploadId: upload.id,
      sectionId: resolved.sectionId,
      importedMonths: parsed.months.length,
      months: parsed.months.map((m) => m.monthName),
      sectionHint: parsed.sectionHint,
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

/** @deprecated Learner-level history — kept for student portal compatibility. */
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

  return {
    data: {
      records: data ?? [],
      summary: null,
    },
    error: null,
  };
}

/**
 * @deprecated Prefer getSectionAttendanceAnalytics — learner SF2 path retired as primary.
 */
export async function getAttendanceAnalytics(opts = {}) {
  const section = await getSectionAttendanceAnalytics(opts);
  if (section.error) return section;
  const d = section.data;
  return {
    data: {
      records: [],
      monthlyAttendanceRate: d.avgPa,
      presentTotal: 0,
      absentTotal: d.totalAbsences,
      nearThresholdCount: d.flaggedSections.length,
      nearThresholdLearners: [],
      trends: d.trends.map((t) => ({
        schoolYear: t.schoolYear,
        month: t.month,
        monthName: t.monthName,
        present: 0,
        absent: t.absences,
        schoolDays: t.schoolDays,
        rate: t.pa,
      })),
      presentVsAbsent: [
        { name: "Absences", value: d.totalAbsences, color: "#e76f51" },
        { name: "Late", value: d.totalLate, color: "#f4a261" },
      ],
      sectionAnalytics: d,
    },
    error: null,
  };
}

/**
 * @deprecated Learner LRN SF2 import — use importSf2CompAttendance.
 */
export async function importSf2Attendance(args) {
  return importSf2CompAttendance(args);
}
