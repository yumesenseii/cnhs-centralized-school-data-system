/**
 * CNHS uses DepEd trimester Class Records / ECR:
 * Term 1–3 + Final Grade/Average (stored as DB `quarter` 1–4).
 * Keep DB integers; use these helpers for all UI labels.
 */

export const TERM_ALL_LABEL = "All Terms";
export const TERM_ALL_VALUE = "all";

/** Dropdown options for filters and forms (values match DB quarter 1–4). */
export const TERM_OPTIONS = [
  { value: "1", label: "Term 1" },
  { value: "2", label: "Term 2" },
  { value: "3", label: "Term 3" },
  { value: "4", label: "Final Grade / Average" },
];

/** Admin create: one assignment row per term (1–4). */
export const TERM_ALL_CREATE_OPTION = {
  value: TERM_ALL_VALUE,
  label: "All Terms (1–3 + Final)",
};

export const TERM_FORM_OPTIONS = [TERM_ALL_CREATE_OPTION, ...TERM_OPTIONS];

/**
 * @param {string|number|null|undefined} quarter
 * @returns {number|null} 1–4 or null
 */
export function parseTermNumber(quarter) {
  if (quarter === null || quarter === undefined || quarter === "") return null;
  if (typeof quarter === "number" && Number.isFinite(quarter)) {
    const n = Math.trunc(quarter);
    return n >= 1 && n <= 4 ? n : null;
  }
  const text = String(quarter).trim();
  if (!text) return null;

  const lower = text.toLowerCase();
  if (lower.includes("final") || lower.includes("average") || lower === "ave") {
    return 4;
  }

  const digits = text.replace(/\D/g, "");
  const n = Number(digits);
  if (Number.isFinite(n) && n >= 1 && n <= 4) return n;
  return null;
}

/**
 * Full UI label: Term 1 | Term 2 | Term 3 | Final Grade / Average
 * @param {string|number|null|undefined} quarter
 * @param {{ allLabel?: string }} [options]
 */
export function termLabel(quarter, options = {}) {
  if (
    quarter === null ||
    quarter === undefined ||
    quarter === "" ||
    quarter === TERM_ALL_VALUE
  ) {
    return options.allLabel ?? TERM_ALL_LABEL;
  }

  const n = parseTermNumber(quarter);
  if (n === 1) return "Term 1";
  if (n === 2) return "Term 2";
  if (n === 3) return "Term 3";
  if (n === 4) return "Final Grade / Average";

  const text = String(quarter).trim();
  if (/all\s*quarter/i.test(text) || /all\s*term/i.test(text)) {
    return options.allLabel ?? TERM_ALL_LABEL;
  }
  return text || (options.allLabel ?? TERM_ALL_LABEL);
}

/** Short chart/axis label: T1 | T2 | T3 | Final */
export function termShortLabel(quarter) {
  const n = parseTermNumber(quarter);
  if (n === 1) return "T1";
  if (n === 2) return "T2";
  if (n === 3) return "T3";
  if (n === 4) return "Final";
  return termLabel(quarter);
}

/** Legacy Q1-style short code still used in some keys — prefer termShortLabel for UI. */
export function termCode(quarter) {
  const n = parseTermNumber(quarter);
  if (n) return `T${n === 4 ? "F" : n}`;
  return "T1";
}

export function termFilterOptions(includeAll = true) {
  return includeAll
    ? [{ value: "", label: TERM_ALL_LABEL }, ...TERM_OPTIONS]
    : [...TERM_OPTIONS];
}

/**
 * Group key for collapsing All-Terms class cards.
 * @param {{ subject?: string, subjectId?: string, grade?: string, section?: string, schoolYear?: string }} item
 */
export function classTermGroupKey(item) {
  return [
    item.subjectId || item.subject || "",
    item.grade || "",
    item.section || "",
    item.schoolYear || "",
  ]
    .join("::")
    .toLowerCase();
}
