import assert from "node:assert/strict";
import test from "node:test";
import { predictNumericalSubjectGrade } from "../lib/services/recommendation/numericalGradeRegressor.js";
import { verifyAndBuildTrendFeatures } from "../lib/services/recommendation/trendFeatures.js";

test("T1. predictNumericalSubjectGrade estimates succeeding grade for failing student (<75)", () => {
  // Francesca Evangelista scenario: Grade 69 in English Term 2
  const result = predictNumericalSubjectGrade({
    featureVector: [0, 69, 74, -5, 1, 69, 0, 0, 0],
    currentGrade: 69,
    currentTerm: 2,
    subject: "english",
  });

  assert.strictEqual(result.currentGrade, 69);
  assert.ok(result.estimatedGrade >= 70, `Estimated grade should show recovery from 69, got ${result.estimatedGrade}`);
  assert.ok(result.estimatedDelta > 0, `Delta should be positive for recovering student, got ${result.estimatedDelta}`);
  assert.strictEqual(result.predictedTrend, "Improving");
  assert.strictEqual(result.typicalError, 3);
  assert.strictEqual(result.targetTerm, 3);
});

test("T2. predictNumericalSubjectGrade clips values to DepEd valid range [60, 100]", () => {
  // Very high grade
  const highResult = predictNumericalSubjectGrade({
    featureVector: [0, 99, 98, 1, 0, 95, 1, 2, 1],
    currentGrade: 99,
    currentTerm: 1,
    subject: "english",
  });
  assert.ok(highResult.estimatedGrade <= 100, "Grade cannot exceed 100");

  // Very low grade
  const lowResult = predictNumericalSubjectGrade({
    featureVector: [0, 60, 62, -2, 4, 60, 0, 0, 0],
    currentGrade: 60,
    currentTerm: 1,
    subject: "mathematics",
  });
  assert.ok(lowResult.estimatedGrade >= 60, "Grade cannot be below 60");
});

test("T3. verifyAndBuildTrendFeatures with allowProvisional succeeds when current subject grade is recorded", () => {
  const mockGrades = [
    { quarter: 2, subject: "English", final_grade: 69 },
  ];

  const result = verifyAndBuildTrendFeatures({
    learnerId: "test-learner-1",
    subjectIdentifier: "English",
    currentTerm: 2,
    gradesRecords: mockGrades,
    ecrTermSheets: [{ term: 2, status: "draft" }],
    allowProvisional: true,
  });

  assert.strictEqual(result.eligible, true, "Should be eligible in provisional mode");
  assert.strictEqual(result.currentGrade, 69);
  assert.strictEqual(result.isProvisional, true, "Should be flagged as provisional");
  assert.ok(result.features, "Features vector should be populated");
});
