import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data: sections, error: secErr } = await supabase
    .from("sections")
    .select("id, section_name, grade_level, school_year, adviser_id")
    .limit(10);

  console.log("Sections in DB:", secErr ? secErr.message : sections);

  const { data: classes, error: clsErr } = await supabase
    .from("classes")
    .select("id, teacher_id, school_year, quarter, section_id")
    .limit(10);

  console.log("Classes in DB:", clsErr ? clsErr.message : classes);
}

check();
