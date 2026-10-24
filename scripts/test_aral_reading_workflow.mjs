import test from "node:test";
import assert from "node:assert/strict";
import { getAralReadingWorkflow } from "../lib/monitoring/aralReadingWorkflow.js";
import { getAralPeriodPermissions } from "../lib/monitoring/assessmentTimeline.js";
import { evaluateTermResult } from "../lib/monitoring/aralProgression.js";
import { buildPhilIriPayload } from "../lib/monitoring/philIriPersistence.js";

const year = "SY 2026-2027";
const learner = (records = [], extra = {}) => ({
  id: "roster-row", studentId: "s1", classId: "english-class", language: "English",
  subject: "English", schoolYear: year, canEditAssessment: true, philIriRecords: records, ...extra,
});
const record = (period, score, extra = {}) => ({
  id: `record-${period}`, student_id: "s1", subject: "English", school_year: year,
  assessment_period: period, total_score: score, reading_level: "Not Assessed", ...extra,
});
const continuing = (period) => record(period, 18, {
  reading_level: "Instructional",
  raw_payload: { iraMetrics: { readingProfile: "Instructional", progressionOutcome: "Continue to Next Assessment Period" } },
});

test("BOSY starts with screening; a roster score without a reading period cannot unlock Form 3", () => {
  const flow = getAralReadingWorkflow(learner([], { philIriScore: 18 }), "BOSY");
  assert.equal(flow.mode, "screening");
  assert.equal(flow.learner.philIriScore, null);
  assert.equal(flow.requiresIndividual, false);
});

for (const score of [0, 15, 16, 27, 28, 40]) {
  test(`BOSY saved GST ${score} automatically determines the individual assessment`, () => {
    const flow = getAralReadingWorkflow(learner([record("BOSY", score)]), "BOSY");
    assert.equal(flow.requiresIndividual, score < 28);
    assert.equal(flow.learner.readingLevel, "Not Assessed", "GST must not generate a reading profile");
  });
}

test("absent and invalid screening cannot unlock Form 3", () => {
  for (const rec of [record("BOSY", 0, { raw_payload: { isAbsent: true } }),
    ...[null, "", " ", -1, 41, "invalid"].map((score) => record("BOSY", score))]) {
    const flow = getAralReadingWorkflow(learner([rec]), "BOSY");
    assert.equal(flow.requiresIndividual, false);
    assert.equal(flow.learner.philIriScore, null);
  }
});

test("MOSY reassessment uses completed BOSY screening as context without prepopulating new results", () => {
  const flow = getAralReadingWorkflow(learner([continuing("BOSY")]), "MOSY");
  assert.equal(flow.mode, "reassessment");
  assert.equal(flow.requiresIndividual, true);
  assert.equal(flow.current, null);
  assert.equal(flow.learner.philIriScore, null);
  assert.equal(flow.learner.iraMetrics, null);
  assert.equal(flow.assessmentLearner.philIriScore, 18);
  assert.equal(flow.assessmentLearner.screeningPeriod, "BOSY");
  assert.equal(flow.assessmentLearner.classId, "english-class");
  assert.equal(flow.assessmentLearner.id, "roster-row");
});

test("EOSY uses MOSY follow-up or requires its own screening when no completed MOSY result exists", () => {
  assert.equal(getAralReadingWorkflow(learner([continuing("BOSY")]), "EOSY").mode, "screening");
  const flow = getAralReadingWorkflow(learner([continuing("BOSY"), continuing("MOSY")]), "EOSY");
  assert.equal(flow.mode, "reassessment");
  assert.equal(flow.requiresIndividual, true);
});

test("pending screening, absence, and an incomplete individualized assessment cannot become a completed prior assessment", () => {
  for (const records of [[], [record("BOSY", 18)], [record("BOSY", 0, { raw_payload: { isAbsent: true } })],
    [record("BOSY", 18, { raw_payload: { iraMetrics: { progressionOutcome: "Continue to Next Assessment Period" } } })]]) {
    const flow = getAralReadingWorkflow(learner(records), "MOSY");
    assert.equal(flow.mode, "incomplete_earlier");
    assert.equal(flow.requiresIndividual, false);
    assert.equal(flow.hasIncompleteEarlier, true);
  }
});

test("incomplete BOSY Form 3 provides incompleteEarlier context and action payload in MOSY", () => {
  const flow = getAralReadingWorkflow(learner([record("BOSY", 23)]), "MOSY");
  assert.equal(flow.mode, "incomplete_earlier");
  assert.equal(flow.hasIncompleteEarlier, true);
  assert.equal(flow.incompleteEarlierPeriod, "BOSY");
  assert.equal(flow.incompleteEarlierReason, "needs_form3");
  assert.equal(flow.incompleteEarlierLearner.philIriScore, 23);
  assert.equal(flow.incompleteEarlierLearner.assessmentPeriod, "BOSY");
  assert.equal(flow.learner.currentStepKey, "needs_earlier_ira");
  assert.equal(flow.learner.currentStepLabel, "BOSY Form 3 Needed");
});

test("completed learners retain history and receive no additional assessment", () => {
  for (const rec of [record("BOSY", 28), record("BOSY", 40), record("BOSY", 18, {
    reading_level: "Independent", raw_payload: { iraMetrics: { progressionOutcome: "No Further Assessment Required" } },
  })]) {
    const flow = getAralReadingWorkflow(learner([rec]), "MOSY");
    assert.equal(flow.mode, "complete");
    assert.equal(flow.requiresIndividual, false);
    assert.equal(flow.learner.philIriRecords.length, 1);
  }
});

test("English, Filipino, school years and students remain isolated", () => {
  const records = [record("BOSY", 35, { subject: "Filipino" }),
    record("BOSY", 40, { school_year: "SY 2025-2026" }), record("BOSY", 40, { student_id: "s2" }), continuing("BOSY")];
  const english = getAralReadingWorkflow(learner(records), "MOSY");
  assert.equal(english.requiresIndividual, true);
  assert.equal(english.learner.philIriRecords.length, 1);
  assert.equal(getAralReadingWorkflow(learner(records, { language: "Filipino", subject: "Filipino" }), "MOSY").mode, "complete");
});

test("only selected-period metrics prefill the assessment; all periods remain available in history", () => {
  const mosy = continuing("MOSY");
  mosy.raw_payload.iraMetrics.miscues = 9;
  const flow = getAralReadingWorkflow(learner([continuing("BOSY"), mosy, record("EOSY", 40)]), "MOSY");
  assert.equal(flow.assessmentLearner.iraMetrics.miscues, 9);
  assert.equal(flow.learner.philIriRecords.length, 3);
  const permissions = getAralPeriodPermissions("MOSY");
  assert.equal(permissions.BOSY.editable, true);
  assert.equal(permissions.MOSY.editable, true);
  assert.equal(permissions.EOSY.hidden, false);
});

test("a missing or invalid selection cannot be mistaken for a reading period", () => {
  for (const period of [null, "Term 1", "Q2", "invalid"]) {
    const flow = getAralReadingWorkflow(learner([continuing("BOSY")]), period);
    assert.equal(flow.mode, "invalid");
    assert.equal(flow.requiresIndividual, false);
    assert.equal(flow.period, null);
  }
});

test("routing is read-only and repeatable; records and outcomes remain unchanged", () => {
  const source = learner([continuing("BOSY")]);
  const before = JSON.stringify(source);
  const first = getAralReadingWorkflow(source, "MOSY");
  const second = getAralReadingWorkflow(first.assessmentLearner, "MOSY");
  assert.equal(JSON.stringify(source), before);
  assert.equal(second.requiresIndividual, true);
  assert.equal(second.current, null, "A projected screen must never turn a reference score into a saved current result");
  assert.equal(second.assessmentLearner.iraMetrics, null);
});

test("legacy records without a period remain BOSY; academic labels are not inferred as BOSY", () => {
  const legacy = record("BOSY", 18);
  delete legacy.assessment_period;
  assert.equal(getAralReadingWorkflow(learner([legacy]), "BOSY").requiresIndividual, true);
  assert.equal(getAralReadingWorkflow(learner([record("Term 1", 18)]), "BOSY").requiresIndividual, false);
});

test("a screening flagged for review does not unlock the individual form", () => {
  const rec = record("BOSY", 18, { raw_payload: { teacherReviewReason: "Check score" } });
  assert.equal(getAralReadingWorkflow(learner([rec]), "BOSY").requiresIndividual, false);
});

test("a corrected result supersedes an older result for the same language and period", () => {
  const old = record("BOSY", 35, { updated_at: "2026-06-01" });
  const corrected = { ...continuing("BOSY"), updated_at: "2026-06-02" };
  assert.equal(getAralReadingWorkflow(learner([old, corrected]), "MOSY").requiresIndividual, true);
});

test("existing individual profiles remain completed even when legacy records have no detailed metrics", () => {
  const flow = getAralReadingWorkflow(learner([record("BOSY", 18, { reading_level: "Instructional" })]), "BOSY");
  assert.equal(flow.hasIndividualResult, true);
  assert.equal(flow.learner.readingLevel, "Instructional");
});

test("evaluateTermResult blocks exit for Frustration or Instructional profiles", () => {
  const frustrationRecord = {
    total_score: 18,
    reading_level: "Frustration",
    teacherOutcome: "No Further Assessment Required",
    raw_payload: {
      iraMetrics: {
        readingProfile: "Frustration",
        progressionOutcome: "No Further Assessment Required",
      },
    },
  };
  const result = evaluateTermResult(frustrationRecord);
  assert.equal(result.outcome, "CONTINUE");
  assert.equal(result.hasPassed, false);
  assert.equal(result.needsFollowUp, true);
});

test("evaluateTermResult blocks exit when an Independent profile is tested on a below-grade passage", () => {
  const belowGradeRecord = {
    total_score: 22,
    grade: "Grade 7",
    reading_level: "Independent",
    teacherOutcome: "No Further Assessment Required",
    iraMetrics: {
      passageLevel: "Grade 5",
      readingProfile: "Independent",
    },
  };
  const result = evaluateTermResult(belowGradeRecord);
  assert.equal(result.outcome, "CONTINUE");
  assert.equal(result.hasPassed, false);
  assert.equal(result.needsFollowUp, true);
  assert.equal(result.statusLabel, "Independent (Grade 5)");
});

test("evaluateTermResult permits exit when an Independent profile is at grade level", () => {
  const atGradeRecord = {
    total_score: 22,
    grade: "Grade 7",
    reading_level: "Independent",
    iraMetrics: {
      passageLevel: "Grade 7",
      readingProfile: "Independent",
    },
  };
  const result = evaluateTermResult(atGradeRecord);
  assert.equal(result.outcome, "PASS");
  assert.equal(result.hasPassed, true);
  assert.equal(result.needsFollowUp, false);
});

test("buildPhilIriPayload throws when exiting with a non-Independent profile or below-grade passage", () => {
  const baseInput = {
    studentId: "11111111-1111-4111-8111-111111111111",
    assessmentPeriod: "BOSY",
    gstScore: 18,
    individualAssessmentRequired: true,
    grade: "Grade 7",
    iraMetrics: {
      passageLevel: "Grade 5",
      totalWords: 125,
      miscues: 2,
      readingTimeSeconds: 60,
      comprehensionCorrect: 7,
      comprehensionTotal: 8,
      progressionOutcome: "No Further Assessment Required",
    },
  };

  // Below-grade passage with Independent profile must throw on exit attempt
  assert.throws(
    () => buildPhilIriPayload(baseInput),
    /below learner's grade level/i
  );

  // Frustration profile must throw on exit attempt
  const frustrationInput = {
    ...baseInput,
    iraMetrics: {
      ...baseInput.iraMetrics,
      passageLevel: "Grade 7",
      totalWords: 155,
      miscues: 25, // causes Frustration
      comprehensionCorrect: 3,
    },
  };
  assert.throws(
    () => buildPhilIriPayload(frustrationInput),
    /cannot be exited from assessment/i
  );
});

test("buildPhilIriPayload sanitizes synthetic classId strings to null or valid UUID", () => {
  const inputSynthetic = {
    studentId: "11111111-1111-4111-8111-111111111111",
    classId: "7_ramon_english",
    assessmentPeriod: "BOSY",
    gstScore: 35,
  };
  const payloadSynthetic = buildPhilIriPayload(inputSynthetic);
  assert.equal(payloadSynthetic.class_id, null, "Synthetic class key must be sanitized to null to prevent 22P02");

  const validUuid = "22222222-2222-4222-8222-222222222222";
  const inputValid = {
    ...inputSynthetic,
    classId: validUuid,
  };
  const payloadValid = buildPhilIriPayload(inputValid);
  assert.equal(payloadValid.class_id, validUuid, "Real UUID classId must be preserved");
});

