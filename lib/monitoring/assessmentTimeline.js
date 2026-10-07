/**
 * assessmentTimeline.js
 * Enforces the strict BEG/MID/END term logic for ARAL Reading Intervention.
 *
 * Academic terms (Term 1–3) and ARAL assessment periods (BOSY/MOSY/EOSY)
 * are SEPARATE concepts. The current ARAL period is authoritative system
 * configuration (system_settings → aral.assessment_period) — never inferred
 * from the academic term or calendar month.
 */

export const ASSESSMENT_TERMS = {
  TERM_1: "TERM_1",
  TERM_2: "TERM_2",
  TERM_3: "TERM_3"
};

export const ASSESSMENT_STAGES = {
  BEG: "BEG",
  MID: "MID",
  END: "END"
};

/** Authoritative ARAL assessment periods (school-wide, admin-configured). */
export const ARAL_ASSESSMENT_PERIODS = {
  BOSY: "BOSY",
  MOSY: "MOSY",
  EOSY: "EOSY",
};

/** Teacher-friendly period labels. */
export const ARAL_PERIOD_LABELS = {
  BOSY: "Beginning Assessment (BOSY)",
  MOSY: "Mid-Year Assessment (MOSY)",
  EOSY: "End-of-Year Assessment (EOSY)",
};

export const ARAL_PERIOD_ORDER = ["BOSY", "MOSY", "EOSY"];

/**
 * Normalize user/config input to BOSY | MOSY | EOSY (null when unknown).
 * Accepts long labels ("Beginning Assessment") and legacy aliases.
 */
export function normalizeAralPeriod(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().toUpperCase();
  if (!text) return null;
  if (text === "BOSY" || text.startsWith("BEGINNING")) return "BOSY";
  if (text === "MOSY" || text.startsWith("MID")) return "MOSY";
  if (text === "EOSY" || text === "END" || text.startsWith("END")) return "EOSY";
  return null;
}

export function aralPeriodLabel(period) {
  return ARAL_PERIOD_LABELS[normalizeAralPeriod(period)] || String(period || "—");
}

/** Short label without the code, e.g. "Beginning Assessment". */
export function aralPeriodShortLabel(period) {
  const label = aralPeriodLabel(period);
  return label.replace(/\s*\((BOSY|MOSY|EOSY)\)\s*$/, "");
}

/**
 * Single source of truth for ARAL assessment permissions by period.
 * HARD RULES:
 * - Past period: READ ONLY (historical, never editable)
 * - Current period: EDITABLE
 * - Future period: HIDDEN (never editable, never visible for entry)
 *
 * @param {string} currentPeriod - BOSY | MOSY | EOSY
 * @returns {{ BOSY: {hidden,editable,readonly}, MOSY: {...}, EOSY: {...} }}
 */
export function getAralPeriodPermissions(currentPeriod) {
  const normalized = normalizeAralPeriod(currentPeriod) || "BOSY";
  const currentIndex = ARAL_PERIOD_ORDER.indexOf(normalized);
  const permissions = {};
  ARAL_PERIOD_ORDER.forEach((period, index) => {
    if (index < currentIndex) {
      permissions[period] = { hidden: false, editable: false, readonly: true };
    } else if (index === currentIndex) {
      permissions[period] = { hidden: false, editable: true, readonly: false };
    } else {
      permissions[period] = { hidden: true, editable: false, readonly: true };
    }
  });
  return permissions;
}

/** True only when `period` is the editable current period. */
export function isAralPeriodEditable(period, currentPeriod) {
  const permissions = getAralPeriodPermissions(currentPeriod);
  return permissions[normalizeAralPeriod(period)]?.editable === true;
}

/**
 * Facilitator scoring phases (pre/mid/post) mapped onto ARAL periods.
 * Display and gating only — the stored phase values are unchanged.
 */
export const ARAL_FACILITATOR_PHASE_PERIOD = {
  pre: "BOSY",
  mid: "MOSY",
  post: "EOSY",
};

export function aralPeriodForFacilitatorPhase(phase) {
  if (!phase) return null;
  return ARAL_FACILITATOR_PHASE_PERIOD[String(phase).trim().toLowerCase()] ?? null;
}

/** Writable only when the phase's period is the current (editable) period. */
export function isFacilitatorPhaseWritable(phase, currentPeriod) {
  const period = aralPeriodForFacilitatorPhase(phase);
  if (!period) return false;
  return isAralPeriodEditable(period, currentPeriod);
}

/**
 * Resolve the active ARAL period: explicit config first; academic-term
 * mapping ONLY as a documented fallback (never month-based).
 */
export function resolveAralPeriod({ configuredPeriod = null, termNumber = null } = {}) {
  const fromConfig = normalizeAralPeriod(configuredPeriod);
  if (fromConfig) return { period: fromConfig, source: "config" };
  const term = Number(termNumber);
  if (term === 2) return { period: "MOSY", source: "term-fallback" };
  if (term >= 3) return { period: "EOSY", source: "term-fallback" };
  return { period: "BOSY", source: "default" };
}

/**
 * Returns the permissions for the assessment stages given an active term.
 * A HARD RULE defined by the system:
 * - Past assessment: READ ONLY
 * - Current assessment: EDITABLE
 * - Future assessment: HIDDEN
 * 
 * @param {string} activeTerm - One of the ASSESSMENT_TERMS values
 * @returns {Object} permissions indicating if a stage is hidden, editable, or read-only
 */
export function getAssessmentPermissions(activeTerm) {
  const permissions = {
    [ASSESSMENT_STAGES.BEG]: { hidden: true, editable: false, readonly: true },
    [ASSESSMENT_STAGES.MID]: { hidden: true, editable: false, readonly: true },
    [ASSESSMENT_STAGES.END]: { hidden: true, editable: false, readonly: true },
  };

  switch (activeTerm) {
    case ASSESSMENT_TERMS.TERM_1:
      permissions[ASSESSMENT_STAGES.BEG] = { hidden: false, editable: true, readonly: false };
      permissions[ASSESSMENT_STAGES.MID] = { hidden: true, editable: false, readonly: true };
      permissions[ASSESSMENT_STAGES.END] = { hidden: true, editable: false, readonly: true };
      break;

    case ASSESSMENT_TERMS.TERM_2:
      permissions[ASSESSMENT_STAGES.BEG] = { hidden: false, editable: false, readonly: true };
      permissions[ASSESSMENT_STAGES.MID] = { hidden: false, editable: true, readonly: false };
      permissions[ASSESSMENT_STAGES.END] = { hidden: true, editable: false, readonly: true };
      break;

    case ASSESSMENT_TERMS.TERM_3:
      permissions[ASSESSMENT_STAGES.BEG] = { hidden: false, editable: false, readonly: true };
      permissions[ASSESSMENT_STAGES.MID] = { hidden: false, editable: false, readonly: true };
      permissions[ASSESSMENT_STAGES.END] = { hidden: false, editable: true, readonly: false };
      break;
      
    default:
      // Default to hiding everything if term is unknown
      break;
  }

  return permissions;
}
