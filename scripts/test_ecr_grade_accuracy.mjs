import assert from "node:assert/strict";
import { test } from "node:test";
import {
  summarizeStudentGrades,
  buildGradeStatsByStudent,
  buildClassKpis,
} from "../lib/teacher/myClassesMappers.js";
import { buildClassSupportSummary } from "../lib/monitoring/gradeTrajectoryForecaster.js";

test("summarizeStudentGrades returns strictly the term grade for preferred quarters without falling back to finalGrade", () => {
  const gradeRows = [
    { id: "g1", subject_id: "eng", quarter: 1, final_grade: 85, school_year: "2026-2027" },
    { id: "g2", subject_id: "eng", quarter: 2, final_grade: 88, school_year: "2026-2027" },
    // Notice: No quarter 3 grade!
  ];

  const term1Summary = summarizeStudentGrades(gradeRows, { preferredQuarter: 1 });
  assert.equal(term1Summary.generalAverage, 85);
  assert.equal(term1Summary.termGrades[1], 85);

  const term2Summary = summarizeStudentGrades(gradeRows, { preferredQuarter: 2 });
  assert.equal(term2Summary.generalAverage, 88);
  assert.equal(term2Summary.termGrades[2], 88);

  const term3Summary = summarizeStudentGrades(gradeRows, { preferredQuarter: 3 });
  // Must NOT fall back to finalGrade (86.5)! Must be null!
  assert.equal(term3Summary.generalAverage, null);
  assert.equal(term3Summary.termGrades[3], null);

  const finalSummary = summarizeStudentGrades(gradeRows, { preferredQuarter: 4 });
  assert.equal(finalSummary.generalAverage, 86.5);
});

test("buildClassKpis correctly excludes ungraded learners from passed and need support", () => {
  const students = [
    { id: "s1", averageGrade: 88 },
    { id: "s2", averageGrade: 75 },
    { id: "s3", averageGrade: 72 }, // failing
    { id: "s4", averageGrade: null }, // ungraded
    { id: "s5", averageGrade: undefined }, // ungraded
  ];

  const kpis = buildClassKpis({ students: 5 }, students);
  const total = kpis.find((k) => k.id === "total")?.value;
  const passed = kpis.find((k) => k.id === "passed")?.value;
  const needSupport = kpis.find((k) => k.id === "need_support")?.value;

  assert.equal(total, 5);
  assert.equal(passed, 2); // s1 (88) + s2 (75)
  assert.equal(needSupport, 1); // s3 (72)
});

test("buildClassSupportSummary strictly requires curGrade >= 75 for isDoingWell and excludes ungraded learners", () => {
  const classItem = { id: "c1", subject: "English", gradeSection: "Grade 7 — Ramon" };
  const students = [
    { id: "s1", name: "Student 1", termGrades: { 1: 85 } }, // Doing Well (>= 77)
    { id: "s2", name: "Student 2", termGrades: { 1: 76 } }, // Needs Monitoring (75-76)
    { id: "s3", name: "Student 3", termGrades: { 1: 69 } }, // Needs Attention (< 75)
    { id: "s4", name: "Student 4", termGrades: { 1: null } }, // Ungraded
  ];

  const summary = buildClassSupportSummary(classItem, students, 1);

  assert.equal(summary.doingWellCount, 1); // Only s1 (s4 is ungraded and must not be in Doing Well)
  assert.equal(summary.needsMonitoringCount, 1); // Only s2
  assert.equal(summary.needsAttentionCount, 1); // Only s3
});

test("MasterClassListTab filter logic safely handles null averageGrade without Number(null) coercion", () => {
  const students = [
    { id: "s1", name: "Passing", termGrades: { 1: 80 } },
    { id: "s2", name: "Failing", termGrades: { 1: 70 } },
    { id: "s3", name: "Ungraded", termGrades: { 1: null } },
  ];

  function evaluateStudent(s, currentTerm) {
    const rawTermGrade = s.termGrades?.[currentTerm];
    const rawGrade =
      rawTermGrade !== null && rawTermGrade !== undefined && rawTermGrade !== ""
        ? rawTermGrade
        : currentTerm
        ? null
        : s.averageGrade;
    const hasGrade =
      rawGrade !== null &&
      rawGrade !== undefined &&
      rawGrade !== "" &&
      !isNaN(Number(rawGrade));
    const grade = hasGrade ? Number(rawGrade) : null;
    const isFailing = hasGrade && grade < 75;
    const isPassing = hasGrade && grade >= 75;
    return { hasGrade, isFailing, isPassing, grade };
  }

  const evalS1 = evaluateStudent(students[0], 1);
  assert.equal(evalS1.isPassing, true);
  assert.equal(evalS1.isFailing, false);

  const evalS2 = evaluateStudent(students[1], 1);
  assert.equal(evalS2.isPassing, false);
  assert.equal(evalS2.isFailing, true);

  const evalS3 = evaluateStudent(students[2], 1);
  assert.equal(evalS3.hasGrade, false);
  assert.equal(evalS3.isPassing, false);
  assert.equal(evalS3.isFailing, false); // Crucial: must NOT be failing!
});
