import { createClient } from "@/lib/supabase/client";
import { getCurrentTeacherSession } from "@/lib/supabase/queries/myClasses";

const supabase = createClient();

function mapClose(row) {
  if (!row) return null;
  return {
    id: row.id,
    sectionId: row.section_id,
    schoolYear: row.school_year,
    month: Number(row.month),
    schoolDays: Number(row.school_days),
    ffM: Number(row.ff_m) || 0,
    ffF: Number(row.ff_f) || 0,
    eomM: Number(row.eom_m) || 0,
    eomF: Number(row.eom_f) || 0,
    notes: row.notes || "",
    closedBy: row.closed_by ?? null,
    closedAt: row.closed_at ?? null,
  };
}

export async function getSectionMonthClose({ sectionId, schoolYear, month }) {
  if (!sectionId || !schoolYear || !month) {
    return { data: null, error: null };
  }

  const { data, error } = await supabase
    .from("attendance_month_closes")
    .select(
      "id, section_id, school_year, month, school_days, ff_m, ff_f, eom_m, eom_f, notes, closed_by, closed_at"
    )
    .eq("section_id", sectionId)
    .eq("school_year", schoolYear)
    .eq("month", Number(month))
    .maybeSingle();

  if (error) return { data: null, error };
  return { data: mapClose(data), error: null };
}

export async function upsertSectionMonthClose({
  sectionId,
  schoolYear,
  month,
  schoolDays,
  ffM,
  ffF,
  eomM,
  eomF,
  notes,
}) {
  const days = Number(schoolDays);
  if (!sectionId || !schoolYear || !month) {
    return {
      data: null,
      error: new Error("Section, school year, and month are required."),
    };
  }
  if (!Number.isInteger(days) || days <= 0) {
    return {
      data: null,
      error: new Error("Days of classes must be a whole number greater than 0."),
    };
  }

  const session = await getCurrentTeacherSession();
  const teacherId = session.data?.teacherId ?? null;
  if (!teacherId) {
    return {
      data: null,
      error: new Error("Only the class adviser can close the month."),
    };
  }

  const payload = {
    section_id: sectionId,
    school_year: schoolYear,
    month: Number(month),
    school_days: days,
    ff_m: Math.max(0, Number(ffM) || 0),
    ff_f: Math.max(0, Number(ffF) || 0),
    eom_m: Math.max(0, Number(eomM) || 0),
    eom_f: Math.max(0, Number(eomF) || 0),
    notes: String(notes || "").trim() || null,
    closed_by: teacherId,
    closed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("attendance_month_closes")
    .upsert(payload, { onConflict: "section_id,school_year,month" })
    .select(
      "id, section_id, school_year, month, school_days, ff_m, ff_f, eom_m, eom_f, notes, closed_by, closed_at"
    )
    .maybeSingle();

  if (error) return { data: null, error };
  return { data: mapClose(data), error: null };
}
