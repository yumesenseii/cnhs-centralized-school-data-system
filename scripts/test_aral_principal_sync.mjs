import test from "node:test";
import assert from "node:assert/strict";

import {
  saveBatchClassGstScores,
  saveSinglePhilIriResult,
  savePhilIriBaselineRecords,
} from "../lib/supabase/queries/monitoring.js";
import { getAralReadingWorkflow } from "../lib/monitoring/aralReadingWorkflow.js";
import {
  aggregateAralLearners,
  computeAralMetrics,
} from "../lib/monitoring/aralLearnerAggregation.js";
import { buildMonitoringRosterShell } from "../lib/teacher/monitoringMappers.js";
import { getSimplifiedAralStatus } from "../lib/monitoring/aralAcademicStatus.js";

// Mock Supabase in-memory DB store for testing synchronization
function createMockSupabase(initialRows = []) {
  const store = {
    phil_iri_baseline_records: [...initialRows],
    classes: [
      {
        id: "class-eng-1",
        school_year: "SY 2026-2027",
        quarter: 1,
        subject_id: "subj-eng",
        section_id: "sec-1",
        teacher_id: "teacher-1",
        subjects: { id: "subj-eng", subject_name: "English 7", subject_code: "ENG7" },
        sections: { id: "sec-1", section_name: "Sampaguita", grade_level: 7, school_year: "SY 2026-2027" },
        teachers: { id: "teacher-1", first_name: "Maria", middle_name: "S", last_name: "Santos" },
      },
      {
        id: "class-fil-1",
        school_year: "SY 2026-2027",
        quarter: 1,
        subject_id: "subj-fil",
        section_id: "sec-1",
        teacher_id: "teacher-2",
        subjects: { id: "subj-fil", subject_name: "Filipino 7", subject_code: "FIL7" },
        sections: { id: "sec-1", section_name: "Sampaguita", grade_level: 7, school_year: "SY 2026-2027" },
        teachers: { id: "teacher-2", first_name: "Juan", middle_name: "D", last_name: "Dela Cruz" },
      },
      {
        id: "class-math-1",
        school_year: "SY 2026-2027",
        quarter: 1,
        subject_id: "subj-math",
        section_id: "sec-1",
        teacher_id: "teacher-3",
        subjects: { id: "subj-math", subject_name: "Mathematics 7", subject_code: "MATH7" },
        sections: { id: "sec-1", section_name: "Sampaguita", grade_level: 7, school_year: "SY 2026-2027" },
        teachers: { id: "teacher-3", first_name: "Ana", middle_name: "M", last_name: "Reyes" },
      },
    ],
    class_students: [
      {
        id: "cs-1",
        class_id: "class-eng-1",
        student_id: "stud-1",
        students: { id: "stud-1", student_number: "2026-0001", first_name: "Juan", last_name: "Luna", sex: "Male", section_id: "sec-1" },
      },
      {
        id: "cs-2",
        class_id: "class-eng-1",
        student_id: "stud-2",
        students: { id: "stud-2", student_number: "2026-0002", first_name: "Maria", last_name: "Clara", sex: "Female", section_id: "sec-1" },
      },
      {
        id: "cs-3",
        class_id: "class-fil-1",
        student_id: "stud-1",
        students: { id: "stud-1", student_number: "2026-0001", first_name: "Juan", last_name: "Luna", sex: "Male", section_id: "sec-1" },
      },
      {
        id: "cs-4",
        class_id: "class-math-1",
        student_id: "stud-1",
        students: { id: "stud-1", student_number: "2026-0001", first_name: "Juan", last_name: "Luna", sex: "Male", section_id: "sec-1" },
      },
    ],
    grades: [],
    monitoring_records: [],
  };

  const client = {
    from(table) {
      const data = store[table] || [];
      let filters = [];
      let selects = "*";
      let isSingle = false;
      let isMaybeSingle = false;

      const builder = {
        select(fields = "*") {
          selects = fields;
          return builder;
        },
        eq(col, val) {
          filters.push((row) => String(row[col]) === String(val));
          return builder;
        },
        in(col, vals) {
          const set = new Set(vals.map(String));
          filters.push((row) => set.has(String(row[col])));
          return builder;
        },
        order() {
          return builder;
        },
        single() {
          isSingle = true;
          return builder;
        },
        maybeSingle() {
          isMaybeSingle = true;
          return builder;
        },
        then(resolve) {
          let rows = data.filter((row) => filters.every((fn) => fn(row)));
          if (isSingle) {
            resolve({ data: rows[0] || null, error: rows[0] ? null : new Error("Not found") });
          } else if (isMaybeSingle) {
            resolve({ data: rows[0] || null, error: null });
          } else {
            resolve({ data: rows, error: null });
          }
        },
        async upsert(payloads, opts = {}) {
          const list = Array.isArray(payloads) ? payloads : [payloads];
          const onConflictKeys = (opts.onConflict || "student_id,school_year,subject,assessment_period").split(",");
          for (const item of list) {
            const idx = store.phil_iri_baseline_records.findIndex((r) =>
              onConflictKeys.every((k) => String(r[k]) === String(item[k]))
            );
            if (idx >= 0) {
              store.phil_iri_baseline_records[idx] = { ...store.phil_iri_baseline_records[idx], ...item };
            } else {
              store.phil_iri_baseline_records.push({ ...item, id: `phil-${Date.now()}-${Math.random()}` });
            }
          }
          return { data: list, error: null };
        },
      };

      return builder;
    },
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "test-admin" } } }, error: null }),
    },
  };

  return { store, client };
}

test("Teacher saves GST and Form 3 results -> Supabase persists record -> matches in phil_iri_baseline_records", async () => {
  const { store, client } = createMockSupabase();

  // 1. Teacher saves GST score 18 with Form 3 metrics in BOSY
  const saveRes = await saveSinglePhilIriResult({
    studentId: "stud-1",
    classId: "class-eng-1",
    teacherId: "teacher-1",
    schoolYear: "SY 2026-2027",
    subject: "English",
    assessmentPeriod: "BOSY",
    gstScore: 18,
    individualAssessmentRequired: true,
    readingLevel: "Instructional",
    iraMetrics: {
      passageLevel: "Grade 5",
      totalWords: 100,
      miscues: 6,
      readingTimeSeconds: 65,
      comprehensionCorrect: 6,
      comprehensionTotal: 8,
      wordReadingPct: 94,
      comprehensionPct: 75,
      readingRateWpm: 92,
      readingProfile: "Instructional",
      progressionOutcome: "Continue to Next Assessment Period",
    },
    supabaseClient: client,
  });

  assert.equal(saveRes.error, null);
  assert.equal(store.phil_iri_baseline_records.length, 1);

  const saved = store.phil_iri_baseline_records[0];
  assert.equal(saved.student_id, "stud-1");
  assert.equal(saved.subject, "English");
  assert.equal(saved.assessment_period, "BOSY");
  assert.equal(saved.total_score, 18);
  assert.equal(saved.reading_level, "Instructional");
  assert.equal(saved.raw_payload.iraMetrics.passageLevel, "Grade 5");
  assert.equal(saved.raw_payload.iraMetrics.miscues, 6);
  assert.equal(saved.raw_payload.iraMetrics.readingRateWpm, 92);
});

test("Principal roster receives phil_iri_baseline_records and maps onto learners", async () => {
  const { store } = createMockSupabase([
    {
      id: "phil-1",
      student_id: "stud-1",
      class_id: "class-eng-1",
      teacher_id: "teacher-1",
      school_year: "SY 2026-2027",
      subject: "English",
      assessment_period: "BOSY",
      total_score: 35,
      reading_level: "At Grade Level",
      raw_payload: { assessmentPeriod: "BOSY" },
    },
    {
      id: "phil-2",
      student_id: "stud-2",
      class_id: "class-eng-1",
      teacher_id: "teacher-1",
      school_year: "SY 2026-2027",
      subject: "English",
      assessment_period: "BOSY",
      total_score: 18,
      reading_level: "Instructional",
      raw_payload: {
        assessmentPeriod: "BOSY",
        iraMetrics: {
          passageLevel: "Grade 5",
          totalWords: 100,
          miscues: 8,
          readingTimeSeconds: 60,
          comprehensionCorrect: 5,
          comprehensionTotal: 8,
          readingProfile: "Instructional",
          progressionOutcome: "Continue to Next Assessment Period",
        },
      },
    },
  ]);

  // Build shell with mock classes, enrollments, and philIriRecords
  const shell = buildMonitoringRosterShell({
    classes: store.classes,
    enrollments: store.class_students,
    grades: [],
    monitoringRecords: [],
    philIriRecords: store.phil_iri_baseline_records,
  });

  const juanEng = shell.students.find((s) => s.studentId === "stud-1" && s.subject.includes("English"));
  assert.ok(juanEng, "Juan English learner must exist");
  assert.equal(juanEng.philIriScore, 35);
  assert.equal(juanEng.philIriRecords.length, 1);

  const mariaEng = shell.students.find((s) => s.studentId === "stud-2" && s.subject.includes("English"));
  assert.ok(mariaEng, "Maria English learner must exist");
  assert.equal(mariaEng.philIriScore, 18);
  assert.equal(mariaEng.readingLevel, "Instructional");

  // Non-language class (Math) does not steal English Phil-IRI score
  const juanMath = shell.students.find((s) => s.studentId === "stud-1" && s.subject.includes("Mathematics"));
  assert.ok(juanMath, "Juan Math learner must exist");
  assert.equal(juanMath.philIriScore, null, "Non-language class must not falsely adopt English Phil-IRI score");
});

test("Principal ARAL aggregation: English and Filipino remain isolated and deduplicated", () => {
  const { store } = createMockSupabase([
    {
      id: "phil-eng-1",
      student_id: "stud-1",
      subject: "English",
      school_year: "SY 2026-2027",
      assessment_period: "BOSY",
      total_score: 32,
      reading_level: "At Grade Level",
      raw_payload: { assessmentPeriod: "BOSY" },
    },
    {
      id: "phil-fil-1",
      student_id: "stud-1",
      subject: "Filipino",
      school_year: "SY 2026-2027",
      assessment_period: "BOSY",
      total_score: 16,
      reading_level: "Frustration",
      raw_payload: {
        assessmentPeriod: "BOSY",
        iraMetrics: {
          passageLevel: "Baitang 4",
          totalWords: 100,
          miscues: 12,
          readingTimeSeconds: 70,
          comprehensionCorrect: 3,
          comprehensionTotal: 8,
          readingProfile: "Frustration",
          progressionOutcome: "Continue to Next Assessment Period",
        },
      },
    },
  ]);

  const shell = buildMonitoringRosterShell({
    classes: store.classes,
    enrollments: store.class_students,
    philIriRecords: store.phil_iri_baseline_records,
  });

  const canonical = aggregateAralLearners(shell.students, {
    schoolYear: "SY 2026-2027",
    role: "principal",
    scope: "school-wide",
  });

  // Exactly 2 reading cases for stud-1: 1 English, 1 Filipino
  const stud1Cases = canonical.filter((c) => c.studentId === "stud-1");
  assert.equal(stud1Cases.length, 2);

  const engCase = stud1Cases.find((c) => c.language === "English");
  const filCase = stud1Cases.find((c) => c.language === "Filipino");

  assert.ok(engCase);
  assert.ok(filCase);
  assert.equal(engCase.philIriScore, 32);
  assert.equal(filCase.philIriScore, 16);
  assert.equal(filCase.readingLevel, "Frustration");

  // Assessor teacher is correctly resolved by subject
  assert.ok(engCase.assessorTeacherName.includes("Santos"));
  assert.ok(filCase.assessorTeacherName.includes("Dela Cruz"));
});

test("A learner who completed assessment earlier is NOT marked as Pending in later periods", () => {
  const learner = {
    id: "learner-1",
    studentId: "stud-1",
    language: "English",
    subject: "English",
    schoolYear: "SY 2026-2027",
    philIriRecords: [
      {
        student_id: "stud-1",
        school_year: "SY 2026-2027",
        subject: "English",
        assessment_period: "BOSY",
        total_score: 35,
        reading_level: "At Grade Level",
        raw_payload: { assessmentPeriod: "BOSY" },
      },
    ],
  };

  // 1. In BOSY: Screening Complete
  const bosyFlow = getAralReadingWorkflow(learner, "BOSY");
  assert.equal(bosyFlow.learner.currentStepKey, "screening_complete_at_grade");
  const bosyStatus = getSimplifiedAralStatus(bosyFlow.learner);
  assert.equal(bosyStatus.label, "Screening Complete");

  // 2. In MOSY: Completed earlier, NOT Pending!
  const mosyFlow = getAralReadingWorkflow(learner, "MOSY");
  assert.notEqual(mosyFlow.learner.currentStepKey, "waiting_for_assessment");
  assert.equal(mosyFlow.learner.currentStepKey, "screening_complete_at_grade");
  assert.equal(mosyFlow.learner.currentStepLabel, "Completed (Earlier Period)");
  assert.equal(mosyFlow.learner.philIriScore, 35);

  const mosyStatus = getSimplifiedAralStatus(mosyFlow.learner);
  assert.equal(mosyStatus.label, "Screening Complete");
  assert.notEqual(mosyStatus.label, "Pending");

  // 3. In EOSY: Completed earlier, NOT Pending!
  const eosyFlow = getAralReadingWorkflow(learner, "EOSY");
  assert.notEqual(eosyFlow.learner.currentStepKey, "waiting_for_assessment");
  assert.equal(eosyFlow.learner.currentStepKey, "screening_complete_at_grade");

  const eosyStatus = getSimplifiedAralStatus(eosyFlow.learner);
  assert.equal(eosyStatus.label, "Screening Complete");
});

test("computeAralMetrics accurately counts Completed, Needs Follow-up, and Pending", () => {
  const learners = [
    // 1. Completed at grade level (GST >= 28)
    { currentStepKey: "screening_complete_at_grade" },
    // 2. Completed Form 3
    { currentStepKey: "assessment_complete", readingLevel: "Instructional" },
    // 3. Needs Individual Assessment (GST < 28 without Form 3)
    { currentStepKey: "needs_individual_assessment" },
    // 4. Needs earlier Form 3
    { currentStepKey: "needs_earlier_ira" },
    // 5. Absent for reschedule
    { currentStepKey: "absent_reschedule" },
    // 6. For Further Review (EOSY persistent need)
    { currentStepKey: "for_review" },
    // 7. Pending initial screening
    { currentStepKey: "waiting_for_assessment" },
  ];

  const metrics = computeAralMetrics(learners);

  // Total
  assert.equal(metrics.total, 7);
  // Total complete count: items 1 and 2 = 2
  assert.equal(metrics.totalCompleteCount, 2);
  // Needs individual assessment count: items 3 and 4 = 2
  assert.equal(metrics.needsIndividualAssessmentCount, 2);
  // Absent: item 5 = 1
  assert.equal(metrics.absentCount, 1);
  // For Review: item 6 = 1
  assert.equal(metrics.forReviewCount, 1);
  // Pending count: item 7 = 1
  assert.equal(metrics.pendingCount, 1);

  // Oversight summary counts
  const completed = metrics.totalCompleteCount;
  const needsFollowUp = metrics.needsIndividualAssessmentCount + metrics.forReviewCount + metrics.absentCount;
  const pending = Math.max(0, metrics.waitingForAssessmentCount - metrics.absentCount);

  assert.equal(completed, 2);
  assert.equal(needsFollowUp, 4); // needs_individual_assessment (1) + needs_earlier_ira (1) + for_review (1) + absent (1)
  assert.equal(pending, 1);
  assert.equal(completed + needsFollowUp + pending, 7);
});

test("Correction history shows both period corrections and cross-period audit history", () => {
  const learner = {
    rawPayload: {
      auditTrail: [
        {
          action: "assessment_corrected",
          reason: "Fixed scoring error in Form 1B",
          previousScore: 22,
          previousReadingLevel: "Not Assessed",
          timestamp: "2026-06-15T08:00:00.000Z",
        },
      ],
    },
    philIriRecords: [
      {
        assessment_period: "BOSY",
        raw_payload: {
          auditTrail: [
            {
              action: "assessment_corrected",
              reason: "Fixed scoring error in Form 1B",
              previousScore: 22,
              previousReadingLevel: "Not Assessed",
              timestamp: "2026-06-15T08:00:00.000Z",
            },
            {
              action: "assessment_corrected",
              reason: "Recalculated Form 3 passage miscues",
              previousScore: 18,
              previousReadingLevel: "Frustration",
              timestamp: "2026-06-16T10:00:00.000Z",
            },
          ],
        },
      },
    ],
  };

  // Verify deduplication and retrieval across records
  const currentCorrections = (learner?.rawPayload?.auditTrail || []).filter(
    (entry) => entry.action === "assessment_corrected"
  );
  const allRecords = Array.isArray(learner?.philIriRecords) ? learner.philIriRecords : [];
  const otherCorrections = allRecords.flatMap((r) =>
    (r.rawPayload?.auditTrail || r.raw_payload?.auditTrail || []).filter(
      (entry) => entry.action === "assessment_corrected"
    )
  );

  const seen = new Set();
  const corrections = [...currentCorrections, ...otherCorrections].filter((entry) => {
    const key = `${entry.timestamp}_${entry.reason}_${entry.action}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  assert.equal(corrections.length, 2);
  assert.equal(corrections[0].reason, "Fixed scoring error in Form 1B");
  assert.equal(corrections[1].reason, "Recalculated Form 3 passage miscues");
});
