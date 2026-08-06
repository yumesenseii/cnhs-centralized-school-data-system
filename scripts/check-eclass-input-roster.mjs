/**
 * Verify Class-Record INPUT vertical Male → blanks → Female roster parsing
 * using the Grade 7 English sample as the upload basis.
 *
 *   node --import ./scripts/alias-loader.mjs scripts/check-eclass-input-roster.mjs "C:\\Users\\Yukari\\Downloads\\GRADE7_ENGLISH (1).xlsx"
 */
import fs from "fs";
import path from "path";
import { parseInputDataFromSheet } from "@/lib/eclass/parseInputData.js";
import { parseEClassRecordBuffer } from "@/lib/eclass/parseEClassCore.js";
import {
  readWorkbookSheetNames,
  readWorkbookSheets,
} from "@/lib/eclass/xlsxRead.js";

const sample =
  process.argv[2] ||
  path.join(
    process.env.USERPROFILE || "",
    "Downloads",
    "GRADE7_ENGLISH (1).xlsx"
  );

if (!fs.existsSync(sample)) {
  console.error("Sample file not found:", sample);
  process.exit(1);
}

const buffer = fs.readFileSync(sample);
const names = readWorkbookSheetNames(buffer);
const inputName =
  names.find((n) => String(n).toLowerCase() === "input") ||
  names.find((n) => String(n).toLowerCase().includes("input"));

const inputBook = readWorkbookSheets(buffer, [inputName]);
const parsedInput = parseInputDataFromSheet(
  inputBook.Sheets[inputName],
  inputName,
  names
);

const males = parsedInput.learners?.filter((l) => l.gender === "Male").length;
const females = parsedInput.learners?.filter(
  (l) => l.gender === "Female"
).length;

console.log("Sample:", sample);
console.log("INPUT:", inputName);
console.log("INPUT ok:", parsedInput.ok, "total:", parsedInput.learners?.length);
console.log("  males:", males, "females:", females);

const full = parseEClassRecordBuffer(buffer, {
  includeGrades: true,
  quarter: 1,
});

const withGrades =
  full.learners?.filter((l) => Object.keys(l.term_grades || {}).length)
    .length ?? 0;

console.log("Full parse ok:", full.ok, "learners:", full.learners?.length);
console.log("  gradesAttached:", full.gradesAttached);
console.log("  with any term_grades:", withGrades);
console.log("  gradeCounts:", full.gradeCounts);

const sampleLearners = (full.learners || []).slice(0, 2).concat(
  (full.learners || []).filter((l) => l.gender === "Female").slice(0, 2)
);
for (const l of sampleLearners) {
  console.log(
    " ",
    l.gender,
    l.full_name,
    "row",
    l.source_row,
    "grades",
    l.term_grades
  );
}

// Spot-check against Class-Record Helper transmute (Excel TERM GRADE).
const aguilar = full.learners?.find((l) =>
  /aguilar,\s*nathan/i.test(l.full_name)
);
const alonzo = full.learners?.find((l) =>
  /alonzo,\s*bryan/i.test(l.full_name)
);
if (aguilar && aguilar.term_grades?.[1] !== 70) {
  console.error(
    "FAIL: Aguilar Term 1 expected TERM GRADE 70, got",
    aguilar.term_grades?.[1]
  );
  process.exit(1);
}
if (alonzo && alonzo.term_grades?.[1] !== 69) {
  console.error(
    "FAIL: Alonzo Term 1 expected TERM GRADE 69, got",
    alonzo.term_grades?.[1]
  );
  process.exit(1);
}

const inputTotal = parsedInput.learners?.length ?? 0;
const fullTotal = full.learners?.length ?? 0;

if (!parsedInput.ok || inputTotal < 35) {
  console.error("FAIL: INPUT roster incomplete", { inputTotal, males, females });
  process.exit(1);
}
if ((males ?? 0) < 15 || (females ?? 0) < 15) {
  console.error("FAIL: expected ~20M + ~20F", { males, females });
  process.exit(1);
}
if (fullTotal < 35) {
  console.error("FAIL: full parse expected ~40 learners, got", fullTotal);
  process.exit(1);
}
if (withGrades < 30) {
  console.error(
    "FAIL: expected term grades from components/TERM for most learners, got",
    withGrades
  );
  process.exit(1);
}
console.log("PASS");
