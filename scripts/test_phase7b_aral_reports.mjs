import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildPhilIriReportFilename,
  exportPhilIriReadingPdf,
  exportPhilIriReadingExcel,
} from "@/lib/reports/philIriReportsExport";
import { SF9_SCHOOL_INFO } from "@/lib/reports/sf9DataService";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// ============================================================================
// 1. FILENAME BUILDER & SANITIZATION TESTS
// ============================================================================

test("Phase 7B ARAL Reports - Filename Builder: Generates valid Windows-safe Form 2 PDF filename", () => {
  const filename = buildPhilIriReportFilename({
    schoolYear: "SY 2026-2027",
    period: "BOSY",
    scopeLabel: "Grade 7 - Diamond",
    reportType: "form2",
    format: "pdf",
  });

  assert.ok(filename.endsWith(".pdf"), "Must end with .pdf");
  assert.ok(filename.includes("CNHS_PhilIRI_Form2"), "Must include Form 2 tag");
  assert.ok(filename.includes("BOSY"), "Must include BOSY period");
  assert.ok(!/[<>:"/\\|?*]/.test(filename), "Must not contain illegal Windows characters");
});

test("Phase 7B ARAL Reports - Filename Builder: Generates valid Windows-safe Caseload Excel filename", () => {
  const filename = buildPhilIriReportFilename({
    schoolYear: "SY 2026-2027",
    period: "MOSY",
    scopeLabel: "School-wide",
    reportType: "caseload",
    format: "excel",
  });

  assert.ok(filename.endsWith(".xlsx"), "Must end with .xlsx");
  assert.ok(filename.includes("CNHS_ARAL_Intervention_Caseload"), "Must include Caseload tag");
  assert.ok(filename.includes("MOSY"), "Must include MOSY period");
  assert.ok(!/[<>:"/\\|?*]/.test(filename), "Must not contain illegal Windows characters");
});

// ============================================================================
// 2. PDF GENERATOR & AUTHENTICITY TESTS
// ============================================================================

test("Phase 7B ARAL Reports - PDF Generator (Form 2): Builds valid print shell with DepEd letterhead & School ID 300793", () => {
  const syntheticForm2Data = {
    rows: [
      {
        grade: "Grade 7",
        totalCases: 40,
        assessed: 38,
        atGradeLevel: 25,
        twoLevelsDown: 10,
        threeLevelsDown: 3,
        form3Assessed: 13,
        form3Independent: 0,
        form3Instructional: 10,
        form3Frustration: 3,
      },
    ],
    total: {
      grade: "Total",
      totalCases: 40,
      assessed: 38,
      atGradeLevel: 25,
      twoLevelsDown: 10,
      threeLevelsDown: 3,
      form3Assessed: 13,
      form3Independent: 0,
      form3Instructional: 10,
      form3Frustration: 3,
    },
  };

  const result = exportPhilIriReadingPdf({
    form2Data: syntheticForm2Data,
    schoolYear: "SY 2026-2027",
    period: "BOSY",
    reportType: "form2",
    scopeLabel: "Grade 7",
    teacherName: "Teacher Santos",
  });

  assert.ok(result.success, "Export must succeed");
  assert.ok(result.html, "HTML content must be returned");

  // Official DepEd metadata
  assert.ok(result.html.includes("CAMBAOG NATIONAL HIGH SCHOOL"), "Must include official school name");
  assert.ok(result.html.includes("300793"), "Must include official School ID 300793");
  assert.ok(result.html.includes("REGION III"), "Must include Region III");
  assert.ok(result.html.includes("BULACAN"), "Must include Bulacan");

  // Phil-IRI Form 2 Specific Content
  assert.ok(result.html.includes("PHIL-IRI FORM 2: SCHOOL READING PROFILE"), "Must include Form 2 title");
  assert.ok(result.html.includes("GST Screened"), "Must include GST screened column");
  assert.ok(result.html.includes("At Grade Level"), "Must include At Grade Level column");

  // Zero Fabricated Signatories
  assert.ok(!result.html.includes("MARIA SANTOS, EDD"), "Must NEVER include fabricated 'MARIA SANTOS, EDD'");
  assert.ok(!result.html.includes("School Principal IV"), "Must NEVER include fabricated 'School Principal IV'");

  // Authentic Signatories
  assert.ok(
    result.html.includes("DULCE VILMA R. GALANG") || result.html.includes("Signature over Printed Name"),
    "Must include official School Head or honest signature line"
  );
});

test("Phase 7B ARAL Reports - PDF Generator (Form 5): Builds valid print shell with Reading Level distribution", () => {
  const syntheticForm5Data = {
    rows: [
      {
        grade: "Grade 8",
        totalScreened: 35,
        atGradeLevel: 20,
        instructional: 10,
        frustration: 5,
        independent: 20,
        requiringSupport: 15,
      },
    ],
    total: {
      grade: "Total",
      totalScreened: 35,
      atGradeLevel: 20,
      instructional: 10,
      frustration: 5,
      independent: 20,
      requiringSupport: 15,
    },
  };

  const result = exportPhilIriReadingPdf({
    form5Data: syntheticForm5Data,
    schoolYear: "SY 2026-2027",
    period: "MOSY",
    reportType: "form5",
    scopeLabel: "Grade 8",
  });

  assert.ok(result.success, "Export must succeed");
  assert.ok(result.html.includes("PHIL-IRI FORM 5: SUMMARY REPORT ON LEARNERS' READING LEVEL"), "Must include Form 5 title");
  assert.ok(result.html.includes("Requiring Support"), "Must include Requiring Support column");
});

test("Phase 7B ARAL Reports - PDF Generator (Caseload): Builds valid print shell with RA 12028 safeguards", () => {
  const syntheticLearners = [
    {
      studentNumber: "100901",
      name: "Reyes, Carlo",
      gradeSectionDisplay: "Grade 7 - Diamond",
      language: "English",
      philIriScore: 18,
      readingProfile: "Instructional",
      currentStepLabel: "Under ARAL Support",
      outcome: "In Progress",
    },
  ];

  const result = exportPhilIriReadingPdf({
    learners: syntheticLearners,
    schoolYear: "SY 2026-2027",
    period: "BOSY",
    reportType: "caseload",
    scopeLabel: "Grade 7 - Diamond",
  });

  assert.ok(result.success, "Export must succeed");
  assert.ok(result.html.includes("ARAL PROGRAM (RA 12028) INTERVENTION CASELOAD"), "Must include RA 12028 Caseload title");
  assert.ok(result.html.includes("Reyes, Carlo"), "Must list learner name");
  assert.ok(result.html.includes("Instructional"), "Must list reading profile");
});

// ============================================================================
// 3. EXCEL WORKBOOK GENERATOR TESTS
// ============================================================================

test("Phase 7B ARAL Reports - Excel Generator: Builds official workbook without errors", async () => {
  const syntheticForm2Data = {
    rows: [
      {
        grade: "Grade 9",
        totalCases: 42,
        assessed: 40,
        atGradeLevel: 30,
        twoLevelsDown: 7,
        threeLevelsDown: 3,
        form3Assessed: 10,
        form3Independent: 0,
        form3Instructional: 7,
        form3Frustration: 3,
      },
    ],
    total: {
      grade: "Total",
      totalCases: 42,
      assessed: 40,
      atGradeLevel: 30,
      twoLevelsDown: 7,
      threeLevelsDown: 3,
      form3Assessed: 10,
      form3Independent: 0,
      form3Instructional: 7,
      form3Frustration: 3,
    },
  };

  const result = await exportPhilIriReadingExcel({
    form2Data: syntheticForm2Data,
    schoolYear: "SY 2026-2027",
    period: "BOSY",
    reportType: "form2",
    scopeLabel: "Grade 9",
  });

  assert.ok(result.success, "Export must succeed");
  assert.ok(result.filename.endsWith(".xlsx"), "Filename must end with .xlsx");
  assert.ok(result.workbook, "Workbook must be returned");

  // Check Detailed Report worksheet
  const worksheet = result.workbook.getWorksheet("Detailed Report") || result.workbook.getWorksheet("Reading Report");
  assert.ok(worksheet, "Must contain detailed report worksheet");
  assert.ok(worksheet.rowCount >= 4, "Must contain header and data rows");
});

// ============================================================================
// 4. UI INTEGRATION TESTS
// ============================================================================

test("Phase 7B ARAL Reports - UI Integration: ExportAralReportModal component file exists and exports valid React component", () => {
  const modalPath = path.join(
    projectRoot,
    "components",
    "aral",
    "ExportAralReportModal.jsx"
  );
  assert.ok(fs.existsSync(modalPath), "ExportAralReportModal.jsx must exist");

  const modalContent = fs.readFileSync(modalPath, "utf-8");
  assert.ok(modalContent.includes("export default function ExportAralReportModal"), "Must have default export");
  assert.ok(modalContent.includes("exportPhilIriReadingPdf"), "Must import PDF exporter");
  assert.ok(modalContent.includes("exportPhilIriReadingExcel"), "Must import Excel exporter");
  assert.ok(modalContent.includes("RA 12028"), "Must show RA 12028 policy context");
});

test("Phase 7B ARAL Reports - UI Integration: Teacher ARAL page wires Export button to modal", () => {
  const pagePath = path.join(
    projectRoot,
    "components",
    "teacher",
    "aral-program",
    "TeacherAralMonitoringPage.jsx"
  );
  assert.ok(fs.existsSync(pagePath), "TeacherAralMonitoringPage.jsx must exist");

  const pageContent = fs.readFileSync(pagePath, "utf-8");
  assert.ok(pageContent.includes("ExportAralReportModal"), "Must import ExportAralReportModal");
  assert.ok(pageContent.includes("exportModalOpen"), "Must have state for exportModalOpen");
  assert.ok(pageContent.includes("setExportModalOpen(true)"), "Export button must trigger setExportModalOpen(true)");
});

test("Phase 7B ARAL Reports - UI Integration: Admin ARAL dashboard wires Export button to modal", () => {
  const pagePath = path.join(
    projectRoot,
    "components",
    "admin",
    "monitoring",
    "AdminAralMonitoringDashboard.jsx"
  );
  assert.ok(fs.existsSync(pagePath), "AdminAralMonitoringDashboard.jsx must exist");

  const pageContent = fs.readFileSync(pagePath, "utf-8");
  assert.ok(pageContent.includes("ExportAralReportModal"), "Must import ExportAralReportModal");
  assert.ok(pageContent.includes("exportModalOpen"), "Must have state for exportModalOpen");
  assert.ok(pageContent.includes("setExportModalOpen(true)"), "Header export button must trigger setExportModalOpen(true)");
});

test("Phase 7B ARAL Reports - UI Integration: Admin Reports ARAL tab wires Export button to modal", () => {
  const tabPath = path.join(
    projectRoot,
    "components",
    "admin",
    "reports",
    "tabs",
    "AralReportTab.jsx"
  );
  assert.ok(fs.existsSync(tabPath), "AralReportTab.jsx must exist");

  const tabContent = fs.readFileSync(tabPath, "utf-8");
  assert.ok(tabContent.includes("ExportAralReportModal"), "Must import ExportAralReportModal");
  assert.ok(tabContent.includes("exportModalOpen"), "Must have state for exportModalOpen");
  assert.ok(tabContent.includes("setExportModalOpen(true)"), "Switcher export button must trigger setExportModalOpen(true)");
});
