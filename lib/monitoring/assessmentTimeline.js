/**
 * assessmentTimeline.js
 * Academic timeline helpers and independent reading assessment period labels.
 *
 * Academic terms (Term 1–3) and ARAL assessment periods (BOSY/MOSY/EOSY)
 * are SEPARATE concepts. Reading periods are selected locally for entry or
 * oversight; they never follow academic terms or require school-wide activation.
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

/** Independent ARAL reading assessment periods. */
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

  // Never parse academic trimester terms as reading periods
  if (text.includes("TERM") || /^Q[1-4]$/.test(text) || text.includes("QUARTER")) {
    return null;
  }

  if (text === "BOSY" || text === "BEG" || text.startsWith("BEGINNING")) return "BOSY";
  if (text === "MOSY" || text === "MID" || text.startsWith("MIDDLE") || text.startsWith("MID-YEAR")) return "MOSY";
  if (text === "EOSY" || text === "END" || text.startsWith("END-OF-YEAR")) return "EOSY";
  return null;
}

export function aralPeriodLabel(period) {
  const norm = normalizeAralPeriod(period);
  return norm ? ARAL_PERIOD_LABELS[norm] : String(period || "—");
}

/** Short label without the code, e.g. "Beginning Assessment". */
export function aralPeriodShortLabel(period) {
  const norm = normalizeAralPeriod(period);
  if (!norm) return String(period || "—");
  const label = ARAL_PERIOD_LABELS[norm];
  return label.replace(/\s*\((BOSY|MOSY|EOSY)\)\s*$/, "");
}

/** All reading periods are available. Authentication and class permissions govern writes. */
export function getAralPeriodPermissions() {
  return Object.fromEntries(ARAL_PERIOD_ORDER.map((period) => [period, {
    hidden: false, editable: true, readonly: false,
  }]));
}

/** Valid reading periods can be edited independently of the selected view. */
export function isAralPeriodEditable(period) {
  return Boolean(normalizeAralPeriod(period));
}

/**
 * Facilitator scoring phases (pre/mid/post) mapped onto ARAL periods.
 * Display only — the stored phase values are unchanged.
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

/** Every recognized facilitator phase is writable by an authorized facilitator. */
export function isFacilitatorPhaseWritable(phase) {
  const period = aralPeriodForFacilitatorPhase(phase);
  if (!period) return false;
  return isAralPeriodEditable(period);
}

/**
 * Resolve the active ARAL period: strictly from explicit configuration or settings.
 * Academic terms must never dictate or fallback-drive reading assessment periods.
 */
export function resolveAralPeriod({ configuredPeriod = null } = {}) {
  const fromConfig = normalizeAralPeriod(configuredPeriod);
  if (fromConfig) return { period: fromConfig, source: "config" };
  return { period: null, source: "unconfigured" };
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

/**
 * Returns formatted Reading Assessment Period label (e.g. "Beginning Assessment (BOSY)").
 * Strictly separates reading period labels from academic term numbers.
 */
export function getAralTermDisplay(period) {
  const norm = normalizeAralPeriod(period);
  if (norm === "BOSY") return "Beginning Assessment (BOSY)";
  if (norm === "MOSY") return "Mid-Year Assessment (MOSY)";
  if (norm === "EOSY") return "End-of-Year Assessment (EOSY)";
  return String(period || "—");
}

