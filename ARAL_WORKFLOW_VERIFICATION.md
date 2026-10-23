# ARAL independent assessment periods

Teachers and the Principal select BOSY, MOSY, or EOSY locally. Reading periods do not activate or lock one another and are independent of academic grading terms.

## Behavior and record integrity

- The teacher page reuses the class GST sheet, Form 3 and the weekly intervention grid. Saved evidence determines the applicable form. Opening a form or changing tabs never creates a result.
- Missing screening requires an actual GST result; neither incomplete earlier assessments nor a calendar date can generate a reading profile. Completed prior individualized assessments can supply the screening context for a manually entered reassessment.
- Existing results in the selected period remain correctable even when an earlier period is later corrected or now meets the benchmark.
- Unsaved GST entries are retained as local, period-specific drafts. Database saves are explicit. Form 3 measurements and outcomes are validated and its reading profile is computed from measurements.
- Significant corrections require an explanation in the save service. Migration 058 records before/after snapshots and the authenticated actor in an append-only audit table. Teachers and the Principal can see concise correction history in the learner record.
- A corrected GST score invalidates only that period's individual result. The interface explains this before saving. Other assessment periods and intervention progress are not updated or deleted. Later results are flagged for review when an earlier correction is newer.
- New weekly progress records carry the selected reading period. Existing progress without a recorded period remains available in a separate view-only history. Academic monitoring callers keep their existing query shape and behavior.
- Authentication, assigned language-class enrollment and school-year permissions remain enforced by Supabase RLS. Migration 058 closes the old write-policy loophole that trusted a self-supplied teacher id alone.
- Academic ECR validation, academic-term locks, rule-based GWA risk classification, RF engines and model artifacts are unchanged.

## Confirmed deployment mismatch

Read-only checks against the Supabase project configured in `.env.local` returned:

| Request | Result |
| --- | --- |
| `system_settings?select=key&limit=0` | HTTP 404, `PGRST205`: relation unavailable in the API schema cache |
| `phil_iri_baseline_records?select=assessment_period&limit=0` | HTTP 400, `42703`: assessment period column does not exist |

The deployed schema does not match the checked-in migrations. The first response alone cannot distinguish an absent relation from a stale/unexposed API schema; it is not proof of a GRANT/RLS problem. The missing reading-period column confirms that the period-aware migration is not reflected in the configured database. The old ARAL code both depended on the unavailable settings relation and attempted writes against incompatible period storage.

ARAL no longer reads or writes the global activation setting. Migration 059 independently repairs the shared settings relation and reloads the API schema, while preserving existing values. No academic term, school information or reading activation value is seeded. Migration 057 is now guarded so it does not fail when the legacy table is absent.

## Required Supabase deployment

These changes have **not** been applied to the live database; only read-only live diagnostics were performed.

1. Confirm the deployment targets the same Supabase project as the application's `NEXT_PUBLIC_SUPABASE_URL`. In the SQL Editor, inspect `select to_regclass('public.system_settings');` and the `assessment_period` column in `information_schema.columns`. This distinguishes an absent table from an API cache problem without guessing from grants.
2. Apply `supabase/migrations/058_aral_independent_periods_and_audit.sql`, then `059_repair_shared_settings_relation.sql` using the SQL Editor or your migration runner. Migration 058 includes the missing period column and period-aware uniqueness from 055, so 055 need not be run separately for this repair. Prerequisites are the existing core classes/enrollments, Phil-IRI baseline and monitoring tables and authentication helpers.
3. Both scripts preserve existing records, are transactional and safe to reapply. They notify PostgREST to reload the schema. Existing baseline records become BOSY only where no reading-period column previously existed; legacy progress stays unassigned to a reading period. Neither script removes assessment or progress data.
4. Deploy the application build. Sign in with an assigned language teacher and verify saves in all three tabs, then sign in as the Principal and verify the matching period records and correction history. Re-run `node --env-file=.env.local scripts/diagnose_aral_schema.mjs` to check that the API now exposes the relation and column.
5. Do not bulk-replay unrelated historical cleanup migrations as part of this fix. No `aral.assessment_period` activation row is needed. Existing academic term configuration must remain as it was.

## Verification

- Reading workflow, save/query, Phil-IRI, term-separation and academic GWA/ECR regressions: 64 tests.
- Real PostgreSQL through PGlite: 15 checks, including rerunnable migrations, legacy preservation, RLS, invalid assessments, audit immutability, stale-write rejection and settings repair. Uses isolated fixture data, not production data.
- Chrome browser scenario: real teacher/Principal React components and real save services with mocked authentication/roster/database transport. Covers GST encoding, local drafts across tabs, explicit saves, Form 3, correction explanations, independent results and Principal record values for BOSY/MOSY/EOSY. Does not substitute for post-deployment verification with real accounts and Supabase RLS.
- Production build succeeds. Targeted ESLint has no errors and five pre-existing hook-dependency warnings in the reused assessment/weekly grids.
- Additional RF verification: 17 of 18 tests pass. The existing exact-label assertion in `test_phase5_rf_verification.mjs` fails because the academic detail modal no longer contains its expected legacy text. The separate forecast regression entry point cannot initialize because its existing inference-client mock lacks `mapInferenceResponse`. These unrelated test fixtures and RF modules were left unchanged.

Commands:

```powershell
node --no-warnings --import ./scripts/test-env.mjs --loader ./scripts/alias-loader.mjs --test scripts/test_aral_period_saves.mjs scripts/test_aral_reading_workflow.mjs scripts/test_p0_03_phil_iri_aral.mjs scripts/test_phase1.mjs scripts/test_p0_02_academic_risk_ecr.mjs
node --no-warnings --test scripts/test_aral_database.mjs
node scripts/test_aral_browser.mjs
npm.cmd run build
```

The browser test uses installed Chrome (`channel: "chrome"`). Test-only dependencies added: `@electric-sql/pglite` and `@playwright/test`.

## Changed files

- Teacher workflow: `components/teacher/aral-program/TeacherAralMonitoringPage.jsx`, `AralClassGstSpreadsheet.jsx`, `AralWeeklyGridPanel.jsx`, `AralAssessmentPanel.jsx`, `AralSectionWorkspace.jsx`.
- Reading entry/history: `components/teacher/monitoring/AralAssessmentFlowModal.jsx`, `AralLearnerRecordModal.jsx`, and the reading-only period condition in `StudentMonitoringSidePanel.jsx`; obsolete activation comments in `PhilIriImportModal.jsx` and `PhilIriEnterResultModal.jsx`.
- Principal oversight: `components/admin/monitoring/AdminAralMonitoringDashboard.jsx`, `AdminAralLearnerModal.jsx`.
- Shared UI: `components/aral/AralPeriodTabs.jsx`, `AralCorrectionHistory.jsx`.
- Period/workflow logic: `hooks/useAralAssessmentPeriod.js`, `lib/monitoring/assessmentTimeline.js`, `aralReadingWorkflow.js`, `philIriPersistence.js`.
- Persistence: `lib/supabase/queries/monitoring.js`, `aralProgram.js`; obsolete `aralAssessmentPeriod.js` removed.
- Supabase: guarded migration `057_grant_system_settings_select.sql`, new migrations `058_aral_independent_periods_and_audit.sql` and `059_repair_shared_settings_relation.sql`.
- Verification/dependencies: `package.json`, `package-lock.json`, `scripts/diagnose_aral_schema.mjs`, `test_aral_reading_workflow.mjs`, `test_aral_period_saves.mjs`, `test_aral_database.mjs`, `test_aral_browser.mjs`, updated `test_phase1.mjs` and `test_p0_03_phil_iri_aral.mjs`, and ARAL-specific helpers under `scripts/test-support/`.

The original working tree already contained changes to the teacher/Principal period controls, hook/query and migration 057. Those files were refactored for the new requirements; unrelated working-tree changes were preserved.
