/**
 * Feature engineering for the Academic Prediction (Random Forest) module.
 *
 * Model B (PRODUCTION):
 * - Risk LABELS use official GWA grade bands (computed separately).
 * - RF INPUTS exclude general_average (no target leakage).
 * - Official subject grades only (final / transmuted), not raw WW/PT/QA.
 * - MAPEH uses consolidated official grade only (not Music/Arts/PE/Health).
 * - Attendance / SF2 never appears in this vector.
 *
 * Keep aligned with ml-service/app/feature_contract.py.
 */

/** Canonical RF subject keys (8 CNHS subjects). */
const FEATURE_SUBJECTS = [
  "english",
  "filipino",
  "mathematics",
  "science",
  "mapeh",
  "araling_panlipunan",
  "tle",
  "values_education",
];

/**
 * Map display / ECR names → canonical keys.
 * MAPEH components map to intermediate keys used only for consolidation.
 */
const SUBJECT_ALIASES = {
  english: "english",
  eng: "english",
  filipino: "filipino",
  fil: "filipino",
  mathematics: "mathematics",
  math: "mathematics",
  maths: "mathematics",
  science: "science",
  sci: "science",
  mapeh: "mapeh",
  "araling panlipunan": "araling_panlipunan",
  ap: "araling_panlipunan",
  tle: "tle",
  "values education": "values_education",
  values: "values_education",
  ve: "values_education",
  // CNHS MAPEH components — NOT RF features
  "music and arts": "music_arts",
  "music & arts": "music_arts",
  "music & art": "music_arts",
  ma: "music_arts",
  music: "music",
  arts: "arts",
  art: "arts",
  "pe and health": "pe_health",
  "pe & health": "pe_health",
  peh: "pe_health",
  pe: "pe",
  "physical education": "pe",
  health: "health",
};

/** Keys that must never become separate RF subject features. */
const MAPEH_COMPONENT_KEYS = new Set([
  "music_arts",
  "music",
  "arts",
  "pe_health",
  "pe",
  "health",
]);

/** Model B RF feature names — must match Python FEATURE_NAMES exactly. */
export const RF_FEATURE_NAMES = [
  "english_grade",
  "filipino_grade",
  "mathematics_grade",
  "science_grade",
  "mapeh_grade",
  "araling_panlipunan_grade",
  "tle_grade",
  "values_education_grade",
  "failing_subject_count",
  "language_fail_count",
  "non_language_fail_count",
  "lowest_grade",
  "available_grade_count",
];

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeSubjectKey(name = "") {
  const key = String(name).trim().toLowerCase().replace(/\s+/g, " ");
  if (SUBJECT_ALIASES[key]) return SUBJECT_ALIASES[key];
  const compact = key.replace(/[^a-z0-9]+/g, " ").trim();
  if (SUBJECT_ALIASES[compact]) return SUBJECT_ALIASES[compact];
  return key.replace(/\s+/g, "_");
}

/**
 * CNHS MAPEH: Music&Arts + PE&Health → average → round → official MAPEH.
 * Prefer an existing official mapeh grade when present.
 */
export function resolveOfficialMapehGrade(rawMap = {}) {
  if (rawMap.mapeh != null && Number.isFinite(Number(rawMap.mapeh))) {
    return Number(rawMap.mapeh);
  }

  let ma = toNumber(rawMap.music_arts);
  if (ma === null) {
    const music = toNumber(rawMap.music);
    const arts = toNumber(rawMap.arts);
    if (music !== null && arts !== null) ma = (music + arts) / 2;
    else if (music !== null) ma = music;
    else if (arts !== null) ma = arts;
  }

  let peh = toNumber(rawMap.pe_health);
  if (peh === null) {
    const pe = toNumber(rawMap.pe);
    const health = toNumber(rawMap.health);
    if (pe !== null && health !== null) peh = (pe + health) / 2;
    else if (pe !== null) peh = pe;
    else if (health !== null) peh = health;
  }

  if (ma !== null && peh !== null) return Math.round((ma + peh) / 2);
  if (ma !== null) return Math.round(ma);
  if (peh !== null) return Math.round(peh);
  return null;
}

/**
 * @param {object} student — academic payload (`subjectGrades` required)
 */
export function buildFeatureVector(student = {}) {
  const subjectGrades = Array.isArray(student.subjectGrades)
    ? student.subjectGrades
    : [];

  const rawMap = {};
  for (const row of subjectGrades) {
    const subject = normalizeSubjectKey(row.subjectName ?? row.subject ?? "");
    const grade = toNumber(row.finalGrade ?? row.grade ?? row.final_grade);
    if (!subject || grade === null) continue;
    rawMap[subject] = grade;
  }

  const mapeh = resolveOfficialMapehGrade(rawMap);

  // Official 8-subject map for RF / GWA helpers (exclude MAPEH components).
  const subjectGradeMap = {};
  for (const key of FEATURE_SUBJECTS) {
    if (key === "mapeh") {
      if (mapeh !== null) subjectGradeMap.mapeh = mapeh;
      continue;
    }
    if (rawMap[key] != null) subjectGradeMap[key] = rawMap[key];
  }

  const grades = FEATURE_SUBJECTS.map((k) => subjectGradeMap[k]).filter(
    (g) => g !== null && g !== undefined && Number.isFinite(Number(g))
  );
  const availableGradeCount = grades.length;
  const generalAverage =
    availableGradeCount > 0
      ? grades.reduce((sum, g) => sum + g, 0) / availableGradeCount
      : null;

  const failingSubjects = FEATURE_SUBJECTS.filter(
    (subject) =>
      subjectGradeMap[subject] != null && Number(subjectGradeMap[subject]) < 75
  );

  const languageFailCount = failingSubjects.filter((s) =>
    ["english", "filipino"].includes(s)
  ).length;
  const nonLanguageFailCount = failingSubjects.length - languageFailCount;
  const lowestGrade = grades.length ? Math.min(...grades) : null;

  const featureVector = {
    english_grade: subjectGradeMap.english ?? null,
    filipino_grade: subjectGradeMap.filipino ?? null,
    mathematics_grade: subjectGradeMap.mathematics ?? null,
    science_grade: subjectGradeMap.science ?? null,
    mapeh_grade: subjectGradeMap.mapeh ?? null,
    araling_panlipunan_grade: subjectGradeMap.araling_panlipunan ?? null,
    tle_grade: subjectGradeMap.tle ?? null,
    values_education_grade: subjectGradeMap.values_education ?? null,
    failing_subject_count: failingSubjects.length,
    language_fail_count: languageFailCount,
    non_language_fail_count: nonLanguageFailCount,
    lowest_grade: lowestGrade,
    available_grade_count: availableGradeCount,
  };

  const featureNames = [...RF_FEATURE_NAMES];
  const featureList = featureNames.map((name) => {
    const value = featureVector[name];
    return value === null || value === undefined ? -1 : Number(value);
  });

  return {
    featureVector,
    featureList,
    featureNames,
    generalAverage,
    subjectGradeMap,
    availableGradeCount,
    failingSubjects,
    mapehComponentsExcluded: [...MAPEH_COMPONENT_KEYS],
  };
}

export { FEATURE_SUBJECTS, MAPEH_COMPONENT_KEYS };
