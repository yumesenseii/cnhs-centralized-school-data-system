/**
 * Feature engineering for the Academic Prediction (Random Forest) module.
 *
 * Builds a stable numeric feature map from ECR subject grades ONLY.
 * Risk predictions are based on academic performance (ECR grades) only.
 * Attendance / SF2 data must never appear in this vector — it belongs to the
 * separate Attendance Monitoring module.
 *
 * Keep this contract aligned with whatever trains / serves the model
 * (Python sklearn, FastAPI, Flask, ONNX, etc.).
 */

const SUBJECT_ALIASES = {
  english: "english",
  filipino: "filipino",
  mathematics: "mathematics",
  math: "mathematics",
  science: "science",
  mapeh: "mapeh",
  "araling panlipunan": "araling_panlipunan",
  ap: "araling_panlipunan",
  tle: "tle",
};

const FEATURE_SUBJECTS = [
  "english",
  "filipino",
  "mathematics",
  "science",
  "mapeh",
  "araling_panlipunan",
  "tle",
];

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeSubjectKey(name = "") {
  const key = String(name).trim().toLowerCase();
  return SUBJECT_ALIASES[key] ?? key.replace(/\s+/g, "_");
}

/**
 * @param {object} student — academic payload (`subjectGrades` required)
 * @returns {{
 *   featureVector: Record<string, number|null>,
 *   featureList: number[],
 *   featureNames: string[],
 *   subjectGradeMap: Record<string, number>,
 *   availableGradeCount: number,
 * }}
 */
export function buildFeatureVector(student = {}) {
  const subjectGrades = Array.isArray(student.subjectGrades)
    ? student.subjectGrades
    : [];

  const subjectGradeMap = {};
  for (const row of subjectGrades) {
    const subject = normalizeSubjectKey(row.subjectName ?? row.subject ?? "");
    const grade = toNumber(row.finalGrade ?? row.grade ?? row.final_grade);
    if (!subject || grade === null) continue;
    subjectGradeMap[subject] = grade;
  }

  const grades = Object.values(subjectGradeMap);
  const availableGradeCount = grades.length;
  const generalAverage =
    availableGradeCount > 0
      ? grades.reduce((sum, g) => sum + g, 0) / availableGradeCount
      : null;

  const failingSubjects = Object.entries(subjectGradeMap)
    .filter(([, grade]) => grade < 75)
    .map(([subject]) => subject);

  const languageFailCount = failingSubjects.filter((s) =>
    ["english", "filipino"].includes(s)
  ).length;
  const nonLanguageFailCount = failingSubjects.length - languageFailCount;
  const lowestGrade = grades.length ? Math.min(...grades) : null;

  // Academic-only features — do not add attendance_rate or SF2 fields here.
  const featureVector = {
    english_grade: subjectGradeMap.english ?? null,
    filipino_grade: subjectGradeMap.filipino ?? null,
    mathematics_grade: subjectGradeMap.mathematics ?? null,
    science_grade: subjectGradeMap.science ?? null,
    mapeh_grade: subjectGradeMap.mapeh ?? null,
    araling_panlipunan_grade: subjectGradeMap.araling_panlipunan ?? null,
    tle_grade: subjectGradeMap.tle ?? null,
    general_average: generalAverage,
    failing_subject_count: failingSubjects.length,
    language_fail_count: languageFailCount,
    non_language_fail_count: nonLanguageFailCount,
    lowest_grade: lowestGrade,
    available_grade_count: availableGradeCount,
  };

  // Dense list for ONNX / sklearn-style array inputs (null → -1 sentinel).
  const featureNames = Object.keys(featureVector);
  const featureList = featureNames.map((name) => {
    const value = featureVector[name];
    return value === null || value === undefined ? -1 : Number(value);
  });

  return {
    featureVector,
    featureList,
    featureNames,
    subjectGradeMap,
    availableGradeCount,
    failingSubjects,
  };
}

export { FEATURE_SUBJECTS };
