import { parseRecordedGrade } from "./computeGrades.js";

/**
 * P0-04C â€” grade write integrity helpers.
 *
 * These helpers are deliberately pure so they can be unit tested and reused by
 * every writer that touches public.grades. The central invariant is:
 *
 *   A null / blank / missing / invalid grade is NEVER written over a grade.
 *
 * Official grades live in public.grades. A blank uploaded value must preserve
 * the existing record instead of clearing it.
 */

export const GRADE_MIN = 0;
export const GRADE_MAX = 100;

/** Parse a recorded grade and verify it is a finite DepEd-scale value. */
export function parseValidGrade(value) {
  const parsed = parseRecordedGrade(value);
  if (parsed === null) return null;
  if (parsed < GRADE_MIN || parsed > GRADE_MAX) return null;
  return parsed;
}

export function isValidGrade(value) {
  return parseValidGrade(value) !== null;
}

export function isMissingGrade(value) {
  return parseRecordedGrade(value) === null;
}

/** Stable identity for a public.grades row. */
export function gradeKey(row = {}) {
  const studentId = row.student_id ?? row.studentId;
  const classId = row.class_id ?? row.classId;
  const subjectId = row.subject_id ?? row.subjectId;
  const quarter = Number(row.quarter);
  const schoolYear = row.school_year ?? row.schoolYear;
  if (!studentId || !classId || !subjectId) return null;
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) return null;
  if (!schoolYear) return null;
  return `${studentId}:${classId}:${subjectId}:${quarter}:${schoolYear}`;
}

/**
 * Classify an incoming grade against the currently stored grade.
 *
 * - new: no stored grade, valid incoming grade
 * - unchanged: same valid value (repeat import is idempotent)
 * - conflicting: stored grade differs from incoming
 * - preserved: incoming is blank/missing/invalid and a stored grade exists
 * - missing: incoming is blank/missing/invalid and nothing is stored
 * - invalid: incoming is present but outside 0â€“100
 */
export function classifyGradeChange({ incoming, existing } = {}) {
  const incomingParsed = parseRecordedGrade(incoming);
  const existingParsed = parseRecordedGrade(existing);
  const incomingValid = parseValidGrade(incoming);
  const existingValid = parseValidGrade(existing);

  if (incomingParsed === null) {
    return existingValid !== null ? "preserved" : "missing";
  }
  if (incomingValid === null) {
    return "invalid";
  }
  if (existingValid === null) {
    return "new";
  }
  return incomingValid === existingValid ? "unchanged" : "conflicting";
}

/**
 * Split grade rows into safe writes and skipped rows.
 *
 * Null/blank/invalid grades and malformed keys never reach Supabase. Duplicate
 * keys are rejected (ambiguous) instead of last-write-wins.
 */
export function partitionGradeWrites(rows = []) {
  const writable = [];
  const skipped = [];
  const duplicates = [];
  const seen = new Map();

  for (const row of rows ?? []) {
    const key = gradeKey(row);
    if (!key) {
      skipped.push({ row, reason: "invalid_key" });
      continue;
    }

    const grade = parseValidGrade(row.final_grade);
    if (grade === null) {
      skipped.push({
        row,
        reason: isMissingGrade(row.final_grade)
          ? "missing_grade"
          : "invalid_grade",
      });
      continue;
    }

    if (seen.has(key)) {
      const first = seen.get(key);
      if (first !== grade) {
        duplicates.push({ key, first, second: grade, row });
      }
      skipped.push({ row, reason: "duplicate_key" });
      continue;
    }

    seen.set(key, grade);
    writable.push({ ...row, final_grade: grade });
  }

  return { writable, skipped, duplicates };
}

/** Count the outcomes of a preview/import plan. */
export function summarizeGradeChanges(rows = []) {
  const summary = {
    new: 0,
    unchanged: 0,
    conflicting: 0,
    preserved: 0,
    missing: 0,
    invalid: 0,
  };
  for (const row of rows ?? []) {
    const change = row.changeType ?? row.change ?? classifyGradeChange(row);
    if (change in summary) summary[change] += 1;
  }
  return summary;
}

/**
 * Keys that a successful write touched. Used to build a compensating snapshot
 * for publication rollback.
 */
export function buildWriteKeys(rows = []) {
  return [...new Set((rows ?? []).map((row) => gradeKey(row)).filter(Boolean))];
}
