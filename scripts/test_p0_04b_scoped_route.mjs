/**
 * P0-04B Track A — scoped route tests for /api/recommendations/predict_subject_trend.
 *
 * These tests execute the REAL route module against a recording Supabase
 * client. The recorder captures every emitted query filter and fails loudly on
 * any write operation, so the read scope of the route is verified, not a mock
 * of the intended logic.
 *
 * Run:
 *   node --no-warnings --loader ./scripts/test-support/trend-route-loader.mjs \
 *        scripts/test_p0_04b_scoped_route.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { POST } from "@/app/api/recommendations/predict_subject_trend/route.js";
import { TREND_FEATURE_NAMES } from "@/lib/services/recommendation/trendFeatures";
import { riskLevelFromGrade } from "@/lib/services/recommendation/riskFromGrade";
import {
  createRecordingSupabaseClient,
  findFilter,
  findQuery,
} from "./test-support/recording-supabase.mjs";
import { setSupabaseClient } from "./test-support/mock-supabase-server.mjs";
import {
  getInferenceCalls,
  resetInferenceCalls,
} from "./test-support/mock-inference-client.mjs";
import {
  FORECAST_SUBJECT,
  LEARNER_ID,
  PRIOR_SCHOOL_YEAR,
  SCHOOL_YEAR,
  SCHOOL_YEAR_VARIANTS,
  buildTrendFixture,
  classIdFor,
} from "./test-support/trend-fixtures.mjs";

const ROUTE_PATH = path.resolve(
  process.cwd(),
  "app/api/recommendations/predict_subject_trend/route.js"
);

async function callRoute(body, { fixtureOptions = {}, prepare = null } = {}) {
  const fixture = buildTrendFixture(fixtureOptions);
  if (prepare) prepare(fixture);

  const client = createRecordingSupabaseClient(fixture);
  setSupabaseClient(client);
  resetInferenceCalls();

  const request = new Request(
    "http://localhost/api/recommendations/predict_subject_trend",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const response = await POST(request);
  const payload = await response.json();

  return { response, payload, client, fixture };
}

test("R1. Term 1 -> Term 2 forecast succeeds for an admin and sends the exact 9-feature contract", async () => {
  const { response, payload, client } = await callRoute({
    learnerId: LEARNER_ID,
    subject: FORECAST_SUBJECT,
    currentTerm: 1,
    schoolYear: `SY ${SCHOOL_YEAR}`,
  });

  assert.equal(response.status, 200);
  assert.equal(payload.status, "available");
  assert.equal(payload.subject, "english");
  assert.equal(payload.currentTerm, 1);
  assert.equal(payload.targetTerm, 2);

  const calls = getInferenceCalls();
  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.deepEqual(call.featureNames, TREND_FEATURE_NAMES);
  assert.deepEqual(Object.keys(call.featureVector), TREND_FEATURE_NAMES);

  const feat = call.featureVector;
  assert.equal(feat.feat_subject_code, 0);
  assert.equal(feat.feat_current_subject_grade, 85);
  // (85+88+82+84+86+89+90+91)/8 = 695/8 = 86.875 -> 86.88
  assert.equal(feat.feat_current_term_gwa, 86.88);
  assert.equal(feat.feat_current_relative_standing, Number((85 - 86.88).toFixed(2)));
  assert.equal(feat.feat_current_failing_count, 0);
  assert.equal(feat.feat_current_lowest_grade, 82);
  assert.equal(feat.feat_has_prior_term, 0.0);
  assert.equal(feat.feat_prior_subject_grade_delta, 0.0);
  assert.equal(feat.feat_prior_gwa_delta, 0.0);

  // The route only reads the required grading quarters of the resolved SY.
  const gradesQuery = findQuery(client, "grades");
  assert.ok(gradesQuery, "the route must read grades");
  assert.deepEqual(findFilter(gradesQuery, "quarter").values, [1]);
  assert.deepEqual(
    [...findFilter(gradesQuery, "school_year").values].sort(),
    [...SCHOOL_YEAR_VARIANTS].sort()
  );
  assert.equal(findFilter(gradesQuery, "student_id").value, LEARNER_ID);

  assert.equal(client.writes.length, 0, "the route must never write");
});

test("R2. Term 2 -> Term 3 forecast uses complete Term 1 history and preserves the 9-feature contract", async () => {
  const { payload, client } = await callRoute({
    learnerId: LEARNER_ID,
    subject: FORECAST_SUBJECT,
    currentTerm: 2,
    schoolYear: SCHOOL_YEAR,
  });

  assert.equal(payload.status, "available");
  assert.equal(payload.currentTerm, 2);
  assert.equal(payload.targetTerm, 3);

  const feat = getInferenceCalls()[0].featureVector;
  assert.equal(feat.feat_current_subject_grade, 87);
  assert.equal(feat.feat_current_term_gwa, 88.13);
  assert.equal(feat.feat_has_prior_term, 1.0);
  assert.equal(feat.feat_prior_subject_grade_delta, 2.0);
  assert.equal(feat.feat_prior_gwa_delta, Number((88.13 - 86.88).toFixed(2)));

  const gradesQuery = findQuery(client, "grades");
  assert.deepEqual(findFilter(gradesQuery, "quarter").values, [1, 2]);
  assert.ok(
    !findFilter(gradesQuery, "quarter").values.includes(4),
    "quarter 4 must never be read as a grading term"
  );
  assert.equal(client.writes.length, 0);
});

test("R3. Prior school year records are excluded: prior-SY grades never reach the features and prior-SY drafts never block", async () => {
  const { payload, client } = await callRoute(
    {
      learnerId: LEARNER_ID,
      subject: FORECAST_SUBJECT,
      currentTerm: 1,
      schoolYear: `SY ${SCHOOL_YEAR}`,
    },
    {
      // Prior school year grades would drag the GWA down if they leaked in.
      prepare: (fixture) => {
        for (const grade of fixture.grades) {
          if (grade.school_year === PRIOR_SCHOOL_YEAR) grade.final_grade = 60;
        }
      },
    }
  );

  assert.equal(payload.status, "available");
  assert.equal(getInferenceCalls()[0].featureVector.feat_current_term_gwa, 86.88);
  assert.equal(
    getInferenceCalls()[0].featureVector.feat_current_lowest_grade,
    82
  );

  const sheetQuery = findQuery(client, "ecr_term_sheets");
  const classIds = findFilter(sheetQuery, "ecr_workbooks.class_id").values;
  assert.ok(
    classIds.every((id) => !id.includes(PRIOR_SCHOOL_YEAR)),
    "prior school year class rows must not be part of the class family"
  );
  assert.ok(
    !findFilter(sheetQuery, "ecr_workbooks.school_year").values.includes(
      PRIOR_SCHOOL_YEAR
    ),
    "the ECR sheet query must be scoped to the resolved school year"
  );
  assert.equal(client.writes.length, 0);
});

test("R4. Class family resolution scopes the ECR sheet query to the forecast subject's own family", async () => {
  const { client } = await callRoute({
    learnerId: LEARNER_ID,
    subject: FORECAST_SUBJECT,
    currentTerm: 1,
  });

  const sheetQuery = findQuery(client, "ecr_term_sheets");
  const classIds = findFilter(sheetQuery, "ecr_workbooks.class_id").values;

  for (const quarter of [1, 2, 3, 4]) {
    assert.ok(
      classIds.includes(classIdFor("subj-english", SCHOOL_YEAR, quarter)),
      `Term ${quarter} class row of the forecast subject must belong to the family`
    );
  }
  for (const other of [
    "subj-filipino",
    "subj-mathematics",
    "subj-science",
    "subj-mapeh",
  ]) {
    assert.ok(
      !classIds.includes(classIdFor(other, SCHOOL_YEAR, 1)),
      "unrelated subject class rows must not belong to the family"
    );
  }
  assert.equal(client.writes.length, 0);
});

test("R5. Unrelated subject draft sheets do not block the current subject forecast", async () => {
  const { payload } = await callRoute(
    {
      learnerId: LEARNER_ID,
      subject: FORECAST_SUBJECT,
      currentTerm: 1,
    },
    { fixtureOptions: { unrelatedSheetStatus: "draft" } }
  );

  assert.equal(payload.status, "available");
  assert.equal(payload.predictedTrend, "Improving");
});

test("R6. The forecast subject's own unpublished sheet blocks the forecast with a precise message", async () => {
  const { payload } = await callRoute(
    {
      learnerId: LEARNER_ID,
      subject: FORECAST_SUBJECT,
      currentTerm: 1,
    },
    { fixtureOptions: { ownSheetStatus: "draft" } }
  );

  assert.equal(payload.status, "unavailable");
  assert.equal(payload.predictedTrend, "—");
  assert.match(payload.message, /draft \/ unpublished state/i);
  assert.match(payload.message, /english/i);
  assert.equal(payload.features, undefined);
  assert.equal(payload.gwa, undefined);
  assert.equal(payload.featureVector, undefined);
});

test("R7. Missing publication evidence blocks the forecast and is not treated as published", async () => {
  const { payload } = await callRoute(
    {
      learnerId: LEARNER_ID,
      subject: FORECAST_SUBJECT,
      currentTerm: 1,
    },
    { fixtureOptions: { ownSheetTerms: [2, 3] } }
  );

  assert.equal(payload.status, "unavailable");
  assert.match(payload.message, /not treated as proof of publication/i);
  assert.match(payload.message, /Term 1/i);
});

test("R8. Duplicate canonical subjects are detected and ambiguous grades fail closed", async () => {
  const catalogue = await callRoute(
    {
      learnerId: LEARNER_ID,
      subject: FORECAST_SUBJECT,
      currentTerm: 1,
    },
    { fixtureOptions: { duplicateSubjectRow: true } }
  );

  assert.equal(catalogue.payload.status, "available");
  assert.deepEqual(catalogue.payload.duplicateSubjects, ["english"]);

  const ambiguous = await callRoute(
    {
      learnerId: LEARNER_ID,
      subject: FORECAST_SUBJECT,
      currentTerm: 1,
    },
    { fixtureOptions: { duplicateGradeRow: true } }
  );

  assert.equal(ambiguous.payload.status, "unavailable");
  assert.match(ambiguous.payload.message, /Ambiguous subject records detected/i);
  assert.equal(ambiguous.payload.features, undefined);
  assert.equal(getInferenceCalls().length, 0, "no forecast may be sent to the model");
});

test("R9. Authorization: admin has school-wide access, unauthenticated is 401, teacher without enrollment is 403", async () => {
  const admin = await callRoute({
    learnerId: LEARNER_ID,
    subject: FORECAST_SUBJECT,
    currentTerm: 1,
  });
  assert.equal(admin.response.status, 200);
  assert.equal(admin.payload.status, "available");

  const unauthenticated = await callRoute(
    {
      learnerId: LEARNER_ID,
      subject: FORECAST_SUBJECT,
      currentTerm: 1,
    },
    {
      fixtureOptions: { role: "teacher" },
      prepare: (fixture) => {
        fixture.authUser = null;
      },
    }
  );
  assert.equal(unauthenticated.response.status, 401);

  const notEnrolled = await callRoute(
    {
      learnerId: LEARNER_ID,
      subject: FORECAST_SUBJECT,
      currentTerm: 1,
    },
    { fixtureOptions: { role: "teacher", enrolled: false } }
  );
  assert.equal(notEnrolled.response.status, 403);
  assert.equal(notEnrolled.payload.status, undefined);
});

test("R10. Teacher session stays restricted: cross-subject evidence is not visible and nothing protected leaks", async () => {
  const { payload } = await callRoute(
    {
      learnerId: LEARNER_ID,
      subject: FORECAST_SUBJECT,
      currentTerm: 1,
    },
    { fixtureOptions: { role: "teacher" } }
  );

  assert.equal(payload.status, "unavailable");
  assert.match(payload.message, /leadership session/i);
  assert.match(payload.message, /pending full-term evaluation/i);

  // No cross-subject completeness list, no grades, no GWA, no feature vector.
  assert.doesNotMatch(payload.message, /filipino|mathematics|science|mapeh/i);
  assert.equal(payload.gwa, undefined);
  assert.equal(payload.features, undefined);
  assert.equal(payload.featureVector, undefined);
  assert.equal(payload.missingSubjects, undefined);
  assert.equal(getInferenceCalls().length, 0);

  // The teacher still receives their OWN subject's publication diagnosis.
  const ownDraft = await callRoute(
    {
      learnerId: LEARNER_ID,
      subject: FORECAST_SUBJECT,
      currentTerm: 1,
    },
    { fixtureOptions: { role: "teacher", ownSheetStatus: "draft" } }
  );
  assert.equal(ownDraft.payload.status, "unavailable");
  assert.match(ownDraft.payload.message, /draft \/ unpublished state/i);
});

test("R11. The route performs no write operation in any scenario", async () => {
  const scenarios = [
    { ownSheetStatus: "published" },
    { ownSheetStatus: "draft" },
    { ownSheetTerms: [2, 3] },
    { unrelatedSheetStatus: "draft" },
    { duplicateGradeRow: true },
    { role: "teacher" },
  ];

  for (const fixtureOptions of scenarios) {
    const { client } = await callRoute(
      {
        learnerId: LEARNER_ID,
        subject: FORECAST_SUBJECT,
        currentTerm: 1,
      },
      { fixtureOptions }
    );
    assert.deepEqual(
      client.writes,
      [],
      `unexpected write operation for ${JSON.stringify(fixtureOptions)}`
    );
  }
});

test("R12. An arbitrary client supplied school year is not trusted", async () => {
  const { payload, client } = await callRoute({
    learnerId: LEARNER_ID,
    subject: FORECAST_SUBJECT,
    currentTerm: 1,
    schoolYear: "2019-2020",
  });

  assert.equal(payload.status, "available");
  assert.equal(payload.schoolYear, `SY ${SCHOOL_YEAR}`);

  const gradesQuery = findQuery(client, "grades");
  const usedYears = findFilter(gradesQuery, "school_year").values;
  assert.ok(!usedYears.includes("2019-2020"));
  assert.deepEqual([...usedYears].sort(), [...SCHOOL_YEAR_VARIANTS].sort());
});

test("R13. Official rule-based risk, GWA and Model B are untouched by this route", async () => {
  const source = fs.readFileSync(ROUTE_PATH, "utf8");

  for (const forbidden of [
    "riskFromGrade",
    "ruleBasedEngine",
    "monitoringMappers",
    "recommendation/features",
    "philIri",
    "aral",
    "RECOMMENDATION",
  ]) {
    assert.equal(
      source.includes(forbidden),
      false,
      `the trend route must not reference ${forbidden}`
    );
  }

  // Model B's feature module is byte identical to HEAD.
  const modelBDiff = execFileSync("git", ["diff", "--name-only", "HEAD", "--", "lib/services/recommendation/features.js"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(
    modelBDiff.trim(),
    "",
    "Model B's features.js must not be modified"
  );

  // The official rule based risk bands still behave as documented.
  assert.equal(riskLevelFromGrade(74), "High Risk");
  assert.equal(riskLevelFromGrade(75), "Moderate Risk");
  assert.equal(riskLevelFromGrade(80), "Moderate Risk");
  assert.equal(riskLevelFromGrade(81), "Low Risk");
  assert.equal(riskLevelFromGrade(88), "Low Risk");
  assert.equal(riskLevelFromGrade(null), "—");

  // The forecast payload never carries risk or probability fields.
  const { payload } = await callRoute({
    learnerId: LEARNER_ID,
    subject: FORECAST_SUBJECT,
    currentTerm: 1,
  });
  for (const forbidden of [
    "predictedRisk",
    "riskLevel",
    "confidence",
    "probabilities",
    "feature_vector",
  ]) {
    assert.equal(forbidden in payload, false, `${forbidden} must not be exposed`);
  }
});
