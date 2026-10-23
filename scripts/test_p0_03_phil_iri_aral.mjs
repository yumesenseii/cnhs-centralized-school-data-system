import test from "node:test";
import assert from "node:assert/strict";

// 1. Assessment Integrity modules
import {
  evaluateGstScore,
  evaluateIraResult,
  calculateIraMetrics,
  PHIL_IRI_CONFIG,
} from "../lib/monitoring/philIriEvaluation.js";

// 2. Import logic
import {
  interpretPhilIriGstScore,
  interpretPhilIriScore,
} from "../lib/monitoring/philIriImport.js";

// 3. Assessment timeline & locking
import {
  normalizeAralPeriod,
  isAralPeriodEditable,
  getAralPeriodPermissions,
} from "../lib/monitoring/assessmentTimeline.js";
import { getAralAssessmentPeriod } from "../lib/supabase/queries/aralAssessmentPeriod.js";

// 4. Supabase queries (with mock client for persistence tests)
import {
  saveBatchClassGstScores,
  saveSinglePhilIriResult,
} from "../lib/supabase/queries/monitoring.js";

// 5. ARAL Approval & Referral workflows
import {
  reviewAralRecommendation,
} from "../lib/supabase/queries/aralApprovals.js";
import {
  ARAL_APPROVAL_STATUS,
  ARAL_APPROVAL_DB,
  isPendingPrincipal,
} from "../lib/monitoring/aralApproval.js";

import {
  getLearnerAralReferralState,
  READING_ASSESSMENT_STATE,
  ARAL_REFERRAL_STATE,
} from "../lib/monitoring/aralAcademicStatus.js";

// 6. PLP generation & P0-01/P0-02 compatibility
import { generateDraftPlp } from "../lib/monitoring/plpGenerator.js";
import { FEATURE_PLP_PERSISTENCE } from "../lib/supabase/queries/plpQueries.js";

// ============================================================================
// 1. GST VALID BOUNDARIES (0, 27, 28, 40)
// ============================================================================

test("1. GST valid boundaries: 0, 27 require Form 3 IRA; 28, 40 meet benchmark without automatic Independent", () => {
  // Score 0: minimum valid score -> requires Form 3
  const res0 = evaluateGstScore(0);
  assert.equal(res0.isEvaluated, true);
  assert.equal(res0.score, 0);
  assert.equal(res0.requiresIra, true);
  assert.equal(res0.isBenchmarkMet, false);
  assert.equal(res0.isIndependent, false, "Score 0 must NOT be Independent");
  assert.equal(res0.readingProfile, null);
  assert.equal(res0.status, "needs_individual_assessment");

  // Score 27: just below threshold -> requires Form 3
  const res27 = evaluateGstScore(27);
  assert.equal(res27.isEvaluated, true);
  assert.equal(res27.score, 27);
  assert.equal(res27.requiresIra, true);
  assert.equal(res27.isBenchmarkMet, false);
  assert.equal(res27.isIndependent, false);
  assert.equal(res27.readingProfile, null);
  assert.equal(res27.status, "needs_individual_assessment");

  // Score 28: screening benchmark met -> does NOT require Form 3, but is NOT automatic Independent
  const res28 = evaluateGstScore(28);
  assert.equal(res28.isEvaluated, true);
  assert.equal(res28.score, 28);
  assert.equal(res28.requiresIra, false);
  assert.equal(res28.isBenchmarkMet, true);
  assert.equal(res28.isIndependent, false, "GST >= 28 must NOT automatically mean Independent Reader");
  assert.equal(res28.readingProfile, null, "Reading profile remains null without Form 3 diagnostic evaluation");
  assert.equal(res28.status, "benchmark_met");

  // Score 40: maximum valid score -> benchmark met, not automatic Independent
  const res40 = evaluateGstScore(40);
  assert.equal(res40.isEvaluated, true);
  assert.equal(res40.score, 40);
  assert.equal(res40.requiresIra, false);
  assert.equal(res40.isBenchmarkMet, true);
  assert.equal(res40.isIndependent, false, "Score 40 must NOT automatically mean Independent Reader");
  assert.equal(res40.readingProfile, null);
  assert.equal(res40.status, "benchmark_met");

  // Absent workflow preserved
  const resAbsent = evaluateGstScore({ isAbsent: true });
  assert.equal(resAbsent.isAbsent, true);
  assert.equal(resAbsent.score, null);
  assert.equal(resAbsent.requiresIra, false);
  assert.equal(resAbsent.status, "absent");
});

// ============================================================================
// 2. INVALID GST VALUE REJECTION
// ============================================================================

test("2. Invalid GST values (null, undefined, empty, whitespace, negative, >40, NaN, non-numeric) are strictly rejected", () => {
  const invalidValues = [
    null,
    undefined,
    "",
    "   ",
    -1,
    -0.5,
    40.1,
    41,
    99,
    NaN,
    "abc",
    "28abc",
    true,
    false,
    [],
    {},
  ];

  for (const val of invalidValues) {
    const res = evaluateGstScore(val);
    assert.equal(
      res.isEvaluated,
      false,
      `GST value '${String(val)}' must result in isEvaluated: false`
    );
    assert.equal(
      res.score,
      null,
      `GST value '${String(val)}' must result in score: null`
    );
    assert.equal(
      res.requiresIra,
      false,
      `GST value '${String(val)}' must not trigger IRA without valid score`
    );
    assert.equal(
      res.isIndependent,
      false,
      `GST value '${String(val)}' must not produce Independent Reader`
    );
  }
});

// ============================================================================
// 3. MISSING AND PARTIAL FORM 3 METRICS (Number(null) === 0 safety)
// ============================================================================

test("3. Missing and partial Form 3 metrics remain Pending/Incomplete, never defaulting to Frustration", () => {
  // Both metrics null: must NOT become Frustration
  const bothNull = evaluateIraResult({ wordReadingPct: null, comprehensionPct: null });
  assert.equal(bothNull.isEvaluated, false);
  assert.equal(bothNull.isPending, true);
  assert.equal(bothNull.readingProfile, null, "Null Form 3 metrics must NOT default to Frustration");
  assert.equal(bothNull.assessmentLevelUsed, "At Grade Level");

  // Word reading null, comprehension valid: remains pending
  const wordNull = evaluateIraResult({ wordReadingPct: null, comprehensionPct: 80 });
  assert.equal(wordNull.isEvaluated, false);
  assert.equal(wordNull.isPending, true);
  assert.equal(wordNull.readingProfile, null);

  // Word reading valid, comprehension null: remains pending
  const compNull = evaluateIraResult({ wordReadingPct: 95, comprehensionPct: null });
  assert.equal(compNull.isEvaluated, false);
  assert.equal(compNull.isPending, true);
  assert.equal(compNull.readingProfile, null);

  // Incomplete string / undefined values
  const invalidStrings = evaluateIraResult({ wordReadingPct: "", comprehensionPct: undefined });
  assert.equal(invalidStrings.isEvaluated, false);
  assert.equal(invalidStrings.readingProfile, null);

  // Out of bounds percentages (>100 or <0)
  const outOfBounds = evaluateIraResult({ wordReadingPct: 105, comprehensionPct: 70 });
  assert.equal(outOfBounds.isEvaluated, false);
  assert.equal(outOfBounds.readingProfile, null);

  // calculateIraMetrics with missing data
  const calcMissing = calculateIraMetrics({
    totalWords: null,
    miscCount: null,
    questionsTotal: null,
    correctAnswers: null,
  });
  assert.equal(calcMissing.wordReadingPct, null);
  assert.equal(calcMissing.comprehensionPct, null);
  assert.equal(calcMissing.readingProfile, null);
  assert.equal(calcMissing.isPending, true);

  // Verified full metrics produce correct profiles
  const frustration = evaluateIraResult({ wordReadingPct: 85, comprehensionPct: 50 });
  assert.equal(frustration.isEvaluated, true);
  assert.equal(frustration.readingProfile, "Frustration");

  const instructional = evaluateIraResult({ wordReadingPct: 92, comprehensionPct: 65 });
  assert.equal(instructional.isEvaluated, true);
  assert.equal(instructional.readingProfile, "Instructional");

  const independent = evaluateIraResult({ wordReadingPct: 98, comprehensionPct: 85 });
  assert.equal(independent.isEvaluated, true);
  assert.equal(independent.readingProfile, "Independent");
});

// ============================================================================
// 4. EXCEL IMPORT GST 16–27 WITHOUT FORM 3
// ============================================================================

test("4. Excel import GST 16–27 without Form 3 requires follow-up and NEVER defaults to Independent", () => {
  // GST 20 in Excel import
  const gstInterp = interpretPhilIriGstScore(20);
  assert.equal(gstInterp.requiresIra, true);
  assert.equal(gstInterp.candidateStatus, "For Review", "Must be 'For Review' awaiting Form 3 follow-up");
  assert.equal(gstInterp.isCandidate, false, "Must not automatically qualify as ARAL candidate");

  // Row with GST 20 and no Form 3
  const rowGst20 = {
    gstScore: 20,
    wordReadingScore: null,
    comprehensionScore: null,
    readingProfile: null,
  };
  const resultGst20 = interpretPhilIriScore(rowGst20);
  assert.equal(resultGst20.requiresIra, true);
  assert.equal(resultGst20.candidateStatus, "For Review");
  assert.equal(resultGst20.readingLevel, "Not Assessed", "Must NOT fabricate Independent or Frustration");
  assert.notEqual(resultGst20.readingLevel, "Independent");

  // Row with GST 35 and no Form 3
  const rowGst35 = {
    gstScore: 35,
    wordReadingScore: null,
    comprehensionScore: null,
    readingProfile: null,
  };
  const resultGst35 = interpretPhilIriScore(rowGst35);
  assert.equal(resultGst35.requiresIra, false);
  assert.equal(resultGst35.candidateStatus, "Baseline Complete");
  assert.equal(resultGst35.readingLevel, "Not Assessed", "GST >= 28 alone must NOT set readingLevel to Independent");
  assert.notEqual(resultGst35.readingLevel, "Independent");
});

// ============================================================================
// 5. ENGLISH AND FILIPINO INDEPENDENCE
// ============================================================================

test("5. English and Filipino assessment outcomes are independent and isolated", () => {
  // A learner can meet benchmark in Filipino while needing Form 3 in English
  const englishGst = evaluateGstScore(22);
  const filipinoGst = evaluateGstScore(34);

  assert.equal(englishGst.requiresIra, true, "English requires Form 3");
  assert.equal(englishGst.isBenchmarkMet, false);

  assert.equal(filipinoGst.requiresIra, false, "Filipino meets benchmark");
  assert.equal(filipinoGst.isBenchmarkMet, true);

  // Both retain independent subject keys
  assert.notEqual(englishGst.status, filipinoGst.status);
});

// ============================================================================
// 6. BOSY / MOSY / EOSY RECORD ISOLATION & UNIQUE CONSTRAINT VERIFICATION
// ============================================================================

test("6. BOSY / MoSY / EOSY record isolation: save queries scope strictly by (student_id, school_year, subject, assessment_period)", async () => {
  let capturedUpsert = null;

  // Mock Supabase client mimicking Migration 055 table schema
  const mockSupabase = {
    from: (table) => {
      if (table === "monitoring_records") {
        return {
          update: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      assert.equal(table, "phil_iri_baseline_records");
      return {
        upsert: (rows, options) => {
          capturedUpsert = { rows, options };
          return { data: rows, error: null };
        },
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      };
    },
  };

  // Save BOSY result
  const bosyResult = await saveSinglePhilIriResult({
    studentId: "student-101",
    schoolYear: "2026-2027",
    subject: "English",
    assessmentPeriod: "BOSY",
    gstScore: 24,
    iraMetrics: { wordReadingPct: 88, comprehensionPct: 60, readingProfile: "Frustration" },
    supabaseClient: mockSupabase,
    currentAssessmentPeriod: "BOSY",
  });

  assert.equal(bosyResult.error, null);
  assert.equal(capturedUpsert.options.onConflict, "student_id,school_year,subject,assessment_period");
  const bosyRow = Array.isArray(capturedUpsert.rows) ? capturedUpsert.rows[0] : capturedUpsert.rows;
  assert.equal(bosyRow.assessment_period, "BOSY");
  assert.equal(bosyRow.subject, "English");
  assert.equal(bosyRow.total_score, 24);

  // Save MOSY result for same student and subject: must NOT conflict with or overwrite BOSY
  const mosyResult = await saveSinglePhilIriResult({
    studentId: "student-101",
    schoolYear: "2026-2027",
    subject: "English",
    assessmentPeriod: "MOSY",
    gstScore: 30,
    iraMetrics: { wordReadingPct: 95, comprehensionPct: 80, readingProfile: "Independent" },
    supabaseClient: mockSupabase,
    currentAssessmentPeriod: "MOSY",
  });

  assert.equal(mosyResult.error, null);
  assert.equal(capturedUpsert.options.onConflict, "student_id,school_year,subject,assessment_period");
  const mosyRow = Array.isArray(capturedUpsert.rows) ? capturedUpsert.rows[0] : capturedUpsert.rows;
  assert.equal(mosyRow.assessment_period, "MOSY");
  assert.equal(mosyRow.total_score, 30);
});

test("6b. Legacy fallback safety: allows 3-column fallback strictly for BOSY on missing column, rejects MOSY/EOSY and unrelated errors", async () => {
  // Case A: BOSY with explicit 'column "assessment_period" does not exist' error -> fallback succeeds
  let bosyUpsertCalls = [];
  const mockBOSYMissingColumn = {
    from: (table) => {
      if (table === "monitoring_records") {
        return {
          update: () => ({ eq: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }) }) }),
        };
      }
      return {
        upsert: (payload, options) => {
          bosyUpsertCalls.push({ payload, options });
          if (bosyUpsertCalls.length === 1) {
            // First call with 4-column conflict fails because column is missing
            return { data: null, error: new Error('column "assessment_period" does not exist') };
          }
          // Second call (legacy 3-column fallback) succeeds
          return { data: payload, error: null };
        },
        select: () => ({
          eq: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }),
        }),
      };
    },
  };

  const resBosyFallback = await saveSinglePhilIriResult({
    studentId: "student-bosy",
    schoolYear: "2026-2027",
    subject: "English",
    assessmentPeriod: "BOSY",
    gstScore: 25,
    supabaseClient: mockBOSYMissingColumn,
    currentAssessmentPeriod: "BOSY",
  });

  assert.equal(resBosyFallback.error, null);
  assert.equal(bosyUpsertCalls.length, 2, "BOSY must attempt fallback upsert when column is missing");
  assert.equal(bosyUpsertCalls[1].options.onConflict, "student_id,school_year,subject");
  assert.equal(bosyUpsertCalls[1].payload.assessment_period, undefined, "Fallback payload must omit missing column");

  // Case B: MOSY with 'column "assessment_period" does not exist' -> MUST NOT use legacy fallback, must fail closed
  let mosyUpsertCalls = [];
  const mockMOSYMissingColumn = {
    from: (table) => {
      if (table === "monitoring_records") {
        return {
          update: () => ({ eq: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }) }) }),
        };
      }
      return {
        upsert: (payload, options) => {
          mosyUpsertCalls.push({ payload, options });
          return { data: null, error: new Error('column "assessment_period" does not exist') };
        },
        select: () => ({
          eq: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }),
        }),
      };
    },
  };

  const resMosyFallback = await saveSinglePhilIriResult({
    studentId: "student-mosy",
    schoolYear: "2026-2027",
    subject: "English",
    assessmentPeriod: "MOSY",
    gstScore: 32,
    supabaseClient: mockMOSYMissingColumn,
    currentAssessmentPeriod: "MOSY",
  });

  assert.ok(resMosyFallback.error, "MOSY must fail closed without fallback");
  assert.match(resMosyFallback.error.message, /column "assessment_period" does not exist/i);
  assert.equal(mosyUpsertCalls.length, 1, "MOSY must NEVER attempt 3-column legacy fallback");

  // Case C: BOSY with an unrelated error (e.g. check constraint or foreign key) -> MUST NOT trigger fallback
  let unrelatedUpsertCalls = [];
  const mockUnrelatedError = {
    from: (table) => {
      if (table === "monitoring_records") {
        return {
          update: () => ({ eq: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }) }) }),
        };
      }
      return {
        upsert: (payload, options) => {
          unrelatedUpsertCalls.push({ payload, options });
          return { data: null, error: new Error("violates foreign key constraint") };
        },
        select: () => ({
          eq: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }),
        }),
      };
    },
  };

  const resUnrelated = await saveSinglePhilIriResult({
    studentId: "student-bosy-fk",
    schoolYear: "2026-2027",
    subject: "English",
    assessmentPeriod: "BOSY",
    gstScore: 25,
    supabaseClient: mockUnrelatedError,
    currentAssessmentPeriod: "BOSY",
  });

  assert.ok(resUnrelated.error);
  assert.match(resUnrelated.error.message, /violates foreign key constraint/i);
  assert.equal(unrelatedUpsertCalls.length, 1, "Unrelated errors must not trigger legacy fallback");
});

// ============================================================================
// 7. LOCKED ASSESSMENT PERIOD WRITE REJECTION
// ============================================================================

test("7. Locked assessment periods reject writes before persisting to database", async () => {
  let dbCalled = false;
  const mockSupabase = {
    from: () => {
      dbCalled = true;
      return {
        upsert: () => ({ data: [], error: null }),
      };
    },
  };

  // When active period is BOSY, writing to MOSY must be rejected
  const resMosyWhenBosy = await saveSinglePhilIriResult({
    studentId: "student-101",
    schoolYear: "2026-2027",
    subject: "English",
    assessmentPeriod: "MOSY",
    gstScore: 25,
    supabaseClient: mockSupabase,
    currentAssessmentPeriod: "BOSY",
  });

  assert.equal(dbCalled, false, "Database must not be called when period is locked");
  assert.ok(resMosyWhenBosy.error, "Must return an error for locked period");
  assert.match(resMosyWhenBosy.error.message, /locked for editing/i);

  // When active period is MOSY, writing to closed BOSY must be rejected
  const resBosyWhenMosy = await saveBatchClassGstScores({
    classId: "class-1",
    schoolYear: "2026-2027",
    subject: "English",
    assessmentPeriod: "BOSY",
    scores: [{ studentId: "s1", gstScore: 25 }],
    supabaseClient: mockSupabase,
    currentAssessmentPeriod: "MOSY",
  });

  assert.equal(dbCalled, false);
  assert.ok(resBosyWhenMosy.error);
  assert.match(resBosyWhenMosy.error.message, /locked for editing/i);
});

// ============================================================================
// 8. MISSING / UNCONFIGURED PERIOD SAFELY LOCKED
// ============================================================================

test("8. Missing or unconfigured assessment periods safely lock all writes without defaulting to editable BOSY", async () => {
  // Permission matrix when unconfigured
  const unconfiguredPerms = getAralPeriodPermissions(null);
  assert.equal(unconfiguredPerms.BOSY.editable, false);
  assert.equal(unconfiguredPerms.BOSY.readonly, true);
  assert.equal(unconfiguredPerms.MOSY.editable, false);
  assert.equal(unconfiguredPerms.EOSY.editable, false);

  // isAralPeriodEditable safely returns false
  assert.equal(isAralPeriodEditable("BOSY", null), false);
  assert.equal(isAralPeriodEditable("MOSY", null), false);
  assert.equal(isAralPeriodEditable("EOSY", null), false);
  assert.equal(isAralPeriodEditable("BOSY", undefined), false);
  assert.equal(isAralPeriodEditable("BOSY", ""), false);

  // Mock write with unconfigured period
  let dbCalled = false;
  const mockSupabase = {
    from: () => {
      dbCalled = true;
      return {};
    },
  };

  const writeResult = await saveSinglePhilIriResult({
    studentId: "s1",
    schoolYear: "2026-2027",
    subject: "English",
    assessmentPeriod: "BOSY",
    gstScore: 25,
    supabaseClient: mockSupabase,
    currentAssessmentPeriod: null,
  });

  assert.equal(dbCalled, false);
  assert.ok(writeResult.error);
  assert.match(writeResult.error.message, /not configured/i);
});

// ============================================================================
// 9. SUGGESTED VERSUS SUBMITTED PRINCIPAL APPROVAL GUARD
// ============================================================================

test("9. Principal approval requires genuine teacher submission; 'SUGGESTED' referrals are rejected", async () => {
  // Mock DB returning a recommendation that is only 'suggested' (awaiting teacher review)
  const mockSupabaseSuggested = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "rec-1",
                    student_id: "s1",
                    status: "suggested", // Not yet submitted by teacher
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  };

  const approveAttempt = await reviewAralRecommendation({
    studentId: "s1",
    classId: "c1",
    schoolYear: "2026-2027",
    quarter: 1,
    status: ARAL_APPROVAL_DB.APPROVED,
    profileId: "admin-1",
    supabaseClient: mockSupabaseSuggested,
  });

  assert.ok(approveAttempt.error, "Approving 'suggested' referral must be rejected");
  assert.match(approveAttempt.error.message, /must be submitted by the teacher/i);

  // Mock DB returning a properly submitted recommendation
  let updatedPayload = null;
  const mockSupabaseSubmitted = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: "rec-2",
                    student_id: "s2",
                    status: "submitted", // Genuinely submitted by teacher
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
      update: (payload) => {
        updatedPayload = payload;
        return {
          eq: () => ({
            select: () => ({
              single: async () => ({
                data: { id: "rec-2", status: "approved", ...payload },
                error: null,
              }),
            }),
          }),
        };
      },
    }),
  };

  const approveSuccess = await reviewAralRecommendation({
    studentId: "s2",
    classId: "c1",
    schoolYear: "2026-2027",
    quarter: 1,
    status: ARAL_APPROVAL_DB.APPROVED,
    profileId: "admin-1",
    supabaseClient: mockSupabaseSubmitted,
  });

  assert.equal(approveSuccess.error, null);
  assert.equal(updatedPayload.status, "approved");
  assert.equal(updatedPayload.reviewed_by_profile_id, "admin-1");
});

// ============================================================================
// 10. BATCH APPROVAL CANNOT BYPASS TEACHER REFERRAL
// ============================================================================

test("10. Batch approval UI filters out 'SUGGESTED' learners and only accepts 'SUBMITTED'", () => {
  // Test isPendingPrincipal utility
  assert.equal(isPendingPrincipal(ARAL_APPROVAL_STATUS.SUBMITTED), true);
  assert.equal(isPendingPrincipal("submitted"), true);
  assert.equal(isPendingPrincipal(ARAL_APPROVAL_STATUS.SUGGESTED), false, "SUGGESTED is awaiting teacher, NOT pending principal");
  assert.equal(isPendingPrincipal(ARAL_APPROVAL_STATUS.APPROVED), false);
  assert.equal(isPendingPrincipal(ARAL_APPROVAL_STATUS.RETURNED), false);
  assert.equal(isPendingPrincipal(null), false);

  // Test batch selection filter simulation
  const learners = [
    { selectKey: "k1", displayStatus: ARAL_APPROVAL_STATUS.SUGGESTED, name: "Student 1" },
    { selectKey: "k2", displayStatus: ARAL_APPROVAL_STATUS.SUBMITTED, name: "Student 2" },
    { selectKey: "k3", displayStatus: ARAL_APPROVAL_STATUS.APPROVED, name: "Student 3" },
    { selectKey: "k4", displayStatus: ARAL_APPROVAL_STATUS.SUBMITTED, name: "Student 4" },
  ];

  const actionableKeys = learners
    .filter((l) => isPendingPrincipal(l.displayStatus))
    .map((l) => l.selectKey);

  assert.deepEqual(actionableKeys, ["k2", "k4"], "Only submitted learners may be selected for batch approval");
  assert.ok(!actionableKeys.includes("k1"), "SUGGESTED student 1 must be excluded from batch approval");
});

// ============================================================================
// 11. GST < 28 WITHOUT FORM 3 DOES NOT AUTOMATICALLY QUALIFY FOR ARAL
// ============================================================================

test("11. GST < 28 without completed Form 3 requires diagnostic assessment and does NOT qualify for ARAL intervention", () => {
  // Candidate status check
  const importResult = interpretPhilIriGstScore(18);
  assert.equal(importResult.requiresIra, true);
  assert.equal(importResult.candidateStatus, "For Review", "Must be 'For Review' awaiting Form 3");
  assert.equal(importResult.isCandidate, false, "Must not be flagged as candidate for ARAL");

  // Referral state check
  const referralState = getLearnerAralReferralState({
    subject: "English",
    philIriScore: 18,
    gstScore: 18,
    gstBenchmarkMet: false,
    readingProfile: null, // Form 3 not done yet
    referralStatus: null,
  });

  assert.equal(
    referralState.readingAssessmentState,
    READING_ASSESSMENT_STATE.NEEDS_IRA,
    "Must be in NEEDS_IRA state"
  );
  assert.equal(
    referralState.aralReferralState,
    ARAL_REFERRAL_STATE.NOT_ELIGIBLE,
    "Learner cannot be referred to ARAL before Form 3 verifies Frustration or Instructional level"
  );
  assert.equal(referralState.canSubmitReferral, false);
  assert.equal(referralState.isUnderSupport, false);
});

// ============================================================================
// 12. READING-ONLY PLP GENERATION & P0-01 / P0-02 COMPATIBILITY
// ============================================================================

test("12. Reading-only BOSY PLP generation is preserved with P0-01/P0-02 compatibility and locked persistence", () => {
  const result = generateDraftPlp({
    student: {
      id: "student-bosy-1",
      name: "Juan Dela Cruz",
      lrn: "123456789012",
      gradeLevel: "Grade 7",
      section: "Rizal",
    },
    readingContext: {
      readingPeriod: "BOSY",
      language: "English",
      gstScore: 18,
      form3ReadingProfile: "Frustration",
      passageLevel: "Grade 5",
      wordReadingPct: 82,
      comprehensionPct: 50,
      gradeLevel: 7,
    },
    schoolYear: "2026-2027",
    academicContext: null, // No academic grades yet in BOSY
  });

  assert.equal(result.success, true);
  const plp = result.plan;
  assert.equal(plp.plan_type, "reading_aral");
  assert.equal(plp.student_id, "student-bosy-1");
  assert.equal(plp.academic_term, null, "Must NOT fabricate academic term for reading-only BOSY PLP");
  assert.equal(plp.class_id, null);
  assert.equal(plp.reading_period, "BOSY");
  assert.equal(plp.overall_risk_level, "High Risk", "High Risk tier for verified reading Frustration");

  // Objectives check: reading goals present, no fabricated academic remediation goals
  assert.ok(plp.target_objectives.length > 0);
  assert.equal(plp.academic_evidence, undefined, "Reading-only plan must not have academic evidence");

  // Preserved invariants: FEATURE_PLP_PERSISTENCE must remain strictly false
  assert.equal(FEATURE_PLP_PERSISTENCE, false, "FEATURE_PLP_PERSISTENCE must remain strictly false");
});
