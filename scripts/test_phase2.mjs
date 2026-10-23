import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateAcademicSupport,
  ACADEMIC_SUPPORT_LEVEL,
} from "../lib/services/recommendation/academicSupportEngine.js";
import { ruleBasedRecommendation } from "../lib/services/recommendation/ruleBasedEngine.js";
import {
  riskLevelFromGrade,
  GRADE_RISK_BANDS,
} from "../lib/services/recommendation/riskFromGrade.js";
import { RISK_LEVEL } from "../lib/monitoring/recommendations.js";
import { deriveAcademicRisk } from "../lib/monitoring/academicMonitoringState.js";

test("Scenario 1: GWA 78, no failing subjects -> Moderate Risk, Targeted Reinforcement", () => {
  const result = evaluateAcademicSupport({
    gwa: 78,
    subjects: {
      English: 78,
      Math: 76,
      Science: 80,
    },
  });

  assert.equal(result.currentAcademicRisk, RISK_LEVEL.MODERATE);
  assert.equal(result.officialRiskLevel, RISK_LEVEL.MODERATE);
  assert.equal(result.gwa, 78);
  assert.deepEqual(result.weakSubjects, []);
  assert.deepEqual(result.reinforcementSubjects, ["English", "Math", "Science"]);
  assert.equal(
    result.recommendedSupportLevel,
    ACADEMIC_SUPPORT_LEVEL.TARGETED_REINFORCEMENT
  );
  assert.ok(
    result.suggestedAcademicActivities.some((a) =>
      a.toLowerCase().includes("targeted practice")
    )
  );
  assert.ok(
    result.suggestedMonitoringIndicators.some((i) =>
      i.includes("Math") || i.includes("Formative check")
    )
  );
});

test("Scenario 2: GWA 78, one failing subject (Math 72) -> Moderate Risk, Subject-Specific Remediation", () => {
  const result = evaluateAcademicSupport({
    gwa: 78,
    subjects: {
      English: 82,
      Math: 72,
      Science: 80,
    },
  });

  assert.equal(result.currentAcademicRisk, RISK_LEVEL.MODERATE);
  assert.equal(result.gwa, 78);
  assert.deepEqual(result.weakSubjects, ["Math"]);
  assert.deepEqual(result.reinforcementSubjects, ["Science"]);
  assert.equal(
    result.recommendedSupportLevel,
    ACADEMIC_SUPPORT_LEVEL.SUBJECT_REMEDIATION
  );
  assert.ok(
    result.recommendationReason.includes("Math"),
    "Reason must mention Math"
  );
  assert.ok(
    result.recommendationReason.includes("Moderate Risk"),
    "Reason must mention Moderate Risk monitoring priority"
  );

  const mathNeed = result.identifiedAcademicNeeds.find((n) => n.subject === "Math");
  assert.ok(mathNeed, "Math need must be present");
  assert.equal(mathNeed.type, "remediation");
  assert.equal(mathNeed.grade, 72);
});

test("Scenario 3: GWA 72, multiple failing subjects -> High Risk, Priority Academic Remediation", () => {
  const result = evaluateAcademicSupport({
    gwa: 72,
    subjects: {
      English: 70,
      Math: 71,
      Science: 75,
    },
  });

  assert.equal(result.currentAcademicRisk, RISK_LEVEL.HIGH);
  assert.equal(result.officialRiskLevel, RISK_LEVEL.HIGH);
  assert.equal(result.gwa, 72);
  assert.deepEqual(result.weakSubjects, ["English", "Math"]);
  assert.equal(
    result.recommendedSupportLevel,
    ACADEMIC_SUPPORT_LEVEL.PRIORITY_REMEDIATION
  );
  assert.ok(
    result.suggestedAcademicActivities.some((a) =>
      a.toLowerCase().includes("guided instructional")
    )
  );
});

test("Scenario 4: GWA 88, one failing subject (Math 74) -> Low Risk priority, but explicit Subject Remediation", () => {
  const result = evaluateAcademicSupport({
    gwa: 88,
    subjects: {
      English: 92,
      Math: 74,
      Science: 90,
      AP: 96,
    },
  });

  assert.equal(result.currentAcademicRisk, RISK_LEVEL.LOW);
  assert.equal(result.gwa, 88);
  assert.deepEqual(result.weakSubjects, ["Math"]);
  // Safeguard: Passing/high GWA must not hide failing subject under generic Low Risk support!
  assert.equal(
    result.recommendedSupportLevel,
    ACADEMIC_SUPPORT_LEVEL.SUBJECT_REMEDIATION
  );
  assert.ok(
    result.recommendationReason.includes("Math"),
    "Remediation reason must explicitly flag Math"
  );
  assert.ok(
    result.recommendationReason.includes("Low Risk"),
    "Reason must state overall Low Risk priority"
  );
});

test("Scenario 5: GWA 90, no failing subjects -> Low Risk, Regular Monitoring & Enrichment", () => {
  const result = evaluateAcademicSupport({
    gwa: 90,
    subjects: {
      English: 90,
      Math: 92,
      Science: 88,
      Filipino: 90,
    },
  });

  assert.equal(result.currentAcademicRisk, RISK_LEVEL.LOW);
  assert.equal(result.gwa, 90);
  assert.deepEqual(result.weakSubjects, []);
  assert.deepEqual(result.reinforcementSubjects, []);
  assert.equal(
    result.recommendedSupportLevel,
    ACADEMIC_SUPPORT_LEVEL.REGULAR_MONITORING
  );
  assert.ok(
    result.suggestedAcademicActivities.some((a) =>
      a.toLowerCase().includes("enrichment")
    )
  );
});

test("Scenario 6: No finalized ECR grades -> Pending / '—', Pending Data status", () => {
  const result = evaluateAcademicSupport({
    subjectGrades: [],
  });

  assert.equal(result.currentAcademicRisk, "Pending");
  assert.equal(result.officialRiskLevel, "—");
  assert.equal(result.gwa, null);
  assert.deepEqual(result.weakSubjects, []);
  assert.deepEqual(result.reinforcementSubjects, []);
  assert.deepEqual(result.identifiedAcademicNeeds, []);
  assert.equal(
    result.recommendedSupportLevel,
    ACADEMIC_SUPPORT_LEVEL.PENDING_DATA
  );
  assert.deepEqual(result.suggestedAcademicActivities, []);
  assert.ok(
    result.suggestedMonitoringIndicators[0].includes("Awaiting finalized ECR grades")
  );
});

test("Scenario 7 (Edge Case): Partial / unpublished grades with non-numeric values", () => {
  const result = evaluateAcademicSupport({
    isCompleteTerm: true,
    subjectGrades: [
      { subject: "English", finalGrade: "86" },
      { subject: "Math", finalGrade: "INC" },
      { subject: "Science", finalGrade: null },
      { subject: "Filipino", finalGrade: "" },
      { subject: "AP", finalGrade: 84 },
    ],
  });

  // Only English (86) and AP (84) are valid numbers. Average = (86 + 84)/2 = 85.
  assert.equal(result.gwa, 85);
  assert.equal(result.currentAcademicRisk, RISK_LEVEL.LOW);
  assert.deepEqual(result.weakSubjects, []);
  assert.deepEqual(result.reinforcementSubjects, []);
  assert.equal(
    result.recommendedSupportLevel,
    ACADEMIC_SUPPORT_LEVEL.REGULAR_MONITORING
  );
});

test("Scenario 8 (Edge Case): Conflicting subject-level needs (Enrichment, Reinforcement, Remediation)", () => {
  const result = evaluateAcademicSupport({
    isCompleteTerm: true,
    subjects: {
      English: 95, // enrichment
      Math: 78,    // reinforcement
      Science: 73, // remediation
    },
  });

  assert.equal(result.gwa, 82); // (95 + 78 + 73)/3 = 82 -> Low Risk overall GWA
  assert.equal(result.currentAcademicRisk, RISK_LEVEL.LOW);
  assert.deepEqual(result.weakSubjects, ["Science"]);
  assert.deepEqual(result.reinforcementSubjects, ["Math"]);

  const scienceNeed = result.identifiedAcademicNeeds.find((n) => n.subject === "Science");
  assert.equal(scienceNeed?.type, "remediation");

  const mathNeed = result.identifiedAcademicNeeds.find((n) => n.subject === "Math");
  assert.equal(mathNeed?.type, "reinforcement");

  const englishNeed = result.identifiedAcademicNeeds.find((n) => n.subject === "English");
  assert.equal(englishNeed?.type, "enrichment");

  // Subject-specific remediation takes priority over generic Low Risk enrichment
  assert.equal(
    result.recommendedSupportLevel,
    ACADEMIC_SUPPORT_LEVEL.SUBJECT_REMEDIATION
  );
});

test("Scenario 9: Single Source of Truth consistency check", () => {
  // Check GRADE_RISK_BANDS
  assert.equal(GRADE_RISK_BANDS.highBelow, 75);
  assert.equal(GRADE_RISK_BANDS.moderateMax, 80);
  assert.equal(GRADE_RISK_BANDS.lowMin, 80);
  assert.equal(GRADE_RISK_BANDS.passingGrade, 75);

  // Check riskLevelFromGrade
  assert.equal(riskLevelFromGrade(74.9), RISK_LEVEL.HIGH);
  assert.equal(riskLevelFromGrade(75), RISK_LEVEL.MODERATE);
  assert.equal(riskLevelFromGrade(80), RISK_LEVEL.MODERATE);
  assert.equal(riskLevelFromGrade(80.01), RISK_LEVEL.LOW);
  assert.equal(riskLevelFromGrade(84), RISK_LEVEL.LOW);
  assert.equal(riskLevelFromGrade(85), RISK_LEVEL.LOW);
  assert.equal(riskLevelFromGrade(98), RISK_LEVEL.LOW);

  // Check academicMonitoringState deriveAcademicRisk
  assert.equal(deriveAcademicRisk({ classSubjectGrade: 72 }), RISK_LEVEL.HIGH);
  assert.equal(deriveAcademicRisk({ classSubjectGrade: 78 }), RISK_LEVEL.MODERATE);
  assert.equal(deriveAcademicRisk({ classSubjectGrade: 88 }), RISK_LEVEL.LOW);
  assert.equal(deriveAcademicRisk({ classSubjectGrade: null }), "—");
  assert.equal(deriveAcademicRisk({ riskLevel: "Pending" }), "—");

  // Check ruleBasedRecommendation output structure
  const ruleOutput = ruleBasedRecommendation({
    isCompleteTerm: true,
    subjectGrades: [{ subject: "Math", finalGrade: 70 }],
  });
  assert.equal(ruleOutput.riskLevel, RISK_LEVEL.HIGH);
  assert.equal(ruleOutput.source, "authoritative-rule-based");
  assert.ok(ruleOutput.academicSupport);
});

test("Scenario 10: Evidence-Based verification - No competency inference without data", () => {
  const result = evaluateAcademicSupport({
    subjects: {
      Mathematics: 72,
    },
  });

  const need = result.identifiedAcademicNeeds[0];
  // Must NOT invent MELCs, fractions, word recognition, etc.
  assert.ok(
    !need.rationale.toLowerCase().includes("fractions"),
    "Must not invent fractions competency"
  );
  assert.ok(
    !need.rationale.toLowerCase().includes("numerical problem-solving"),
    "Must not invent specific sub-competencies without competency data"
  );
  assert.ok(
    need.rationale.includes("Subject teacher to assess specific competency gaps"),
    "Must leave specific competency determination to teachers"
  );
});
