import * as XLSX from "xlsx";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE_XLSX =
  "c:/Users/Yukari/Downloads/maria santos 9 bonifacio.xlsx";
const OUTPUT_XLSX =
  "c:/Users/Yukari/Downloads/grade-9-bonifacio-sf2-demo.xlsx";
const OUTPUT_CSV =
  "c:/Users/Yukari/Downloads/grade-9-bonifacio-sf2-demo.csv";

const SCHOOL_DAYS = 22;

/** Grade 9 Bonifacio — one LRN per learner (Supabase, SY 2026-2027). */
const STUDENTS = [
  ["104793975983", "CHLOE", "ANNE", "CASTILLO"],
  ["104793203209", "CLYDE", "VINCENT", "CASTILLO"],
  ["104793667087", "KENNETH", "PAUL", "CASTILLO"],
  ["104793578711", "ANGELA", "MAE", "CRUZ"],
  ["104793333905", "JOSHUA", "DANIEL", "CRUZ"],
  ["104793046621", "HANNAH", "MARIE", "CRUZADO"],
  ["104793347746", "CHRISTINE", "JOY", "DE LEON"],
  ["104793420353", "FRANCIS", "XAVIER", "DE LEON"],
  ["104793158859", "PRINCESS", "MAE", "DELA CRUZ"],
  ["104793108744", "CHRISTIAN", "ANGELO", "DELA PEÑA"],
  ["104793322441", "JUSTIN", "RAPHAEL", "DIAZ"],
  ["104793412604", "SARAH", "LOUISE", "DIAZ"],
  ["104793681061", "ANGELA", "KRISTINE", "DIZON"],
  ["104793484932", "JAMES", "ANTHONY", "DIZON"],
  ["104793999132", "MATTHEW", "JOSHUA", "DOMINGUEZ"],
  ["104793538157", "TRISHA", "MAE", "DOMINGUEZ"],
  ["104793215849", "ALLEN", "JOSHUA", "ESPINO"],
  ["104793207406", "MARY", "KATE", "ESPINO"],
  ["104793406031", "DAVID", "JOHN", "ESTRELLA"],
  ["104793018865", "SHEENA", "MARIE", "ESTRELLA"],
  ["104793627939", "FRANCESCA", "JOY", "EVANGELISTA"],
  ["104793245068", "STEVEN", "MARK", "EVANGELISTA"],
  ["104793010466", "BIANCA", "NICOLE", "FERNANDEZ"],
  ["104793173977", "PATRICK", "NEIL", "FERNANDEZ"],
  ["104793317252", "JASMINE", "CLAIRE", "FLORES"],
  ["104793141999", "JOHN", "MATTHEW", "FLORES"],
  ["104793806264", "AARON", "MATTHEW", "GARCIA"],
  ["104793095496", "NICOLE", "MARIE", "GARCIA"],
  ["104793448042", "ELLA", "MARIE", "GOMEZ"],
  ["104793637575", "NATHANIEL", null, "GOMEZ"],
  ["104793318021", "DENISE", "NICOLE", "GONZALES"],
  ["104793516825", "MARCO", "LUIS", "GONZALES"],
  ["104793278028", "JULIA", "FAITH", "HERNANDEZ"],
  ["104793868011", "VINCENT", "KYLE", "HERNANDEZ"],
  ["104793566678", "ALBERT", "JOHN", "IGNACIO"],
  ["104793818273", "PATRICIA", "MAE", "IGNACIO"],
  ["104793281911", "JANINE", "LOUISE", "JAVIER"],
  ["104793511040", "KYLE", "ANTHONY", "JAVIER"],
  ["104793983596", "ALYANNA", "FAITH", "LIM"],
  ["104793813495", "RALPH", "CHRISTIAN", "LOPEZ"],
];

/** present, absent, late — includes Warning (4–5 absent) and Critical (6–8 absent). */
const ATTENDANCE_PATTERNS = [
  { present: 21, absent: 1, late: 0 },
  { present: 20, absent: 2, late: 1 },
  { present: 19, absent: 3, late: 1 },
  { present: 18, absent: 4, late: 2 },
  { present: 17, absent: 5, late: 1 },
  { present: 16, absent: 6, late: 2 },
  { present: 15, absent: 7, late: 1 },
  { present: 14, absent: 8, late: 2 },
];

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function formatLearnerName(last, first, middle) {
  const mid = middle ? ` ${middle}` : "";
  return `${last}, ${first}${mid}`;
}

function extractLearnerNamesFromSource() {
  const workbook = XLSX.read(readFileSync(SOURCE_XLSX));
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets.INPUT, {
    header: 1,
    defval: "",
  });
  return rows
    .map((row) => (typeof row[1] === "string" ? row[1].trim() : ""))
    .filter(
      (name) =>
        name.includes(",") &&
        !/LEARNERS|MALE|FEMALE|SCORE|REGION|SCHOOL/i.test(name)
    );
}

function buildLrnMap() {
  const map = new Map();
  for (const [lrn, first, middle, last] of STUDENTS) {
    const key = normalizeName(formatLearnerName(last, first, middle));
    map.set(key, lrn);
  }
  return map;
}

function absencePercent(absent, schoolDays) {
  return Math.round((absent / schoolDays) * 1000) / 10;
}

const sourceNames = extractLearnerNamesFromSource();
const lrnMap = buildLrnMap();

const rows = [
  ["LRN", "Learner Name", "Present", "Absent", "Late", "School Days"],
];

const unmatched = [];

sourceNames.forEach((name, index) => {
  const lrn = lrnMap.get(normalizeName(name));
  if (!lrn) {
    unmatched.push(name);
    return;
  }
  const pattern =
    ATTENDANCE_PATTERNS[index % ATTENDANCE_PATTERNS.length];
  rows.push([
    lrn,
    name,
    pattern.present,
    pattern.absent,
    pattern.late,
    SCHOOL_DAYS,
  ]);
});

if (unmatched.length) {
  console.error("Unmatched learners:", unmatched);
  process.exit(1);
}

const sheet = XLSX.utils.aoa_to_sheet(rows);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, sheet, "SF2 Attendance");

XLSX.writeFile(workbook, OUTPUT_XLSX);

const csv = rows.map((row) => row.join(",")).join("\n");
writeFileSync(OUTPUT_CSV, csv, "utf8");

const atRisk = rows.slice(1).filter((row) => {
  const absent = Number(row[3]);
  const pct = absencePercent(absent, SCHOOL_DAYS);
  return pct >= 15;
});

console.log(`Wrote ${OUTPUT_XLSX}`);
console.log(`Wrote ${OUTPUT_CSV}`);
console.log(`Learners: ${rows.length - 1}`);
console.log(`Near 20% absence (>=15%): ${atRisk.length}`);
