import test from "node:test";
import assert from "node:assert/strict";

import {
  saveBatchClassGstScores,
  saveSinglePhilIriResult,
  savePhilIriBaselineRecords,
} from "../lib/supabase/queries/monitoring.js";
import { getAralReadingWorkflow } from "../lib/monitoring/aralReadingWorkflow.js";
import {
  evaluateTermResult,
  getPreviousTermOutcome,
  filterActiveLearnersForTerm,
  getLearnerTimelineSummary,
} from "../lib/monitoring/aralProgression.js";
import {
  aggregateAralLearners,
  computeAralMetrics,
} from "../lib/monitoring/aralLearnerAggregation.js";
import { getSimplifiedAralStatus } from "../lib/monitoring/aralAcademicStatus.js";
import { buildPhilIriPayload } from "../lib/monitoring/philIriPersistence.js";

// Mock Supabase in-memory DB client for persistence testing
function createMockSupabase(initialRows = []) {
  const store = {
    phil_iri_baseline_records: [...initialRows],
  };

  const client = {
    from(tableName) {
      if (tableName !== "phil_iri_baseline_records") {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        };
      }

      return {
        select(cols = "*") {
          return {
            eq(field, val) {
              const filterEq = (item) => String(item[field] || "") === String(val || "");
              return {
                eq(field2, val2) {
                  const filterEq2 = (item) => filterEq(item) && String(item[field2] || "") === String(val2 || "");
                  return {
                    eq(field3, val3) {
                      const filterEq3 = (item) => filterEq2(item) && String(item[field3] || "") === String(val3 || "");
                      return {
                        eq(field4, val4) {
                          const filterEq4 = (item) => filterEq3(item) && String(item[field4] || "") === String(val4 || "");
                          return {
                            maybeSingle: async () => {
                              const match = store.phil_iri_baseline_records.find(filterEq4);
                              return { data: match || null, error: null };
                            },
                          };
                        },
                        maybeSingle: async () => {
                          const match = store.phil_iri_baseline_records.find(filterEq3);
                          return { data: match || null, error: null };
                        },
                      };
                    },
                    maybeSingle: async () => {
                      const match = store.phil_iri_baseline_records.find(filterEq2);
                      return { data: match || null, error: null };
                    },
                  };
                },
                maybeSingle: async () => {
                  const match = store.phil_iri_baseline_records.find(filterEq);
                  return { data: match || null, error: null };
                },
              };
            },
          };
        },
        upsert(payload, options = {}) {
          const rows = Array.isArray(payload) ? payload : [payload];
          for (const row of rows) {
            const conflictKey = (r) => `${r.student_id}|${r.school_year}|${r.subject}|${r.assessment_period}`;
            const key = conflictKey(row);
            const idx = store.phil_iri_baseline_records.findIndex((r) => conflictKey(r) === key);
            if (idx >= 0) {
              store.phil_iri_baseline_records[idx] = {
                ...store.phil_iri_baseline_records[idx],
                ...row,
                updated_at: new Date().toISOString(),
              };
            } else {
              store.phil_iri_baseline_records.push({
                id: `rec-${store.phil_iri_baseline_records.length + 1}`,
                ...row,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
          }
          return Promise.resolve({ data: rows, error: null });
        },
      };
    },
    _getStore: () => store,
  };

  return client;
}

const SY = "SY 2026-2027";

// ============================================================================
// 1. UNBLOCK SCORE CORRECTIONS WITHOUT MANDATORY EXPLANATION
// ============================================================================

test("1. Modifying a saved score without a correction explanation succeeds and records automatic audit history", async () => {
  const db = createMockSupabase([
    {
      student_id: "s1",
      school_year: SY,
      subject: "English",
      assessment_period: "BOSY",
      total_score: 18,
      reading_level: "Not Assessed",
      raw_payload: {
        assessmentPeriod: "BOSY",
        isAbsent: false,
        auditTrail: [
          {
            action: "assessment_recorded",
            score: 18,
            timestamp: "2026-06-15T08:00:00.000Z",
            teacherId: "t1",
          },
        ],
      },
    },
  ]);

  // Teacher updates score from 18 to 22 without providing any correctionReason
  const result = await saveSinglePhilIriResult({
    studentId: "s1",
    teacherId: "t1",
    schoolYear: SY,
    subject: "English",
    assessmentPeriod: "BOSY",
    gstScore: 22,
    correctionReason: "", // Empty explanation!
    supabaseClient: db,
  });

  assert.equal(result.error, null, "Save must succeed without throwing a correction reason error");
  assert.equal(result.data.success, true);

  const updated = db._getStore().phil_iri_baseline_records[0];
  assert.equal(updated.total_score, 22);

  // Verify automatic audit trail
  const trail = updated.raw_payload.auditTrail;
  assert.ok(trail.length >= 2, "Audit trail must retain previous and new events");
  const lastEvent = trail.at(-1);
  assert.equal(lastEvent.action, "assessment_corrected");
  assert.equal(lastEvent.previousScore, 18);
  assert.equal(lastEvent.newScore, 22);
  assert.ok(lastEvent.timestamp, "Must have an automated ISO timestamp");
  assert.equal(lastEvent.teacherId, "t1");
  assert.equal(lastEvent.reason, "Assessment updated", "Defaults to standard automated message if explanation omitted");
});

test("2. Batch saving changed GST scores without explanation saves cleanly and logs audit trail", async () => {
  const db = createMockSupabase([
    {
      student_id: "s2",
      class_id: "c1",
      school_year: SY,
      subject: "English",
      assessment_period: "BOSY",
      total_score: 15,
      reading_level: "Not Assessed",
      raw_payload: { assessmentPeriod: "BOSY", isAbsent: false },
    },
  ]);

  const batchRes = await saveBatchClassGstScores({
    classId: "c1",
    teacherId: "t1",
    schoolYear: SY,
    assessmentPeriod: "BOSY",
    subject: "English",
    scores: [
      { studentId: "s2", gstScore: 20, isAbsent: false }, // no correctionReason provided
    ],
    supabaseClient: db,
  });

  assert.equal(batchRes.error, null);
  assert.equal(batchRes.data.count, 1);
  const updated = db._getStore().phil_iri_baseline_records[0];
  assert.equal(updated.total_score, 20);
  assert.equal(updated.raw_payload.auditTrail.at(-1).previousScore, 15);
  assert.equal(updated.raw_payload.auditTrail.at(-1).newScore, 20);
});

// ============================================================================
// 2. BOSY PROGRESSION RULES
// ============================================================================

test("3. BOSY: GST passing (>=28) -> Screening Complete / Exit Pathway", () => {
  const learner = {
    studentId: "s1",
    language: "English",
    schoolYear: SY,
    philIriScore: 32,
    philIriRecords: [
      {
        student_id: "s1",
        subject: "English",
        school_year: SY,
        assessment_period: "BOSY",
        total_score: 32,
        reading_level: "Not Assessed",
      },
    ],
  };

  const workflow = getAralReadingWorkflow(learner, "BOSY", SY);
  assert.equal(workflow.learner.currentStepKey, "screening_complete_at_grade");
  assert.equal(workflow.learner.currentStepLabel, "Screening Complete");

  const evaluated = evaluateTermResult(learner.philIriRecords[0]);
  assert.equal(evaluated.outcome, "PASS");
  assert.equal(evaluated.statusLabel, "Screening Complete — At Grade Level");
  assert.equal(evaluated.exitNotice, "No Further Assessment Required");
});

test("4. BOSY: GST below benchmark (<28) -> Form 3 IRA required before confirming progression", () => {
  const learner = {
    studentId: "s2",
    language: "English",
    schoolYear: SY,
    philIriScore: 18,
    philIriRecords: [
      {
        student_id: "s2",
        subject: "English",
        school_year: SY,
        assessment_period: "BOSY",
        total_score: 18,
        reading_level: "Not Assessed",
      },
    ],
  };

  const workflow = getAralReadingWorkflow(learner, "BOSY", SY);
  assert.equal(workflow.requiresIndividual, true);
  assert.equal(workflow.learner.currentStepKey, "needs_individual_assessment");
  assert.equal(workflow.learner.currentStepLabel, "Individual Assessment Needed");

  const evaluated = evaluateTermResult(learner.philIriRecords[0]);
  assert.equal(evaluated.outcome, "NEEDS_IRA");
  assert.equal(evaluated.statusLabel, "Needs Further Assessment");
});

test("5. BOSY: Completed Form 3 IRA with Independent profile at grade level exits; Instructional/Frustration continues", () => {
  // Case A: Independent at Grade Level -> PASS
  const independentLearner = {
    student_id: "s3",
    subject: "English",
    school_year: SY,
    assessment_period: "BOSY",
    total_score: 20,
    grade: "Grade 7",
    reading_level: "Independent",
    iraMetrics: {
      passageLevel: "Grade 7",
      wordReadingPct: 98,
      comprehensionPct: 88,
      readingProfile: "Independent",
      progressionOutcome: "No Further Assessment Required",
    },
  };
  const evalA = evaluateTermResult(independentLearner);
  assert.equal(evalA.outcome, "PASS");
  assert.equal(evalA.statusLabel, "Reading Assessment Complete");
  assert.equal(evalA.exitNotice, "No Further Assessment Required");

  // Case B: Instructional at Grade Level -> CONTINUE to MOSY
  const instructionalLearner = {
    student_id: "s4",
    subject: "English",
    school_year: SY,
    assessment_period: "BOSY",
    total_score: 18,
    grade: "Grade 7",
    reading_level: "Instructional",
    iraMetrics: {
      passageLevel: "Grade 7",
      wordReadingPct: 92,
      comprehensionPct: 75,
      readingProfile: "Instructional",
      progressionOutcome: "Continue to Next Assessment Period",
    },
  };
  const evalB = evaluateTermResult(instructionalLearner);
  assert.equal(evalB.outcome, "CONTINUE");
  assert.equal(evalB.statusLabel, "Instructional");
  assert.equal(evalB.exitNotice, "Continue to Next Assessment Period");
});

// ============================================================================
// 3. MOSY PROGRESSION RULES & GST-ALONE RESTRICTION
// ============================================================================

test("6. MOSY: Exited BOSY learner is carried forward as Completed and NOT marked pending in MOSY", () => {
  const learner = {
    id: "l1",
    studentId: "s1",
    language: "English",
    subject: "English",
    schoolYear: SY,
    philIriRecords: [
      {
        student_id: "s1",
        subject: "English",
        school_year: SY,
        assessment_period: "BOSY",
        total_score: 30,
        reading_level: "Not Assessed",
      },
    ],
  };

  const workflow = getAralReadingWorkflow(learner, "MOSY", SY);
  assert.equal(workflow.mode, "complete");
  assert.equal(workflow.learner.currentStepKey, "screening_complete_at_grade");
  assert.equal(workflow.learner.currentStepLabel, "Completed (Earlier Period)");
  assert.equal(workflow.requiresIndividual, false);
});

test("7. MOSY: A raw GST score entered in MOSY without Form 3 CANNOT pass or exit the learner", () => {
  // A record in MOSY with a score of 30 but NO Form 3
  const rawMosyRecord = {
    student_id: "s2",
    subject: "English",
    school_year: SY,
    assessment_period: "MOSY",
    total_score: 30,
    reading_level: "Not Assessed",
  };

  const evalRes = evaluateTermResult(rawMosyRecord);
  assert.notEqual(evalRes.outcome, "PASS", "MOSY cannot pass on a raw score alone");
  assert.equal(evalRes.outcome, "NEEDS_IRA", "Reassessment requires Form 3 IRA");
  assert.equal(evalRes.statusLabel, "Reassessment Needed");
});

test("8. MOSY: Learner achieving Independent profile on at-grade passage exits; Instructional continues to EOSY", () => {
  // Case A: Achieved Independent at grade 7 in MOSY -> PASS / Exit
  const mosyPass = {
    student_id: "s2",
    subject: "English",
    school_year: SY,
    assessment_period: "MOSY",
    grade: "Grade 7",
    reading_level: "Independent",
    iraMetrics: {
      passageLevel: "Grade 7",
      wordReadingPct: 97,
      comprehensionPct: 85,
      readingProfile: "Independent",
      progressionOutcome: "No Further Assessment Required",
    },
  };
  const evalPass = evaluateTermResult(mosyPass);
  assert.equal(evalPass.outcome, "PASS");
  assert.equal(evalPass.statusLabel, "Reading Assessment Complete");
  assert.equal(evalPass.exitNotice, "No Further Assessment Required");

  // Case B: Still Instructional in MOSY -> CONTINUE to EOSY
  const mosyContinue = {
    student_id: "s3",
    subject: "English",
    school_year: SY,
    assessment_period: "MOSY",
    grade: "Grade 7",
    reading_level: "Instructional",
    iraMetrics: {
      passageLevel: "Grade 7",
      wordReadingPct: 92,
      comprehensionPct: 65,
      readingProfile: "Instructional",
      progressionOutcome: "Continue to Next Assessment Period",
    },
  };
  const evalContinue = evaluateTermResult(mosyContinue);
  assert.equal(evalContinue.outcome, "CONTINUE");
  assert.equal(evalContinue.statusLabel, "Instructional");
  assert.equal(evalContinue.exitNotice, "Continue to Next Assessment Period");
});

// ============================================================================
// 4. EOSY PROGRESSION RULES & "ARAL ELIGIBLE — FOR REVIEW"
// ============================================================================

test("9. EOSY: Learner meeting exit criteria exits; learner still below required level is flagged ARAL Eligible — For Review", () => {
  // Case A: EOSY Independent at Grade Level -> PASS
  const eosyPass = {
    student_id: "s2",
    subject: "English",
    school_year: SY,
    assessment_period: "EOSY",
    grade: "Grade 7",
    reading_level: "Independent",
    iraMetrics: {
      passageLevel: "Grade 7",
      wordReadingPct: 96,
      comprehensionPct: 80,
      readingProfile: "Independent",
      progressionOutcome: "No Further Assessment Required",
    },
  };
  const evalPass = evaluateTermResult(eosyPass);
  assert.equal(evalPass.outcome, "PASS");
  assert.equal(evalPass.statusLabel, "Reading Assessment Complete");

  // Case B: EOSY Instructional profile -> ARAL Eligible — For Review
  const eosyReview = {
    student_id: "s4",
    subject: "English",
    school_year: SY,
    assessment_period: "EOSY",
    grade: "Grade 7",
    reading_level: "Instructional",
    iraMetrics: {
      passageLevel: "Grade 7",
      wordReadingPct: 91,
      comprehensionPct: 62,
      readingProfile: "Instructional",
      progressionOutcome: "For Further Review after EOSY",
    },
  };
  const evalReview = evaluateTermResult(eosyReview);
  assert.equal(evalReview.outcome, "EOSY_REVIEW");
  assert.equal(evalReview.statusLabel, "ARAL Eligible — For Review");
  assert.equal(evalReview.exitNotice, "ARAL Eligible — For Review");
});

test("10. EOSY: Workflow step and simplified status display ARAL Eligible — For Review", () => {
  const learner = {
    id: "l4",
    studentId: "s4",
    language: "English",
    subject: "English",
    schoolYear: SY,
    grade: "Grade 7",
    philIriRecords: [
      {
        student_id: "s4",
        subject: "English",
        school_year: SY,
        assessment_period: "EOSY",
        grade: "Grade 7",
        total_score: 18,
        reading_level: "Frustration",
        iraMetrics: {
          passageLevel: "Grade 5",
          wordReadingPct: 88,
          comprehensionPct: 50,
          readingProfile: "Frustration",
          progressionOutcome: "For Further Review after EOSY",
        },
      },
    ],
  };

  const workflow = getAralReadingWorkflow(learner, "EOSY", SY);
  assert.equal(workflow.learner.currentStepKey, "for_review");
  assert.equal(workflow.learner.currentStepLabel, "ARAL Eligible — For Review");

  const simplified = getSimplifiedAralStatus(workflow.learner);
  assert.equal(simplified.label, "ARAL Eligible — For Review");
  assert.match(simplified.badgeClass, /border-sky/);
});

// ============================================================================
// 5. INCOMPLETE PREREQUISITES & TEACHER FREEDOM
// ============================================================================

test("11. Incomplete earlier prerequisites (BOSY GST < 28 without Form 3, or absent) are clearly flagged in MOSY/EOSY", () => {
  // Case A: BOSY GST 15 without Form 3 viewed in MOSY
  const missingForm3 = {
    id: "l5",
    studentId: "s5",
    language: "English",
    subject: "English",
    schoolYear: SY,
    philIriRecords: [
      {
        student_id: "s5",
        subject: "English",
        school_year: SY,
        assessment_period: "BOSY",
        total_score: 15,
        reading_level: "Not Assessed",
      },
    ],
  };
  const wfA = getAralReadingWorkflow(missingForm3, "MOSY", SY);
  assert.equal(wfA.hasIncompleteEarlier, true);
  assert.equal(wfA.incompleteEarlierReason, "needs_form3");
  assert.equal(wfA.learner.currentStepKey, "needs_earlier_ira");
  assert.equal(wfA.learner.currentStepLabel, "BOSY Form 3 Needed");

  // Case B: Absent in BOSY viewed in EOSY
  const absentBosy = {
    id: "l6",
    studentId: "s6",
    language: "English",
    subject: "English",
    schoolYear: SY,
    philIriRecords: [
      {
        student_id: "s6",
        subject: "English",
        school_year: SY,
        assessment_period: "BOSY",
        total_score: null,
        isAbsent: true,
        reading_level: "Not Assessed",
        candidate_status: "Absent / For Reschedule",
      },
    ],
  };
  const wfB = getAralReadingWorkflow(absentBosy, "EOSY", SY);
  assert.equal(wfB.hasIncompleteEarlier, true);
  assert.equal(wfB.incompleteEarlierReason, "absent");
  assert.equal(wfB.learner.currentStepKey, "absent_earlier");
  assert.equal(wfB.learner.currentStepLabel, "Absent in BOSY");
});

// ============================================================================
// 6. KPI METRICS & ROSTER ACCURACY
// ============================================================================

test("12. computeAralMetrics accurately counts Completed, Needs Follow-up, and Pending without marking exited learners as Pending", () => {
  const learners = [
    // 1. Exited earlier in BOSY (passing >= 28)
    { currentStepKey: "screening_complete_at_grade" },
    // 2. Exited earlier in MOSY (Form 3 Independent)
    { currentStepKey: "assessment_complete" },
    // 3. Needs Form 3
    { currentStepKey: "needs_individual_assessment" },
    // 4. Incomplete earlier prerequisite Form 3
    { currentStepKey: "needs_earlier_ira" },
    // 5. Absent in active period
    { currentStepKey: "absent_reschedule" },
    // 6. Waiting for assessment (genuine pending)
    { currentStepKey: "waiting_for_assessment" },
    // 7. EOSY ARAL Eligible — For Review
    { currentStepKey: "for_review" },
  ];

  const metrics = computeAralMetrics(learners);
  assert.equal(metrics.total, 7);
  // Total complete = 2 (screening_complete_at_grade + assessment_complete)
  assert.equal(metrics.totalCompleteCount, 2);
  // Needs individual assessment count = 2 (needs_individual_assessment + needs_earlier_ira)
  assert.equal(metrics.needsIndividualAssessmentCount, 2);
  // For review count = 1
  assert.equal(metrics.forReviewCount, 1);
  // Absent count = 1
  assert.equal(metrics.absentCount, 1);
  // Pending count = 1 (waiting_for_assessment only; absent is separated and exited learners are 0)
  assert.equal(metrics.pendingCount, 1);
});
