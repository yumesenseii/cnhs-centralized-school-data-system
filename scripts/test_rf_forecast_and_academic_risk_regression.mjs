import "./test-support/env-setup.mjs";

import test from "node:test";
import assert from "node:assert/strict";

import {
  deriveAcademicRisk,
  deriveAcademicProgress,
  deriveCurrentSupport,
} from "../lib/monitoring/academicMonitoringState.js";
import {
  evaluateAcademicSupport,
  ACADEMIC_SUPPORT_LEVEL,
} from "../lib/services/recommendation/academicSupportEngine.js";
import {
  verifyAndBuildTrendFeatures,
  TREND_FEATURE_NAMES,
  TREND_SUBJECT_LABELS,
} from "../lib/services/recommendation/trendFeatures.js";
import {
  evaluatePublicationEvidence,
  describePublicationEvidence,
} from "../lib/services/recommendation/trendScope.js";
import { RISK_LEVEL } from "../lib/monitoring/recommendations.js";
import {
  applyRecommendationToUiFields,
} from "../lib/teacher/monitoringMappers.js";
import { POST } from "../app/api/recommendations/predict_subject_trend/route.js";
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
  SCHOOL_YEAR,
  buildTrendFixture,
} from "./test-support/trend-fixtures.mjs";

function makeTermGrades(quarter, baseGrades = {}) {
  const defaults = {
    english: 85,
    filipino: 88,
    mathematics: 82,
    science: 84,
    araling_panlipunan: 86,
    mapeh: 89,
    tle: 90,
    values_education: 91,
  };
  const merged = { ...defaults, ...baseGrades };
  return Object.entries(merged).map(([subject, final_grade]) => ({
    subject_name: subject,
    quarter,
    final_grade,
  }));
}

// ---------------------------------------------------------------------------
// 1. Overall Academic Risk & GWA Thresholds (DepEd Rule-Based Basis)
// ---------------------------------------------------------------------------
test("T1. Overall academic risk strictly follows authoritative GWA thresholds", () => {
  // Below 75 -> High Risk
  assert.equal(deriveAcademicRisk({ authoritativeGwa: 74.5 }), RISK_LEVEL.HIGH);
  assert.equal(deriveAcademicRisk({ authoritativeGwa: 70.0 }), RISK_LEVEL.HIGH);

  // 75-80 -> Moderate Risk
  assert.equal(deriveAcademicRisk({ authoritativeGwa: 75.0 }), RISK_LEVEL.MODERATE);
  assert.equal(deriveAcademicRisk({ authoritativeGwa: 78.5 }), RISK_LEVEL.MODERATE);
  assert.equal(deriveAcademicRisk({ authoritativeGwa: 80.0 }), RISK_LEVEL.MODERATE);

  // Above 80 -> Low Risk
  assert.equal(deriveAcademicRisk({ authoritativeGwa: 80.1 }), RISK_LEVEL.LOW);
  assert.equal(deriveAcademicRisk({ authoritativeGwa: 85.0 }), RISK_LEVEL.LOW);
  assert.equal(deriveAcademicRisk({ authoritativeGwa: 92.0 }), RISK_LEVEL.LOW);
});

test("T2. Incomplete / unverified GWA yields 'Pending Academic Risk' (never falls back to subject grade)", () => {
  // Learner has an individual failing subject (English = 69), but no GWA:
  const learnerWithFailingSubjectNoGwa = {
    classSubject: "English",
    classSubjectGrade: 69,
    authoritativeGwa: null,
    evaluationStatus: "provisional",
    isProvisional: true,
  };

  // Must NEVER be derived from classSubjectGrade = 69 (which would falsely trigger High Risk)
  const risk = deriveAcademicRisk(learnerWithFailingSubjectNoGwa);
  assert.equal(risk, "Pending Academic Risk");
  assert.notEqual(risk, RISK_LEVEL.HIGH);
});

test("T3. Complete GWA of 82 preserves Low Risk even when individual subject grade is failing (69)", () => {
  // Learner has passing overall GWA (82.0), but a struggling English grade (69)
  const learner = {
    classSubject: "English",
    classSubjectGrade: 69,
    authoritativeGwa: 82.0,
    evaluationStatus: "complete",
  };

  // Overall risk must be Low Risk based on complete GWA
  const overallRisk = deriveAcademicRisk(learner);
  assert.equal(overallRisk, RISK_LEVEL.LOW);
  assert.notEqual(overallRisk, RISK_LEVEL.HIGH);
});

// ---------------------------------------------------------------------------
// 2. Publication Evidence & Safeguards
// ---------------------------------------------------------------------------
test("T4. Publication evidence evaluator keeps draft and missing strictly distinct and blocking", () => {
  // Term 2 sheet is draft
  const draftEval = evaluatePublicationEvidence({
    sheets: [{ term: 2, status: "draft" }],
    requiredTerms: [2],
  });
  assert.equal(draftEval.state, "draft");
  const draftDesc = describePublicationEvidence(draftEval, { subjectLabel: "English" });
  assert.match(draftDesc, /draft/i);
  assert.match(draftDesc, /English/i);
  assert.match(draftDesc, /Term 2/i);

  // Term 2 sheet is missing
  const missingEval = evaluatePublicationEvidence({
    sheets: [{ term: 1, status: "published" }], // Term 2 is absent
    requiredTerms: [2],
  });
  assert.equal(missingEval.state, "missing");
  const missingDesc = describePublicationEvidence(missingEval, { subjectLabel: "English" });
  assert.match(missingDesc, /not treated as proof of publication/i);
  assert.match(missingDesc, /Term 2/i);

  // Term 2 sheet is published
  const pubEval = evaluatePublicationEvidence({
    sheets: [{ term: 2, status: "published" }],
    requiredTerms: [2],
  });
  assert.equal(pubEval.state, "published");
  assert.equal(describePublicationEvidence(pubEval), null);
});

// ---------------------------------------------------------------------------
// 3. Feature Builder: Term 2 -> Term 3 Graceful Degradation
// ---------------------------------------------------------------------------
test("T5. Term 2 -> Term 3 forecasting: missing Term 1 records safely uses feat_has_prior_term = 0 with zero deltas", () => {
  // Term 2 grades are complete and published, but no Term 1 records exist
  const grades = makeTermGrades(2, { english: 69 });
  const result = verifyAndBuildTrendFeatures({
    learnerId: "std-reg-01",
    subjectIdentifier: "english",
    currentTerm: 2,
    gradesRecords: grades,
    ecrTermSheets: [{ term: 2, status: "published" }],
  });

  assert.equal(result.eligible, true);
  assert.equal(result.features.feat_subject_code, 0); // english
  assert.equal(result.features.feat_current_subject_grade, 69);
  assert.equal(result.features.feat_has_prior_term, 0.0);
  assert.equal(result.features.feat_prior_subject_grade_delta, 0.0);
  assert.equal(result.features.feat_prior_gwa_delta, 0.0);
  assert.deepEqual(Object.keys(result.features), TREND_FEATURE_NAMES);
});

test("T6. Term 2 -> Term 3 forecasting: draft Term 1 records do NOT leak draft grades into prior deltas", () => {
  // Term 1 sheet is draft, Term 2 is published
  const grades = [
    ...makeTermGrades(1, { english: 75 }),
    ...makeTermGrades(2, { english: 69 }),
  ];
  const result = verifyAndBuildTrendFeatures({
    learnerId: "std-reg-02",
    subjectIdentifier: "english",
    currentTerm: 2,
    gradesRecords: grades,
    ecrTermSheets: [
      { term: 1, status: "draft" },
      { term: 2, status: "published" },
    ],
  });

  assert.equal(result.eligible, true);
  // Draft Term 1 must NOT be used: velocity remains zero
  assert.equal(result.features.feat_has_prior_term, 0.0);
  assert.equal(result.features.feat_prior_subject_grade_delta, 0.0);
  assert.equal(result.features.feat_prior_gwa_delta, 0.0);
});

test("T7. Term 2 -> Term 3 forecasting: complete published Term 1 records derive velocity", () => {
  // Both Term 1 and Term 2 are published and complete
  const grades = [
    ...makeTermGrades(1, { english: 75 }),
    ...makeTermGrades(2, { english: 69 }),
  ];
  const result = verifyAndBuildTrendFeatures({
    learnerId: "std-reg-03",
    subjectIdentifier: "english",
    currentTerm: 2,
    gradesRecords: grades,
    ecrTermSheets: [
      { term: 1, status: "published" },
      { term: 2, status: "published" },
    ],
  });

  assert.equal(result.eligible, true);
  assert.equal(result.features.feat_has_prior_term, 1.0);
  // Delta: 69 - 75 = -6.0
  assert.equal(result.features.feat_prior_subject_grade_delta, -6.0);
});

test("T8. Term 2 forecasting blocks when current term (Term 2) grades are incomplete, listing missing subjects in friendly terms", () => {
  // Missing mathematics and science in Term 2
  const incompleteGrades = makeTermGrades(2).filter(
    (g) => g.subject_name !== "mathematics" && g.subject_name !== "science"
  );

  const result = verifyAndBuildTrendFeatures({
    learnerId: "std-reg-04",
    subjectIdentifier: "english",
    currentTerm: 2,
    gradesRecords: incompleteGrades,
    ecrTermSheets: [{ term: 2, status: "published" }],
  });

  assert.equal(result.eligible, false);
  assert.match(result.reason, /Mathematics/);
  assert.match(result.reason, /Science/);
  assert.deepEqual(result.missingSubjects.sort(), ["mathematics", "science"]);
});

// ---------------------------------------------------------------------------
// 4. Route Level: Scoped Execution with Recording Supabase
// ---------------------------------------------------------------------------
test("T9. Route execution: Term 2 -> Term 3 forecast succeeds when Term 1 is missing, calling remote ML with 9 features", async () => {
  const fixture = buildTrendFixture({
    // Only Term 2 ECR sheet published; Term 1 sheet omitted
    ownSheetTerms: [2],
  });

  const client = createRecordingSupabaseClient(fixture);
  setSupabaseClient(client);
  resetInferenceCalls();

  const request = new Request(
    "http://localhost/api/recommendations/predict_subject_trend",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        learnerId: LEARNER_ID,
        subject: FORECAST_SUBJECT,
        currentTerm: 2,
        schoolYear: SCHOOL_YEAR,
      }),
    }
  );

  const response = await POST(request);
  const payload = await response.json();

  assert.equal(payload.status, "available");
  assert.equal(payload.currentTerm, 2);
  assert.equal(payload.targetTerm, 3);
  assert.equal(payload.predictedTrend, "Improving");

  const calls = getInferenceCalls();
  assert.equal(calls.length, 1);
  const feat = calls[0].featureVector;
  assert.equal(feat.feat_has_prior_term, 0.0);
  assert.equal(feat.feat_prior_subject_grade_delta, 0.0);
  assert.equal(feat.feat_prior_gwa_delta, 0.0);
});

test("T10. Route execution: Term 2 sheet in draft state strictly blocks the forecast", async () => {
  const fixture = buildTrendFixture({
    ownSheetStatus: "draft",
    ownSheetTerms: [2],
  });

  const client = createRecordingSupabaseClient(fixture);
  setSupabaseClient(client);
  resetInferenceCalls();

  const request = new Request(
    "http://localhost/api/recommendations/predict_subject_trend",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        learnerId: LEARNER_ID,
        subject: FORECAST_SUBJECT,
        currentTerm: 2,
        schoolYear: SCHOOL_YEAR,
      }),
    }
  );

  const response = await POST(request);
  const payload = await response.json();

  assert.equal(payload.status, "unavailable");
  assert.match(payload.message, /draft \/ unpublished state/i);
  assert.equal(getInferenceCalls().length, 0);
});
