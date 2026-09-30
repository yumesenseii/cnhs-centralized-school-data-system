/**
 * CNHS Junior High School Grade Levels (Grade 7 - 10).
 * Canonical source of truth for section management, class assignments, and grade filters.
 */

export const GRADE_LEVELS = [7, 8, 9, 10];

export const GRADE_OPTIONS = GRADE_LEVELS.map((grade) => ({
  value: String(grade),
  label: `Grade ${grade}`,
}));

export const GRADE_FILTER_OPTIONS = [
  "All Grades",
  ...GRADE_LEVELS.map((grade) => `Grade ${grade}`),
];

/**
 * Validate whether a numeric or string grade is an accepted CNHS grade level (7..10).
 * @param {string|number|null|undefined} grade
 * @returns {boolean}
 */
export function isValidGradeLevel(grade) {
  if (grade === null || grade === undefined || grade === "") return false;
  const n = Number(String(grade).replace(/\D/g, ""));
  return Number.isInteger(n) && GRADE_LEVELS.includes(n);
}
