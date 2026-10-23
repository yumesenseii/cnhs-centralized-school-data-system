import {
  isAcademicTermNumber,
  parseTermNumber,
} from "./termLabels.js";

/**
 * P0-04C â€” authoritative academic-term edit/import policy.
 *
 * CNHS uses Term 1â€“3 as the only academic grading terms. Quarter 4 is the
 * Final Grade / Average and is never editable as a grading term.
 *
 * The current term is school-level configuration. It is stored in the existing
 * admin-managed `system_settings` row `school_info` as `currentTerm`. We never
 * infer it from the calendar or from grades that happen to exist.
 *
 * Fail-safe: when the current term is not configured, every academic term is
 * locked for writing. Reads, exports and historical views keep working.
 */

export const ACADEMIC_TERM_SETTING_KEY = "academic.current_term";
export const SCHOOL_INFO_SETTING_KEY = "school_info";
export const ACADEMIC_TERMS = Object.freeze([1, 2, 3]);

/** Normalize a school year to the comparable `YYYY-YYYY` form. */
export function normalizeSchoolYear(value) {
  if (value === null || value === undefined) return null;
  let text = String(value).trim();
  if (!text) return null;
  text = text
    .replace(/^SY\s*/i, "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, "");
  return text || null;
}

export function schoolYearVariants(value) {
  const raw = normalizeSchoolYear(value);
  if (!raw) return [];
  return [...new Set([raw, `SY ${raw}`])];
}

export function areSameSchoolYear(a, b) {
  const left = normalizeSchoolYear(a);
  const right = normalizeSchoolYear(b);
  return Boolean(left && right && left === right);
}

/** Only Term 1â€“3 are academic grading terms. */
export function normalizeAcademicTerm(value) {
  const parsed = parseTermNumber(value);
  return isAcademicTermNumber(parsed) ? parsed : null;
}

/**
 * Read the configured term from the existing `school_info` value.
 * Accepts both `currentTerm` and the legacy `current_term` spelling.
 */
export function readConfiguredTerm(schoolInfo = {}) {
  const raw =
    schoolInfo?.currentTerm ??
    schoolInfo?.current_term ??
    schoolInfo?.gradingTerm ??
    null;
  return normalizeAcademicTerm(raw);
}

export function readConfiguredSchoolYear(schoolInfo = {}) {
  return normalizeSchoolYear(schoolInfo?.schoolYear ?? schoolInfo?.school_year);
}

/**
 * Resolve write access for one academic term.
 *
 * @param {object} input
 * @param {number|string} input.targetTerm
 * @param {number|string|null} input.currentTerm
 * @param {string|null} input.targetSchoolYear
 * @param {string|null} input.currentSchoolYear
 * @param {"draft"|"published"} [input.sheetStatus]
 * @returns {{
 *   allowed: boolean,
 *   editable: boolean,
 *   publishable: boolean,
 *   readonly: boolean,
 *   hidden: boolean,
 *   requiresPublishedConfirmation: boolean,
 *   code: string,
 *   message: string,
 * }}
 */
export function resolveTermAccess({
  targetTerm,
  currentTerm,
  targetSchoolYear = null,
  currentSchoolYear = null,
  sheetStatus = "draft",
} = {}) {
  const term = normalizeAcademicTerm(targetTerm);
  const active = normalizeAcademicTerm(currentTerm);
  const status = String(sheetStatus ?? "draft").toLowerCase();

  const base = {
    allowed: false,
    editable: false,
    publishable: false,
    readonly: true,
    hidden: false,
    requiresPublishedConfirmation: false,
    code: "locked",
    message: "This term is read-only.",
  };

  if (term === null) {
    return {
      ...base,
      code: "not_a_grading_term",
      message:
        "Quarter 4 is the Final Grade / Average, not an academic grading term. Publish it from the Summary (AVE).",
    };
  }

  if (active === null) {
    return {
      ...base,
      code: "current_term_unconfigured",
      message:
        "The current grading term is not configured. Ask the school administrator to set it before editing or importing grades.",
    };
  }

  if (
    targetSchoolYear &&
    currentSchoolYear &&
    !areSameSchoolYear(targetSchoolYear, currentSchoolYear)
  ) {
    return {
      ...base,
      code: "different_school_year",
      message: `This class belongs to ${normalizeSchoolYear(
        targetSchoolYear
      )}, which is not the active school year (${normalizeSchoolYear(
        currentSchoolYear
      )}). Historical school years are read-only.`,
    };
  }

  if (term < active) {
    return {
      ...base,
      code: "past_term_locked",
      message: `Term ${term} is read-only because Term ${active} is the current grading term. Past published terms may only be changed through an authorized correction workflow.`,
    };
  }

  if (term > active) {
    return {
      ...base,
      hidden: true,
      code: "future_term_locked",
      message: `Term ${term} is not open yet. The current grading term is Term ${active}.`,
    };
  }

  if (status === "published") {
    return {
      ...base,
      allowed: true,
      publishable: false,
      requiresPublishedConfirmation: true,
      code: "published_term_requires_confirmation",
      message: `Term ${term} is already published. Re-publishing requires an explicit correction confirmation and must not silently replace official grades.`,
    };
  }

  return {
    allowed: true,
    editable: true,
    publishable: true,
    readonly: false,
    hidden: false,
    requiresPublishedConfirmation: false,
    code: "current_term_editable",
    message: `Term ${term} is the current grading term and is editable.`,
  };
}

/** UI convenience: permissions for every academic term. */
export function buildTermAccessMap({
  currentTerm,
  currentSchoolYear = null,
  schoolYear = null,
  sheetStatuses = {},
} = {}) {
  const map = {};
  for (const term of ACADEMIC_TERMS) {
    map[term] = resolveTermAccess({
      targetTerm: term,
      currentTerm,
      targetSchoolYear: schoolYear,
      currentSchoolYear,
      sheetStatus: sheetStatuses[term] ?? "draft",
    });
  }
  return map;
}

/**
 * P0-04E — per-term publication policy (no global current-term dependency).
 *
 * Edit/import/publish authority comes from the class-subject-term itself:
 * the target class row (term, subject, school year, teacher) plus the status
 * of that term's ECR sheet. Any academic Term 1–3 with a draft sheet is
 * editable; published sheets are protected behind an explicit correction
 * confirmation; non-academic terms (Quarter 4) are never grading terms.
 *
 * This replaces the previous fail-closed global `school_info.currentTerm`
 * selector so teachers control which term they work on — while historical
 * (published) grades stay locked.
 *
 * @param {object} input
 * @param {number|string} input.term
 * @param {"draft"|"published"} [input.sheetStatus]
 * @returns {{
 *   allowed: boolean,
 *   editable: boolean,
 *   publishable: boolean,
 *   readonly: boolean,
 *   requiresCorrectionConfirmation: boolean,
 *   code: string,
 *   message: string,
 * }}
 */
export function resolveTermSheetAccess({ term, sheetStatus } = {}) {
  const termNumber = normalizeAcademicTerm(term);
  const base = {
    allowed: false,
    editable: false,
    publishable: false,
    readonly: true,
    requiresCorrectionConfirmation: false,
    code: "locked",
    message: "This term is read-only.",
  };

  if (termNumber === null) {
    return {
      ...base,
      code: "not_a_grading_term",
      message:
        "Quarter 4 is the Final Grade / Average, not an academic grading term. Publish it from the Summary (AVE).",
    };
  }

  const status = String(sheetStatus ?? "").toLowerCase();
  if (status !== "draft" && status !== "published") {
    return {
      ...base,
      code: "sheet_status_unknown",
      message:
        "This term sheet has an unknown status. Editing is locked until the E-Record can confirm its state.",
    };
  }

  if (status === "published") {
    return {
      ...base,
      allowed: true,
      requiresCorrectionConfirmation: true,
      code: "published_requires_correction",
      message: `Term ${termNumber} is already published. Changing published grades requires the authorized correction confirmation.`,
    };
  }

  return {
    allowed: true,
    editable: true,
    publishable: true,
    readonly: false,
    requiresCorrectionConfirmation: false,
    code: "draft_editable",
    message: `Term ${termNumber} is an editable draft. Review it before publishing.`,
  };
}

/** UI convenience: per-sheet access for every academic term. */
export function buildTermSheetAccessMap({ sheetStatuses = {} } = {}) {
  const map = {};
  for (const term of ACADEMIC_TERMS) {
    map[term] = resolveTermSheetAccess({
      term,
      sheetStatus: sheetStatuses[term] ?? undefined,
    });
  }
  return map;
}

/** True only when a term is both open and not already published. */
export function canWriteTerm(access) {
  return Boolean(access?.allowed && access?.editable);
}
