export function philIriMemoryClient({ seed = [], denied = false, schemaMissing = false, writeError = null } = {}) {
  const rows = structuredClone(seed);
  const calls = [];
  const key = (row) => [row.student_id, row.school_year, row.subject, row.assessment_period].join("|");
  const client = { from(table) {
    calls.push({ table });
    if (table !== "phil_iri_baseline_records") throw new Error(`Unexpected access to ${table}`);
    const filters = {};
    const query = {
      select() { return query; },
      eq(field, value) { filters[field] = value; return query; },
      async maybeSingle() {
        if (schemaMissing) return { data: null, error: { code: "42703", message: "column assessment_period does not exist" } };
        return { data: structuredClone(rows.find((row) => Object.entries(filters).every(([field, value]) => row[field] === value)) || null), error: null };
      },
      async upsert(payload, options) {
        calls.push({ table, payload: structuredClone(payload), options });
        if (denied) return { data: null, error: { code: "42501", message: "row-level security policy denied this class" } };
        if (writeError) return { data: null, error: writeError };
        for (const row of Array.isArray(payload) ? payload : [payload]) {
          const index = rows.findIndex((existing) => key(existing) === key(row));
          if (index >= 0) rows[index] = structuredClone(row);
          else rows.push(structuredClone(row));
        }
        return { data: payload, error: null };
      },
    };
    return query;
  } };
  return { client, rows, calls };
}
