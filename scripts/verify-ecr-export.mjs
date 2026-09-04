/**
 * Smoke test: load PONCE template, fill sample cells, write output.
 * Run: node scripts/verify-ecr-export.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import ExcelJS from "exceljs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const templatePath = join(root, "public/templates/class-record-v1-template.xlsx");

if (!existsSync(templatePath)) {
  console.error("Missing template:", templatePath);
  process.exit(1);
}

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(templatePath);

const sheets = wb.worksheets.map((w) => w.name);
const required = ["INPUT DATA", "TERM 1", "TERM 2", "TERM 3", "AVE"];
const missing = required.filter((name) => !sheets.includes(name));
if (missing.length) {
  console.error("Missing sheets:", missing.join(", "));
  process.exit(1);
}

const input = wb.getWorksheet("INPUT DATA");
input.getCell("F14").value = "CAMBAOG NATIONAL HIGH SCHOOL";
input.getCell("F22").value = "TEST TEACHER";
input.getCell("F24").value = "10";
input.getCell("F26").value = "Del Pilar";
input.getCell("F28").value = "Filipino";
input.getCell("L11").value = "GARCIA, AARON MATTHEW";
input.getCell("O11").value = "AMISTAR, AISHAJIRAH";

const term1 = wb.getWorksheet("TERM 1");
term1.getCell("F13").value = 20;
term1.getCell("N13").value = 28;

const outPath = join(root, "tmp-export-verify.xlsx");
const buffer = await wb.xlsx.writeBuffer();
writeFileSync(outPath, Buffer.from(buffer));

const b13 = term1.getCell("B13").value;
const hasFormula =
  typeof b13 === "object" && b13 !== null && "formula" in b13;

console.log("OK:", outPath);
console.log("Sheets:", sheets.join(", "));
console.log("TERM 1 B13 keeps INPUT DATA formula:", hasFormula);
console.log("TERM 1 F13 score:", term1.getCell("F13").value);
