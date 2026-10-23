import { parseRecordedGrade } from "../ecr/computeGrades.js";
import {
  classifyGradeChange,
  isValidGrade,
  summarizeGradeChanges,
} from "../ecr/gradeIntegrity.js";
import {
  isAcademicTermNumber,
  parseTermNumber,
} from "../academic/termLabels.js";
import { normalizeSchoolYear } from "../academic/academicTermPolicy.js";

/**
 * P0-04C â€” pure helpers for safe, repeatable E-Class Record imports.
 *
 * Responsibilities:
 * - only the selected academic term is considered (cross-term isolation)
 * - only LRN/name/class-validated learners are written
 * - duplicate/ambiguous rows are rejected
 * - null / blank / partial rows preserve the existing record
 * - repeated identical imports are idempotent
 */

export function normalizeLrn(value) {
  return String(value ?? "").trim();
}

/**
 * The target class owns exactly one academic term. A Final Grade / Average
 * class cannot receive a component-level ECR import.
 */
export function resolveImportTargetTerm(classItem = {}) {
  const term = parseTermNumber(
    classItem?.quarter ??
      classItem?.currentQuarter ??
      classItem?.quarterLabel ??
      null
  );
  if (!isAcademicTermNumber(term)) {
    return {
      term: null,
      error: new Error(
        "Final Grade / Average is not an academic grading term. Open the Term 1, 2, or 3 class to import an E-Class Record, then publish the Final Grade from the Summary (AVE)."
      ),
    };
  }
  return { term, error: null };
}

/** Read only the selected term's grade. Never fall back to another term. */
export function readImportTermGrade(learner = {}, targetTerm) {
  const termGrades = learner?.term_grades ?? {};
  const direct =
    termGrades?.[targetTerm] ?? termGrades?.[String(targetTerm)] ?? null;
  const hasDirect =
    direct !== null &&
    direct !== undefined &&
    String(direct).trim() !== "";
  // An explicitly mapped other term must never supply this term's fallback grade.
  const quarterly = Object.keys(termGrades).length ? null : learner?.quarterly_grade ?? null;
  return parseRecordedGrade(hasDirect ? direct : quarterly);
}

/** Read only the selected term's component scores. */
export function readImportTermScores(learner = {}, targetTerm) {
  const all =
    learner?.component_scores?.[targetTerm] ??
    learner?.component_scores?.[String(targetTerm)] ??
    null;
  return all && typeof all === "object" ? all : null;
}

export function hasUsableScores(rawScores) {
  if (!rawScores || typeof rawScores !== "object") return false;
  return Object.values(rawScores).some(
    (value) => value !== "" && value !== null && value !== undefined
  );
}

function parseScore(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * A component row is importable only when every configured item has a valid
 * score. Partial rows are preserved instead of being recomputed into a lower
 * term grade from incomplete evidence.
 */
export function isCompleteScoreRow(rawScores, configRows = []) {
  if (!rawScores || typeof rawScores !== "object") return false;
  if (!configRows?.length) return false;
  for (const cfg of configRows) {
    const key = `${cfg.component}:${cfg.item_index}`;
    const score = parseScore(rawScores[key]);
    if (score === null) return false;
    const hps = Number(cfg.highest_possible_score);
    if (!Number.isFinite(hps) || hps <= 0) return false;
    if (score > hps) return false;
  }
  return true;
}

/** Only valid scores are written; blanks never clear an existing score. */
export function pickValidScores(rawScores, configRows = []) {
  const picked = {};
  for (const cfg of configRows) {
    const key = `${cfg.component}:${cfg.item_index}`;
    const score = parseScore(rawScores?.[key]);
    if (score === null) continue;
    const hps = Number(cfg.highest_possible_score);
    if (!Number.isFinite(hps) || hps <= 0 || score > hps) continue;
    picked[key] = score;
  }
  return picked;
}

/**
 * Build a preview/plan for the selected term.
 *
 * @param {object} input
 * @param {Array} input.learners parsed file rows (already matched to student ids)
 * @param {Array<string>} input.studentIds aligned student ids
 * @param {number} input.targetTerm 1â€“3
 * @param {Map<string, number>} [input.existingGradesByStudent]
 * @param {Set<string>} [input.publishedStudentIds]
 * @param {Map<string, number>} [input.uploadedLrnCounts]
 */
export function buildImportPlan({
  learners = [],
  studentIds = [],
  targetTerm,
  existingGradesByStudent = new Map(),
  publishedStudentIds = new Set(),
  uploadedLrnCounts = new Map(),
} = {}) {
  const rows = [];

  learners.forEach((learner, index) => {
    const studentId = studentIds[index] ?? null;
    const lrn = normalizeLrn(learner?.student_number);
    const duplicateRow = lrn ? (uploadedLrnCounts.get(lrn) ?? 0) > 1 : false;
    const incomingGrade = readImportTermGrade(learner, targetTerm);
    const existingGrade = studentId
      ? parseRecordedGrade(existingGradesByStudent.get(studentId))
      : null;
    const published = Boolean(studentId && publishedStudentIds.has(studentId));
    const changeType = classifyGradeChange({
      incoming: incomingGrade,
      existing: existingGrade,
    });

    let include = Boolean(studentId) && !duplicateRow;
    let reason = "";
    if (!studentId) {
      include = false;
      reason = "Learner is not matched to the official class list.";
    } else if (duplicateRow) {
      include = false;
      reason = "The same LRN appears more than once in the uploaded file.";
    } else if (changeType === "missing") {
      include = false;
      reason = "No grade in the uploaded file; the existing record is preserved.";
    } else if (changeType === "invalid") {
      include = false;
      reason = "The uploaded grade is not a valid 0â€“100 value; the existing record is preserved.";
    } else if (changeType === "preserved") {
      include = false;
      reason = "Blank/invalid upload; the existing official grade is preserved.";
    } else if (published && changeType === "conflicting") {
      include = false;
      reason =
        "This term is already published. The conflicting grade is preserved and requires an authorized correction.";
    }

    rows.push({
      index: index + 1,
      student_id: studentId,
      lrn,
      full_name: learner?.full_name ?? "",
      incomingGrade,
      existingGrade,
      published,
      changeType,
      include,
      reason,
    });
  });

  const counts = summarizeGradeChanges(rows);
  const importable = rows.filter((row) => row.include);

  return {
    rows,
    counts,
    importable,
    publishedConflicts: rows.filter(
      (row) => row.published && row.changeType === "conflicting"
    ),
    blocking: rows.filter(
      (row) => !row.include && row.changeType === "invalid"
    ),
    canImport: importable.length > 0,
    idempotent: importable.length === 0 && counts.unchanged > 0,
  };
}

/** Count duplicate LRNs in the uploaded file. */
export function countUploadedLrns(learners = []) {
  const counts = new Map();
  for (const learner of learners) {
    const lrn = normalizeLrn(learner?.student_number);
    if (!lrn) continue;
    counts.set(lrn, (counts.get(lrn) ?? 0) + 1);
  }
  return counts;
}

/**
 * Verify the teacher actually owns the class they are importing into.
 * Returns null when authorized, or an Error with a teacher-friendly message.
 */
export function verifyClassAssignment({
  classRow,
  classItem,
  teacherId,
  sessionTeacherId,
} = {}) {
  if (!classRow?.id) {
    return new Error("This class could not be found or is not assigned to you.");
  }

  const requestedTeacherId =
    teacherId ??
    classItem?.teacherId ??
    classItem?.teacher_id ??
    null;

  if (sessionTeacherId && classRow.teacher_id !== sessionTeacherId) {
    return new Error("You can only import records into classes assigned to you.");
  }
  if (requestedTeacherId && classRow.teacher_id !== requestedTeacherId) {
    return new Error("You can only import records into classes assigned to you.");
  }
  if (classItem?.id && classItem.id !== classRow.id) {
    return new Error("The selected class does not match this upload.");
  }

  const itemSubject =
    classItem?.subjectId ?? classItem?.subject_id ?? null;
  const itemSection =
    classItem?.sectionId ?? classItem?.section_id ?? null;
  const itemYear =
    classItem?.schoolYear ?? classItem?.school_year ?? null;

  if (itemSubject && classRow.subject_id !== itemSubject) {
    return new Error("The selected subject does not match this class.");
  }
  if (itemSection && classRow.section_id !== itemSection) {
    return new Error("The selected section does not match this class.");
  }
  if (
    itemYear &&
    normalizeSchoolYear(classRow.school_year) !== normalizeSchoolYear(itemYear)
  ) {
    return new Error("The selected school year does not match this class.");
  }

  return null;
}

/** True when a learner row is safe to link/accepted for import. */
export function isConfirmedLearner(learner) {
  return Boolean(
    learner?.included &&
      learner?.matchedStudent?.id &&
      learner?.status !== "WRONG_SECTION" &&
      learner?.status !== "UNMATCHED" &&
      learner?.status !== "AMBIGUOUS" &&
      learner?.status !== "DUPLICATE_ROW" &&
      learner?.changeType !== "invalid" &&
      !(learner?.published && learner?.changeType === "conflicting")
  );
}

export { isValidGrade };
