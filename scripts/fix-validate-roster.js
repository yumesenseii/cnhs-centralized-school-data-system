const fs = require("fs");
const p = "lib/eclass/validateEClassRoster.js";
let s = fs.readFileSync(p, "utf8");

const header = `import { createClient } from "@/lib/supabase/client";
import { normalizePersonName } from "@/lib/eclass/normalize";
import { parseRecordedGrade } from "@/lib/ecr/computeGrades";
import { parseTermNumber } from "@/lib/academic/termLabels";
import { classifyGradeChange, summarizeGradeChanges } from "@/lib/ecr/gradeIntegrity";
import { buildImportPlan, countUploadedLrns, readImportTermGrade } from "@/lib/eclass/importIntegrity";
import { areSameSchoolYear } from "@/lib/academic/academicTermPolicy";
import { getCurrentTeacherSession } from "@/lib/supabase/queries/myClasses";

function unwrapRelation(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizeLrnKey(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\\s+/g, "");
}

function normalizeNameKey(last, first, middle) {
  const parts = [last, first, middle].map((part) => normalizePersonName(part)).filter(Boolean);
  return parts.join("|");
}

`;

const start = s.indexOf("export async function validateEClassRoster");
if (start === -1) throw new Error("not found");
s = header + s.slice(start);
fs.writeFileSync(p, s);
console.log("done");
