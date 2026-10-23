import { computeLearnerRow, termGradeDescription } from "./computeGrades.js";
import { parseValidGrade } from "./gradeIntegrity.js";
import { isCompleteScoreRow } from "../eclass/importIntegrity.js";

export function scoresByStudentFromRows(rows = []) {
  const scores = {};
  for (const row of rows) {
    if (row.raw_score == null || String(row.raw_score).trim() === "") continue;
    (scores[row.student_id] ||= {})[`${row.component}:${row.item_index}`] = String(row.raw_score);
  }
  return scores;
}

/** No scores are inferred from a final grade. A partial row is never a final calculation. */
export function resolveEcrLearnerResult({ scores = {}, config = [], saved = {}, officialGrades = [], published = false, useLiveCalculation = false } = {}) {
  const live = computeLearnerRow(scores, config);
  for (const component of ["WW", "PT", "QA"]) {
    const rows = config.filter((row) => row.component === component);
    if (!isCompleteScoreRow(scores, rows)) {
      live[`${component.toLowerCase()}_ps`] = null;
      live[`${component.toLowerCase()}_ws`] = null;
    }
  }
  const complete = isCompleteScoreRow(scores, config);
  const recorded = parseValidGrade(saved?.term_grade);
  const officialValues = [...new Set(officialGrades.map((row) => parseValidGrade(row.final_grade)).filter((grade) => grade !== null))];
  const official = officialValues.length === 1 ? officialValues[0] : null;
  const rawScoreCount = Object.values(scores).filter((score) => score != null && String(score).trim() !== "").length;
  const calculate = complete && !published && (recorded === null || useLiveCalculation);
  const termGrade = calculate ? live.term_grade : recorded ?? official;
  const source = calculate ? "assessment_scores" : recorded !== null ? "saved_ecr_grade" : official !== null ? "recorded_subject_grade" : "unavailable";
  return {
    ...(rawScoreCount ? live : saved),
    initial_grade: complete ? live.initial_grade : saved?.initial_grade ?? null,
    term_grade: termGrade,
    description: termGrade !== null ? termGradeDescription(termGrade) : "",
    rawScoreCount, completeAssessment: complete, gradeOnly: rawScoreCount === 0 && termGrade !== null,
    gradeSource: source, recorded_term_grade: recorded, official_grade: official,
    conflictingOfficialGrades: officialValues.length > 1,
  };
}

export function buildEcrTermView({ students = [], config = [], scoreRows = [], computedRows = [], officialGrades = [], status = "draft", useLiveCalculation: calculateLive = false } = {}) {
  const studentScores = scoresByStudentFromRows(scoreRows);
  const computed = new Map(computedRows.map((row) => [row.student_id, row]));
  const computedByStudent = {};
  const availability = { total: students.length, withAssessments: 0, completeAssessments: 0, withTermGrades: 0, gradeOnly: 0, partialAssessments: 0 };
  for (const student of students) {
    const result = resolveEcrLearnerResult({ scores: studentScores[student.id] || {}, config,
      saved: computed.get(student.id), officialGrades: officialGrades.filter((row) => row.student_id === student.id), published: status === "published",
      useLiveCalculation: typeof calculateLive === "function" ? calculateLive(student.id) : calculateLive });
    computedByStudent[student.id] = result;
    if (result.rawScoreCount) availability.withAssessments++;
    if (result.completeAssessment) availability.completeAssessments++;
    else if (result.rawScoreCount) availability.partialAssessments++;
    if (result.term_grade !== null) availability.withTermGrades++;
    if (result.gradeOnly) availability.gradeOnly++;
  }
  return { config, studentScores, computedByStudent, availability, status };
}

/** Resolve sibling workbook storage without copying or rewriting saved rows. */
export function selectEcrTermSource({ term, blocks = [], termClassId, baseClassId }) {
  const candidates = blocks.filter((block) => Number(block.termSheet.term) === Number(term));
  const hasEvidence = (block) => block.scores.some((row) => row.raw_score != null) || block.computed.some((row) => parseValidGrade(row.term_grade) !== null);
  const populated = candidates.filter(hasEvidence);
  const pool = populated.length ? populated : candidates;
  const selected = pool.find((block) => block.classId === termClassId) || pool.find((block) => block.classId === baseClassId) || pool[0] || null;
  // Competing saved sources remain visible in the export; do not silently pick one for editing.
  return { selected, conflicts: populated.length > 1 ? populated.map((block) => block.termSheet.id) : [] };
}
