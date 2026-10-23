import test from "node:test";
import assert from "node:assert/strict";

import {
  TREND_SUBJECTS,
  TREND_SUBJECT_MAP,
  TREND_FEATURE_NAMES,
  normalizeTrendSubject,
  extractQuarterGradeMap,
  findDuplicateCanonicalSubjects,
  verifyAndBuildTrendFeatures,
} from "../lib/services/recommendation/trendFeatures.js";

// Helper to generate a full set of 8 subject grades for a term
function makeTermGrades(quarter, baseGrades = {}) {
  const defaults = {
    english: 85,
    filipino: 88,
    mathematics: 82,
    science: 84,
    araling_panlipunan: 86,
    mapeh: 89,
    tle: 90,
    values_education: 91,
  };
  const merged = { ...defaults, ...baseGrades };
  return Object.entries(merged).map(([subject, final_grade]) => ({
    subject_name: subject,
    quarter,
    final_grade,
  }));
}

test("1. Trend Subject Mapping & Aliases: exactly matches Checkpoint 1 training encoding", () => {
  assert.equal(TREND_SUBJECTS.length, 8);
  assert.equal(TREND_SUBJECT_MAP.english, 0);
  assert.equal(TREND_SUBJECT_MAP.filipino, 1);
  assert.equal(TREND_SUBJECT_MAP.mathematics, 2);
  assert.equal(TREND_SUBJECT_MAP.science, 3);
  assert.equal(TREND_SUBJECT_MAP.araling_panlipunan, 4);
  assert.equal(TREND_SUBJECT_MAP.mapeh, 5);
  assert.equal(TREND_SUBJECT_MAP.tle, 6);
  assert.equal(TREND_SUBJECT_MAP.values_education, 7);

  // Test aliases
  assert.equal(normalizeTrendSubject("Math"), "mathematics");
  assert.equal(normalizeTrendSubject("mathematics"), "mathematics");
  assert.equal(normalizeTrendSubject("Science"), "science");
  assert.equal(normalizeTrendSubject("English"), "english");
  assert.equal(normalizeTrendSubject("Filipino"), "filipino");
  assert.equal(normalizeTrendSubject("Araling Panlipunan"), "araling_panlipunan");
  assert.equal(normalizeTrendSubject("AP"), "araling_panlipunan");
  assert.equal(normalizeTrendSubject("MAPEH"), "mapeh");
  assert.equal(normalizeTrendSubject("TLE"), "tle");
  assert.equal(normalizeTrendSubject("Values Education"), "values_education");
  assert.equal(normalizeTrendSubject("EsP"), "values_education");
  assert.equal(normalizeTrendSubject("Astronomy"), null);
});

test("2. Feature Builder for Term 1 -> Term 2: exact 9 features with zero prior velocity", () => {
  const grades = makeTermGrades(1, { mathematics: 80 });
  const result = verifyAndBuildTrendFeatures({
    learnerId: "std-001",
    subjectIdentifier: "Math",
    currentTerm: 1,
    gradesRecords: grades,
    ecrTermSheets: [{ term: 1, status: "published" }],
  });

  assert.equal(result.eligible, true);
  assert.equal(result.subject, "mathematics");
  assert.equal(result.subjectCode, 2);
  assert.equal(result.currentTerm, 1);
  assert.equal(result.targetTerm, 2);

  const feat = result.features;
  // All 9 features must be present
  assert.deepEqual(Object.keys(feat), TREND_FEATURE_NAMES);

  assert.equal(feat.feat_subject_code, 2);
  assert.equal(feat.feat_current_subject_grade, 80);
  // GWA: (85+88+80+84+86+89+90+91)/8 = 693 / 8 = 86.625 -> 86.63
  assert.equal(feat.feat_current_term_gwa, 86.63);
  assert.equal(feat.feat_current_relative_standing, Number((80 - 86.63).toFixed(2)));
  assert.equal(feat.feat_current_failing_count, 0);
  assert.equal(feat.feat_current_lowest_grade, 80);
  // Strict requirement: Term 1 must have 0 velocity
  assert.equal(feat.feat_has_prior_term, 0.0);
  assert.equal(feat.feat_prior_subject_grade_delta, 0.0);
  assert.equal(feat.feat_prior_gwa_delta, 0.0);
});

test("3. Feature Builder for Term 2 -> Term 3: derives velocity from verified Term 1 and Term 2", () => {
  const gradesT1 = makeTermGrades(1, { science: 78 }); // T1 science = 78
  const gradesT2 = makeTermGrades(2, { science: 84 }); // T2 science = 84 (delta = +6.0)

  const result = verifyAndBuildTrendFeatures({
    learnerId: "std-002",
    subjectIdentifier: "science",
    currentTerm: 2,
    gradesRecords: [...gradesT1, ...gradesT2],
    ecrTermSheets: [
      { term: 1, status: "published" },
      { term: 2, status: "published" },
    ],
  });

  assert.equal(result.eligible, true);
  assert.equal(result.subject, "science");
  assert.equal(result.subjectCode, 3);
  assert.equal(result.currentTerm, 2);
  assert.equal(result.targetTerm, 3);

  const feat = result.features;
  assert.deepEqual(Object.keys(feat), TREND_FEATURE_NAMES);
  assert.equal(feat.feat_subject_code, 3);
  assert.equal(feat.feat_current_subject_grade, 84);
  assert.equal(feat.feat_has_prior_term, 1.0);
  assert.equal(feat.feat_prior_subject_grade_delta, 6.0); // 84 - 78
});

test("4. Term Boundary Safeguards: Term 3 and Term 4 are strictly rejected", () => {
  const grades = makeTermGrades(3);
  const resultT3 = verifyAndBuildTrendFeatures({
    learnerId: "std-003",
    subjectIdentifier: "english",
    currentTerm: 3,
    gradesRecords: grades,
  });
  assert.equal(resultT3.eligible, false);
  assert.match(resultT3.reason, /only supported for Term 1 → Term 2 and Term 2 → Term 3/i);

  const resultT4 = verifyAndBuildTrendFeatures({
    learnerId: "std-003",
    subjectIdentifier: "english",
    currentTerm: 4,
    gradesRecords: grades,
  });
  assert.equal(resultT4.eligible, false);
});

test("5. Completeness Guard: Missing required subject returns ineligible (never -1 sentinel)", () => {
  // Only 7 subjects (missing Filipino)
  const partialGrades = [
    { subject_name: "english", quarter: 1, final_grade: 85 },
    { subject_name: "mathematics", quarter: 1, final_grade: 80 },
    { subject_name: "science", quarter: 1, final_grade: 84 },
    { subject_name: "araling_panlipunan", quarter: 1, final_grade: 86 },
    { subject_name: "mapeh", quarter: 1, final_grade: 89 },
    { subject_name: "tle", quarter: 1, final_grade: 90 },
    { subject_name: "values_education", quarter: 1, final_grade: 91 },
  ];

  const result = verifyAndBuildTrendFeatures({
    learnerId: "std-004",
    subjectIdentifier: "english",
    currentTerm: 1,
    gradesRecords: partialGrades,
    ecrTermSheets: [{ term: 1, status: "published" }],
  });

  assert.equal(result.eligible, false);
  assert.deepEqual(result.missingSubjects, ["filipino"]);
  assert.match(result.reason, /Missing finalized published grades/i);
  // Must NOT produce features with -1
  assert.equal(result.features, undefined);
});

test("6. ECR Publication Guard: Draft / unpublished ECR sheets reject forecast", () => {
  const grades = makeTermGrades(1);
  const result = verifyAndBuildTrendFeatures({
    learnerId: "std-005",
    subjectIdentifier: "english",
    currentTerm: 1,
    gradesRecords: grades,
    ecrTermSheets: [{ term: 1, status: "draft" }], // Draft status
  });

  assert.equal(result.eligible, false);
  assert.match(result.reason, /draft \/ unpublished state in ECR/i);
});

test("7. Term 2 requires verified Term 1 records: missing Term 1 grades rejects forecast", () => {
  const gradesT2Only = makeTermGrades(2); // Only Term 2 grades, no Term 1
  const result = verifyAndBuildTrendFeatures({
    learnerId: "std-006",
    subjectIdentifier: "mathematics",
    currentTerm: 2,
    gradesRecords: gradesT2Only,
    ecrTermSheets: [{ term: 2, status: "published" }],
  });

  assert.equal(result.eligible, false);
  assert.match(result.reason, /Missing finalized published grades in prior Term 1/i);
});

test("8. MAPEH Component Resolution: averages components and rounds to official grade", () => {
  const gradesWithMapehComponents = [
    { subject_name: "english", quarter: 1, final_grade: 85 },
    { subject_name: "filipino", quarter: 1, final_grade: 85 },
    { subject_name: "mathematics", quarter: 1, final_grade: 85 },
    { subject_name: "science", quarter: 1, final_grade: 85 },
    { subject_name: "araling_panlipunan", quarter: 1, final_grade: 85 },
    { subject_name: "music_arts", quarter: 1, final_grade: 88 },
    { subject_name: "pe_health", quarter: 1, final_grade: 92 },
    { subject_name: "tle", quarter: 1, final_grade: 85 },
    { subject_name: "values_education", quarter: 1, final_grade: 85 },
  ];

  const qMap = extractQuarterGradeMap(gradesWithMapehComponents, 1);
  // (88 + 92) / 2 = 90
  assert.equal(qMap.mapeh, 90);

  const result = verifyAndBuildTrendFeatures({
    learnerId: "std-007",
    subjectIdentifier: "mapeh",
    currentTerm: 1,
    gradesRecords: gradesWithMapehComponents,
    ecrTermSheets: [{ term: 1, status: "published" }],
  });

  assert.equal(result.eligible, true);
  assert.equal(result.features.feat_subject_code, 5); // mapeh is 5
  assert.equal(result.features.feat_current_subject_grade, 90);
});

test("C1. Official DepEd long-form subject names resolve to the canonical subject", () => {
  assert.equal(normalizeTrendSubject("Technology and Livelihood Education"), "tle");
  assert.equal(normalizeTrendSubject("Edukasyon sa Pagpapakatao"), "values_education");
  assert.equal(normalizeTrendSubject("Aral Pan"), "araling_panlipunan");

  const grades = makeTermGrades(1);
  const tle = verifyAndBuildTrendFeatures({
    learnerId: "std-008",
    subjectIdentifier: "Technology and Livelihood Education",
    currentTerm: 1,
    gradesRecords: grades,
    ecrTermSheets: [{ term: 1, status: "published" }],
  });
  assert.equal(tle.eligible, true);
  assert.equal(tle.subject, "tle");
  assert.equal(tle.subjectCode, 6);
  assert.equal(tle.features.feat_subject_code, 6);

  const esp = verifyAndBuildTrendFeatures({
    learnerId: "std-009",
    subjectIdentifier: "Edukasyon sa Pagpapakatao",
    currentTerm: 1,
    gradesRecords: grades,
    ecrTermSheets: [{ term: 1, status: "published" }],
  });
  assert.equal(esp.eligible, true);
  assert.equal(esp.subject, "values_education");
  assert.equal(esp.subjectCode, 7);
});

test("C2. Ambiguous canonical grade records fail closed (no last-write-wins)", () => {
  const grades = makeTermGrades(1);
  const ambiguous = [
    ...grades,
    { subject_name: "english", quarter: 1, final_grade: 71, school_year: "2026-2027" },
  ];

  const duplicates = findDuplicateCanonicalSubjects(ambiguous, 1);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].canonicalKey, "english");
  assert.equal(duplicates[0].rows.length, 2);

  const result = verifyAndBuildTrendFeatures({
    learnerId: "std-010",
    subjectIdentifier: "english",
    currentTerm: 1,
    gradesRecords: ambiguous,
    ecrTermSheets: [{ term: 1, status: "published" }],
  });

  assert.equal(result.eligible, false);
  assert.match(result.reason, /Ambiguous subject records detected/i);
  assert.deepEqual(result.duplicateSubjects, ["english"]);
  assert.equal(result.features, undefined);
});

test("C3. Nine-feature model input contract is unchanged for Term 2 -> Term 3", () => {
  const gradesT1 = makeTermGrades(1, { mathematics: 80 });
  const gradesT2 = makeTermGrades(2, { mathematics: 86 });

  const result = verifyAndBuildTrendFeatures({
    learnerId: "std-011",
    subjectIdentifier: "Mathematics",
    currentTerm: 2,
    gradesRecords: [...gradesT1, ...gradesT2],
    ecrTermSheets: [
      { term: 1, status: "published" },
      { term: 2, status: "published" },
    ],
  });

  assert.equal(result.eligible, true);
  assert.deepEqual(Object.keys(result.features), TREND_FEATURE_NAMES);
  assert.deepEqual(result.featureNames, TREND_FEATURE_NAMES);

  const feat = result.features;
  assert.equal(feat.feat_subject_code, 2);
  assert.equal(feat.feat_current_subject_grade, 86);
  // (85+88+86+84+86+89+90+91)/8 = 699/8 = 87.375 -> 87.38
  assert.equal(feat.feat_current_term_gwa, 87.38);
  assert.equal(feat.feat_current_relative_standing, Number((86 - 87.38).toFixed(2)));
  assert.equal(feat.feat_current_failing_count, 0);
  assert.equal(feat.feat_current_lowest_grade, 84);
  assert.equal(feat.feat_has_prior_term, 1.0);
  assert.equal(feat.feat_prior_subject_grade_delta, 6.0);
  assert.equal(feat.feat_prior_gwa_delta, Number((87.38 - 86.63).toFixed(2)));
});
