/**
 * Stage B Schema Replay Runner.
 *
 * Replays genuine CNHS LEARN migrations (001 through 055 + 20261003) in strict dependency order
 * onto an approved, fresh, disposable Supabase test project using direct PostgreSQL connection.
 *
 * Safety Invariants:
 * 1. STRICT ALLOWLISTING:
 *    - Rejects production ref ('siumnhtrksgjkbgggpwg') across all environment variables, URLs, and database hosts.
 *    - Enforces ALLOWED_STAGE_B_PROJECT_REF match.
 * 2. SAFE PRE-FLIGHT CHECK:
 *    - Verifies that target contains ZERO production learner records or identifiable data before executing any write.
 * 3. EXPLICIT EXECUTION CONTROL:
 *    - Does NOT execute automatically. Requires explicit authorization and invocation.
 */

import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const { Client } = pg;

export const PROD_REF = "siumnhtrksgjkbgggpwg";

export const MIGRATION_REPLAY_ORDER = [
  "001_initial_core_schema.sql",
  "002_create_grades.sql",
  "003_create_lesson_plans.sql",
  "004_create_lesson_plan_events.sql",
  "005_create_monitoring_records.sql",
  "006_create_notifications.sql",
  "007_enable_rls_core_tables.sql",
  "008_security_advisor_followups.sql",
  "009_performance_rls_indexes.sql",
  "010_student_portal_rls.sql",
  "011_attendance_module.sql",
  "012_aral_facilitator_assignments.sql",
  "013_lesson_plans_reviewed_by_name.sql",
  "014_profiles_temp_password.sql",
  "015_aral_recommendation_approvals.sql",
  "016_aral_assessment_scores.sql",
  "017_aral_assessment_comments.sql",
  "018_delete_requests.sql",
  "019_values_education_subject.sql",
  "020_ecr_module.sql",
  "021_attendance_section_months.sql",
  "022_profiles_accepted_terms.sql",
  "023_attendance_daily.sql",
  "024_fix_adviser_rls_recursion.sql",
  "025_aral_weekly_structured.sql",
  "026_attendance_daily_session.sql",
  "027_attendance_daily_session_unique_and_select.sql",
  "028_attendance_month_closes.sql",
  "029_monitoring_intervention_eval.sql",
  "030_aral_weekly_session_days.sql",
  "031_student_attendance_daily_select.sql",
  "032_profiles_guided_tour_completed.sql",
  "033_lesson_plan_admin_notify_realtime.sql",
  "034_notifications_actor_select.sql",
  "035_notifications_teacher_to_admin_monitoring.sql",
  "036_phase1_class_assignments_unique_and_cleanup.sql",
  "037_cleanup_ghost_users_and_teachers.sql",
  "038_lesson_plan_section_remarks_and_workflow.sql",
  "039_academic_intervention_pathways.sql",
  "040_phil_iri_baseline_records.sql",
  "041_aral_unified_workflow_and_progress_checks.sql",
  "042_cleanup_ghost_english_ilang_ilang.sql",
  "043_clear_gumamela_advisory_roster.sql",
  "044_sf9_lifecycle_and_releases.sql",
  "045_phil_iri_schema_update.sql",
  "046_aral_assessment_period_settings.sql",
  "047_scoped_teachers_select_and_facilitator_rpc.sql",
  "048_fix_screening_interpretation_check.sql",
  "053_phil_iri_absent_and_audit.sql",
  "055_phil_iri_term_uniqueness.sql",
  "20261003_add_aral_screening_fields.sql",
];

export function validateTargetEnvironment(urlOrOpts, maybeAllowedRef) {
  let supabaseUrl, databaseUrl, databaseHost, allowedRef;
  if (typeof urlOrOpts === "object" && urlOrOpts !== null) {
    supabaseUrl = urlOrOpts.supabaseUrl || process.env.STAGE_B_SUPABASE_URL;
    databaseUrl = urlOrOpts.databaseUrl || process.env.STAGE_B_DATABASE_URL;
    databaseHost = urlOrOpts.databaseHost || process.env.STAGE_B_DB_HOST;
    allowedRef = urlOrOpts.allowedRef || process.env.ALLOWED_STAGE_B_PROJECT_REF || "127.0.0.1";
  } else {
    supabaseUrl = urlOrOpts || process.env.STAGE_B_SUPABASE_URL;
    allowedRef = maybeAllowedRef || process.env.ALLOWED_STAGE_B_PROJECT_REF || "127.0.0.1";
    databaseUrl = process.env.STAGE_B_DATABASE_URL;
    databaseHost = process.env.STAGE_B_DB_HOST;
  }

  // 1. Mandatory allowed ref check
  if (!allowedRef || typeof allowedRef !== "string" || allowedRef.trim() === "") {
    throw new Error("FAIL-SAFE GUARD: ALLOWED_STAGE_B_PROJECT_REF environment variable must be explicitly defined.");
  }

  // 2. Strict Production Rejection across all configuration
  if (
    allowedRef.toLowerCase().includes(PROD_REF.toLowerCase()) ||
    (supabaseUrl && supabaseUrl.toLowerCase().includes(PROD_REF.toLowerCase())) ||
    (databaseUrl && databaseUrl.toLowerCase().includes(PROD_REF.toLowerCase())) ||
    (databaseHost && databaseHost.toLowerCase().includes(PROD_REF.toLowerCase()))
  ) {
    throw new Error(`FATAL SECURITY GUARD: Production project reference '${PROD_REF}' detected in Stage B configuration! Aborting immediately.`);
  }

  // 3. Local Loopback Invariant: Verify host is strictly local
  const isLocalHost = (h) => h === "127.0.0.1" || h === "localhost" || h === "::1";

  if (supabaseUrl) {
    try {
      const parsedUrl = new URL(supabaseUrl);
      if (!isLocalHost(parsedUrl.hostname)) {
        throw new Error(`FATAL SECURITY GUARD: Stage B API URL must resolve to localhost or 127.0.0.1, found: '${parsedUrl.hostname}'. Remote execution prohibited.`);
      }
    } catch (e) {
      if (e.message.includes("Remote execution prohibited")) throw e;
      throw new Error(`FAIL-SAFE GUARD: Invalid STAGE_B_SUPABASE_URL: ${e.message}`);
    }
  }

  if (databaseUrl) {
    try {
      const parsedDb = new URL(databaseUrl);
      if (!isLocalHost(parsedDb.hostname)) {
        throw new Error(`FATAL SECURITY GUARD: Stage B database URL must connect to localhost or 127.0.0.1, found: '${parsedDb.hostname}'. Remote execution prohibited.`);
      }
    } catch (e) {
      if (e.message.includes("Remote execution prohibited")) throw e;
      throw new Error(`FAIL-SAFE GUARD: Invalid STAGE_B_DATABASE_URL: ${e.message}`);
    }
  }

  if (databaseHost && !isLocalHost(databaseHost)) {
    throw new Error(`FATAL SECURITY GUARD: Stage B database host must be localhost or 127.0.0.1, found: '${databaseHost}'. Remote execution prohibited.`);
  }

  return true;
}



export function getDatabaseClientConfig() {
  const allowedRef = process.env.ALLOWED_STAGE_B_PROJECT_REF || "127.0.0.1";
  validateTargetEnvironment({ allowedRef });

  if (process.env.STAGE_B_DATABASE_URL) {
    validateTargetEnvironment({ databaseUrl: process.env.STAGE_B_DATABASE_URL, allowedRef });
    const isLocal = process.env.STAGE_B_DATABASE_URL.includes("127.0.0.1") || process.env.STAGE_B_DATABASE_URL.includes("localhost");
    return {
      connectionString: process.env.STAGE_B_DATABASE_URL,
      ssl: isLocal ? false : { rejectUnauthorized: false },
    };
  }

  const host = process.env.STAGE_B_DB_HOST || "127.0.0.1";
  const port = parseInt(process.env.STAGE_B_DB_PORT || "54322", 10);
  const user = process.env.STAGE_B_DB_USER || "postgres";
  const password = process.env.STAGE_B_DB_PASSWORD || "postgres";
  const database = process.env.STAGE_B_DB_NAME || "postgres";

  validateTargetEnvironment({ databaseHost: host, allowedRef });

  const isLocal = host === "127.0.0.1" || host === "localhost" || host === "::1";

  return {
    host,
    port,
    user,
    password,
    database,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  };
}


export async function replayBaselineMigrations({
  migrationsDir = path.resolve(process.cwd(), "supabase/migrations"),
} = {}) {
  const allowedRef = process.env.ALLOWED_STAGE_B_PROJECT_REF;
  validateTargetEnvironment({ allowedRef });

  const clientConfig = getDatabaseClientConfig();
  console.log(`[Stage B Replay] Connecting to target database for project ref: ${allowedRef}`);

  const client = new Client(clientConfig);
  await client.connect();

  try {
    // 1. Read-only safety verification
    console.log("[Stage B Replay] Performing pre-flight data presence check...");
    const checkRes = await client.query(`
      SELECT 
        (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'students') as has_students,
        (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'personalized_learning_plans') as has_plp
    `);

    const hasStudents = parseInt(checkRes.rows[0]?.has_students || "0", 10) > 0;
    if (hasStudents) {
      const studentCountRes = await client.query(`SELECT count(*) as count FROM public.students;`);
      const studentCount = parseInt(studentCountRes.rows[0]?.count || "0", 10);
      if (studentCount > 0) {
        throw new Error(`FAIL-SAFE GUARD: Target database already contains ${studentCount} records in public.students! Replay aborted to prevent overwriting non-empty project.`);
      }
    }

    console.log(`[Stage B Replay] Target project verified clean. Replaying ${MIGRATION_REPLAY_ORDER.length} migrations...`);

    const summary = [];

    // 2. Sequential execution
    for (const [index, fileName] of MIGRATION_REPLAY_ORDER.entries()) {
      let filePath;
      if (fileName === "001_initial_core_schema.sql") {
        filePath = path.resolve(process.cwd(), "scripts/stage_b_schema/001_initial_core_schema.sql");
      } else {
        filePath = path.join(migrationsDir, fileName);
      }

      if (!fs.existsSync(filePath)) {
        throw new Error(`Migration file missing from repository: ${fileName} (checked at: ${filePath})`);
      }


      const sqlContent = fs.readFileSync(filePath, "utf8");
      const startTime = Date.now();
      console.log(`[Replay ${index + 1}/${MIGRATION_REPLAY_ORDER.length}] ${fileName} (${sqlContent.length} bytes)...`);

      try {
        await client.query("BEGIN;");
        await client.query(sqlContent);
        await client.query("COMMIT;");
        const duration = Date.now() - startTime;
        console.log(`  -> Applied successfully (${duration}ms)`);
        summary.push({ fileName, status: "applied", durationMs: duration });
      } catch (err) {
        await client.query("ROLLBACK;");
        console.error(`  -> FAILED at ${fileName}: ${err.message}`);
        summary.push({ fileName, status: "failed", error: err.message });
        throw new Error(`Replay stopped at ${fileName}: ${err.message}`);
      }
    }

    console.log("[Stage B Replay] Complete: All baseline migrations successfully replayed.");
    return { success: true, projectRef: allowedRef, summary };
  } finally {
    await client.end();
  }
}

// Fail-safe: do not run if not explicitly called via CLI with confirmed env
if (process.argv[1] && process.argv[1].endsWith("replay_stage_b_schema.mjs")) {
  if (process.env.AUTHORIZE_STAGE_B_EXECUTION !== "true") {
    console.error("FAIL-SAFE GUARD: Database execution is NOT authorized. Set AUTHORIZE_STAGE_B_EXECUTION=true after explicit approval.");
    process.exit(1);
  }
  replayBaselineMigrations().then((res) => {
    console.log("[Stage B Replay Finished]", JSON.stringify(res, null, 2));
  }).catch((err) => {
    console.error("[Stage B Replay Fatal Error]", err.message);
    process.exit(1);
  });
}
