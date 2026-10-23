import test from "node:test";
import assert from "node:assert/strict";
import { saveBatchClassGstScores, saveSinglePhilIriResult, savePhilIriBaselineRecords } from "../lib/supabase/queries/monitoring.js";
import { buildPhilIriPayload } from "../lib/monitoring/philIriPersistence.js";
import { getAralReadingWorkflow } from "../lib/monitoring/aralReadingWorkflow.js";
import { philIriMemoryClient } from "./test-support/phil-iri-memory-client.mjs";

const context = { studentId: "s1", classId: "c1", teacherId: "t1", schoolYear: "SY 2026-2027", subject: "English" };
const metrics = { passageLevel: "Grade 5", totalWords: 100, miscues: 8, readingTimeSeconds: 90,
  comprehensionCorrect: 6, comprehensionTotal: 8, progressionOutcome: "Continue to Next Assessment Period" };
const save = (client, assessmentPeriod, gstScore, extra = {}) => saveSinglePhilIriResult({
  ...context, assessmentPeriod, gstScore, supabaseClient: client, ...extra,
});

test("encoding, saving, switching periods and returning preserves three independent records", async () => {
  const db = philIriMemoryClient();
  for (const [period, score] of [["EOSY", 22], ["BOSY", 18], ["MOSY", 25]]) assert.equal((await save(db.client, period, score)).error, null);
  const learner = { ...context, canEditAssessment: true, philIriRecords: db.rows };
  for (const [period, score] of [["BOSY", 18], ["MOSY", 25], ["EOSY", 22], ["BOSY", 18]]) {
    const flow = getAralReadingWorkflow(learner, period);
    assert.equal(flow.learner.philIriScore, score);
    assert.equal(flow.requiresIndividual, true);
    assert.equal(flow.learner.iraMetrics, null);
  }
  assert.ok(db.calls.every((call) => call.table === "phil_iri_baseline_records"));
});

test("earlier GST correction requires explanation and preserves later records byte-for-byte", async () => {
  const db = philIriMemoryClient();
  for (const period of ["BOSY", "MOSY", "EOSY"]) await save(db.client, period, 18);
  const later = JSON.stringify(db.rows.filter((row) => row.assessment_period !== "BOSY"));
  const denied = await save(db.client, "BOSY", 20);
  assert.match(denied.error.message, /explain the correction/);
  assert.equal((await save(db.client, "BOSY", 20, { correctionReason: "Corrected scoring transcription" })).error, null);
  assert.equal(JSON.stringify(db.rows.filter((row) => row.assessment_period !== "BOSY")), later);
  const bosy = db.rows.find((row) => row.assessment_period === "BOSY");
  assert.equal(bosy.raw_payload.auditTrail.at(-1).previousScore, 18);
  assert.equal(bosy.raw_payload.auditTrail.at(-1).reason, "Corrected scoring transcription");
});

test("initial individual assessment uses real measurements and derives its reading profile", async () => {
  const db = philIriMemoryClient();
  await save(db.client, "BOSY", 18);
  const result = await save(db.client, "BOSY", 18, { individualAssessmentRequired: true, iraMetrics: metrics, readingLevel: "Independent" });
  assert.equal(result.error, null);
  assert.equal(db.rows[0].reading_level, "Instructional", "Profile must come from measurements, not a selected label");
  assert.equal(db.rows[0].raw_payload.iraMetrics.wordReadingPct, 92);
});

test("correcting GST invalidates only its own individual result and retains documents and history", async () => {
  const db = philIriMemoryClient();
  await save(db.client, "BOSY", 18, { individualAssessmentRequired: true, iraMetrics: metrics, documents: [{ name: "original.pdf" }] });
  await save(db.client, "MOSY", 20, { individualAssessmentRequired: true, iraMetrics: { ...metrics, screeningPeriod: "BOSY", assessmentKind: "reassessment" } });
  const mosy = JSON.stringify(db.rows[1]);
  const result = await saveBatchClassGstScores({ ...context, assessmentPeriod: "BOSY", scores: [{ studentId: "s1", gstScore: 21 }],
    correctionReason: "Recounted correct answers", supabaseClient: db.client });
  assert.equal(result.error, null);
  assert.equal(db.rows[0].raw_payload.iraMetrics, null);
  assert.equal(db.rows[0].reading_level, "Not Assessed");
  assert.equal(db.rows[0].raw_payload.individualResultNeedsReview, true);
  assert.deepEqual(db.rows[0].raw_payload.documents, [{ name: "original.pdf" }]);
  assert.equal(JSON.stringify(db.rows[1]), mosy);
});

test("resaving an unchanged screening score keeps the individual result", () => {
  const existing = buildPhilIriPayload({ ...context, assessmentPeriod: "BOSY", gstScore: 18, individualAssessmentRequired: true, iraMetrics: metrics });
  const payload = buildPhilIriPayload({ ...context, assessmentPeriod: "BOSY", gstScore: 18, screeningOnly: true }, existing);
  assert.deepEqual(payload.raw_payload.iraMetrics, existing.raw_payload.iraMetrics);
  assert.equal(payload.reading_level, existing.reading_level);
});

test("significant individual corrections require a reason and retain prior score history", async () => {
  const db = philIriMemoryClient();
  await save(db.client, "MOSY", 18, { iraMetrics: metrics });
  const changed = { ...metrics, miscues: 20 };
  assert.ok((await save(db.client, "MOSY", 18, { iraMetrics: changed })).error);
  assert.equal((await save(db.client, "MOSY", 18, { iraMetrics: changed, correctionReason: "Corrected miscues count" })).error, null);
  assert.equal(db.rows[0].reading_level, "Frustration");
  assert.equal(db.rows[0].raw_payload.auditTrail.at(-1).action, "assessment_corrected");
});

test("missing screening, incomplete metrics and impossible measurements cannot create results", async () => {
  for (const [score, iraMetrics] of [[null, metrics], [28, metrics], [18, {}], [18, { ...metrics, miscues: 101 }],
    [18, { ...metrics, comprehensionCorrect: 9 }], [18, { ...metrics, readingTimeSeconds: 0 }]]) {
    const db = philIriMemoryClient();
    assert.ok((await save(db.client, "BOSY", score, { individualAssessmentRequired: true, iraMetrics })).error);
    assert.equal(db.rows.length, 0);
  }
});

test("invalid GST scores fail rather than being clamped or treated as assessed", async () => {
  for (const gstScore of [-1, 41, Infinity, "bad"]) {
    const db = philIriMemoryClient();
    assert.ok((await saveBatchClassGstScores({ ...context, assessmentPeriod: "EOSY", scores: [{ studentId: "s1", gstScore }], supabaseClient: db.client })).error);
    assert.equal(db.rows.length, 0);
  }
});

test("blank rows do not create results and absence keeps the score null", async () => {
  const db = philIriMemoryClient();
  assert.equal((await saveBatchClassGstScores({ ...context, assessmentPeriod: "BOSY", scores: [{ studentId: "s1", gstScore: null }], supabaseClient: db.client })).data.count, 0);
  assert.equal(db.calls.length, 0);
  assert.equal((await save(db.client, "BOSY", null, { isAbsent: true })).error, null);
  assert.equal(db.rows[0].total_score, null);
  assert.equal(db.rows[0].raw_payload.isAbsent, true);
});

test("language and school year records remain separate on correction", async () => {
  const db = philIriMemoryClient();
  await save(db.client, "BOSY", 18);
  await save(db.client, "BOSY", 28, { subject: "Filipino" });
  await save(db.client, "BOSY", 30, { schoolYear: "SY 2025-2026" });
  await save(db.client, "BOSY", 20, { correctionReason: "Corrected English score" });
  assert.deepEqual(db.rows.map((row) => row.total_score), [20, 28, 30]);
});

test("database errors are returned instead of reporting a successful save", async () => {
  const db = philIriMemoryClient({ writeError: { code: "23503", message: "foreign key violation" } });
  const result = await save(db.client, "BOSY", 18);
  assert.ok(result.error);
  assert.equal(result.data, null);
  assert.equal(db.rows.length, 0);
});

test("correcting an earlier period never hides an existing subsequent result", () => {
  const bosy = { ...buildPhilIriPayload({ ...context, assessmentPeriod: "BOSY", gstScore: 35 }), updated_at: "2026-10-23T10:00:00Z" };
  bosy.raw_payload.correctionReason = "Corrected screening";
  const mosy = { ...buildPhilIriPayload({ ...context, assessmentPeriod: "MOSY", gstScore: 18, iraMetrics: metrics }), updated_at: "2026-10-20T10:00:00Z" };
  const flow = getAralReadingWorkflow({ ...context, canEditAssessment: true, philIriRecords: [bosy, mosy] }, "MOSY");
  assert.equal(flow.requiresIndividual, true);
  assert.equal(flow.learner.philIriScore, 18);
  assert.equal(flow.learner.readingLevel, "Instructional");
  assert.equal(flow.earlierCorrectionNeedsReview, true);
});

test("imports use independent period records without updating intervention progress or inventing reading profiles", async () => {
  const db = philIriMemoryClient();
  for (const assessmentPeriod of ["BOSY", "MOSY", "EOSY"]) {
    const result = await savePhilIriBaselineRecords({ ...context, assessmentPeriod,
      records: [{ studentId: "s1", classId: "c1", isMatched: true, totalScore: 18, readingLevel: "Instructional" }], supabaseClient: db.client });
    assert.equal(result.error, null);
  }
  assert.equal(db.rows.length, 3);
  assert.ok(db.rows.every((row) => row.reading_level === "Not Assessed"));
});
