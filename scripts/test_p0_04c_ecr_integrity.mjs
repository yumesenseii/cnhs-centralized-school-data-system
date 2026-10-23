#!/usr/bin/env node
/**
 * P0-04C/P0-04E — ECR import & publication data integrity tests
 * Synthetic fixtures only. No production DB writes.
 */

import assert from "node:assert/strict";
import {
  buildTermAccessMap,
  buildTermSheetAccessMap,
  canWriteTerm,
  normalizeAcademicTerm,
  normalizeSchoolYear,
  readConfiguredTerm,
  resolveTermAccess,
  resolveTermSheetAccess,
} from "../lib/academic/academicTermPolicy.js";
import {
  classifyGradeChange,
  isValidGrade,
  partitionGradeWrites,
} from "../lib/ecr/gradeIntegrity.js";
import { buildImportPlan } from "../lib/eclass/importIntegrity.js";

function testSheetPolicy() {
  // Draft terms are editable for any Term 1–3 (teacher-controlled workflow).
  for (const term of [1, 2, 3]) {
    const access = resolveTermSheetAccess({ term, sheetStatus: "draft" });
    assert.equal(access.editable, true, `term ${term} draft editable`);
    assert.equal(access.publishable, true, `term ${term} draft publishable`);
  }

  // Published sheets are protected; only an explicit correction unlocks writes.
  const published = resolveTermSheetAccess({ term: 2, sheetStatus: "published" });
  assert.equal(published.editable, false);
  assert.equal(published.requiresCorrectionConfirmation, true);

  // Undefined sheet status fails closed.
  const unknown = resolveTermSheetAccess({ term: 1, sheetStatus: undefined });
  assert.equal(unknown.editable, false);

  // Non-academic terms are never a grading import target.
  const final = resolveTermSheetAccess({ term: 4, sheetStatus: "draft" });
  assert.equal(final.editable, false);
  assert.equal(final.code, "not_a_grading_term");

  const map = buildTermSheetAccessMap({
    sheetStatuses: { 1: "published", 2: "draft", 3: undefined },
  });
  assert.equal(map[1].editable, false);
  assert.equal(map[1].requiresCorrectionConfirmation, true);
  assert.equal(map[2].editable, true);
  assert.notEqual(map[3].editable, true);
}

function testLegacyPolicyHelpers() {
  // Fail-safe unconfigured (legacy global policy still exposed for tests).
  const unconfigured = resolveTermAccess({ targetTerm: 1, currentTerm: null });
  assert.equal(unconfigured.allowed, false);
  assert.equal(unconfigured.code, "current_term_unconfigured");

  const t1 = resolveTermAccess({ targetTerm: 1, currentTerm: 1 });
  assert.equal(canWriteTerm(t1), true);

  const t1Locked = resolveTermAccess({ targetTerm: 1, currentTerm: 2 });
  assert.equal(t1Locked.allowed, false);

  const q4 = resolveTermAccess({ targetTerm: 4, currentTerm: 3 });
  assert.equal(q4.code, "not_a_grading_term");

  const map = buildTermAccessMap({ currentTerm: 2, schoolYear: "2026-2027" });
  assert.ok(map[1].readonly);
  assert.ok(map[2].editable);
  assert.ok(map[3].hidden);

  assert.equal(normalizeAcademicTerm(2), 2);
  assert.equal(normalizeAcademicTerm("Term 3"), 3);
  assert.equal(normalizeAcademicTerm(4), null);
  assert.equal(normalizeSchoolYear("SY 2026-2027"), "2026-2027");
  assert.equal(readConfiguredTerm({ currentTerm: 2 }), 2);
}

function testGradeIntegrity() {
  assert.equal(isValidGrade(85), true);
  assert.equal(isValidGrade(74), true);
  assert.equal(isValidGrade(100), true);
  assert.equal(isValidGrade(101), false);

  // classifyGradeChange
  assert.equal(classifyGradeChange({ incoming: 90, existing: null }).type ?? classifyGradeChange({ incoming: 90, existing: null }), "new");
  const cNew = classifyGradeChange({ incoming: 90, existing: null });
  assert.equal(cNew, "new");
  const cSame = classifyGradeChange({ incoming: 90, existing: 90 });
  assert.equal(cSame, "unchanged");
  const cDiff = classifyGradeChange({ incoming: 90, existing: 85 });
  assert.equal(cDiff, "conflicting");
  const cPreserved = classifyGradeChange({ incoming: null, existing: 85 });
  assert.equal(cPreserved, "preserved");
  const cMissing = classifyGradeChange({ incoming: null, existing: null });
  assert.equal(cMissing, "missing");
  const cInvalid = classifyGradeChange({ incoming: 150, existing: 85 });
  assert.equal(cInvalid, "invalid");

  // partitionGradeWrites: null/blank/invalid never written
  const parts = partitionGradeWrites([
    {
      student_id: "s1",
      class_id: "c1",
      subject_id: "sub1",
      quarter: 2,
      school_year: "2026-2027",
      final_grade: null,
    },
    {
      student_id: "s2",
      class_id: "c1",
      subject_id: "sub1",
      quarter: 2,
      school_year: "2026-2027",
      final_grade: "",
    },
    {
      student_id: "s3",
      class_id: "c1",
      subject_id: "sub1",
      quarter: 2,
      school_year: "2026-2027",
      final_grade: 150,
    },
    {
      student_id: "s4",
      class_id: "c1",
      subject_id: "sub1",
      quarter: 2,
      school_year: "2026-2027",
      final_grade: 90,
    },
  ]);
  assert.equal(parts.writable.length, 1);
  assert.equal(parts.writable[0].final_grade, 90);
  const reasons = parts.skipped.map((row) => row.reason);
  assert.ok(reasons.includes("missing_grade"));
  assert.ok(reasons.includes("invalid_grade"));

  // malformed keys are never written
  const badKey = partitionGradeWrites([
    {
      student_id: null,
      class_id: "c1",
      subject_id: "sub1",
      quarter: 2,
      school_year: "2026-2027",
      final_grade: 88,
    },
  ]);
  assert.equal(badKey.writable.length, 0);
  assert.equal(badKey.skipped[0].reason, "invalid_key");

  // cross-quarter rows keep distinct keys
  const crossTerm = partitionGradeWrites([
    {
      student_id: "s1",
      class_id: "c1",
      subject_id: "sub1",
      quarter: 1,
      school_year: "2026-2027",
      final_grade: 88,
    },
    {
      student_id: "s1",
      class_id: "c1",
      subject_id: "sub1",
      quarter: 2,
      school_year: "2026-2027",
      final_grade: 90,
    },
  ]);
  assert.equal(crossTerm.writable.length, 2);
}

function testImportIntegrity() {
  const plan = buildImportPlan({
    learners: [
      { index: 0, student_number: "123", full_name: "A B", quarterly_grade: 90 },
      { index: 1, student_number: "124", full_name: "C D", quarterly_grade: 91 },
    ],
    studentIds: ["s1", "s2"],
    targetTerm: 2,
    existingGradesByStudent: new Map([["s1", 90]]),
    publishedStudentIds: new Set(),
    uploadedLrnCounts: new Map([["123", 1], ["124", 1]]),
  });
  assert.equal(plan.importable.length, 2);
  assert.equal(plan.counts.unchanged, 1);
  assert.equal(plan.counts.new, 1);

  // Published conflicts are never auto-written.
  const publishedPlan = buildImportPlan({
    learners: [
      { index: 0, student_number: "123", full_name: "A B", quarterly_grade: 88 },
    ],
    studentIds: ["s1"],
    targetTerm: 1,
    existingGradesByStudent: new Map([["s1", 90]]),
    publishedStudentIds: new Set(["s1"]),
    uploadedLrnCounts: new Map([["123", 1]]),
  });
  assert.equal(publishedPlan.importable.length, 0);
  assert.equal(publishedPlan.publishedConflicts.length, 1);
}

function main() {
  testSheetPolicy();
  testLegacyPolicyHelpers();
  testGradeIntegrity();
  testImportIntegrity();
  console.log("P0-04C/P0-04E integrity tests: PASSED");
}

main();
