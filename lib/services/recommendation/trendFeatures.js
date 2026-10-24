/**
 * Feature engineering for the Experimental Per-Subject Next-Term Trend Forecast.
 *
 * Checkpoint 2 Specifications:
 * - 8 Canonical subjects with strict integer encoding (0-7):
 *     0: english
 *     1: filipino
 *     2: mathematics
 *     3: science
 *     4: araling_panlipunan
 *     5: mapeh
 *     6: tle
 *     7: values_education
 *
 * - Exact 9-feature vector:
 *     1. feat_subject_code
 *     2. feat_current_subject_grade
 *     3. feat_current_term_gwa
 *     4. feat_current_relative_standing
 *     5. feat_current_failing_count
 *     6. feat_current_lowest_grade
 *     7. feat_has_prior_term
 *     8. feat_prior_subject_grade_delta
 *     9. feat_prior_gwa_delta
 *
 * - Safety & Isolation:
 *     - No -1 sentinels for missing evidence. Missing evidence fails closed (eligible: false).
 *     - Term 1: zero prior velocity.
 *     - Term 2: velocity derived from verified Term 1 and Term 2 records.
 *     - Term 3+: unsupported.
 *     - Must match ml-service/scripts/train_trend_model.py exactly.
 */

import { resolveOfficialMapehGrade } from "./features.js";

export const TREND_SUBJECTS = [
  "english",
  "filipino",
  "mathematics",
  "science",
  "araling_panlipunan",
  "mapeh",
  "tle",
  "values_education",
];

export const TREND_SUBJECT_MAP = Object.freeze({
  english: 0,
  filipino: 1,
  mathematics: 2,
  science: 3,
  araling_panlipunan: 4,
  mapeh: 5,
  tle: 6,
  values_education: 7,
});

export const TREND_SUBJECT_LABELS = Object.freeze({
  english: "English",
  filipino: "Filipino",
  mathematics: "Mathematics",
  science: "Science",
  araling_panlipunan: "Araling Panlipunan",
  mapeh: "MAPEH",
  tle: "Technology and Livelihood Education (TLE)",
  values_education: "Values Education / EsP",
});

/**
 * Source terms the trend model supports: Term 1 → Term 2 and Term 2 → Term 3.
 */
export const TREND_SUPPORTED_SOURCE_TERMS = Object.freeze([1, 2]);

/**
 * Grade quarters each source term legitimately consumes.
 *
 * - Term 1 → Term 2 requires a complete current-school-year Term 1.
 * - Term 2 → Term 3 requires a complete current-school-year Term 1 AND Term 2.
 *
 * Quarter 4 is the general average / final aggregate and is NEVER a grading term.
 */
export const TREND_REQUIRED_QUARTERS = Object.freeze({
  1: Object.freeze([1]),
  2: Object.freeze([1, 2]),
});

export const TREND_FEATURE_NAMES = [
  "feat_subject_code",
  "feat_current_subject_grade",
  "feat_current_term_gwa",
  "feat_current_relative_standing",
  "feat_current_failing_count",
  "feat_current_lowest_grade",
  "feat_has_prior_term",
  "feat_prior_subject_grade_delta",
  "feat_prior_gwa_delta",
];

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
  "araling_panlipunan": "araling_panlipunan",
  ap: "araling_panlipunan",
  tle: "tle",
  "values education": "values_education",
  "values_education": "values_education",
  values: "values_education",
  ve: "values_education",
  esp: "values_education",
  // Official DepEd long-form learning-area names.
  // These are already recognized by the ML service contract
  // (ml-service/app/longitudinal_contract.py -> normalize_subject_name),
  // so they are genuinely supported and were only missing on the JS side.
  "technology and livelihood education": "tle",
  "edukasyon sa pagpapakatao": "values_education",
  "aral pan": "araling_panlipunan",
  // MAPEH component aliases
  music_arts: "music_arts",
  pe_health: "pe_health",
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

export function normalizeTrendSubject(name = "") {
  const clean = String(name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (SUBJECT_ALIASES[clean]) return SUBJECT_ALIASES[clean];
  const compact = clean.replace(/[^a-z0-9]+/g, " ").trim();
  if (SUBJECT_ALIASES[compact]) return SUBJECT_ALIASES[compact];
  const under = clean.replace(/\s+/g, "_");
  if (SUBJECT_ALIASES[under]) return SUBJECT_ALIASES[under];
  return null;
}

/**
 * Single source of truth for the unsupported-subject message so the route and
 * the feature guard can never drift apart.
 */
export function describeUnsupportedTrendSubject(subjectIdentifier = "") {
  return `Subject '${subjectIdentifier}' is not supported for trend forecasting. Supported: ${TREND_SUBJECTS.join(", ")}.`;
}

/**
 * Read the subject display name of a grade row regardless of the shape the
 * caller used (flat column, nested `subject`, or nested `subjects` relation).
 */
function readGradeSubjectName(row = {}) {
  return (
    row.subject_name ??
    row.subjectName ??
    row.subject?.subject_name ??
    row.subjects?.subject_name ??
    row.subject ??
    ""
  );
}

/**
 * Detect subject records that resolve to the SAME canonical key within a term.
 *
 * extractQuarterGradeMap() is last-write-wins, so an ambiguous mapping must fail
 * closed instead of silently picking one arbitrary grade.
 *
 * Only the 8 canonical learning areas are considered: MAPEH components
 * (music_arts / pe_health) legitimately share a term with the consolidated
 * `mapeh` record and are consolidated by resolveOfficialMapehGrade().
 *
 * Ambiguity is scoped to a single school year: the same subject recorded in a
 * PRIOR school year is not a conflict, it is history.
 */
export function findDuplicateCanonicalSubjects(gradeRows = [], targetQuarter = 1) {
  const quarterRows = (gradeRows ?? []).filter((r) => {
    const q = Number(r.quarter ?? r.term ?? 0);
    return q === Number(targetQuarter);
  });

  const grouped = new Map();
  for (const row of quarterRows) {
    const subjectName = readGradeSubjectName(row);
    const canonicalKey = normalizeTrendSubject(subjectName);
    if (!canonicalKey || !TREND_SUBJECTS.includes(canonicalKey)) continue;

    if (!grouped.has(canonicalKey)) grouped.set(canonicalKey, []);
    grouped.get(canonicalKey).push({
      id: row.id ?? null,
      subjectId: row.subject_id ?? null,
      classId: row.class_id ?? null,
      schoolYear: row.school_year ?? row.schoolYear ?? null,
      subjectName: subjectName || null,
      finalGrade: row.final_grade ?? row.finalGrade ?? null,
    });
  }

  const duplicates = [];
  for (const [canonicalKey, rows] of grouped.entries()) {
    if (rows.length < 2) continue;

    const conflicting = rows.filter((row, index) =>
      rows.some(
        (other, otherIndex) =>
          otherIndex !== index && gradeRowsConflict(row, other)
      )
    );

    if (conflicting.length < 2) continue;

    const schoolYears = new Set(
      conflicting.map((row) => row.schoolYear ?? null)
    );
    duplicates.push({
      canonicalKey,
      schoolYear: schoolYears.size === 1 ? conflicting[0].schoolYear : null,
      rows: conflicting,
    });
  }

  return duplicates;
}

/**
 * Two grade rows conflict when they belong to the same school year.
 * A row without a school year cannot be proven to belong to a different year,
 * so it is treated as a conflict.
 */
function gradeRowsConflict(a = {}, b = {}) {
  if (!a.schoolYear || !b.schoolYear) return true;
  return a.schoolYear === b.schoolYear;
}

function parseGrade(val) {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

/**
 * Extract canonical 8-subject grade map for a specific quarter.
 * Handles MAPEH component consolidation if needed.
 */
export function extractQuarterGradeMap(gradeRows = [], targetQuarter = 1) {
  const quarterRows = (gradeRows ?? []).filter((r) => {
    const q = Number(r.quarter ?? r.term ?? 0);
    return q === Number(targetQuarter);
  });

  const rawMap = {};
  for (const row of quarterRows) {
    const subjName = readGradeSubjectName(row);
    const canonicalKey = normalizeTrendSubject(subjName);
    const grade = parseGrade(row.final_grade ?? row.finalGrade ?? row.grade ?? row.term_grade);
    if (!canonicalKey || grade === null) continue;
    rawMap[canonicalKey] = grade;
  }

  // Resolve MAPEH
  const mapehGrade = resolveOfficialMapehGrade(rawMap);

  const gradeMap = {};
  for (const key of TREND_SUBJECTS) {
    if (key === "mapeh") {
      if (mapehGrade !== null) gradeMap.mapeh = mapehGrade;
    } else if (rawMap[key] != null) {
      gradeMap[key] = rawMap[key];
    }
  }

  return gradeMap;
}

/**
 * Validate academic records and construct exact 9-feature vector.
 *
 * @param {object} params
 * @param {string} params.learnerId
 * @param {string} params.subjectIdentifier
 * @param {number|string} params.currentTerm - 1 or 2
 * @param {Array<object>} params.gradesRecords - Trusted grade rows from database
 * @param {Array<object>} [params.ecrTermSheets] - Optional workbook/sheet status records
 * @returns {object} { eligible: boolean, reason?: string, missingSubjects?: string[], features?: object, featureNames?: string[] }
 */
export function verifyAndBuildTrendFeatures({
  learnerId,
  subjectIdentifier,
  currentTerm,
  gradesRecords = [],
  ecrTermSheets = [],
  allowProvisional = false,
}) {
  const termNum = Number(currentTerm);

  // 1. Term Boundary: Only 1 or 2 are eligible
  if (termNum !== 1 && termNum !== 2) {
    return {
      eligible: false,
      reason: `Forecasting is only supported for Term 1 → Term 2 and Term 2 → Term 3 (requested Term ${currentTerm}).`,
    };
  }

  // 2. Target Subject Validation
  const canonicalSubject = normalizeTrendSubject(subjectIdentifier);
  if (!canonicalSubject || !(canonicalSubject in TREND_SUBJECT_MAP)) {
    return {
      eligible: false,
      reason: describeUnsupportedTrendSubject(subjectIdentifier),
    };
  }

  // 3. ECR Publication Status Verification
  const targetSheets = (ecrTermSheets ?? []).filter((s) => Number(s.term) === termNum);
  const draftSheet = targetSheets.find((s) => s.status === "draft");
  if (draftSheet && !allowProvisional) {
    return {
      eligible: false,
      reason: `Academic record for Term ${termNum} is in draft / unpublished state in ECR. Verified publication is required.`,
    };
  }

  // 4. Duplicate Canonical Subject Detection
  const duplicateFindings = [];
  for (const quarter of TREND_REQUIRED_QUARTERS[termNum] ?? []) {
    const duplicates = findDuplicateCanonicalSubjects(gradesRecords, quarter);
    if (duplicates.length > 0) duplicateFindings.push({ quarter, duplicates });
  }
  if (duplicateFindings.length > 0) {
    const detail = duplicateFindings
      .map(
        ({ quarter, duplicates }) =>
          `Term ${quarter}: ${duplicates
            .map((d) =>
              d.schoolYear ? `${d.canonicalKey} (${d.schoolYear})` : d.canonicalKey
            )
            .join(", ")}`
      )
      .join("; ");
    return {
      eligible: false,
      reason: `Ambiguous subject records detected (${detail}). Duplicate subject entries must be resolved before a next-term trend forecast can be produced.`,
      duplicateSubjects: [
        ...new Set(
          duplicateFindings.flatMap(({ duplicates }) =>
            duplicates.map((d) => d.canonicalKey)
          )
        ),
      ],
    };
  }

  // 5. Current Term Grade Extraction
  const currentGrades = extractQuarterGradeMap(gradesRecords, termNum);
  const curSubjectGrade = currentGrades[canonicalSubject];
  if (curSubjectGrade == null) {
    return {
      eligible: false,
      reason: `Cannot forecast next-term trend: no recorded grade found for ${
        TREND_SUBJECT_LABELS[canonicalSubject] || canonicalSubject
      } in Term ${termNum}.`,
    };
  }

  const missingInCurrent = TREND_SUBJECTS.filter((s) => currentGrades[s] == null);
  if (missingInCurrent.length > 0 && !allowProvisional) {
    const missingLabels = missingInCurrent.map((s) => TREND_SUBJECT_LABELS[s] || s);
    return {
      eligible: false,
      reason: `Cannot forecast next-term trend: missing finalized published grades in Term ${termNum} for: ${missingLabels.join(
        ", "
      )}. All 8 core subjects must have finalized, published grades.`,
      missingSubjects: missingInCurrent,
    };
  }

  const isProvisional = Boolean(draftSheet || missingInCurrent.length > 0);

  // Compute Current Term Metrics
  const curAllGrades =
    missingInCurrent.length === 0
      ? TREND_SUBJECTS.map((s) => currentGrades[s])
      : Object.values(currentGrades).filter((g) => g != null);
  const curGwa = Number(
    (curAllGrades.reduce((a, b) => a + b, 0) / curAllGrades.length).toFixed(2)
  );
  const curRelStanding = Number((curSubjectGrade - curGwa).toFixed(2));
  const curFailingCount = curAllGrades.filter((g) => g < 75).length;
  const curLowestGrade = Math.min(...curAllGrades);

  let hasPriorTerm = 0.0;
  let priorSubjectGradeDelta = 0.0;
  let priorGwaDelta = 0.0;

  // 6. Term 2 Transition: Prior term velocity
  if (termNum === 2) {
    const priorSheets = (ecrTermSheets ?? []).filter((s) => Number(s.term) === 1);
    const hasDraftPriorSheet = priorSheets.some((s) => s.status === "draft");
    const hasPublishedPriorSheet = priorSheets.some((s) => s.status === "published");

    const priorGrades = extractQuarterGradeMap(gradesRecords, 1);
    const priorSubjectGrade = priorGrades[canonicalSubject];
    const missingInPrior = TREND_SUBJECTS.filter((s) => priorGrades[s] == null);

    if (
      (!hasDraftPriorSheet && hasPublishedPriorSheet && missingInPrior.length === 0) ||
      (allowProvisional && priorSubjectGrade != null)
    ) {
      const priorAll = Object.values(priorGrades).filter((g) => g != null);
      const priorGwa = Number(
        (priorAll.reduce((a, b) => a + b, 0) / priorAll.length).toFixed(2)
      );

      hasPriorTerm = 1.0;
      priorSubjectGradeDelta = Number(
        (curSubjectGrade - priorSubjectGrade).toFixed(2)
      );
      priorGwaDelta = Number((curGwa - priorGwa).toFixed(2));
    } else {
      hasPriorTerm = 0.0;
      priorSubjectGradeDelta = 0.0;
      priorGwaDelta = 0.0;
    }
  }

  const subjectCode = TREND_SUBJECT_MAP[canonicalSubject];

  const features = {
    feat_subject_code: subjectCode,
    feat_current_subject_grade: curSubjectGrade,
    feat_current_term_gwa: curGwa,
    feat_current_relative_standing: curRelStanding,
    feat_current_failing_count: curFailingCount,
    feat_current_lowest_grade: curLowestGrade,
    feat_has_prior_term: hasPriorTerm,
    feat_prior_subject_grade_delta: priorSubjectGradeDelta,
    feat_prior_gwa_delta: priorGwaDelta,
  };

  return {
    eligible: true,
    subject: canonicalSubject,
    subjectCode,
    currentTerm: termNum,
    targetTerm: termNum + 1,
    currentGrade: curSubjectGrade,
    isProvisional,
    features,
    featureNames: TREND_FEATURE_NAMES,
  };
}
