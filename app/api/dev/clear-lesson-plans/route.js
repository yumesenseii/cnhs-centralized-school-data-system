import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();

    // 1. Fetch existing lesson plans to get their file_paths for storage cleanup
    const { data: existingPlans } = await supabase
      .from("lesson_plans")
      .select("id, file_path");

    const filePaths = (existingPlans || [])
      .map((p) => p.file_path)
      .filter(Boolean);

    // 2. Delete all lesson plan events
    await supabase.from("lesson_plan_events").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // 3. Delete all delete requests for lesson plans
    await supabase.from("delete_requests").delete().eq("target_type", "lesson_plan");

    // 4. Delete all lesson plans
    const { error: deletePlansError } = await supabase
      .from("lesson_plans")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (deletePlansError) {
      return NextResponse.json(
        { ok: false, error: deletePlansError.message },
        { status: 400 }
      );
    }

    // 5. Clean up storage files if any
    if (filePaths.length > 0) {
      await supabase.storage.from("lesson-plans").remove(filePaths);
    }

    return NextResponse.json({
      ok: true,
      message: `Successfully deleted ${(existingPlans || []).length} test lesson plan(s).`,
      deletedCount: (existingPlans || []).length,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err.message || "Failed to clear lesson plans." },
      { status: 500 }
    );
  }
}
