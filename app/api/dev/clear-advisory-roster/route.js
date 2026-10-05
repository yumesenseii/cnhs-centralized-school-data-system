import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  try {
    const supabase = await createClient();

    let sectionId = null;
    try {
      const body = await request.json();
      sectionId = body?.sectionId || null;
    } catch {
      // Body may be empty
    }

    // If sectionId is not provided, look up Grade 7 Gumamela
    let section = null;
    if (sectionId) {
      const { data } = await supabase
        .from("sections")
        .select("id, section_name, grade_level, school_year, adviser_id")
        .eq("id", sectionId)
        .maybeSingle();
      section = data;
    } else {
      // Find Gumamela section
      const { data } = await supabase
        .from("sections")
        .select("id, section_name, grade_level, school_year, adviser_id")
        .ilike("section_name", "%gumamela%")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      section = data;
    }

    if (!section) {
      return NextResponse.json(
        { ok: false, error: "Section not found." },
        { status: 404 }
      );
    }

    // 1. Fetch all student IDs in this section
    const { data: students, error: sErr } = await supabase
      .from("students")
      .select("id")
      .eq("section_id", section.id);

    if (sErr) throw sErr;
    const studentIds = (students || []).map((s) => s.id);

    // 2. Set section_id = null for these students to remove them from the official section roster
    // Historical grades, class assignments, attendance, and student master records are preserved

    // 4. Set section_id = null for these students
    if (studentIds.length > 0) {
      const { error: updErr } = await supabase
        .from("students")
        .update({ section_id: null })
        .eq("section_id", section.id);

      if (updErr) throw updErr;
    }

    return NextResponse.json({
      ok: true,
      sectionId: section.id,
      sectionName: `Grade ${section.grade_level} — ${section.section_name}`,
      clearedCount: studentIds.length,
      message: `Successfully cleared ${studentIds.length} learner(s) from Grade ${section.grade_level} — ${section.section_name}.`,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err.message || "Failed to clear advisory section roster." },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  return POST(request);
}
