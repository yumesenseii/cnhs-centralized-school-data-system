process.loadEnvFile?.(".env.local");
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, first_name, last_name")
    .or("first_name.ilike.%yukari%,last_name.ilike.%nemoto%")
    .maybeSingle();

  console.log("Teacher:", teacher);

  if (teacher) {
    const { data: sections } = await supabase
      .from("sections")
      .select("id, section_name, grade_level, school_year, adviser_id")
      .eq("adviser_id", teacher.id);
    console.log("Advisory sections for teacher:", sections);

    if (sections && sections.length > 0) {
      for (const sec of sections) {
        const { data: students, count } = await supabase
          .from("students")
          .select("id, student_number, first_name, last_name, section_id", { count: "exact" })
          .eq("section_id", sec.id);
        console.log(`Section ${sec.section_name} (ID: ${sec.id}): ${count} students`);
        console.log("Sample students:", (students || []).slice(0, 5));

        // Check classes under this section
        const { data: classes } = await supabase
          .from("classes")
          .select("id, subject_id, teacher_id, quarter, school_year, subjects(subject_name)")
          .eq("section_id", sec.id);
        console.log(`Classes under section ${sec.section_name}:`, classes?.length);

        // Check if students have grades or class_students
        if (students && students.length > 0) {
          const studentIds = students.map((s) => s.id);
          const { count: csCount } = await supabase
            .from("class_students")
            .select("id", { count: "exact" })
            .in("student_id", studentIds);
          console.log(`class_students count for these learners: ${csCount}`);

          const { count: gCount } = await supabase
            .from("grades")
            .select("id", { count: "exact" })
            .in("student_id", studentIds);
          console.log(`grades count for these learners: ${gCount}`);

          const { count: monCount } = await supabase
            .from("monitoring_records")
            .select("id", { count: "exact" })
            .in("student_id", studentIds);
          console.log(`monitoring_records count for these learners: ${monCount}`);
        }
      }
    }
  }

  // Also check if any other section is named Gumamela
  const { data: gumamelaSections } = await supabase
    .from("sections")
    .select("id, section_name, grade_level, school_year, adviser_id, teachers(first_name, last_name)")
    .ilike("section_name", "%gumamela%");
  console.log("All Gumamela sections in DB:", gumamelaSections);
}

check();
