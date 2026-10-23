import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildAcademicRecordsFilename,
  buildAcademicRecordsPdfDoc,
  exportAcademicRecordsPdf,
  exportAcademicRecordsExcel,
} from "@/lib/admin/academicRecordsExport";
import { SF9_SCHOOL_INFO } from "@/lib/reports/sf9DataService";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// ============================================================================
// 1. FILENAME BUILDER & SANITIZATION TESTS
// ============================================================================

test("Phase 7B Academic Records - Filename Builder: Generates valid Windows-safe PDF filename", () => {
  const filename = buildAcademicRecordsFilename({
    schoolYear: "SY 2026-2027",
    quarter: "Quarter 1",
    classTitle: "Grade 7 - Diamond (Mathematics)",
    format: "pdf",
  });

  assert.ok(filename.endsWith(".pdf"), "Filename must end with .pdf");
  assert.ok(filename.includes("CNHS_Academic_Records"), "Must include CNHS prefix");
  assert.ok(filename.includes("Diamond"), "Must include section info");
  assert.ok(filename.includes("Q1") || filename.includes("Quarter1"), "Must include quarter");
  assert.ok(!/[<>:"/\\|?*]/.test(filename), "Must not contain illegal Windows characters");
});

test("Phase 7B Academic Records - Filename Builder: Generates valid Windows-safe Excel filename", () => {
  const filename = buildAcademicRecordsFilename({
    schoolYear: "SY 2026-2027",
    quarter: "Quarter 2",
    classTitle: "Grade 8 - Rizal (Science)",
    format: "excel",
  });

  assert.ok(filename.endsWith(".xlsx"), "Filename must end with .xlsx");
  assert.ok(filename.includes("CNHS_Academic_Records"), "Must include CNHS prefix");
  assert.ok(filename.includes("Rizal"), "Must include class/section info");
  assert.ok(!/[<>:"/\\|?*]/.test(filename), "Must not contain illegal Windows characters");
});

// ============================================================================
// 2. PDF GENERATOR & AUTHENTICITY TESTS
// ============================================================================

test("Phase 7B Academic Records - PDF Generator: Builds valid jsPDF doc with official DepEd metadata and School ID 300793", () => {
  const syntheticStudents = [
    {
      studentNumber: "100201",
      studentName: "Dela Cruz, Juan",
      gender: "M",
      term1: 88,
      term2: 85,
      term3: 86,
      final: 86,
      termGrade: 86,
    },
    {
      studentNumber: "100202",
      studentName: "Santos, Maria Clara",
      gender: "F",
      term1: 72,
      term2: 74,
      term3: 75,
      final: 74,
      termGrade: 74,
    },
  ];

  const doc = buildAcademicRecordsPdfDoc({
    students: syntheticStudents,
    schoolYear: "SY 2026-2027",
    quarter: "Quarter 1",
    classTitle: "Grade 7 - Diamond (English)",
    teacherName: "Teacher Maria",
  });

  assert.ok(doc, "Document must be created");
  assert.equal(typeof doc.output, "function", "Must have jsPDF output function");

  // Output plain text to verify contents
  const textOutput = doc.output();

  // DepEd Header & School Authenticity
  assert.ok(textOutput.includes("Department of Education"), "Must include DepEd Department");
  assert.ok(textOutput.includes("REGION III"), "Must include official Region III");
  assert.ok(textOutput.includes("BULACAN"), "Must include official Bulacan Division");
  assert.ok(textOutput.includes("300793"), "Must include official School ID 300793");
  assert.ok(textOutput.includes("CAMBAOG NATIONAL HIGH SCHOOL"), "Must include official Cambaog NHS name");

  // Zero Fabricated Signatories
  assert.ok(!textOutput.includes("MARIA SANTOS, EDD"), "Must NEVER include fabricated 'MARIA SANTOS, EDD'");
  assert.ok(!textOutput.includes("School Principal IV"), "Must NEVER include fabricated 'School Principal IV'");

  // Policy Note
  assert.ok(textOutput.includes("AUTHORITATIVE POLICY NOTE"), "Must include DepEd grading descriptor note");
  assert.ok(textOutput.includes("Advancing"), "Must include descriptor text");
});

test("Phase 7B Academic Records - PDF Generator: Handles empty student list gracefully without crashing", () => {
  const doc = buildAcademicRecordsPdfDoc({
    students: [],
    classes: [],
    schoolYear: "SY 2026-2027",
    quarter: "Quarter 1",
    classTitle: "Empty Class",
  });

  assert.ok(doc, "Doc must still be generated");
  const textOutput = doc.output();
  assert.ok(textOutput.includes("No academic records match"), "Must render placeholder row");
});

test("Phase 7B Academic Records - PDF Generator: Honest signatories fallback when no authenticated name provided", () => {
  const doc = buildAcademicRecordsPdfDoc({
    students: [],
    teacherName: "Subject Teacher", // default unauthenticated fallback
    schoolHeadName: null,
  });

  const textOutput = doc.output();
  assert.ok(
    textOutput.includes("(Signature over Printed Name)") || textOutput.includes(SF9_SCHOOL_INFO.defaultSchoolHead.toUpperCase()),
    "Must use honest fallback or official school head name"
  );
});

// ============================================================================
// 3. EXCEL WORKBOOK GENERATOR TESTS
// ============================================================================

test("Phase 7B Academic Records - Excel Generator: Builds official workbook without errors", async () => {
  const syntheticStudents = [
    {
      studentNumber: "100301",
      studentName: "Aquino, Benigno",
      gender: "M",
      term1: 85,
      term2: 87,
      term3: 88,
      final: 87,
      termGrade: 87,
    },
  ];

  const result = await exportAcademicRecordsExcel({
    students: syntheticStudents,
    schoolYear: "SY 2026-2027",
    quarter: "Quarter 1",
    classTitle: "Grade 9 - Rizal (Mathematics)",
  });

  assert.ok(result.success, "Export must succeed");
  assert.ok(result.filename.endsWith(".xlsx"), "Filename must end with .xlsx");
  assert.ok(result.workbook, "Workbook must be returned");

  // Check worksheet
  const worksheet = result.workbook.getWorksheet("Detailed Report") || result.workbook.getWorksheet("Class List");
  assert.ok(worksheet, "Must contain 'Detailed Report' worksheet");
  assert.ok(worksheet.rowCount >= 4, "Must contain header and data rows");
});

// ============================================================================
// 4. UI INTEGRATION TESTS
// ============================================================================

test("Phase 7B Academic Records - UI Integration: ExportAcademicRecordsModal component file exists and exports valid React component", () => {
  const modalPath = path.join(
    projectRoot,
    "components",
    "academic-records",
    "ExportAcademicRecordsModal.jsx"
  );
  assert.ok(fs.existsSync(modalPath), "ExportAcademicRecordsModal.jsx must exist");

  const modalContent = fs.readFileSync(modalPath, "utf-8");
  assert.ok(modalContent.includes("export default function ExportAcademicRecordsModal"), "Must have default export");
  assert.ok(modalContent.includes("exportAcademicRecordsPdf"), "Must import PDF exporter");
  assert.ok(modalContent.includes("exportAcademicRecordsExcel"), "Must import Excel exporter");
  assert.ok(
    modalContent.includes("AUTHORITATIVE POLICY NOTE") ||
    modalContent.includes("DepEd Grading Standards") ||
    modalContent.includes("DepEd Grading Descriptors"),
    "Must show DepEd policy context"
  );
});

test("Phase 7B Academic Records - UI Integration: Admin Academic Records page wires Export button to modal", () => {
  const pagePath = path.join(
    projectRoot,
    "app",
    "(admin)",
    "academic-records",
    "page.js"
  );
  assert.ok(fs.existsSync(pagePath), "app/(admin)/academic-records/page.js must exist");

  const pageContent = fs.readFileSync(pagePath, "utf-8");
  assert.ok(pageContent.includes("ExportAcademicRecordsModal"), "Must import ExportAcademicRecordsModal");
  assert.ok(pageContent.includes("exportModalOpen"), "Must have state for exportModalOpen");
  assert.ok(pageContent.includes("setExportModalOpen(true)"), "Header export button must trigger setExportModalOpen(true)");
});
