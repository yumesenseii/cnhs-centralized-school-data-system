import {
  RECOMMENDATION,
  RISK_LEVEL,
} from "@/lib/monitoring/recommendations";

const ARAL_SUBJECTS = new Set(["english", "filipino"]);
const PASSING_GRADE = 75;

function normalizeSubjectName(name = "") {
  return String(name).trim().toLowerCase();
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function extractSubjectGrades(student = {}) {
  return Array.isArray(student.subjectGrades) ? student.subjectGrades : [];
}

/**
 * Rule-based recommendation engine (last-resort fallback only).
 * Uses ECR subject grades only — never attendance.
 *
 * The active Monitoring path uses Random Forest via recommendationService.
 * This module remains available if the RF engine throws unexpectedly.
 */
export function ruleBasedRecommendation(student = {}) {
  const subjectGrades = extractSubjectGrades(student);
  const failingSubjects = [];

  for (const row of subjectGrades) {
    const subject = row.subjectName ?? row.subject ?? "Subject";
    const grade = toNumber(row.finalGrade ?? row.grade ?? row.final_grade);
    if (grade === null) continue;
    if (grade < PASSING_GRADE) {
      failingSubjects.push({ subject, grade });
    }
  }

  const hasAralFail = failingSubjects.some((item) =>
    ARAL_SUBJECTS.has(normalizeSubjectName(item.subject))
  );
  const hasOtherFail = failingSubjects.some(
    (item) => !ARAL_SUBJECTS.has(normalizeSubjectName(item.subject))
  );

  const generatedAt = new Date().toISOString();

  if (hasAralFail) {
    const aralFails = failingSubjects.filter((item) =>
      ARAL_SUBJECTS.has(normalizeSubjectName(item.subject))
    );
    return {
      recommendationType: RECOMMENDATION.ARAL,
      riskLevel: RISK_LEVEL.HIGH,
      confidence: 0.91,
      reasons: aralFails.map(
        (item) => `${item.subject} below ${PASSING_GRADE} (${item.grade})`
      ),
      generatedAt,
    };
  }

  if (hasOtherFail) {
    const otherFails = failingSubjects.filter(
      (item) => !ARAL_SUBJECTS.has(normalizeSubjectName(item.subject))
    );
    return {
      recommendationType: RECOMMENDATION.REMEDIATION,
      riskLevel: RISK_LEVEL.MODERATE,
      confidence: 0.86,
      reasons: otherFails.map(
        (item) => `${item.subject} below ${PASSING_GRADE} (${item.grade})`
      ),
      generatedAt,
    };
  }

  const hasAnyGrade = subjectGrades.some(
    (row) => toNumber(row.finalGrade ?? row.grade ?? row.final_grade) !== null
  );

  return {
    recommendationType: RECOMMENDATION.NONE,
    riskLevel: RISK_LEVEL.LOW,
    confidence: hasAnyGrade ? 0.8 : 0.45,
    reasons: hasAnyGrade
      ? [`All available subject grades are ${PASSING_GRADE} or above`]
      : ["No graded subjects available yet"],
    generatedAt,
  };
}
