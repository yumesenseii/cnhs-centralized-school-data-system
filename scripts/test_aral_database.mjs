import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const t1 = "00000000-0000-0000-0000-000000000001";
const t2 = "00000000-0000-0000-0000-000000000002";
const s1 = "00000000-0000-0000-0000-000000000011";
const s2 = "00000000-0000-0000-0000-000000000012";
const c1 = "00000000-0000-0000-0000-000000000021";
const c2 = "00000000-0000-0000-0000-000000000022";

test("migration 058: actual PostgreSQL validation, security, correction audit and preservation", async (suite) => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated; create role anon; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select '${t1}'::uuid $$;
      create function public.current_teacher_id() returns uuid language sql stable as $$ select '${t1}'::uuid $$;
      create function public.current_student_id() returns uuid language sql stable as $$ select null::uuid $$;
      create function public.is_active_admin_profile() returns boolean language sql stable as $$ select coalesce(current_setting('test.admin', true), '') = 'yes' $$;
      create function public.is_active_teacher_profile() returns boolean language sql stable as $$ select true $$;
      create table public.students (id uuid primary key);
      create table public.teachers (id uuid primary key);
      create table public.subjects (id uuid primary key, subject_name text);
      create table public.classes (id uuid primary key, teacher_id uuid, subject_id uuid, school_year text);
      create table public.class_students (student_id uuid, class_id uuid);
      create function public.owns_class(p_id uuid) returns boolean language sql stable security definer as $$
        select exists(select 1 from public.classes where id = p_id and teacher_id = public.current_teacher_id()) $$;
      create table public.monitoring_records (id uuid primary key default gen_random_uuid(), student_id uuid, class_id uuid,
        school_year text, week_number int, student_progress text);
      insert into public.students values ('${s1}'),('${s2}');
      insert into public.teachers values ('${t1}'),('${t2}');
      insert into public.subjects values ('${t1}', 'English 7');
      insert into public.classes values ('${c1}', '${t1}', '${t1}', 'SY 2026-2027'), ('${c2}', '${t2}', '${t1}', 'SY 2026-2027');
      insert into public.class_students values ('${s1}','${c1}'), ('${s2}','${c2}');
      insert into public.monitoring_records (student_id,class_id,school_year,week_number,student_progress)
        values ('${s1}','${c1}','SY 2026-2027',1,'Original progress');
    `);
    await db.exec(await readFile(new URL("../supabase/migrations/040_phil_iri_baseline_records.sql", import.meta.url), "utf8"));
    await db.exec(`insert into public.phil_iri_baseline_records (student_id,class_id,teacher_id,school_year,subject,total_score,reading_level,raw_payload)
      values ('${s1}','${c1}','${t1}','SY 2026-2027','English',18,'Instructional','{"isAbsent":false}');`);
    const migration = await readFile(new URL("../supabase/migrations/058_aral_independent_periods_and_audit.sql", import.meta.url), "utf8");
    await db.exec(migration);
    await db.exec(migration); // Safe to reapply without changing or deleting records.
    await db.exec("grant usage on schema public, auth to authenticated; set role authenticated;");

    const insert = (period, student = s1, cls = c1, score = 20, raw = { isAbsent: false }, level = "Not Assessed") => db.query(
      `insert into public.phil_iri_baseline_records (student_id,class_id,teacher_id,school_year,subject,assessment_period,total_score,reading_level,raw_payload)
        values ($1,$2,$3,'SY 2026-2027','English',$4,$5,$6,$7::jsonb)`, [student, cls, t1, period, score, level, JSON.stringify(raw)]);

    await suite.test("legacy data remains BOSY and no system_settings table is required", async () => {
      const { rows } = await db.query("select assessment_period,total_score from public.phil_iri_baseline_records");
      assert.equal(rows[0].assessment_period, "BOSY");
      assert.equal(Number(rows[0].total_score), 18);
      assert.equal((await db.query("select to_regclass('public.system_settings') as relation")).rows[0].relation, null);
    });
    await suite.test("assigned teachers can encode both later periods without activation", async () => {
      await insert("EOSY"); await insert("MOSY");
      assert.equal((await db.query("select * from public.phil_iri_baseline_records")).rows.length, 3);
    });
    await suite.test("resaving an identical legacy screening retains its stored profile", async () => {
      await db.query(`insert into public.phil_iri_baseline_records
        (student_id,class_id,teacher_id,school_year,subject,assessment_period,total_score,reading_level,raw_payload)
        values ($1,$2,$3,'SY 2026-2027','English','BOSY',18,'Instructional','{"isAbsent":false}')
        on conflict (student_id,school_year,subject,assessment_period) do update
          set total_score=excluded.total_score, reading_level=excluded.reading_level`, [s1,c1,t1]);
      assert.equal((await db.query("select reading_level from public.phil_iri_baseline_records where assessment_period='BOSY'")).rows[0].reading_level, "Instructional");
    });
    await suite.test("self-supplied teacher id cannot bypass assigned-class permissions", async () => {
      await assert.rejects(insert("BOSY", s2, c2), /row-level security/);
    });
    await suite.test("wrong language and unenrolled learners are rejected", async () => {
      await assert.rejects(db.query(`insert into public.phil_iri_baseline_records
        (student_id,class_id,teacher_id,school_year,subject,assessment_period,total_score,reading_level)
        values ($1,$2,$3,'SY 2026-2027','Filipino','BOSY',20,'Not Assessed')`, [s1,c1,t1]), /row-level security/);
      await assert.rejects(insert("MOSY", s2, c1), /row-level security/);
    });
    await suite.test("an earlier correction is audited and does not modify subsequent results or progress", async () => {
      const later = (await db.query("select to_jsonb(r) as result from public.phil_iri_baseline_records r where assessment_period <> 'BOSY' order by assessment_period")).rows;
      await db.query(`update public.phil_iri_baseline_records set total_score=22, raw_payload=raw_payload || '{"correctionReason":"Corrected score"}' where assessment_period='BOSY'`);
      assert.deepEqual((await db.query("select to_jsonb(r) as result from public.phil_iri_baseline_records r where assessment_period <> 'BOSY' order by assessment_period")).rows, later);
      const audit = (await db.query("select * from public.phil_iri_assessment_audit")).rows[0];
      assert.equal(audit.before_result.total_score, 18);
      assert.equal(audit.after_result.total_score, 22);
      assert.equal(audit.actor_auth_user_id, t1);
      assert.equal(audit.correction_reason, "Corrected score");
    });
    await suite.test("the database rejects invalid screening, invented profiles and incomplete Form 3 measurements", async () => {
      await assert.rejects(db.exec("update public.phil_iri_baseline_records set total_score=41 where assessment_period='BOSY'"), /valid GST/);
      await assert.rejects(db.exec("update public.phil_iri_baseline_records set reading_level='Independent' where assessment_period='BOSY'"), /Form 3/);
      await assert.rejects(db.exec(`update public.phil_iri_baseline_records set raw_payload='{"iraMetrics":{"passageLevel":"Grade 5"}}' where assessment_period='BOSY'`), /measurements/);
    });
    await suite.test("saved results cannot be moved to a different assessment period", async () => {
      await assert.rejects(db.exec("update public.phil_iri_baseline_records set assessment_period='MOSY' where assessment_period='BOSY'"), /cannot be moved/);
    });
    await suite.test("stale corrections fail instead of overwriting a newer result", async () => {
      await assert.rejects(db.exec(`update public.phil_iri_baseline_records set total_score=24,
        raw_payload=raw_payload || '{"expectedUpdatedAt":"2020-01-01T00:00:00Z"}' where assessment_period='BOSY'`), /changed while you were editing/);
    });
    await suite.test("correction history is append-only to authenticated users", async () => {
      await assert.rejects(db.exec("delete from public.phil_iri_assessment_audit"), /permission denied/);
      await assert.rejects(db.exec("update public.phil_iri_assessment_audit set correction_reason='hidden'"), /permission denied/);
    });
    await suite.test("Principal oversight can read every period and the correction history", async () => {
      await db.exec("select set_config('test.admin', 'yes', false)");
      assert.equal((await db.query("select * from public.phil_iri_baseline_records")).rows.length, 3);
      assert.equal((await db.query("select * from public.phil_iri_assessment_audit")).rows.length, 1);
    });
    await suite.test("stale insert-on-conflict corrections also fail safely", async () => {
      await assert.rejects(db.query(`insert into public.phil_iri_baseline_records
        (student_id,class_id,teacher_id,school_year,subject,assessment_period,total_score,reading_level,raw_payload)
        values ($1,$2,$3,'SY 2026-2027','English','BOSY',24,'Not Assessed','{"expectedUpdatedAt":"2020-01-01T00:00:00Z"}')
        on conflict (student_id,school_year,subject,assessment_period) do update
          set total_score=excluded.total_score, raw_payload=excluded.raw_payload`, [s1,c1,t1]), /changed while you were editing/);
    });
    await suite.test("valid Form 3 results are accepted and fabricated profiles are rejected", async () => {
      const raw = JSON.stringify({ isAbsent: false, iraMetrics: { passageLevel: "Grade 5", totalWords: 100, miscues: 8,
        readingTimeSeconds: 90, comprehensionCorrect: 6, comprehensionTotal: 8, progressionOutcome: "Continue to Next Assessment Period" } });
      await db.query("update public.phil_iri_baseline_records set reading_level='Instructional', raw_payload=$1::jsonb where assessment_period='MOSY'", [raw]);
      await assert.rejects(db.exec("update public.phil_iri_baseline_records set reading_level='Independent' where assessment_period='MOSY'"), /must match/);
    });
    await db.exec("reset role");
    assert.equal((await db.query("select student_progress,assessment_period from public.monitoring_records")).rows[0].student_progress, "Original progress");
    assert.equal((await db.query("select assessment_period from public.monitoring_records")).rows[0].assessment_period, null);
    await suite.test("settings repair creates the missing relation without activating periods or changing existing school settings", async () => {
      const repair = await readFile(new URL("../supabase/migrations/059_repair_shared_settings_relation.sql", import.meta.url), "utf8");
      await db.exec(repair);
      assert.equal((await db.query("select * from public.system_settings")).rows.length, 0);
      await db.exec(`insert into public.system_settings (key,value) values ('school_info','{"schoolYear":"2026-2027","currentTerm":2}')`);
      await db.exec(repair);
      assert.equal((await db.query("select value from public.system_settings where key='school_info'")).rows[0].value.currentTerm, 2);
      await db.exec("set role authenticated; select set_config('test.admin', 'no', false)");
      assert.equal((await db.query("select * from public.system_settings")).rows.length, 1);
      // UPDATE with USING=false affects zero rows; it must not change the setting.
      await db.exec("update public.system_settings set value='{}' where key='school_info'");
      assert.equal((await db.query("select value from public.system_settings")).rows[0].value.currentTerm, 2);
    });
  } finally { await db.close(); }
});
