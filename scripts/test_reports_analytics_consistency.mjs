process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

import assert from "node:assert/strict";
import test from "node:test";
import {
  computeUniqueLearnerCount,
  computeInterventionPerformanceProgress,
  computeMultiTermAcademicTrends,
  buildGwaRiskDistribution,
  passingRateFromGrades,
  averageOf,
} from "../lib/teacher/reportsCalculations.js";
import {
  computeFacilitatorReportData,
  computePrincipalAralReportData,
} from "../lib/reports/aralReportsAggregation.js";
import { getSimplifiedAralStatus } from "../lib/monitoring/aralAcademicStatus.js";

test("T1. Learner deduplication counts unique learners while preserving class seat count", () => {
  // A teacher handles English 7 and Values Ed 7 for the same section
  const mockStudents = [
    { studentId: "s-101", name: "Juan Dela Cruz", subject: "English 7", section: "7-Ramon" },
    { studentId: "s-101", name: "Juan Dela Cruz", subject: "Values Ed 7", section: "7-Ramon" },
    { studentId: "s-102", name: "Maria Santos", subject: "English 7", section: "7-Ramon" },
    { studentId: "s-102", name: "Maria Santos", subject: "Values Ed 7", section: "7-Ramon" },
    { studentId: "s-103", name: "Pedro Penduko", subject: "English 7", section: "7-Ramon" },
  ];

  const uniqueCount = computeUniqueLearnerCount(mockStudents);
  assert.equal(uniqueCount, 3, "Should count 3 unique learners instead of 5 duplicate records");
  assert.equal(mockStudents.length, 5, "Total enrollments remains 5");
});

test("T2. Zero fabricated analytics: failing counts and passing rate are strictly calculated", () => {
  // Real grades with 1 failing, 3 passing, and nulls
  const grades = [85, 90, 72, 78, null, ""];
  const passRate = passingRateFromGrades(grades);
  assert.equal(passRate, 75, "3 passing out of 4 graded = 75%");

  const allPassing = [80, 85, 90];
  const passRateAll = passingRateFromGrades(allPassing);
  assert.equal(passRateAll, 100, "All passing = 100%");

  const failingCount = allPassing.filter((g) => g < 75).length;
  assert.equal(failingCount, 0, "No failing learners should result in 0, not fabricated approximation");
});

test("T3. Before/After intervention performance progression metrics", () => {
  const studentsWithIntervention = [
    {
      id: "s-1",
      name: "Learner One",
      section: "7-Ramon",
      subject: "English",
      monitoringStatus: "Ongoing",
      baselineGrade: 72,
      currentGrade: 78,
    },
    {
      id: "s-2",
      name: "Learner Two",
      section: "7-Ramon",
      subject: "English",
      monitoringStatus: "Completed",
      baselineGrade: 70,
      currentGrade: 75,
    },
    {
      id: "s-3",
      name: "Learner Three",
      section: "7-Ramon",
      subject: "English",
      monitoringStatus: "Needs Follow-Up",
      baselineGrade: 74,
      currentGrade: 71,
    },
  ];

  const progress = computeInterventionPerformanceProgress(studentsWithIntervention);
  assert.equal(progress.totalUnderIntervention, 3);
  assert.equal(progress.improvedCount, 2, "2 learners improved (72->78, 70->75)");
  assert.equal(progress.declinedCount, 1, "1 learner declined (74->71)");
  assert.equal(progress.improvementRate, 67, "2/3 = 67% improvement rate");
  assert.ok(progress.averagePointChange > 0, "Net point gain should be positive");
});

test("T4. Multi-term academic trends evaluation across Terms 1-3", () => {
  const studentsWithTermGrades = [
    {
      studentId: "s-1",
      termGrades: { 1: 75, 2: 78, 3: 82 },
    },
    {
      studentId: "s-2",
      termGrades: { 1: 80, 2: 83, 3: 85 },
    },
  ];

  const trends = computeMultiTermAcademicTrends(studentsWithTermGrades, []);
  assert.equal(trends.length, 3);
  assert.equal(trends[0].term, "Term 1");
  assert.equal(trends[0].averageGrade, 77.5);
  assert.equal(trends[1].term, "Term 2");
  assert.equal(trends[1].averageGrade, 80.5);
  assert.equal(trends[2].term, "Term 3");
  assert.equal(trends[2].averageGrade, 83.5);
});

test("T5. Canonical ARAL reading progression status consistency", () => {
  const mockAralLearners = [
    {
      id: "l-1",
      name: "Learner A",
      grade: "Grade 7",
      language: "English",
      currentStepKey: "waiting_for_assessment",
    },
    {
      id: "l-2",
      name: "Learner B",
      grade: "Grade 7",
      language: "English",
      currentStepKey: "needs_individual_assessment",
    },
    {
      id: "l-3",
      name: "Learner C",
      grade: "Grade 7",
      language: "English",
      currentStepKey: "screening_complete_at_grade",
    },
  ];

  const facilitatorReport = computeFacilitatorReportData(mockAralLearners, {
    schoolYear: "SY 2026-2027",
    aralPeriod: "BOSY",
  });

  assert.equal(facilitatorReport.isFacilitator, true, "Should provide reading analytics for class learners");
  assert.equal(facilitatorReport.summaryCounts.assigned, 3);
  assert.ok(facilitatorReport.assessmentStatusTable.length > 0);

  // Check simplified status mapping
  assert.equal(getSimplifiedAralStatus(mockAralLearners[0]).label, "Pending");
  assert.equal(getSimplifiedAralStatus(mockAralLearners[1]).label, "Needs Assessment");
  assert.equal(getSimplifiedAralStatus(mockAralLearners[2]).label, "Screening Complete");
});

test("T6. Published GWA risk distribution cleanly categorizes learners", () => {
  const students = [
    { studentId: "s-1", riskLevel: "High Risk" },
    { studentId: "s-2", riskLevel: "Moderate Risk" },
    { studentId: "s-3", riskLevel: "Low Risk" },
    { studentId: "s-4", riskLevel: "Pending", predictionsPending: true },
  ];

  const distribution = buildGwaRiskDistribution(students);
  assert.equal(distribution.length, 4);
  assert.equal(distribution.find((d) => d.name === "High Risk")?.value, 1);
  assert.equal(distribution.find((d) => d.name === "Moderate Risk")?.value, 1);
  assert.equal(distribution.find((d) => d.name === "Low Risk")?.value, 1);
  assert.equal(distribution.find((d) => d.name === "Pending Records")?.value, 1);
});

test("T7. computePrincipalAralReportData calculates term movement and outcomes without ReferenceError", () => {
  const learners = [
    {
      id: "l-1",
      name: "Student Alpha",
      grade: "Grade 7",
      section: "Rizal",
      language: "English",
      currentStepKey: "completed",
      outcome: "Completed Support",
      quarter: 1,
    },
    {
      id: "l-2",
      name: "Student Beta",
      grade: "Grade 8",
      section: "Emerald",
      language: "Filipino",
      currentStepKey: "under_aral_support",
      inAralProgram: true,
      quarter: 1,
    },
  ];

  const principalData = computePrincipalAralReportData(learners, {
    schoolYear: "SY 2026-2027",
    quarter: "1",
    aralPeriod: "BOSY",
  });

  assert.ok(principalData, "Report data should be computed");
  assert.equal(principalData.summaryCards.length, 4);
  assert.equal(principalData.termMovement.completedExited, 1);
  assert.equal(principalData.hasOutcomes, true);
  assert.equal(principalData.outcomesTableRows.length, 1);
  assert.equal(principalData.outcomesTableRows[0].outcome, "Completed Support");
});
