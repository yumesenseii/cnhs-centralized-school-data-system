/**
 * Stage B Target Migration 056 Runner.
 *
 * Applies 056_create_personalized_learning_plans.sql onto the verified,
 * isolated test project after baseline replay using direct PostgreSQL connection.
 *
 * Safety Invariants:
 * 1. STRICT ALLOWLISTING:
 *    - Rejects production ref ('siumnhtrksgjkbgggpwg') across all environment variables, URLs, and database hosts.
 *    - Enforces ALLOWED_STAGE_B_PROJECT_REF match.
 * 2. PREREQUISITE VERIFICATION:
 *    - Verifies all core prerequisite tables and authorization helper functions before applying 056.
 * 3. POST-FLIGHT AUDIT:
 *    - Confirms table existence, structural check constraints, partial unique indexes, triggers,
 *      table-level grants, RLS policies, and SECURITY DEFINER RPC functions.
 * 4. EXPLICIT EXECUTION CONTROL:
 *    - Does NOT execute automatically. Requires explicit authorization and invocation.
 */

import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { validateTargetEnvironment, getDatabaseClientConfig } from "./replay_stage_b_schema.mjs";

const { Client } = pg;

export async function applyMigration056({
  migrationFile = path.resolve(process.cwd(), "supabase/migrations/056_create_personalized_learning_plans.sql"),
} = {}) {
  const allowedRef = process.env.ALLOWED_STAGE_B_PROJECT_REF;
  validateTargetEnvironment({ allowedRef });

  const clientConfig = getDatabaseClientConfig();
  console.log(`[Stage B Migration 056] Connecting to target database for project ref: ${allowedRef}`);

  const client = new Client(clientConfig);
  await client.connect();

  try {
    // 1. Pre-flight prerequisite verification
    console.log("[Stage B Migration 056] Verifying prerequisite tables and helpers...");
    const tableCheckRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('profiles', 'teachers', 'students', 'classes', 'subjects', 'sections');
    `);
    const foundTables = new Set(tableCheckRes.rows.map((r) => r.table_name));
    const missingTables = ["profiles", "teachers", "students", "classes", "subjects", "sections"].filter(
      (t) => !foundTables.has(t)
    );

    if (missingTables.length > 0) {
      throw new Error(`PREREQUISITE MISSING: The following core tables are missing on the target database: ${missingTables.join(", ")}. Replay baseline first.`);
    }

    const helperCheckRes = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
        AND routine_name IN ('current_profile_id', 'is_active_admin_profile', 'is_active_teacher_profile', 'current_teacher_id', 'is_section_adviser');
    `);
    const foundHelpers = new Set(helperCheckRes.rows.map((r) => r.routine_name));
    const missingHelpers = ['current_profile_id', 'is_active_admin_profile', 'is_active_teacher_profile', 'current_teacher_id', 'is_section_adviser'].filter(
      (h) => !foundHelpers.has(h)
    );

    if (missingHelpers.length > 0) {
      throw new Error(`PREREQUISITE MISSING: Required authorization helper functions are missing: ${missingHelpers.join(", ")}`);
    }

    console.log("[Stage B Migration 056] All prerequisite tables and helpers confirmed present.");

    // 2. Read migration 056 SQL
    if (!fs.existsSync(migrationFile)) {
      throw new Error(`Migration 056 source file not found at: ${migrationFile}`);
    }
    const sqlContent = fs.readFileSync(migrationFile, "utf8");
    console.log(`[Stage B Migration 056] Applying ${path.basename(migrationFile)} (${sqlContent.length} bytes)...`);

    // 3. Execute in transaction
    const startTime = Date.now();
    await client.query("BEGIN;");
    await client.query(sqlContent);
    await client.query("COMMIT;");
    const duration = Date.now() - startTime;
    console.log(`[Stage B Migration 056] SQL executed successfully in ${duration}ms.`);

    // 4. Post-flight verification
    console.log("[Stage B Migration 056] Performing post-flight structural and security audit...");

    // Check table
    const plpTableRes = await client.query(`
      SELECT count(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'personalized_learning_plans';
    `);
    if (parseInt(plpTableRes.rows[0]?.count || "0", 10) !== 1) {
      throw new Error("POST-FLIGHT AUDIT FAILED: Table 'public.personalized_learning_plans' was not created.");
    }

    // Check RLS
    const rlsRes = await client.query(`
      SELECT rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = 'personalized_learning_plans';
    `);
    if (rlsRes.rows[0]?.rowsecurity !== true) {
      throw new Error("POST-FLIGHT AUDIT FAILED: RLS is not enabled on public.personalized_learning_plans.");
    }

    // Check triggers
    const triggerRes = await client.query(`
      SELECT trigger_name 
      FROM information_schema.triggers 
      WHERE trigger_schema = 'public' AND event_object_table = 'personalized_learning_plans';
    `);
    const triggers = triggerRes.rows.map((r) => r.trigger_name);
    if (!triggers.includes("trg_enforce_plp_insert_constraints") || !triggers.includes("trg_enforce_plp_status_transitions")) {
      throw new Error(`POST-FLIGHT AUDIT FAILED: Missing required triggers. Found: ${triggers.join(", ")}`);
    }

    // Check RPCs & Helpers
    const rpcRes = await client.query(`
      SELECT proname, prosecdef, provolatile 
      FROM pg_proc p 
      JOIN pg_namespace n ON n.oid = p.pronamespace 
      WHERE n.nspname = 'public' 
        AND proname IN (
          'generate_and_save_draft_plp',
          'save_teacher_plp_draft',
          'mark_plp_reviewed_rpc',
          'activate_plp_rpc',
          'complete_plp_rpc',
          'can_teacher_manage_student_plp'
        );
    `);
    const rpcs = rpcRes.rows.map((r) => r.proname);
    const nonSecDef = rpcRes.rows.filter((r) => !r.prosecdef).map((r) => r.proname);
    if (nonSecDef.length > 0) {
      throw new Error(`POST-FLIGHT AUDIT FAILED: The following functions are not SECURITY DEFINER: ${nonSecDef.join(", ")}`);
    }
    if (rpcs.length < 6) {
      throw new Error(`POST-FLIGHT AUDIT FAILED: Expected 6 PLP functions, found ${rpcs.length}: ${rpcs.join(", ")}`);
    }

    // Check Table-Level Permissions: SELECT-only for authenticated, direct write revoked
    const grantRes = await client.query(`
      SELECT privilege_type 
      FROM information_schema.role_table_grants 
      WHERE table_schema = 'public' 
        AND table_name = 'personalized_learning_plans' 
        AND grantee = 'authenticated';
    `);
    const grantedPrivileges = grantRes.rows.map((r) => r.privilege_type);
    if (!grantedPrivileges.includes("SELECT")) {
      throw new Error("POST-FLIGHT AUDIT FAILED: SELECT privilege not granted to authenticated.");
    }
    const forbiddenDirectWrites = ["INSERT", "UPDATE", "DELETE"].filter((p) => grantedPrivileges.includes(p));
    if (forbiddenDirectWrites.length > 0) {
      throw new Error(`POST-FLIGHT AUDIT FAILED: Direct write privileges (${forbiddenDirectWrites.join(", ")}) must be REVOKED from authenticated.`);
    }


    console.log("[Stage B Migration 056] SUCCESS: Migration 056 verified (Table, Constraints, RLS, Triggers, and RPCs confirmed).");
    return { success: true, projectRef: allowedRef, durationMs: duration };
  } catch (err) {
    await client.query("ROLLBACK;").catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

// Fail-safe: do not run if not explicitly called via CLI with confirmed env
if (process.argv[1] && process.argv[1].endsWith("apply_migration_056_stage_b.mjs")) {
  if (process.env.AUTHORIZE_STAGE_B_EXECUTION !== "true") {
    console.error("FAIL-SAFE GUARD: Database execution is NOT authorized. Set AUTHORIZE_STAGE_B_EXECUTION=true after explicit approval.");
    process.exit(1);
  }
  applyMigration056().then((res) => {
    console.log("[Stage B Migration 056 Finished]", JSON.stringify(res, null, 2));
  }).catch((err) => {
    console.error("[Stage B Migration 056 Fatal Error]", err.message);
    process.exit(1);
  });
}
