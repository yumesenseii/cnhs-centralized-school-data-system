/**
 * P0-04B Track A — pure scoping tests for the next-term trend forecast.
 *
 * Run:
 *   node --no-warnings --loader ./scripts/alias-loader.mjs \
 *        scripts/test_p0_04b_trend_scope.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  TREND_REQUIRED_QUARTERS,
  TREND_SUPPORTED_SOURCE_TERMS,
  describePublicationEvidence,
  evaluatePublicationEvidence,
  matchesSchoolYear,
  resolveAuthorizedSchoolYear,
  resolveCanonicalSubject,
  resolveSubjectFamily,
  resolveTrendScope,
} from "../lib/services/recommendation/trendScope.js";
import {
  findDuplicateCanonicalSubjects,
  normalizeTrendSubject,
  verifyAndBuildTrendFeatures,
} from "../lib/services/recommendation/trendFeatures.js";
import {
  FORECAST_SUBJECT,
  FORECAST_SUBJECT_ID,
  LEARNER_ID,
  PRIOR_SCHOOL_YEAR,
  SCHOOL_YEAR,
  SECTION_ID,
  buildTrendFixture,
  classIdFor,
} from "./test-support/trend-fixtures.mjs";

test("S1. Term contract: Term 1 -> Term 2 needs Term 1, Term 2 -> Term 3 needs Term 1 + Term 2, quarter 4 is never a grading term", () => {
  assert.deepEqual([...TREND_SUPPORTED_SOURCE_TERMS], [1, 2]);
  assert.deepEqual([...TREND_REQUIRED_QUARTERS[1]], [1]);
  assert.deepEqual([...TREND_REQUIRED_QUARTERS[2]], [1, 2]);

  for (const term of TREND_SUPPORTED_SOURCE_TERMS) {
    const quarters = [...TREND_REQUIRED_QUARTERS[term]];
    assert.ok(!quarters.includes(4), "Quarter 4 must never be a grading term");
    assert.ok(quarters.includes(1), "Term 1 history is always required");
    assert.equal(quarters.at(-1), term);
  }
});

test("S2. School year: both 'SY 2026-2027' and '2026-2027' are supported and a client request is validated against the authorized context", () => {
  const prefixed = resolveAuthorizedSchoolYear({
    requestedSchoolYear: "SY 2026-2027",
    authorizedSchoolYears: ["2026-2027"],
  });
  const bare = resolveAuthorizedSchoolYear({
    requestedSchoolYear: "2026-2027",
    authorizedSchoolYears: ["SY 2026-2027"],
  });

  assert.equal(prefixed.requestedAccepted, true);
  assert.equal(bare.requestedAccepted, true);
  assert.equal(prefixed.raw, "2026-2027");
  assert.equal(bare.raw, "2026-2027");
  assert.deepEqual(prefixed.variants.sort(), bare.variants.sort());
  assert.ok(prefixed.variants.includes("SY 2026-2027"));
  assert.ok(prefixed.variants.includes("2026-2027"));

  // An arbitrary client supplied school year is NOT trusted.
  const arbitrary = resolveAuthorizedSchoolYear({
    requestedSchoolYear: "2019-2020",
    authorizedSchoolYears: ["2026-2027"],
    activeSchoolYear: "SY 2026-2027",
  });
  assert.equal(arbitrary.requestedAccepted, false);
  assert.equal(arbitrary.source, "authorized-context");
  assert.equal(arbitrary.raw, "2026-2027");

  // No authorized context at all: the request is only an unverified hint.
  const unverified = resolveAuthorizedSchoolYear({
    requestedSchoolYear: "2026-2027",
    authorizedSchoolYears: [],
  });
  assert.equal(unverified.source, "requested-unverified");
  assert.equal(unverified.requestedAccepted, false);

  // Format tolerant comparison.
  assert.equal(matchesSchoolYear("SY 2026-2027", ["2026-2027"]), true);
  assert.equal(matchesSchoolYear("2026-2027", ["SY 2026-2027"]), true);
  assert.equal(matchesSchoolYear("2025-2026", ["SY 2026-2027", "2026-2027"]), false);
});

test("S3. Prior school year exclusion: prior-SY class rows and grades never enter the current scope", () => {
  const fixture = buildTrendFixture();
  const scope = resolveTrendScope({
    requestedTerm: 1,
    subjectIdentifier: FORECAST_SUBJECT,
    requestedSchoolYear: SCHOOL_YEAR,
    activeSchoolYear: `SY ${SCHOOL_YEAR}`,
    sectionId: SECTION_ID,
    subjectRows: fixture.subjects,
    classRows: fixture.classes,
    gradeRows: fixture.grades,
    learnerSchoolYears: [SCHOOL_YEAR, PRIOR_SCHOOL_YEAR],
  });

  assert.equal(scope.schoolYear.raw, SCHOOL_YEAR);
  assert.ok(
    scope.family.classIds.every((id) => !id.includes(PRIOR_SCHOOL_YEAR)),
    "Prior school year class rows must be excluded from the class family"
  );
  assert.ok(
    scope.scopedGrades.every((grade) => grade.school_year === SCHOOL_YEAR),
    "Prior school year grades must be excluded from the scoped grades"
  );
  assert.ok(
    scope.scopedGrades.every((grade) => grade.quarter === 1),
    "Only the required grading quarters may be read"
  );
});

test("S4. Class family resolution spans every term row of the subject and excludes unrelated subjects", () => {
  const fixture = buildTrendFixture();
  const family = resolveSubjectFamily({
    subjectIds: [FORECAST_SUBJECT_ID],
    sectionId: SECTION_ID,
    schoolYearVariants: [`SY ${SCHOOL_YEAR}`, SCHOOL_YEAR],
    classRows: fixture.classes,
  });

  assert.deepEqual(family.quarters, [1, 2, 3, 4]);
  assert.equal(family.classIds.length, 4);
  for (const quarter of [1, 2, 3, 4]) {
    assert.ok(
      family.classIds.includes(classIdFor(FORECAST_SUBJECT_ID, SCHOOL_YEAR, quarter)),
      `Term ${quarter} class row must belong to the family`
    );
  }
  assert.ok(
    !family.classIds.includes(classIdFor("subj-filipino", SCHOOL_YEAR, 1)),
    "Unrelated subject class rows must not belong to the family"
  );
});

test("S5. Publication evidence: published / draft / missing stay distinct and missing is never proof of publication", () => {
  const published = evaluatePublicationEvidence({
    sheets: [{ id: "s1", term: 1, status: "published" }],
    requiredTerms: [1],
  });
  assert.equal(published.state, "published");
  assert.equal(published.missingTerms.length, 0);
  assert.equal(published.draftTerms.length, 0);

  const draft = evaluatePublicationEvidence({
    sheets: [{ id: "s1", term: 1, status: "draft" }],
    requiredTerms: [1, 2],
  });
  assert.equal(draft.state, "draft");
  assert.deepEqual(draft.draftTerms, [1]);
  assert.match(
    describePublicationEvidence(draft, { subjectLabel: "english" }),
    /draft \/ unpublished state/i
  );

  const missing = evaluatePublicationEvidence({
    sheets: [],
    requiredTerms: [1, 2],
  });
  assert.equal(missing.state, "missing");
  assert.deepEqual(missing.missingTerms, [1, 2]);
  assert.match(
    describePublicationEvidence(missing, { subjectLabel: "english" }),
    /not treated as proof of publication/i
  );

  // A mixed state still blocks, and the draft reason is reported first.
  const mixed = evaluatePublicationEvidence({
    sheets: [
      { id: "s1", term: 1, status: "published" },
      { id: "s2", term: 2, status: "draft" },
    ],
    requiredTerms: [1, 2],
  });
  assert.equal(mixed.state, "draft");
});

test("S6. Canonical subject resolution detects duplicate subject records for the same canonical key", () => {
  const resolved = resolveCanonicalSubject({
    subjectIdentifier: "English",
    subjectRows: [
      { id: "s1", subject_name: "English" },
      { id: "s2", subject_name: "English" },
      { id: "s3", subject_name: "Filipino" },
    ],
  });

  assert.equal(resolved.canonical, "english");
  assert.equal(resolved.isCanonical, true);
  assert.deepEqual(resolved.subjectIds, ["s1", "s2"]);
  assert.equal(resolved.duplicateForForecastSubject, true);
  assert.equal(resolved.duplicates.length, 1);
  assert.equal(resolved.duplicates[0].canonicalKey, "english");

  const clean = resolveCanonicalSubject({
    subjectIdentifier: "Mathematics",
    subjectRows: [
      { id: "s1", subject_name: "English" },
      { id: "s3", subject_name: "Mathematics" },
    ],
  });
  assert.deepEqual(clean.subjectIds, ["s3"]);
  assert.equal(clean.duplicateForForecastSubject, false);
});

test("S7. Official DepEd long-form subject names are supported and do not disturb the existing aliases", () => {
  assert.equal(normalizeTrendSubject("Technology and Livelihood Education"), "tle");
  assert.equal(normalizeTrendSubject("Edukasyon sa Pagpapakatao"), "values_education");
  assert.equal(normalizeTrendSubject("Aral Pan"), "araling_panlipunan");

  // Existing aliases stay untouched.
  assert.equal(normalizeTrendSubject("TLE"), "tle");
  assert.equal(normalizeTrendSubject("Values Education"), "values_education");
  assert.equal(normalizeTrendSubject("EsP"), "values_education");
  assert.equal(normalizeTrendSubject("MAPEH"), "mapeh");
  assert.equal(normalizeTrendSubject("Astronomy"), null);
});

test("S8. Ambiguous canonical grades fail closed instead of last-write-wins", () => {
  const fixture = buildTrendFixture({ duplicateGradeRow: true });
  const duplicates = findDuplicateCanonicalSubjects(fixture.grades, 1);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].canonicalKey, "english");
  assert.equal(duplicates[0].rows.length, 2);

  const result = verifyAndBuildTrendFeatures({
    learnerId: LEARNER_ID,
    subjectIdentifier: FORECAST_SUBJECT,
    currentTerm: 1,
    gradesRecords: fixture.grades,
    ecrTermSheets: [{ term: 1, status: "published" }],
  });

  assert.equal(result.eligible, false);
  assert.match(result.reason, /Ambiguous subject records detected/i);
  assert.deepEqual(result.duplicateSubjects, ["english"]);
  assert.equal(result.features, undefined);
});

test("S9. Full scope resolution on a production shaped fixture (Term 1 -> Term 2)", () => {
  const fixture = buildTrendFixture();
  const scope = resolveTrendScope({
    requestedTerm: 1,
    subjectIdentifier: FORECAST_SUBJECT,
    requestedSchoolYear: `SY ${SCHOOL_YEAR}`,
    activeSchoolYear: `SY ${SCHOOL_YEAR}`,
    sectionId: SECTION_ID,
    subjectRows: fixture.subjects,
    classRows: fixture.classes,
    gradeRows: fixture.grades,
    learnerSchoolYears: [SCHOOL_YEAR],
  });

  assert.equal(scope.supported, true);
  assert.deepEqual(scope.requiredQuarters, [1]);
  assert.equal(scope.schoolYear.raw, SCHOOL_YEAR);
  assert.equal(scope.subject.canonical, "english");
  assert.equal(scope.family.classIds.length, 4);
  assert.equal(scope.scopedGrades.length, 8);
  assert.ok(scope.scopedGrades.every((grade) => grade.quarter === 1));
});
