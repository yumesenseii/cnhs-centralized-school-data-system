import test from "node:test";
import assert from "node:assert/strict";

// 1. Test assessmentTimeline.js decoupling
import {
  normalizeAralPeriod,
  aralPeriodLabel,
  aralPeriodShortLabel,
  getAralPeriodPermissions,
  resolveAralPeriod,
  getAralTermDisplay,
  ARAL_PERIOD_LABELS,
} from "../lib/monitoring/assessmentTimeline.js";

// 2. Test aralProgression.js decoupling
import {
  normalizeReadingPeriod,
  normalizeTerm,
  getPreviousTermOutcome,
  filterActiveLearnersForTerm,
} from "../lib/monitoring/aralProgression.js";

test("Phase 1 - assessmentTimeline: normalizeAralPeriod rejects academic terms and quarters", () => {
  assert.equal(normalizeAralPeriod("TERM 1"), null);
  assert.equal(normalizeAralPeriod("TERM 2"), null);
  assert.equal(normalizeAralPeriod("TERM 3"), null);
  assert.equal(normalizeAralPeriod("Term 2"), null);
  assert.equal(normalizeAralPeriod("Q1"), null);
  assert.equal(normalizeAralPeriod("Q2"), null);
  assert.equal(normalizeAralPeriod("Q3"), null);
  assert.equal(normalizeAralPeriod("Q4"), null);
  assert.equal(normalizeAralPeriod("Quarter 1"), null);
  assert.equal(normalizeAralPeriod("Quarter 4"), null);
});

test("Phase 1 - assessmentTimeline: normalizeAralPeriod normalizes valid reading periods without silent defaults", () => {
  assert.equal(normalizeAralPeriod("BOSY"), "BOSY");
  assert.equal(normalizeAralPeriod("Beginning Assessment"), "BOSY");
  assert.equal(normalizeAralPeriod("MOSY"), "MOSY");
  assert.equal(normalizeAralPeriod("Middle of School Year"), "MOSY");
  assert.equal(normalizeAralPeriod("EOSY"), "EOSY");
  assert.equal(normalizeAralPeriod("End-of-Year Assessment"), "EOSY");

  // Rejects invalid, empty, or unconfigured
  assert.equal(normalizeAralPeriod(null), null);
  assert.equal(normalizeAralPeriod(undefined), null);
  assert.equal(normalizeAralPeriod(""), null);
  assert.equal(normalizeAralPeriod("UNKNOWN_PERIOD"), null);
});

test("Phase 1 - assessmentTimeline: all reading periods are independently available", () => {
  for (const selection of [null, "BOSY", "MOSY", "EOSY"]) {
    assert.ok(Object.values(getAralPeriodPermissions(selection)).every((permission) => permission.editable && !permission.hidden && !permission.readonly));
  }
});

test("Phase 1 - assessmentTimeline: resolveAralPeriod does not fall back to academic term number", () => {
  const resFromTerm = resolveAralPeriod({ configuredPeriod: null, termNumber: 2 });
  assert.equal(resFromTerm.period, null);
  assert.equal(resFromTerm.source, "unconfigured");

  const resFromTerm3 = resolveAralPeriod({ configuredPeriod: null, termNumber: 3 });
  assert.equal(resFromTerm3.period, null);
  assert.equal(resFromTerm3.source, "unconfigured");

  const resConfig = resolveAralPeriod({ configuredPeriod: "MOSY" });
  assert.equal(resConfig.period, "MOSY");
  assert.equal(resConfig.source, "config");
});

test("Phase 1 - assessmentTimeline: getAralTermDisplay separates reading period from academic terms", () => {
  const bosyLabel = getAralTermDisplay("BOSY");
  assert.match(bosyLabel, /Beginning Assessment \(BOSY\)/);
  assert.doesNotMatch(bosyLabel, /Term 1/);

  const mosyLabel = getAralTermDisplay("MOSY");
  assert.match(mosyLabel, /Mid-Year Assessment \(MOSY\)/);
  assert.doesNotMatch(mosyLabel, /Term 2/);

  const eosyLabel = getAralTermDisplay("EOSY");
  assert.match(eosyLabel, /End-of-Year Assessment \(EOSY\)/);
  assert.doesNotMatch(eosyLabel, /Term 3/);
});

test("Phase 1 - aralProgression: normalizeTerm and normalizeReadingPeriod reject academic terms and invalid values", () => {
  assert.equal(normalizeReadingPeriod("TERM 2"), null);
  assert.equal(normalizeReadingPeriod("TERM 3"), null);
  assert.equal(normalizeReadingPeriod("Q4"), null);
  assert.equal(normalizeReadingPeriod("Q2"), null);
  assert.equal(normalizeReadingPeriod(null), null);
  assert.equal(normalizeReadingPeriod(undefined), null);

  assert.equal(normalizeTerm("TERM 2"), null);
  assert.equal(normalizeTerm("TERM 3"), null);
  assert.equal(normalizeTerm("Q4"), null);
  assert.equal(normalizeTerm(null), null);
  assert.equal(normalizeTerm(undefined), null);

  // Valid values
  assert.equal(normalizeTerm("BOSY"), "BOSY");
  assert.equal(normalizeTerm("MOSY"), "MOSY");
  assert.equal(normalizeTerm("EOSY"), "EOSY");
});

test("Phase 1 - aralProgression: filterActiveLearnersForTerm handles unconfigured periods safely", () => {
  const dummyLearners = [{ id: "st-1" }, { id: "st-2" }];
  // Unconfigured period should return all learners without crashing or filtering
  const unconfigured = filterActiveLearnersForTerm(dummyLearners, null);
  assert.equal(unconfigured.length, 2);

  const invalid = filterActiveLearnersForTerm(dummyLearners, "INVALID");
  assert.equal(invalid.length, 2);

  const bosy = filterActiveLearnersForTerm(dummyLearners, "BOSY");
  assert.equal(bosy.length, 2);
});

test("Phase 1 - aralProgression: getPreviousTermOutcome handles null targetPeriod safely", () => {
  const learner = {
    philIriRecords: [
      { assessmentPeriod: "BOSY", totalScore: 35 },
    ],
  };

  const outcomeNull = getPreviousTermOutcome(learner, null);
  assert.equal(outcomeNull.hasPassedEarlier, false);
  assert.equal(outcomeNull.passedInTerm, "BOSY");

  const outcomeMosy = getPreviousTermOutcome(learner, "MOSY");
  assert.equal(outcomeMosy.hasPassedEarlier, true);
  assert.equal(outcomeMosy.passedInTerm, "BOSY");
});

// 3. Test termGradesForClassSubject from monitoringMappers.js
import { termGradesForClassSubject } from "../lib/teacher/monitoringMappers.js";

test("Phase 1 - monitoringMappers: termGradesForClassSubject maps Terms 1–3 and preserves Quarter 4 Final Grade", () => {
  const gradeRows = [
    { subject: "Mathematics", quarter: 1, finalGrade: 82, schoolYear: "2026-2027" },
    { subject: "Mathematics", quarter: 2, finalGrade: 85, schoolYear: "2026-2027" },
    { subject: "Mathematics", quarter: 3, finalGrade: 88, schoolYear: "2026-2027" },
    { subject: "Mathematics", quarter: 4, finalGrade: 85, schoolYear: "2026-2027" }, // Legacy / Final Grade
  ];

  const result = termGradesForClassSubject(gradeRows, {
    schoolYear: "2026-2027",
    classSubject: "Mathematics",
  });

  assert.equal(result[1], 82);
  assert.equal(result[2], 85);
  assert.equal(result[3], 88);
  assert.equal(result[4], 85); // Confirms Quarter 4 is preserved as final average
});

