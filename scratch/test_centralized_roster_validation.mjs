import assert from "assert";
import { normalizePersonName, normalizeKey } from "../lib/eclass/normalize.js";
import { splitLearnerName } from "../lib/teacher/myClassesMappers.js";

console.log("=== Testing Centralized Section Membership & E-Record Validation ===");

// 1. Mock Database State
const officialSection = {
  id: "sec-gumamela",
  section_name: "Gumamela",
  grade_level: 7,
  school_year: "2026-2027",
  adviser_id: "teach-anna",
};

const otherSection = {
  id: "sec-sampaguita",
  section_name: "Sampaguita",
  grade_level: 7,
  school_year: "2026-2027",
};

// Official Section Roster established by Adviser (Anna Stilhevia)
const officialRoster = [
  { id: "s-01", student_number: "123456789012", first_name: "Yuka", middle_name: "", last_name: "Rinemoto", sex: "Female", section_id: "sec-gumamela" },
  { id: "s-02", student_number: "123456789013", first_name: "Juan", middle_name: "M.", last_name: "Santos", sex: "Male", section_id: "sec-gumamela" },
  { id: "s-03", student_number: "123456789014", first_name: "Maria", middle_name: "C.", last_name: "Cruz", sex: "Female", section_id: "sec-gumamela" },
];

// Student Master across school (including other sections)
const globalStudentMaster = [
  ...officialRoster,
  { id: "s-04", student_number: "123456789015", first_name: "Pedro", middle_name: "P.", last_name: "Reyes", sex: "Male", section_id: "sec-sampaguita", section: otherSection },
];

// Existing grades in Science Grade 7 Gumamela for Q1
const existingGrades = [
  { id: "g-01", student_id: "s-01", quarter: 1, final_grade: 88, school_year: "2026-2027" },
];

// 2. Incoming Science E-Record Uploaded by Subject Teacher
const uploadedEClassLearners = [
  { student_number: "123456789012", full_name: "Rinemoto, Yuka", gender: "Female", quarterly_grade: 90 }, // Should be DUPLICATE (grade 88 exists)
  { student_number: "123456789013", full_name: "Santos, Juan M.", gender: "Male", quarterly_grade: 85 },   // Should be MATCHED
  { student_number: "123456789014", full_name: "Cruz, Maria C.", gender: "Female", quarterly_grade: 92 },  // Should be MATCHED
  { student_number: "123456789015", full_name: "Reyes, Pedro P.", gender: "Male", quarterly_grade: 84 },   // Should be WRONG_SECTION (belongs to Sampaguita)
  { student_number: "123456789999", full_name: "Dizon, Anna", gender: "Female", quarterly_grade: 86 },     // Should be UNMATCHED (not in CNHS Learn)
];

// 3. Validation Logic Simulation
const officialByLrn = new Map(officialRoster.map((s) => [s.student_number, s]));
const globalByLrn = new Map(globalStudentMaster.map((s) => [s.student_number, s]));
const existingGradeMap = new Map(existingGrades.map((g) => [`${g.student_id}:${g.quarter}`, g]));

const targetQuarter = 1;
const results = uploadedEClassLearners.map((learner) => {
  const lrn = String(learner.student_number).trim();
  const rawFullName = learner.full_name;
  const normalizedKey = normalizePersonName(rawFullName);

  let status = "UNMATCHED";
  let matchedStudent = null;
  let validationMessage = "";
  let defaultIncluded = false;

  if (lrn && officialByLrn.has(lrn)) {
    matchedStudent = officialByLrn.get(lrn);
    const gradeKey = `${matchedStudent.id}:${targetQuarter}`;
    if (existingGradeMap.has(gradeKey)) {
      status = "DUPLICATE";
      validationMessage = `Grade already recorded (${existingGradeMap.get(gradeKey).final_grade}). Check to overwrite.`;
      defaultIncluded = true;
    } else {
      status = "MATCHED";
      validationMessage = "Matched to official section roster.";
      defaultIncluded = true;
    }
  } else if (lrn && globalByLrn.has(lrn)) {
    matchedStudent = globalByLrn.get(lrn);
    status = "WRONG_SECTION";
    validationMessage = `Learner officially belongs to Grade ${matchedStudent.section.grade_level} — ${matchedStudent.section.section_name}.`;
    defaultIncluded = false;
  } else {
    status = "UNMATCHED";
    validationMessage = `No student record found with LRN ${lrn}.`;
    defaultIncluded = false;
  }

  return {
    student_number: lrn,
    full_name: rawFullName,
    status,
    matchedStudent,
    validationMessage,
    defaultIncluded,
  };
});

console.log("Validation Results:");
results.forEach((r, idx) => {
  console.log(`[${r.status}] #${idx + 1} ${r.full_name} (LRN: ${r.student_number}) -> ${r.validationMessage}`);
});

// 4. Assertions
const matched = results.filter((r) => r.status === "MATCHED");
const duplicates = results.filter((r) => r.status === "DUPLICATE");
const wrongSection = results.filter((r) => r.status === "WRONG_SECTION");
const unmatched = results.filter((r) => r.status === "UNMATCHED");

assert.strictEqual(matched.length, 2, "Expected 2 MATCHED learners (Juan Santos, Maria Cruz)");
assert.strictEqual(duplicates.length, 1, "Expected 1 DUPLICATE learner (Yuka Rinemoto)");
assert.strictEqual(wrongSection.length, 1, "Expected 1 WRONG_SECTION learner (Pedro Reyes)");
assert.strictEqual(unmatched.length, 1, "Expected 1 UNMATCHED learner (Anna Dizon)");

// 5. Test Pedro Reyes Wrong Section Rule:
const pedro = wrongSection[0];
assert.strictEqual(pedro.matchedStudent.section_id, "sec-sampaguita", "Pedro Reyes must resolve to Sampaguita");
assert.strictEqual(pedro.defaultIncluded, false, "Wrong Section learner must NOT be checked by default");

// 6. Test Persistence Rule:
// Only confirmed learners with status MATCHED or confirmed DUPLICATE are included
const confirmedForImport = results.filter((r) => r.defaultIncluded);
assert.strictEqual(confirmedForImport.length, 3, "Only Yuka, Juan, and Maria should be imported");
confirmedForImport.forEach((r) => {
  assert.strictEqual(r.matchedStudent.section_id, "sec-gumamela", "Every imported learner must belong to Gumamela");
});

console.log("\n All centralized roster validation tests PASSED successfully!");
