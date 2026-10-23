/**
 * Recording Supabase client used by the P0-04B scoped route tests.
 *
 * The client records every query (table + emitted filters) so the tests can
 * assert the REAL route's read scope, and it fails loudly on any write
 * operation so a regression that mutates academic data cannot pass silently.
 *
 * A lightweight row level security simulation is applied on top of the fixture
 * data, because the production route reads through the caller's own session:
 *   - admin  → sees every row,
 *   - teacher → sees only rows of the classes the teacher owns.
 */

function readPath(row, key) {
  if (row == null) return undefined;
  let current = row;
  for (const part of key.split(".")) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function readValue(row, key, table) {
  if (table === "ecr_term_sheets" && key.startsWith("ecr_workbooks.")) {
    return row?.workbook?.[key.slice("ecr_workbooks.".length)];
  }
  return readPath(row, key);
}

function matchesFilters(row, filters, table) {
  for (const filter of filters) {
    const value = readValue(row, filter.key, table);
    if (filter.type === "eq") {
      if (value !== filter.value) return false;
    } else if (filter.type === "in") {
      if (!Array.isArray(filter.values) || !filter.values.includes(value)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * @param {object} fixture
 * @param {object} [fixture.session] { role, visibleClassIds } — visibleClassIds
 *        null means "no restriction" (admin).
 */
export function createRecordingSupabaseClient(fixture = {}) {
  const tables = {
    profiles: fixture.profiles ?? [],
    teachers: fixture.teachers ?? [],
    class_students: fixture.classStudents ?? [],
    students: fixture.students ?? [],
    subjects: fixture.subjects ?? [],
    classes: fixture.classes ?? [],
    grades: fixture.grades ?? [],
    ecr_term_sheets: fixture.ecrTermSheets ?? [],
  };

  const session = fixture.session ?? { role: "admin", visibleClassIds: null };
  const visibleClassIds = session.visibleClassIds ?? null;

  const queries = [];
  const writes = [];

  function applyRowLevelSecurity(table, rows) {
    if (visibleClassIds === null) return rows;
    if (table === "grades") {
      return rows.filter((row) => visibleClassIds.has(row.class_id));
    }
    if (table === "classes") {
      return rows.filter((row) => visibleClassIds.has(row.id));
    }
    if (table === "ecr_term_sheets") {
      return rows.filter((row) => visibleClassIds.has(row.workbook?.class_id));
    }
    return rows;
  }

  function makeBuilder(table) {
    const filters = [];
    let selectColumns = null;
    let orderColumn = null;
    let limitValue = null;

    function run() {
      queries.push({
        table,
        operation: "select",
        select: selectColumns,
        order: orderColumn,
        limit: limitValue,
        filters: filters.map((filter) => ({ ...filter })),
      });

      let rows = applyRowLevelSecurity(table, tables[table] ?? []).filter((row) =>
        matchesFilters(row, filters, table)
      );

      if (orderColumn) {
        rows = [...rows].sort((a, b) => {
          const left = readPath(a, orderColumn);
          const right = readPath(b, orderColumn);
          if (left === right) return 0;
          return left > right ? 1 : -1;
        });
      }

      if (limitValue !== null) rows = rows.slice(0, limitValue);
      return rows;
    }

    const builder = {
      select(columns) {
        selectColumns = columns;
        return builder;
      },
      eq(key, value) {
        filters.push({ type: "eq", key, value });
        return builder;
      },
      in(key, values) {
        filters.push({ type: "in", key, values: [...values] });
        return builder;
      },
      order(column) {
        orderColumn = column;
        return builder;
      },
      limit(value) {
        limitValue = value;
        return builder;
      },
      single() {
        return builder.maybeSingle();
      },
      async maybeSingle() {
        const rows = run();
        return { data: rows.length ? rows[0] : null, error: null };
      },
      then(resolve, reject) {
        try {
          resolve({ data: run(), error: null });
        } catch (error) {
          reject(error);
        }
      },
    };

    for (const operation of ["insert", "update", "upsert", "delete"]) {
      builder[operation] = () => {
        writes.push({ table, operation });
        throw new Error(
          `Write operation '${operation}' on table '${table}' is not allowed in the trend forecast route.`
        );
      };
    }

    return builder;
  }

  return {
    queries,
    writes,
    auth: {
      getUser: async () => ({
        data: { user: fixture.authUser ?? null },
        error: fixture.authUser ? null : new Error("No session"),
      }),
    },
    from(table) {
      return makeBuilder(table);
    },
  };
}

/** Find the recorded query for a table (last match wins). */
export function findQuery(client, table) {
  const matches = client.queries.filter((query) => query.table === table);
  return matches.length ? matches[matches.length - 1] : null;
}

/** Find a recorded filter on a query. */
export function findFilter(query, key) {
  if (!query) return null;
  return query.filters.find((filter) => filter.key === key) ?? null;
}
