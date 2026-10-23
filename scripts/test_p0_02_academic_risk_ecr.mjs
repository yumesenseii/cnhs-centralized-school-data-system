import { test } from "node:test";
import assert from "node:assert/strict";

import {
  GRADE_RISK_BANDS,
  riskLevelFromGrade,
} from "@/lib/services/recommendation/riskFromGrade";
import { evaluateAcademicSupport } from "@/lib/services/recommendation/academicSupportEngine";
import {
  buildMonitoringRosterShell,
  groupMonitoredStudentsForAdmin,
  applyRecommendationToUiFields,
} from "@/lib/teacher/monitoringMappers";
import { countGradeBands } from "@/lib/admin/reportsMappers";
import { generateDraftPlp } from "@/lib/monitoring/plpGenerator";

// ============================================================================
// 1. EXACT RISK THRESHOLDS & BOUNDARY CONDITIONS
// ============================================================================

test("P0-02 - Risk Thresholds: exact project-defined boundaries", () => {
  assert.strictEqual(GRADE_RISK_BANDS.highBelow, 75);
  assert.strictEqual(GRADE_RISK_BANDS.moderateMax, 80);
  assert.strictEqual(GRADE_RISK_BANDS.lowMin, 80);
  assert.strictEqual(GRADE_RISK_BANDS.passingGrade, 75);

  // Exact boundary values
  assert.strictEqual(riskLevelFromGrade(74.99), "High Risk", "74.99 must be High Risk");
  assert.strictEqual(riskLevelFromGrade(75.0), "Moderate Risk", "75.00 must be Moderate Risk");
  assert.strictEqual(riskLevelFromGrade(79.99), "Moderate Risk", "79.99 must be Moderate Risk");
  assert.strictEqual(riskLevelFromGrade(80.0), "Moderate Risk", "80.00 must be Moderate Risk");
  assert.strictEqual(riskLevelFromGrade(80.01), "Low Risk", "80.01 must be Low Risk");
  assert.strictEqual(riskLevelFromGrade(84.0), "Low Risk", "84.00 must be Low Risk");
  assert.strictEqual(riskLevelFromGrade(85.0), "Low Risk", "85.00 must be Low Risk");
  assert.strictEqual(riskLevelFromGrade(95.5), "Low Risk", "95.50 must be Low Risk");
});

// ============================================================================
// 2. MISSING / NULL / UNDEFINED / EMPTY VALUES COERCION SAFETY
// ============================================================================

test("P0-02 - Coercion Safety: reject null, undefined, empty strings, and invalid values before numeric comparison", () => {
  // In JS: Number(null) === 0, Number("") === 0. They must NOT evaluate to High Risk!
  assert.strictEqual(riskLevelFromGrade(null), "—", "null must be neutral '—'");
  assert.strictEqual(riskLevelFromGrade(undefined), "—", "undefined must be neutral '—'");
  assert.strictEqual(riskLevelFromGrade(""), "—", "empty string must be neutral '—'");
  assert.strictEqual(riskLevelFromGrade("   "), "—", "whitespace string must be neutral '—'");
  assert.strictEqual(riskLevelFromGrade("—"), "—", "em-dash must be neutral '—'");
  assert.strictEqual(riskLevelFromGrade("Pending"), "—", "'Pending' must be neutral '—'");
  assert.strictEqual(riskLevelFromGrade("N/A"), "—", "'N/A' must be neutral '—'");
  assert.strictEqual(riskLevelFromGrade(NaN), "—", "NaN must be neutral '—'");
  assert.strictEqual(riskLevelFromGrade(Infinity), "—", "Infinity must be neutral '—'");
  assert.strictEqual(riskLevelFromGrade(-1), "—", "negative grade out of 0-100 range must be neutral '—'");
  assert.strictEqual(riskLevelFromGrade(105), "—", "grade > 100 out of range must be neutral '—'");
});

// ============================================================================
// 3. CURRENT-TERM ISOLATION IN buildMonitoringRosterShell
// ============================================================================

test("P0-02 - Current-Term Isolation: missing current-term grade does not fall back to previous terms or Final Grade", () => {
  const enrollments = [
    {
      student_id: "s1",
      section_id: "sec1",
      class_id: "c1",
      classes: {
        id: "c1",
        subject: "Mathematics",
        section: "Diamond",
        grade_level: 7,
        school_year: "SY 2026-2027",
      },
      students: {
        id: "s1",
        lrn: "123456789012",
        first_name: "Juan",
        last_name: "Dela Cruz",
        gender: "Male",
      },
    },
  ];

  // Grade records include:
  // 1. Quarter 1 grade: 88 (previous term)
  // 2. Quarter 4 / Final grade: 85 (legacy final grade record)
  // 3. Quarter 2 (Current Term) has NO record!
  const grades = [
    {
      student_id: "s1",
      class_id: "c1",
      quarter: 1,
      school_year: "SY 2026-2027",
      subject: "Mathematics",
      quarter_grade: 88,
      final_grade: 88,
      is_finalized: true,
    },
    {
      student_id: "s1",
      class_id: "c1",
      quarter: 4,
      school_year: "SY 2026-2027",
      subject: "Mathematics",
      quarter_grade: null,
      final_grade: 85,
      is_finalized: true,
    },
  ];

  const classes = [
    {
      id: "c1",
      subject_id: "subj1",
      section_id: "sec1",
      school_year: "SY 2026-2027",
      quarter: 2, // Current term is Quarter 2
      subjects: { subject_name: "Mathematics" },
      sections: { id: "sec1", section_name: "Diamond", grade_level: 7 },
    },
  ];

  // Querying for Quarter 2 (current term)
  const roster = buildMonitoringRosterShell({
    classes,
    enrollments,
    grades,
  });

  assert.strictEqual(roster.students.length, 1);
  const row = roster.students[0];
  // Must NOT fall back to 88 or 85!
  assert.strictEqual(row.currentGrade, null, "currentGrade must be null for Quarter 2");
  assert.strictEqual(row.classSubjectGrade, null, "classSubjectGrade must be null for Quarter 2");
  assert.strictEqual(row.riskLevel, "—", "riskLevel must be neutral '—' when no current term grade");
});

// ============================================================================
// 4. ECR COMPLETENESS & PROVISIONAL VS COMPLETE STANDING
// ============================================================================

test("P0-02 - Completeness: Incomplete required subjects yield provisional standing", () => {
  const requiredSubjects = [
    "English",
    "Mathematics",
    "Science",
    "Filipino",
    "Araling Panlipunan",
    "MAPEH",
    "Values Education / ESP",
    "TLE",
  ];

  // Only 3 of 8 subjects have finalized grades
  const incompleteResult = evaluateAcademicSupport({
    isCompleteTerm: false,
    requiredSubjects,
    subjects: {
      English: 85,
      Mathematics: 88,
      Science: 82,
    },
  });

  assert.strictEqual(incompleteResult.evaluationStatus, "provisional");
  assert.strictEqual(incompleteResult.missingRequiredSubjects.length, 5);
  assert.strictEqual(
    incompleteResult.officialRiskLevel,
    "Pending Full-Term Evaluation",
    "Official risk must be pending full-term evaluation when incomplete"
  );
  assert.strictEqual(incompleteResult.gwa, null, "GWA must be null when evidence is incomplete");
});

test("P0-02 - Completeness: Draft/unpublished records do not satisfy required subject completeness", () => {
  const requiredSubjects = ["English", "Mathematics", "Science"];

  // Mathematics is draft/unpublished (`isFinalized: false`)
  const draftRecordResult = evaluateAcademicSupport({
    requiredSubjects,
    subjectGrades: [
      { subject: "English", grade: 85, isFinalized: true },
      { subject: "Mathematics", grade: 88, isFinalized: false }, // draft!
      { subject: "Science", grade: 82, isFinalized: true },
    ],
  });

  assert.strictEqual(draftRecordResult.evaluationStatus, "provisional");
  assert.ok(draftRecordResult.missingRequiredSubjects.includes("Mathematics"));
  assert.strictEqual(draftRecordResult.officialRiskLevel, "Pending Full-Term Evaluation");
});

// ============================================================================
// 5. ISOLATION: ONE FAILING SUBJECT WITH COMPLETE PASSING SUBJECTS
// ============================================================================

test("P0-02 - Subject Isolation: One failing subject does NOT turn passing GWA into High Risk", () => {
  const requiredSubjects = [
    "English",
    "Mathematics",
    "Science",
    "Filipino",
    "Araling Panlipunan",
    "MAPEH",
    "ESP",
    "TLE",
  ];

  // Math is 74 (failing), remaining 7 subjects are 88
  // Total = 74 + (7 * 88) = 74 + 616 = 690. GWA = 690 / 8 = 86.25.
  const result = evaluateAcademicSupport({
    isCompleteTerm: true,
    requiredSubjects,
    subjects: {
      English: 88,
      Mathematics: 74,
      Science: 88,
      Filipino: 88,
      "Araling Panlipunan": 88,
      MAPEH: 88,
      ESP: 88,
      TLE: 88,
    },
  });

  assert.strictEqual(result.evaluationStatus, "complete");
  assert.strictEqual(result.gwa, 86.25);
  // GWA > 80 -> Low Risk!
  assert.strictEqual(result.officialRiskLevel, "Low Risk", "Overall risk must be Low Risk based on GWA 86.25");
  assert.strictEqual(result.currentAcademicRisk, "Low Risk");

  // Subject failure is independently isolated
  assert.strictEqual(result.hasFailingSubject, true);
  assert.strictEqual(result.failingSubjectCount, 1);
  assert.strictEqual(result.lowestSubjectGrade, 74);
  assert.deepEqual(result.weakSubjects, ["Mathematics"]);
  assert.strictEqual(
    result.recommendedSupportLevel,
    "Subject-Specific Remediation & Monitoring",
    "Subject remediation recommended for Math without overriding overall GWA band"
  );
});

// ============================================================================
// 6. PRINCIPAL AGGREGATION IN groupMonitoredStudentsForAdmin
// ============================================================================

test("P0-02 - Principal Aggregation: Computes true GWA only when complete; never uses lowest grade", () => {
  const requiredSubjects = [
    "English",
    "Mathematics",
    "Science",
    "Filipino",
    "Araling Panlipunan",
    "MAPEH",
    "ESP",
    "TLE",
  ];

  // Student A: Complete all 8 subjects. Math 74, other 7 subjects 88. True GWA = 86.25.
  const studentARows = requiredSubjects.map((subject, idx) => ({
    studentId: "s-complete",
    studentNumber: "1001",
    name: "Abe, Clara",
    gradeLevel: 7,
    section: "Diamond",
    quarter: 1,
    schoolYear: "SY 2026-2027",
    subject,
    classSubjectGrade: subject === "Mathematics" ? 74 : 88,
    isFinalized: true,
    requiredSubjects,
  }));

  // Student B: Incomplete (only 2 subjects: Math 85, English 88)
  const studentBRows = [
    {
      studentId: "s-incomplete",
      studentNumber: "1002",
      name: "Bonifacio, Andres",
      gradeLevel: 7,
      section: "Diamond",
      quarter: 1,
      schoolYear: "SY 2026-2027",
      subject: "Mathematics",
      classSubjectGrade: 85,
      isFinalized: true,
      requiredSubjects,
    },
    {
      studentId: "s-incomplete",
      studentNumber: "1002",
      name: "Bonifacio, Andres",
      gradeLevel: 7,
      section: "Diamond",
      quarter: 1,
      schoolYear: "SY 2026-2027",
      subject: "English",
      classSubjectGrade: 88,
      isFinalized: true,
      requiredSubjects,
    },
  ];

  const adminAggregated = groupMonitoredStudentsForAdmin([...studentARows, ...studentBRows]);
  assert.strictEqual(adminAggregated.length, 2);

  const aggregatedA = adminAggregated.find((s) => s.studentId === "s-complete");
  assert.ok(aggregatedA);
  // Must NOT be lowest grade 74!
  assert.strictEqual(aggregatedA.generalAverage, 86.25, "generalAverage must be authoritative GWA 86.25, NOT lowest grade");
  assert.strictEqual(aggregatedA.riskLevel, "Low Risk", "Risk level must be Low Risk for GWA 86.25");
  assert.strictEqual(aggregatedA.lowestGrade, 74, "lowestGrade is preserved separately");
  assert.strictEqual(aggregatedA.hasFailingSubject, true, "hasFailingSubject is preserved separately");

  const aggregatedB = adminAggregated.find((s) => s.studentId === "s-incomplete");
  assert.ok(aggregatedB);
  // Must NOT average partial grades 85 & 88 to 86.5!
  assert.strictEqual(aggregatedB.generalAverage, null, "generalAverage must be null when required subjects incomplete");
  assert.strictEqual(aggregatedB.riskLevel, "Pending Full-Term Evaluation");
  assert.strictEqual(aggregatedB.evaluationStatus, "provisional");
});

// ============================================================================
// 7. ADMIN REPORT GRADE BAND COUNTS
// ============================================================================

test("P0-02 - Admin Report Bands: countGradeBands strictly partitions <75, 75-80, >80", () => {
  const testGrades = [
    74.99, // below 75 (High)
    75.0,  // 75-80 (Moderate)
    78.5,  // 75-80 (Moderate)
    80.0,  // 75-80 (Moderate)
    80.01, // above 80 (Low)
    84.0,  // above 80 (Low)
    85.0,  // above 80 (Low)
    92.0,  // above 80 (Low)
    null,  // ignored
    undefined, // ignored
    "",    // ignored
    "invalid", // ignored
  ];

  const counts = countGradeBands(testGrades);
  assert.strictEqual(counts.below75, 1, "Only 74.99 is below 75");
  assert.strictEqual(counts.band75to80, 3, "75.0, 78.5, and 80.0 are in band 75-80");
  assert.strictEqual(counts.above80, 4, "80.01, 84.0, 85.0, and 92.0 are above 80");
  assert.strictEqual(counts.total, 8, "Total valid grades counted must be 8");
});

// ============================================================================
// 8. PLP GENERATOR MODERATE BAND ALIGNMENT
// ============================================================================

test("P0-02 - PLP Alignment: Moderate risk in PLP generator targets >80% threshold", () => {
  const plpResult = generateDraftPlp({
    student: { id: "s-mod", name: "Rizal, Jose", gradeLevel: 9 },
    schoolYear: "SY 2026-2027",
    academicContext: {
      classId: "c-sci",
      subjectName: "Science",
      subjectGrade: 78,
      academicTerm: 1,
      targetTerm: 1,
      overallRisk: "Moderate Risk",
    },
  });

  assert.strictEqual(plpResult.success, true);
  const plan = plpResult.plan;
  assert.strictEqual(plan.overall_risk_level, "Moderate Risk");
  assert.strictEqual(plan.recommended_support_level, "Targeted Academic Reinforcement");
  assert.ok(
    plan.target_objectives.some((o) => o.target.includes("80%")),
    "Target objective for Moderate Risk must align to >80%"
  );
});
