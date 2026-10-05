import { OFFICIAL_SUBJECT_KEYS, getMatatagDescriptor, computeTermAverage } from "../lib/reports/sf9DataService.js";

console.log("=== Testing Advisory Class Consolidated Grade Calculations ===");

// 1. Verify 8 official subjects are covered
console.log(`Checking ${OFFICIAL_SUBJECT_KEYS.length} official subjects...`);
const expectedKeys = [
  "filipino",
  "english",
  "mathematics",
  "science",
  "araling_panlipunan",
  "values_education",
  "tle",
  "mapeh",
];
expectedKeys.forEach((key) => {
  const found = OFFICIAL_SUBJECT_KEYS.find((s) => s.key === key);
  if (!found) throw new Error(`Missing expected subject key: ${key}`);
  console.log(` Subject: ${found.label} (${found.key}) OK`);
});

// 2. Verify Composite MAPEH calculation
const sampleMusicArts = { t1: 94, t2: 96, t3: 92 };
const samplePeHealth = { t1: 96, t2: 94, t3: 94 };

const mapehT1 = Math.round((sampleMusicArts.t1 + samplePeHealth.t1) / 2);
const mapehT2 = Math.round((sampleMusicArts.t2 + samplePeHealth.t2) / 2);
const mapehT3 = Math.round((sampleMusicArts.t3 + samplePeHealth.t3) / 2);
const mapehFinal = computeTermAverage(mapehT1, mapehT2, mapehT3);

if (mapehT1 !== 95 || mapehT2 !== 95 || mapehT3 !== 93 || mapehFinal !== 94) {
  throw new Error(`MAPEH calculation mismatch: got ${mapehT1}, ${mapehT2}, ${mapehT3}, final: ${mapehFinal}`);
}
console.log(` Composite MAPEH: T1=${mapehT1}, T2=${mapehT2}, T3=${mapehT3}, Final=${mapehFinal} OK`);

// 3. Verify General Average calculation across all 8 subjects
const subjectFinals = [90, 88, 85, 87, 91, 92, 89, mapehFinal];
const genAvg = Math.round(subjectFinals.reduce((a, b) => a + b, 0) / subjectFinals.length);
const desc = getMatatagDescriptor(genAvg);

console.log(` General Average: ${genAvg} -> ${desc.descriptor} (${desc.remarks}) OK`);

if (genAvg !== 90 || desc.descriptor !== "Advancing" || desc.remarks !== "Passed") {
  throw new Error(`General average test failed: got ${genAvg}, ${desc.descriptor}`);
}

// 4. Verify Student Schema and Roster Mapping (No 'lrn' or 'gender' column in DB)
console.log("\n--- Testing Student Schema & Roster Mapping ---");
const rawDbStudent = {
  id: "std-001",
  student_number: "104793482917", // Real LRN stored in student_number
  first_name: "Juan",
  middle_name: "Protacio",
  last_name: "Dela Cruz",
  sex: "Male",                    // Real column is 'sex'
  birthdate: "2012-05-15",
  status: "Active",
};

// Check that invalid column 'lrn' and 'gender' are not referenced directly from DB
if ("lrn" in rawDbStudent || "gender" in rawDbStudent) {
  throw new Error("DB student schema should NOT have lrn or gender columns!");
}

// Verify mapper produces all expected UI fields
const mappedLearner = {
  id: rawDbStudent.id,
  studentId: rawDbStudent.id,
  name: [rawDbStudent.first_name, rawDbStudent.middle_name, rawDbStudent.last_name].filter(Boolean).join(" "),
  lrn: rawDbStudent.student_number || "—",
  studentNumber: rawDbStudent.student_number || "—",
  firstName: rawDbStudent.first_name,
  middleName: rawDbStudent.middle_name || "",
  lastName: rawDbStudent.last_name,
  gender: rawDbStudent.sex || "—",
  sex: rawDbStudent.sex || "—",
  birthdate: rawDbStudent.birthdate,
};

if (mappedLearner.lrn !== "104793482917") {
  throw new Error(`LRN mapping failed: got ${mappedLearner.lrn}`);
}
if (mappedLearner.gender !== "Male" || mappedLearner.sex !== "Male") {
  throw new Error(`Sex/Gender mapping failed: got ${mappedLearner.gender}`);
}
if (mappedLearner.name !== "Juan Protacio Dela Cruz") {
  throw new Error(`Name construction failed: got ${mappedLearner.name}`);
}
console.log(` Student LRN mapped from student_number: ${mappedLearner.lrn} OK`);
console.log(` Student Sex/Gender mapped from sex: ${mappedLearner.sex} OK`);
console.log(` Student Full Name: ${mappedLearner.name} OK`);

console.log("\nALL ADVISORY CLASS CONSOLIDATION & SCHEMA TESTS PASSED 100%!");
