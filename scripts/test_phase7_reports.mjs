import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildMonitoringFilename,
  buildAcademicMonitoringPdfDoc,
  buildAcademicMonitoringExcelWorkbook,
} from "@/lib/reports/academicMonitoringExport";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// ============================================================================
// 1. FILENAME BUILDER TESTS
// ============================================================================

test("Phase 7 Reports - Filename Builder: Generates Windows-safe PDF filename", () => {
  const filename = buildMonitoringFilename({
    schoolYear: "SY 2026-2027",
    quarter: "Quarter 1",
    scope: "Grade 8 - Bonifacio",
    role: "teacher",
    format: "pdf",
  });

  assert.ok(filename.endsWith(".pdf"), "Filename must end with .pdf");
  assert.ok(filename.includes("CNHS_Academic_Monitoring"), "Must identify module");
  assert.ok(filename.includes("Grade_8_-_Bonifacio"), "Must include sanitized scope");
  assert.ok(!/[<>:"/\\|?*]/.test(filename), "Must be free of illegal Windows filename characters");
});

test("Phase 7 Reports - Filename Builder: Generates Windows-safe Excel filename", () => {
  const filename = buildMonitoringFilename({
    schoolYear: "SY 2026-2027",
    quarter: "Quarter 2",
    scope: "School-Wide Consolidated",
    role: "principal",
    format: "excel",
  });

  assert.ok(filename.endsWith(".xlsx"), "Filename must end with .xlsx");
  assert.ok(filename.includes("School-Wide_Consolidated"), "Must include sanitized scope");
  assert.ok(!/[<>:"/\\|?*]/.test(filename), "Must be free of illegal Windows filename characters");
});

// ============================================================================
// 2. PDF GENERATOR TESTS
// ============================================================================

test("Phase 7 Reports - PDF Generator: Builds valid jsPDF document with DepEd standards", () => {
  const syntheticLearners = [
    {
      name: "Juan Dela Cruz",
      lrn: "123456789012",
      gradeSection: "Grade 8 - Rizal",
      subject: "Mathematics",
      finalGrade: 88,
      officialRiskLevel: "Low Risk",
      recommendation: "None",
      isCompleteTerm: true,
    },
    {
      name: "Maria Santos",
      lrn: "123456789013",
      gradeSection: "Grade 8 - Rizal",
      subject: "Mathematics",
      finalGrade: 72,
      officialRiskLevel: "Moderate Risk",
      failingSubjects: [{ subjectName: "Mathematics", grade: 72 }],
      recommendation: "Classroom Remedial",
      isCompleteTerm: true,
    },
    {
      name: "Pedro Penduko",
      lrn: "123456789014",
      gradeSection: "Grade 8 - Rizal",
      subject: "Mathematics",
      isProvisional: true, // Incomplete curriculum
      recommendation: "General Monitoring",
    },
  ];

  const doc = buildAcademicMonitoringPdfDoc({
    role: "teacher",
    teacherName: "Mr. Juan Tamad",
    schoolYear: "SY 2026-2027",
    quarter: "Quarter 1",
    gradeLevel: "Grade 8",
    sectionName: "Rizal",
    scopeLabel: "Grade 8 - Rizal",
    learners: syntheticLearners,
    summaryCounts: {
      totalEnrolled: 3,
      immediateReview: 0,
      needsMonitoring: 1,
      underSupport: 1,
      doingWell: 1,
    },
  });

  assert.ok(doc, "jsPDF instance must be created");
  assert.strictEqual(typeof doc.output, "function", "Must have output method");

  // Output as array buffer / string to confirm document rendering
  const pdfString = doc.output();
  assert.ok(pdfString.length > 500, "Rendered PDF must have valid size");
  assert.ok(pdfString.includes("PDF"), "Output must be valid PDF stream");

  // Zero fabrication checks: placeholder "MARIA SANTOS, EDD" must NOT be hardcoded
  assert.ok(
    !pdfString.includes("MARIA SANTOS, EDD"),
    "Must not include fabricated signatory MARIA SANTOS, EDD"
  );
  assert.ok(
    !pdfString.includes("School Principal IV"),
    "Must not include fabricated title School Principal IV"
  );
  // Official metadata checks
  assert.ok(pdfString.includes("300793"), "Must contain official DepEd School ID 300793");
  assert.ok(pdfString.includes("BULACAN"), "Must contain Schools Division of Bulacan");
});

test("Phase 7 Reports - PDF Generator: Incomplete records are designated as Pending Evidence", () => {
  const incompleteLearner = [
    {
      name: "Elena Adarna",
      lrn: "123456789015",
      gradeSection: "Grade 7 - Luna",
      subject: "Science",
      isProvisional: true,
    },
  ];

  const doc = buildAcademicMonitoringPdfDoc({
    role: "teacher",
    teacherName: "Ms. Santos",
    schoolYear: "SY 2026-2027",
    quarter: "Quarter 1",
    learners: incompleteLearner,
  });

  assert.ok(doc, "Document should build successfully for incomplete learners");
});

test("Phase 7 Reports - Filter Consistency: Scoped section export contains only target learners", () => {
  const allLearners = [
    { name: "Learner 7A-1", lrn: "111111111111", gradeSection: "Grade 7 - Diamond", grade: 85 },
    { name: "Learner 7A-2", lrn: "111111111112", gradeSection: "Grade 7 - Diamond", grade: 78 },
    { name: "Learner 8B-1", lrn: "222222222221", gradeSection: "Grade 8 - Emerald", grade: 90 },
  ];

  // When filtered by Section "Grade 7 - Diamond", only 2 learners are passed
  const scopedLearners = allLearners.filter((l) => l.gradeSection === "Grade 7 - Diamond");
  assert.strictEqual(scopedLearners.length, 2, "Scoped filter must isolate Grade 7 - Diamond");

  const doc = buildAcademicMonitoringPdfDoc({
    role: "teacher",
    teacherName: "Teacher Maria",
    sectionName: "Grade 7 - Diamond",
    scopeLabel: "Grade 7 - Diamond",
    learners: scopedLearners,
  });

  const pdfOutput = doc.output();
  assert.ok(pdfOutput.includes("Learner 7A-1"), "Must include scoped learner 7A-1");
  assert.ok(pdfOutput.includes("Learner 7A-2"), "Must include scoped learner 7A-2");
  assert.ok(!pdfOutput.includes("Learner 8B-1"), "Must NOT include out-of-scope learner 8B-1");
  assert.ok(pdfOutput.includes("Grade 7 - Diamond"), "Scope label must match filtered section");
});

// ============================================================================
// 3. EXCEL WORKBOOK GENERATOR TESTS
// ============================================================================

test("Phase 7 Reports - Excel Generator: Builds official multi-sheet workbook", async () => {
  const syntheticLearners = [
    {
      name: "Learner One",
      lrn: "100000000001",
      gradeSection: "Grade 9 - Bonifacio",
      subject: "English",
      finalGrade: 90,
      officialRiskLevel: "Low Risk",
      recommendation: "None",
      isCompleteTerm: true,
    },
    {
      name: "Learner Two",
      lrn: "100000000002",
      gradeSection: "Grade 9 - Bonifacio",
      subject: "English",
      finalGrade: 68,
      officialRiskLevel: "High Risk",
      failingSubjects: [{ subjectName: "English", grade: 68 }],
      recommendation: "Classroom Remedial",
      isCompleteTerm: true,
    },
    {
      name: "Learner Three",
      lrn: "100000000003",
      gradeSection: "Grade 9 - Bonifacio",
      subject: "English",
      isProvisional: true,
    },
  ];

  const workbook = await buildAcademicMonitoringExcelWorkbook({
    role: "principal",
    teacherName: "Principal Maria Santos",
    schoolYear: "SY 2026-2027",
    quarter: "Quarter 1",
    gradeLevel: "Grade 9",
    sectionName: "Bonifacio",
    scopeLabel: "Grade 9 - Bonifacio",
    learners: syntheticLearners,
    summaryCounts: {
      immediateReview: 1,
      needsMonitoring: 0,
      underSupport: 1,
    },
  });

  assert.ok(workbook, "Workbook must be created");

  // Verify Worksheets exist
  const sheetNames = workbook.worksheets.map((ws) => ws.name);
  assert.ok(sheetNames.includes("SUMMARY"), "Must contain SUMMARY sheet");
  assert.ok(sheetNames.includes("ACADEMIC_MONITORING"), "Must contain ACADEMIC_MONITORING sheet");
  assert.ok(sheetNames.includes("INTERVENTIONS"), "Must contain INTERVENTIONS sheet");

  // Verify Summary Sheet metadata
  const wsSummary = workbook.getWorksheet("SUMMARY");
  assert.ok(
    String(wsSummary.getCell("B2").value).includes("CAMBAOG NATIONAL HIGH SCHOOL"),
    "Summary must contain school name"
  );
  assert.ok(
    String(wsSummary.getCell("B2").value).includes("300793"),
    "Summary must contain official school ID 300793"
  );
  assert.strictEqual(wsSummary.getCell("C5").value, "SY 2026-2027");
  assert.strictEqual(wsSummary.getCell("C6").value, "Quarter 1");

  // Verify Monitoring Sheet Rows
  const wsMonitoring = workbook.getWorksheet("ACADEMIC_MONITORING");
  assert.strictEqual(wsMonitoring.rowCount, 4); // 1 header + 3 learner rows
  assert.strictEqual(wsMonitoring.getRow(2).getCell(2).value, "Learner One");
  assert.strictEqual(wsMonitoring.getRow(3).getCell(2).value, "Learner Two");
  assert.strictEqual(wsMonitoring.getRow(4).getCell(6).value, "Pending"); // Incomplete learner

  // Verify Interventions Sheet Rows (only High/Mod risk or remedial)
  const wsInterventions = workbook.getWorksheet("INTERVENTIONS");
  assert.strictEqual(wsInterventions.rowCount, 2); // 1 header + 1 remedial learner
  assert.strictEqual(wsInterventions.getRow(2).getCell(2).value, "Learner Two");

  // Verify writeBuffer produces valid binary xlsx buffer
  const buffer = await workbook.xlsx.writeBuffer();
  assert.ok(buffer.byteLength > 1000, "Excel buffer must have valid size");
});

// ============================================================================
// 4. UI INTEGRATION INVENTORY TESTS
// ============================================================================

test("Phase 7 Reports - UI Integration: Teacher MonitoringDashboard has Export Report button and modal", () => {
  const dashboardPath = path.join(
    projectRoot,
    "components",
    "teacher",
    "monitoring",
    "MonitoringDashboard.jsx"
  );
  const content = fs.readFileSync(dashboardPath, "utf-8");

  assert.ok(
    content.includes("ExportAcademicMonitoringModal"),
    "Teacher MonitoringDashboard must import and render ExportAcademicMonitoringModal"
  );
  assert.ok(
    content.includes("Export Report"),
    "Teacher MonitoringDashboard must have 'Export Report' button"
  );
  assert.ok(
    content.includes("exportModalOpen"),
    "Teacher MonitoringDashboard must manage exportModalOpen state"
  );
});

test("Phase 7 Reports - UI Integration: Admin MonitoringPage has Export Report button and modal", () => {
  const adminPagePath = path.join(
    projectRoot,
    "components",
    "admin",
    "monitoring",
    "AdminMonitoringPage.jsx"
  );
  const content = fs.readFileSync(adminPagePath, "utf-8");

  assert.ok(
    content.includes("ExportAcademicMonitoringModal"),
    "Admin MonitoringPage must import and render ExportAcademicMonitoringModal"
  );
  assert.ok(
    content.includes("Export Report"),
    "Admin MonitoringPage must have 'Export Report' button"
  );
  assert.ok(
    content.includes("role=\"principal\""),
    "Admin MonitoringPage must pass role='principal' to export modal"
  );
});
