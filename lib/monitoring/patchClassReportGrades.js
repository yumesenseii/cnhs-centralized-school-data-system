/**
 * Patch monitoring roster rows after Class report Save, then re-predict
 * only the learners whose grades changed. Does not run full /predict_batch.
 */

import recommendationService from "@/lib/services/recommendationService";
import { parseRecordedGrade } from "@/lib/ecr/computeGrades";
import { isRecommendationFallback } from "@/lib/monitoring/recommendationSource";
import { normalizeSubjectName } from "@/lib/services/recommendation/subjectCapabilities";
import { applyRiskPredictionToLearner } from "@/lib/teacher/monitoringMappers";

function learnerKey(row = {}) {
  return `${row.studentId}|${row.schoolYear}|${row.quarterNumber}`;
}

function cloneLearner(row) {
  return {
    ...row,
    termGrades: { ...(row.termGrades || {}) },
    subjectGrades: (row.subjectGrades || []).map((g) => ({ ...g })),
  };
}

function setSubjectGrade(subjectGrades, subject, grade) {
  const key = normalizeSubjectName(subject);
  const next = [...subjectGrades];
  const idx = next.findIndex(
    (g) => normalizeSubjectName(g.subject ?? g.subjectName) === key
  );
  if (grade === null || grade === undefined) {
    if (idx >= 0) next.splice(idx, 1);
    return next;
  }
  if (idx >= 0) {
    next[idx] = { ...next[idx], grade };
    return next;
  }
  next.push({ subject, grade });
  return next;
}

/**
 * Apply saved class-report cells onto in-memory roster rows.
 * @returns {{ students: object[], dirtyKeys: Set<string> }}
 */
export function applyGradeUpdatesToStudents(
  students = [],
  { subject, classId, schoolYear, updates = [] } = {}
) {
  if (!updates.length) {
    return { students, dirtyKeys: new Set() };
  }

  const subjectKey = normalizeSubjectName(subject);
  const dirtyKeys = new Set();

  const nextStudents = students.map((row) => {
    let next = null;

    for (const update of updates) {
      if (update.student_id !== row.studentId) continue;
      if (
        schoolYear &&
        row.schoolYear &&
        update.school_year &&
        row.schoolYear !== update.school_year
      ) {
        continue;
      }

      const quarter = Number(update.quarter);
      const grade = parseRecordedGrade(update.final_grade);
      const sameClass =
        row.classId === update.class_id || row.classId === classId;
      const sameSubject = normalizeSubjectName(row.subject) === subjectKey;

      if (sameClass && sameSubject) {
        next = next || cloneLearner(row);
        next.termGrades[quarter] = grade;
      }

      if (Number(row.quarterNumber) === quarter) {
        next = next || cloneLearner(row);
        next.subjectGrades = setSubjectGrade(
          next.subjectGrades,
          subject,
          grade
        );
        dirtyKeys.add(learnerKey(next));
      }
    }

    if (!next) return row;
    return next;
  });

  return { students: nextStudents, dirtyKeys };
}

function fallbackPrediction() {
  return {
    recommendationType: null,
    riskLevel: null,
    confidence: null,
    probabilities: null,
    source: "rule-based-fallback",
    reasons: [],
    generatedAt: new Date().toISOString(),
  };
}

function honestPrediction(rec) {
  if (!rec) return fallbackPrediction();
  if (isRecommendationFallback(rec.source)) {
    return {
      ...rec,
      confidence: null,
      probabilities: null,
      source: rec.source || "rule-based-fallback",
    };
  }
  return rec;
}

/**
 * Re-score dirty roster rows via /predict or /predict-batch of those rows only.
 * Unique student+term → one RF call. Edited class gets full UI fields;
 * sibling classes only receive RF Priority fields (not ARAL/remediation).
 * ML down → grades-only fallback; Priority stays "—". Never throws.
 */
export async function repredictPatchedStudents(
  students = [],
  dirtyKeys,
  { classId = null, subject = null } = {}
) {
  const keys =
    dirtyKeys instanceof Set
      ? dirtyKeys
      : new Set(Array.isArray(dirtyKeys) ? dirtyKeys : []);
  if (!keys.size) return students;

  const subjectKey = normalizeSubjectName(subject);
  const isEditedClassRow = (row) =>
    (!classId || row.classId === classId) &&
    (!subjectKey || normalizeSubjectName(row.subject) === subjectKey);

  const preferred = new Map();
  for (const row of students) {
    const key = learnerKey(row);
    if (!keys.has(key)) continue;
    const prev = preferred.get(key);
    if (!prev || isEditedClassRow(row)) preferred.set(key, row);
  }
  const representatives = [...preferred.values()];
  if (!representatives.length) return students;

  const payloads = representatives.map((row) => ({
    id: row.studentId,
    subjectGrades: row.subjectGrades || [],
    schoolYear: row.schoolYear,
    quarter: row.quarterNumber,
    classId: row.classId,
    classSubject: row.subject,
  }));

  let recs = [];
  try {
    recs =
      payloads.length === 1
        ? [await recommendationService.generate(payloads[0])]
        : await recommendationService.generateBatch(payloads);
  } catch {
    recs = payloads.map(() => fallbackPrediction());
  }

  const predictions = new Map();
  representatives.forEach((row, index) => {
    predictions.set(learnerKey(row), honestPrediction(recs[index]));
  });

  return students.map((row) => {
    const rec = predictions.get(learnerKey(row));
    if (!rec) return row;
    if (isEditedClassRow(row)) {
      return applyRiskPredictionToLearner(row, rec);
    }
    return {
      ...row,
      recommendationSource: rec.source ?? null,
      recommendationProbabilities: rec.probabilities ?? null,
      recommendationConfidence: rec.confidence ?? null,
    };
  });
}
