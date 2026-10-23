// Read-only deployment check. Run with: node --env-file=.env.local scripts/diagnose_aral_schema.mjs
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Supabase URL and public key are required.");
for (const [table, column] of [["system_settings", "key"], ["phil_iri_baseline_records", "assessment_period"]]) {
  const response = await fetch(`${url}/rest/v1/${table}?select=${column}&limit=0`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = await response.json();
  console.log(JSON.stringify({ table, status: response.status, code: body.code, message: body.message, hint: body.hint }));
}
