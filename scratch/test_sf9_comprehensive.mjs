import assert from "node:assert";
import {
  normalizeGradeLevel,
  formatStudentForSf9,
  validateSf9ReleaseEligibility,
  OFFICIAL_SUBJECT_KEYS,
} from "../lib/reports/sf9DataService.js";
import { generateSf9PdfDocument } from "../lib/reports/sf9PdfGenerator.js";

console.log("=== 1. Testing normalizeGradeLevel ===");
assert.strictEqual(normalizeGradeLevel("Grade 7"), "7", "Expected '7' for 'Grade 7'");
assert.strictEqual(normalizeGradeLevel(7), "7", "Expected '7' for numeric 7");
assert.strictEqual(normalizeGradeLevel("7"), "7", "Expected '7' for string '7'");
assert.strictEqual(normalizeGradeLevel(null), "7", "Expected '7' fallback for null");
assert.strictEqual(normalizeGradeLevel(undefined), "7", "Expected '7' fallback for undefined");
assert.strictEqual(normalizeGradeLevel("Grade 10"), "10", "Expected '10' for 'Grade 10'");
assert.strictEqual(normalizeGradeLevel(10), "10", "Expected '10' for numeric 10");
assert.strictEqual(normalizeGradeLevel(""), "7", "Expected '7' fallback for empty string");
console.log("✓ All normalizeGradeLevel assertions PASSED!");

console.log("\n=== 2. Testing formatStudentForSf9 (Type-safety & field normalization) ===");
const learnerWithNumericGrade = {
  id: "student-uuid-01",
  studentId: "student-uuid-01",
  student_number: "104793160001",
  first_name: "Yuka",
  last_name: "Nemoto",
  gradeLevel: 7, // NUMERIC integer, previously threw TypeError: replace is not a function
  sectionName: "Gumamela",
  adviserName: "Yukari Nemoto",
  grades: {
    english: { t1: 88, t2: 89, t3: 90 },
  },
};

const formatted1 = formatStudentForSf9(learnerWithNumericGrade);
assert.strictEqual(formatted1.gradeLevel, "7", "gradeLevel should be normalized to string '7'");
assert.strictEqual(formatted1.lrn, "104793160001", "LRN should match");
assert.strictEqual(formatted1.lastName, "Nemoto", "lastName should match");
assert.strictEqual(formatted1.firstName, "Yuka", "firstName should match");
assert.strictEqual(formatted1.grades.english.t1, 88, "grades.english.t1 should be preserved");
console.log("✓ Numeric gradeLevel formatStudentForSf9 PASSED without runtime error!");

console.log("\n=== 3. Testing Distinct Learner Previews (Ensuring no stale state) ===");
const learner2 = {
  id: "student-uuid-02",
  studentId: "student-uuid-02",
  student_number: "104793160002",
  first_name: "Juan",
  last_name: "Dela Cruz",
  gradeLevel: "Grade 7",
  sectionName: "Gumamela",
  adviserName: "Yukari Nemoto",
};

const formatted2 = formatStudentForSf9(learner2);
assert.notStrictEqual(formatted1.id, formatted2.id, "Learner IDs must be distinct");
assert.notStrictEqual(formatted1.lrn, formatted2.lrn, "LRNs must be distinct");
assert.strictEqual(formatted2.firstName, "Juan");
assert.strictEqual(formatted2.lastName, "Dela Cruz");
console.log("✓ Distinct learner data isolation PASSED!");

console.log("\n=== 4. Testing validateSf9ReleaseEligibility ===");
// Case A: 0 of 8 published subjects (like current Gumamela state)
const emptySection = { id: "sec-gumamela", sectionName: "Gumamela" };
const validationIncomplete = validateSf9ReleaseEligibility(formatted1, emptySection, { requiredTerms: [1] });
assert.strictEqual(validationIncomplete.isEligible, false, "Should NOT be eligible when subjects are missing");
assert.strictEqual(validationIncomplete.canRelease, false, "Release should be blocked");
assert(validationIncomplete.missing.length >= 7, `Expected missing list to contain unrecorded subjects, got: ${validationIncomplete.missing.length}`);
console.log(`✓ Incomplete SF9 release blocked properly! Missing ${validationIncomplete.missing.length} items:`, validationIncomplete.missing.slice(0, 3), "...");

// Case B: Complete grades across all required subjects
const completeGrades = {};
OFFICIAL_SUBJECT_KEYS.forEach((subj) => {
  if (subj.isComposite) {
    subj.subAreas.forEach((sub) => {
      completeGrades[sub.key] = { t1: 85, t2: 86, t3: 87 };
    });
  } else {
    completeGrades[subj.key] = { t1: 88, t2: 89, t3: 90 };
  }
});

const learnerComplete = {
  ...formatted1,
  section_id: "sec-gumamela",
  grades: completeGrades,
};
const validationComplete = validateSf9ReleaseEligibility(learnerComplete, emptySection, { requiredTerms: [1] });
assert.strictEqual(validationComplete.isEligible, true, "Should be eligible when all required subjects have grades");
assert.strictEqual(validationComplete.canRelease, true, "Release should be permitted");
assert.strictEqual(validationComplete.missing.length, 0, "No missing items expected");
console.log("✓ Complete SF9 release eligibility verified PASSED!");

console.log("\n=== 5. Testing Official DepEd SF9 PDF Generation ===");
const doc1 = generateSf9PdfDocument(formatted1, "2026-2027");
assert(doc1, "PDF document 1 must be created");
const doc2 = generateSf9PdfDocument(formatted2, "2026-2027");
assert(doc2, "PDF document 2 must be created");
console.log("✓ Official SF9 PDF generation for multiple learners PASSED!");

console.log("\n ALL COMPREHENSIVE SF9 UNIT TESTS PASSED SUCCESSFULLY! ");
