// Read-only ECR audit. Never prints learner names, LRNs, tokens or keys.
// node --env-file=.env.local scripts/diagnose_ecr_data.mjs
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const token = process.env.ECR_AUDIT_ACCESS_TOKEN || serviceKey || publicKey;
console.log(JSON.stringify({ privilegedAccessConfigured: Boolean(serviceKey), userAccessConfigured: Boolean(process.env.ECR_AUDIT_ACCESS_TOKEN) }));
if (!url || !publicKey) throw new Error("Supabase URL and public key are required.");
for (const [table, fields] of [
  ["grades", "class_id,subject_id,school_year,quarter,final_grade"],
  ["ecr_workbooks", "id,class_id,school_year,source,status"],
  ["ecr_term_sheets", "id,workbook_id,term,status"],
  ["ecr_computed_grades", "term_sheet_id,term_grade,ww_ps,pt_ps,qa_ps,initial_grade"],
  ["ecr_component_scores", "term_sheet_id,component,item_index,raw_score"],
]) {
  let rows = [];
  for (let start = 0; ; start += 1000) {
    const response = await fetch(`${url}/rest/v1/${table}?select=${fields}`, {
      headers: { apikey: serviceKey || publicKey, Authorization: `Bearer ${token}`, Range: `${start}-${start + 999}` },
    });
    const data = await response.json();
    if (!response.ok) { console.log(JSON.stringify({ table, status: response.status, code: data.code, message: data.message })); break; }
    rows.push(...data);
    if (data.length < 1000) {
      const byScope = {};
      for (const row of rows) {
        const scope = table === "grades" ? `${row.class_id}|${row.school_year}|T${row.quarter}` :
          table === "ecr_term_sheets" ? `${row.workbook_id}|T${row.term}|${row.status}` :
          table === "ecr_workbooks" ? `${row.class_id}|${row.school_year}|${row.source}|${row.status}` : row.term_sheet_id;
        const item = byScope[scope] ||= { rows: 0, withGrade: 0, rawScores: 0 };
        item.rows++;
        if ((row.final_grade ?? row.term_grade) != null) item.withGrade++;
        if (row.raw_score != null) item.rawScores++;
      }
      console.log(JSON.stringify({ table, visibleRows: rows.length, byScope }));
      break;
    }
  }
}
if (!serviceKey && !process.env.ECR_AUDIT_ACCESS_TOKEN) console.log("Anonymous visibility is not evidence that protected records are absent. A teacher/admin session is required for an authoritative audit.");
