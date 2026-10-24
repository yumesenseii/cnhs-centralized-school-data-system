import assert from "node:assert/strict";
import { normalizePersonName } from "../lib/eclass/normalize.js";

function testRosterMatcher({ officialStudents, uploadedLearners, existingGrades = [], targetQuarter = 3 }) {
  const officialByLrn = new Map();
  const officialByName = new Map();

  function normalizeText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
  }

  function registerOfficialNameKeys(student) {
    const last = normalizeText(student.last_name);
    const first = normalizeText(student.first_name);
    const middle = normalizeText(student.middle_name);
    const middleInitial = middle ? middle[0] : "";

    const addKey = (str) => {
      const k = normalizePersonName(str);
      if (k && !officialByName.has(k)) {
        officialByName.set(k, student);
      }
    };

    if (last && first) {
      if (middle) {
        addKey(`${last}, ${first} ${middle}`);
        addKey(`${first} ${middle} ${last}`);
        addKey(`${last} ${first} ${middle}`);
      }
      if (middleInitial) {
        addKey(`${last}, ${first} ${middleInitial}`);
        addKey(`${last}, ${first} ${middleInitial}.`);
        addKey(`${first} ${middleInitial} ${last}`);
        addKey(`${first} ${middleInitial}. ${last}`);
      }
      addKey(`${last}, ${first}`);
      addKey(`${first} ${last}`);
      addKey(`${last} ${first}`);
    } else if (last) {
      addKey(last);
    }
  }

  for (const s of officialStudents ?? []) {
    const lrn = String(s.student_number ?? "").trim();
    if (lrn) officialByLrn.set(lrn, s);
    registerOfficialNameKeys(s);
  }

  const existingGradeMap = new Map();
  for (const g of existingGrades) {
    existingGradeMap.set(`${g.student_id}:${Number(g.quarter)}`, g);
  }

  function resolveStudentByName(rawFullName) {
    const raw = normalizeText(rawFullName);
    const keysToCheck = [];

    const primaryKey = normalizePersonName(raw);
    if (primaryKey) keysToCheck.push(primaryKey);

    const commaParts = raw.split(",").map((p) => p.trim()).filter(Boolean);
    if (commaParts.length >= 2) {
      const last = commaParts[0];
      const rest = commaParts.slice(1).join(" ");
      keysToCheck.push(normalizePersonName(`${last}, ${rest}`));
      keysToCheck.push(normalizePersonName(`${rest} ${last}`));
      keysToCheck.push(normalizePersonName(`${last} ${rest}`));

      const restWords = rest.split(/\s+/).filter(Boolean);
      if (restWords.length > 1) {
        const firstOnly = restWords[0];
        keysToCheck.push(normalizePersonName(`${last}, ${firstOnly}`));
        keysToCheck.push(normalizePersonName(`${firstOnly} ${last}`));
      }
    } else {
      const words = raw.split(/\s+/).filter(Boolean);
      if (words.length >= 2) {
        const last = words[words.length - 1];
        const first = words[0];
        keysToCheck.push(normalizePersonName(`${last}, ${first}`));
        keysToCheck.push(normalizePersonName(`${first} ${last}`));
      }
    }

    for (const k of keysToCheck) {
      if (k && officialByName.has(k)) {
        return officialByName.get(k);
      }
    }
    return null;
  }

  return uploadedLearners.map((learner, index) => {
    const lrn = learner.lrn_is_generated ? "" : String(learner.student_number ?? "").trim();
    const rawFullName = normalizeText(learner.full_name);

    let status = "UNMATCHED";
    let matchedStudent = null;
    let defaultIncluded = false;
    let existingGradeRecord = null;

    if (lrn && officialByLrn.has(lrn)) {
      matchedStudent = officialByLrn.get(lrn);
      status = "MATCHED";
      defaultIncluded = true;
    } else {
      const matchedByName = resolveStudentByName(rawFullName);
      if (matchedByName) {
        matchedStudent = matchedByName;
        const officialLrn = String(matchedStudent.student_number ?? "").trim();

        if (!lrn || lrn === officialLrn) {
          const gradeKey = `${matchedStudent.id}:${targetQuarter}`;
          if (existingGradeMap.has(gradeKey)) {
            existingGradeRecord = existingGradeMap.get(gradeKey);
            status = "DUPLICATE";
            defaultIncluded = true;
          } else {
            status = "MATCHED";
            defaultIncluded = true;
          }
        } else {
          status = "NEEDS_VERIFICATION";
          defaultIncluded = false;
        }
      } else {
        status = "UNMATCHED";
        defaultIncluded = false;
      }
    }

    return {
      index: index + 1,
      student_number: lrn || matchedStudent?.student_number || "",
      full_name: rawFullName,
      status,
      included: defaultIncluded,
      matchedStudent,
      existingGrade: existingGradeRecord,
    };
  });
}

// 1. Setup mock official section roster for Grade 7 Ramon
const officialStudents = [
  { id: "s-1", student_number: "104793172781", first_name: "STEVEN", middle_name: "MERCADO", last_name: "EVANGELISTA" },
  { id: "s-2", student_number: "104793172782", first_name: "PATRICK", middle_name: "NAVARRO", last_name: "FERNANDEZ" },
  { id: "s-3", student_number: "104793172783", first_name: "JOHN", middle_name: "MANALO", last_name: "FLORES" },
  { id: "s-4", student_number: "104793172784", first_name: "AARON", middle_name: "MARQUEZ", last_name: "GARCIA" },
  { id: "s-5", student_number: "104793172785", first_name: "NATHANIEL", middle_name: "", last_name: "GOMEZ" },
];

console.log("Running Test 1: Term 3 sheet upload without LRN (lrn_is_generated: true)...");
const uploadedTerm3Learners = [
  { full_name: "EVANGELISTA, STEVEN M.", student_number: "ECR-M-01", lrn_is_generated: true },
  { full_name: "FERNANDEZ, PATRICK N.", student_number: "ECR-M-02", lrn_is_generated: true },
  { full_name: "FLORES, JOHN M.", student_number: "ECR-M-03", lrn_is_generated: true },
  { full_name: "GARCIA, AARON M.", student_number: "ECR-M-04", lrn_is_generated: true },
  { full_name: "GOMEZ, NATHANIEL", student_number: "ECR-M-05", lrn_is_generated: true },
];

const results1 = testRosterMatcher({ officialStudents, uploadedLearners: uploadedTerm3Learners });

assert.equal(results1.length, 5, "All 5 learners should be processed");
for (const r of results1) {
  assert.equal(r.status, "MATCHED", `Learner ${r.full_name} should be MATCHED`);
  assert.equal(r.included, true, `Learner ${r.full_name} should be included`);
  assert.ok(r.student_number && !r.student_number.startsWith("ECR-"), `Learner ${r.full_name} should have official LRN: ${r.student_number}`);
}
assert.equal(results1[0].student_number, "104793172781", "Official LRN populated for EVANGELISTA, STEVEN M.");
console.log("PASS: Test 1 passed (all 5 learners cleanly MATCHED with official LRNs).");

console.log("\nRunning Test 2: Existing grade update (DUPLICATE status)...");
const existingGrades = [{ student_id: "s-1", quarter: 3, final_grade: 85 }];
const results2 = testRosterMatcher({ officialStudents, uploadedLearners: uploadedTerm3Learners, existingGrades });
assert.equal(results2[0].status, "DUPLICATE", "Should identify existing grade as DUPLICATE");
assert.equal(results2[0].included, true, "DUPLICATE should still be defaultIncluded for overwrite");
assert.equal(results2[1].status, "MATCHED", "Other learners remain MATCHED");
console.log("PASS: Test 2 passed (DUPLICATE correctly detected with defaultIncluded = true).");

console.log("\nRunning Test 3: Genuine LRN mismatch (security check)...");
const conflictingUpload = [
  { full_name: "EVANGELISTA, STEVEN M.", student_number: "999999999999", lrn_is_generated: false },
];
const results3 = testRosterMatcher({ officialStudents, uploadedLearners: conflictingUpload });
assert.equal(results3[0].status, "NEEDS_VERIFICATION", "Conflicting LRN must trigger NEEDS_VERIFICATION");
assert.equal(results3[0].included, false, "Conflicting LRN must not be default included");
console.log("PASS: Test 3 passed (conflicting LRN securely triggers NEEDS_VERIFICATION).");

console.log("\nAll E-Class Record matching tests passed successfully!");
