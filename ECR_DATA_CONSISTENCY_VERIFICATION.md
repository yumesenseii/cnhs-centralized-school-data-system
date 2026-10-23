# ECR data consistency investigation and verification

Verified 24 October 2026. Changes in this report concern academic ECR only. Earlier ARAL changes in the working tree are separate.

## Data actually inspected

The user supplied `docs/PONCE.xlsx`. Read-only inspection and parser assertions found Science, Grade 10 Ponce, SY 2026–2027:

| Evidence | Term 1 | Term 2 |
| --- | --- | --- |
| Named roster | 42 learners in the workbook: 27 male, 15 female | Same workbook roster |
| Saved term grades | One grade: 85 at AA13 | None |
| Actual raw assessment scores | 10 values for one learner: 4 WW, 3 PT, 3 examination | None |
| Actual LRNs in source | None | None |

Term 1 item positions are G13:J13, N13:P13, and T13:V13. F13 (WW item 1) is missing. Q13 is a PT total, not another assessment item. Term 3 also has no saved grades or raw item scores. The AVE sheet does not contain 40/41 saved grades.

This file therefore **does not establish what is stored in the protected live 40/41 records**. Do not replace the database roster with this 42-learner workbook or treat its generated parser identifiers as LRNs.

The read-only Supabase audit could use only the project's public credentials: `grades` returned HTTP 401 / 42501; ECR queries exposed zero rows to the anonymous role. RLS-filtered empty responses do not prove missing records. An authenticated assigned teacher/admin audit is still necessary to independently confirm the production counts. No production academic records were written, reset, deleted, or reimported during this work.

## Data sources and causes

| Workflow | Actual source | Finding / correction |
| --- | --- | --- |
| My Classes | `grades.final_grade`, student IDs, sibling classes, subject, year, quarter | These are subject-term grades; they do not contain item-level WW/PT/exam scores. The existing academic monitoring source is preserved. |
| Online Grade Sheet | `ecr_workbooks`, `ecr_term_sheets`, `ecr_component_config`, `ecr_component_scores`, `ecr_computed_grades` | The old loader inspected only the opened class workbook. Imports may live in the selected term's sibling-class workbook. The reader now resolves the assigned teacher/subject/section/year family and reads existing sources without copying records. Authentic official grades provide a final-grade-only fallback. |
| Term switching | Local hook state | The old loader merged previous-term score state into the next term. Drafts and persisted sources are now independent per term. |
| Score count | Row status including imported final-only grades | Previously called these “with scores.” Now assessment-score counts and term-grade counts are separate. Final-only rows explain why the item cells are blank. |
| ECR import | Workbook parser → roster validation → confirmed import → selected sibling workbook | Roster validation discarded `component_scores` and `component_layout`. Both now survive confirmation. Parsing now uses the dialog's selected term, and grade fallback cannot borrow another explicitly mapped term. |
| Workbook parsing | Actual saved cells and cached Excel results | The PT total of 84 was counted as an extra item because its HPS total was below 100. Total/PS columns are excluded. Missing raw scores remain missing; invalid high scores are no longer clamped into invented values. Oversized formatting dimensions no longer drive worksheet scans. |
| Excel export | Official template filled from ECR state | Export previously ignored saved final-grade values and reconstructed output from raw scores alone. It now fills all three term sheets with available authentic grades and scores, caches names and results for non-calculating viewers, and removes stale template sample caches. |

The shared source resolver preserves competing populated sheets and makes the teacher view read-only with an explanation. The export includes every source separately for review. It does not merge competing academic records.

## Integrity and behavior

- Viewing ECR creates no workbooks, grades, scores, or publication states. Missing ECR scaffolding is created only on an encoding/save action.
- Actual student IDs link existing records; authentic LRNs are retained in workbook exports/import matching. Names-only uploads require explicit verification against the official roster. Generated display identifiers do not silently match centralized LRNs.
- Saves reject unassigned classes, cross-subject/year/section targets, learners outside the selected term roster, and invalid raw scores. No authentication or RLS policies were relaxed.
- Partial raw evidence can be saved without replacing an authentic final grade. Blank inputs preserve existing scores. A plain save of unchanged complete scores also preserves the saved grade; an actual complete score/configuration correction can recompute it.
- Imports retain genuine partial evidence and genuine saved term grades. An incomplete set of item scores cannot manufacture a final grade. Duplicate confirmed learner IDs are rejected before imported HPS/configuration changes are applied. Repeated identical imports use existing record keys.
- Draft save/import does not publish `grades`. Publication still requires the complete official roster and valid final grades; partial assessment evidence cannot bypass that validation. Published sheets stay protected. Official writes are verified and restored if committing publication status fails.
- Final/AVE publication requires all three selected term sheets to be published and every required learner to have all three term grades. It accepts the actual sibling-workbook sources without copying them.
- Excel contains TERM1, TERM2, TERM3, and SUMMARY OF GRADES plus GRADE RECORDS, ASSESSMENT RECORDS, and SAVED GRADE SOURCES. Supplementary sheets preserve source IDs, status, authentic grades, and all actual saved item rows, including competing sources. Unknown details remain blank. Excel formulas cannot turn partial rows or only two term grades into final results on recalculation.
- Rule-based GWA risk classification, Random Forest features/services, and Phil-IRI assessment modules were not changed for this ECR task.

## Checks

All save/import/publication tests use isolated transport fixtures with the real ECR query functions, not live academic writes. The supplied workbook is read-only input. Chrome uses the real ECR page, grid, hook, queries, and Excel builder; the transport, surrounding navigation/import dialog, and download delivery are isolated. Import parsing, roster validation, persistence, and Excel roundtrip are exercised separately in the regression suite.

| Check | Result |
| --- | --- |
| `test_ecr_consistency.mjs` | 10/10 pass: sibling retrieval; final-only counters; scope/security checks; >1000 raw-row pagination; partial save/reload; publication and rollback; unchanged-grade preservation; duplicate/partial imports; sibling final publication; supplied PONCE import/export roundtrip; final-only Term 1/2 export |
| `test_ecr_browser.mjs` | Pass in Chrome: 0/41 actual score count vs 40/41 term grades, independent Term 1/2 drafts, explicit save, remount/reload, successful Excel build, incomplete-publication rejection, published read-only state |
| `test_p0_04c_ecr_integrity.mjs` | Pass |
| `test_p0_02_academic_risk_ecr.mjs` | 9/9 pass, including published completeness and authoritative GWA boundaries |
| Targeted ESLint with `.js,.jsx` | Pass |
| Production build | Pass: `npm.cmd run build`, lint/type checks and all 48 static pages generated |
| Broader unchanged academic/RF tests | 26/28 pass. `test_phase2.mjs` Scenario 9 expects subject-grade-only risk classification although current completeness logic returns Pending Academic Risk. `test_phase5_rf_verification.mjs` expects an exact label absent from the unchanged LearnerAcademicDetailModal. These failures are outside the ECR change; those modules/tests were not modified. |

Reproduce the primary checks:

```powershell
node --no-warnings --import ./scripts/test-env.mjs --loader ./scripts/test-support/ecr-loader.mjs --test scripts/test_ecr_consistency.mjs
node scripts/test_ecr_browser.mjs
node --no-warnings --import ./scripts/test-env.mjs --loader ./scripts/alias-loader.mjs scripts/test_p0_04c_ecr_integrity.mjs
node --no-warnings --import ./scripts/test-env.mjs --loader ./scripts/alias-loader.mjs --test scripts/test_p0_02_academic_risk_ecr.mjs
node --no-warnings --loader ./scripts/alias-loader.mjs scripts/inspect_ecr_workbook.mjs docs/PONCE.xlsx
npm.cmd run build
```

For an authorized read-only production audit, `scripts/diagnose_ecr_data.mjs` accepts an existing teacher session through the `ECR_AUDIT_ACCESS_TOKEN` environment variable. It prints counts and source scopes, not learner names, LRNs, or credentials. Never commit a session token. Anonymous results alone are inconclusive.

## Changed files for this ECR task

Teacher interface and state:

- `components/teacher/e-record/EcrGrid.jsx`
- `components/teacher/e-record/EcrRecordPage.jsx`
- `components/teacher/my-classes/EClassUploadDialog.jsx`
- `hooks/teacher/useEcrRecord.js`

Queries, record resolution, and Excel:

- `lib/supabase/queries/ecr.js`
- `lib/ecr/recordData.js` (new)
- `lib/ecr/exportTermSheet.js`
- `lib/ecr/gridLayout.js`
- `lib/ecr/computeGrades.js`

Import parsing and validation:

- `lib/eclass/importIntegrity.js`
- `lib/eclass/parseAssignedTerm.js`
- `lib/eclass/parseAveSheet.js`
- `lib/eclass/parseInputData.js`
- `lib/eclass/validateEClassRoster.js`
- `lib/eclass/xlsxRead.js`

New verification tools/files:

- `scripts/diagnose_ecr_data.mjs`
- `scripts/inspect_ecr_workbook.mjs`
- `scripts/test_ecr_consistency.mjs`
- `scripts/test_ecr_browser.mjs`
- `scripts/test-support/ecr-fixture.mjs`
- `scripts/test-support/ecr-loader.mjs`
- `scripts/test-support/ecr-browser-entry.jsx`
- `scripts/test-support/ecr-browser-mocks.jsx`
- `ECR_DATA_CONSISTENCY_VERIFICATION.md`

The user-provided `docs/PONCE.xlsx` was not modified. No additional production dependency or ECR SQL migration was added.

## Deployment

Deploy the updated web application normally. No Supabase SQL, GRANT/RLS change, schema-cache reset, data backfill, or workbook reimport is required by this ECR fix. The existing ECR schema from migration 020 is reused. Earlier ARAL migrations in the working tree belong to the previous task and are not ECR deployment requirements.

After web deployment, an assigned teacher should review the affected class's Term 1 and Term 2 and download Excel while signed in. If the database contains only final grades, the final-grade columns will display/export those values and the detailed cells will remain blank with an explanation. Add missing details only from authentic source records after roster verification. This investigation has not independently inspected the protected live 40/41 learner records or performed a production publish.
