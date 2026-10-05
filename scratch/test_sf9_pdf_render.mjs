import fs from "fs";
import path from "path";
import { generateSf9PdfDocument } from "../lib/reports/sf9PdfGenerator.js";
import { getMatatagDescriptor } from "../lib/reports/sf9DataService.js";

console.log("=== Testing SF9 MATATAG Descriptors ===");
const testCases = [
  { grade: 96, expectedDesc: "Advancing", expectedRemark: "Passed" },
  { grade: 86, expectedDesc: "Benchmarking", expectedRemark: "Passed" },
  { grade: 77, expectedDesc: "Connecting", expectedRemark: "Passed" },
  { grade: 70, expectedDesc: "Developing", expectedRemark: "Failed" },
  { grade: 55, expectedDesc: "Emerging", expectedRemark: "Failed" },
];

testCases.forEach((tc) => {
  const res = getMatatagDescriptor(tc.grade);
  if (res.descriptor !== tc.expectedDesc || res.remarks !== tc.expectedRemark) {
    throw new Error(`Failed descriptor test for grade ${tc.grade}: got ${JSON.stringify(res)}`);
  }
  console.log(` Grade ${tc.grade} -> ${res.descriptor} (${res.remarks}) OK`);
});

console.log("\n=== Testing SF9 PDF Generation ===");
const sampleLearner = {
  last_name: "Santos",
  first_name: "Akissia Kaith",
  middle_name: "Yamsuan",
  lrn: "104793160029",
  gender: "Female",
  birthdate: "2010-05-14",
  gradeLevel: "10",
  sectionName: "Ponce",
  adviserName: "Allan A. Marcelo",
  schoolHead: "Dulce Vilma R. Galang",
  grades: {
    filipino: { t1: 92, t2: 90, t3: 94 },
    english: { t1: 92, t2: 91, t3: 93 },
    mathematics: { t1: 86, t2: 88, t3: 89 },
    science: { t1: 87, t2: 89, t3: 90 },
    araling_panlipunan: { t1: 91, t2: 92, t3: 93 },
    values_education: { t1: 93, t2: 94, t3: 95 },
    tle: { t1: 91, t2: 90, t3: 92 },
    music_arts: { t1: 96, t2: 95, t3: 97 },
    pe_health: { t1: 96, t2: 97, t3: 98 },
  },
  attendance: {
    jun: { classDays: 15, present: 15, absent: 0 },
    jul: { classDays: 20, present: 20, absent: 0 },
    aug: { classDays: 21, present: 20, absent: 1 },
    sep: { classDays: 22, present: 22, absent: 0 },
    oct: { classDays: 21, present: 21, absent: 0 },
    nov: { classDays: 20, present: 19, absent: 1 },
    dec: { classDays: 14, present: 14, absent: 0 },
    jan: { classDays: 20, present: 20, absent: 0 },
    feb: { classDays: 18, present: 18, absent: 0 },
    mar: { classDays: 21, present: 21, absent: 0 },
    apr: { classDays: 9, present: 9, absent: 0 },
  },
};

const doc = generateSf9PdfDocument(sampleLearner, "2026-2027");
const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
const outPath = path.resolve("scratch/test_sf9_output.pdf");

fs.writeFileSync(outPath, pdfBuffer);
console.log(` SF9 PDF generated successfully! Saved to: ${outPath}`);
console.log(` PDF Size: ${pdfBuffer.length} bytes`);
console.log(` Page Count: ${doc.getNumberOfPages()} (Expected: 2 pages - Front & Back)`);

if (doc.getNumberOfPages() !== 2) {
  throw new Error(`Expected 2 pages, got ${doc.getNumberOfPages()}`);
}
console.log("\nALL SF9 TESTS PASSED 100%!");
