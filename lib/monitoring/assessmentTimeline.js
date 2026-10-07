/**
 * assessmentTimeline.js
 * Enforces the strict BEG/MID/END term logic for ARAL Reading Intervention.
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
