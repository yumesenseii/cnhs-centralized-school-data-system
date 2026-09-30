/**
 * Centralized subject capability policy for recommendations (aligned with RA 12028).
 *
 * Access and intervention visibility follow the assigned class subject.
 *
 * - English / Filipino / Mathematics / Science → ARAL Program eligible (RA 12028)
 * - All subjects → Classroom Remediation eligible
 */

import { RECOMMENDATION } from "@/lib/monitoring/recommendations";

const ARAL_ELIGIBLE_SUBJECTS = new Set([
  "english",
  "filipino",
]);

/** Aliases that may appear in E-Class / subject rows. */
const SUBJECT_ALIASES = {
  eng: "english",
  en: "english",
  fil: "filipino",
  filipino: "filipino",
  english: "english",
  math: "mathematics",
  mathematics: "mathematics",
  sci: "science",
  science: "science",
  ap: "araling_panlipunan",
  "araling panlipunan": "araling_panlipunan",
  tle: "tle",
  mapeh: "mapeh",
  esp: "values_education",
  "values education": "values_education",
};

/**
 * Normalize a subject name for capability checks.
 * @param {string|null|undefined} subjectName
 * @returns {string}
 */
export function normalizeSubjectName(subjectName = "") {
  const raw = String(subjectName ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  if (!raw) return "";
  if (SUBJECT_ALIASES[raw]) return SUBJECT_ALIASES[raw];

  // Collapse common punctuation variants.
  const compact = raw.replace(/[^a-z0-9]+/g, " ").trim();
  if (SUBJECT_ALIASES[compact]) return SUBJECT_ALIASES[compact];

  return compact || raw;
}

/**
 * @param {string|null|undefined} subjectName
 * @returns {boolean}
 */
export function isAralEligibleSubject(subjectName) {
  const key = normalizeSubjectName(subjectName);
  return ARAL_ELIGIBLE_SUBJECTS.has(key);
}

/**
 * Classroom Remedial is available for every subject offering.
 * @param {string|null|undefined} _subjectName
 * @returns {boolean}
 */
export function isClassroomRemedialEligibleSubject(_subjectName) {
  return true;
}

/**
 * Student-level recommendation types allowed for a class subject.
 *
 * @param {string|null|undefined} subjectName
 * @returns {string[]}
 */
export function allowedStudentRecommendationsForSubject(subjectName) {
  if (isAralEligibleSubject(subjectName)) {
    return [RECOMMENDATION.ARAL, RECOMMENDATION.REMEDIATION, RECOMMENDATION.NONE];
  }
  return [RECOMMENDATION.REMEDIATION, RECOMMENDATION.NONE];
}

/**
 * Capability snapshot for a class subject.
 * @param {string|null|undefined} subjectName
 */
export function getSubjectCapabilities(subjectName) {
  const aralEligible = isAralEligibleSubject(subjectName);
  return {
    subjectKey: normalizeSubjectName(subjectName),
    subjectName: subjectName ?? null,
    aralEligible,
    classroomRemedialEligible: isClassroomRemedialEligibleSubject(subjectName),
    allowedStudentRecommendations:
      allowedStudentRecommendationsForSubject(subjectName),
  };
}

export { ARAL_ELIGIBLE_SUBJECTS };
