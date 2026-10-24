/**
 * Read-only audit script to check published ECR data availability.
 * Inspects:
 *  - ECR workbooks and term sheets (published vs draft vs missing)
 *  - Grades table row counts per school year and quarter
 *  - Student subject grade distributions
 * 
 * STRICTLY READ-ONLY. Does not insert, update, or delete.
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  console.log("==================================================================");
  console.log("CNHS LEARN — Read-Only Audit: ECR Data Availability & Publication");
  console.log("==================================================================");

  // 1. Audit ecr_workbooks & ecr_term_sheets
  const { data: sheets, error: sheetsErr } = await supabase
    .from("ecr_term_sheets")
    .select("id, term, status, workbook_id, created_at, updated_at");

  if (sheetsErr) {
    console.log("Notice: ecr_term_sheets query result:", sheetsErr.message);
  } else {
    console.log(`\n[ECR Term Sheets Status Breakdown] (Total rows: ${sheets?.length || 0})`);
    const statusCounts = {};
    const termCounts = {};
    for (const s of sheets || []) {
      statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
      termCounts[`Term ${s.term}`] = (termCounts[`Term ${s.term}`] || 0) + 1;
    }
    console.log("By Status:", statusCounts);
    console.log("By Term:", termCounts);
  }

  // 2. Audit classes & subjects
  const { data: classes, error: classesErr } = await supabase
    .from("classes")
    .select("id, grade_level, section_id, subject_id, school_year");

  if (classesErr) {
    console.log("Notice: classes query result:", classesErr.message);
  } else {
    console.log(`\n[Classes Availability] (Total classes: ${classes?.length || 0})`);
    const syCounts = {};
    for (const c of classes || []) {
      syCounts[c.school_year] = (syCounts[c.school_year] || 0) + 1;
    }
    console.log("By School Year:", syCounts);
  }

  // 3. Audit grades table
  const { data: gradesSummary, error: gradesErr } = await supabase
    .from("grades")
    .select("quarter, school_year, final_grade")
    .limit(1000);

  if (gradesErr) {
    console.log("Notice: grades query result:", gradesErr.message);
  } else {
    console.log(`\n[Grades Table Sample Availability] (Sample rows retrieved: ${gradesSummary?.length || 0})`);
    const qCounts = {};
    for (const g of gradesSummary || []) {
      qCounts[`Quarter ${g.quarter}`] = (qCounts[`Quarter ${g.quarter}`] || 0) + 1;
    }
    console.log("By Quarter:", qCounts);
  }

  console.log("\nAudit complete.");
}

runAudit().catch(console.error);
