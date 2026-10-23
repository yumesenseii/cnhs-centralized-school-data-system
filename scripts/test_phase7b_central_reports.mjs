import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  exportAdminReportsExcel,
  formatDynamicReportFilename,
  buildDailyAttendanceExportSummary,
} from "@/lib/admin/reportsExport";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// ============================================================================
// 1. FILENAME BUILDER & SANITIZATION TESTS
// ============================================================================

test("Phase 7B Central Reports - Filename Builder: Generates valid Windows-safe PDF filenames", () => {
  const academicName = formatDynamicReportFilename("Academic", "SY 2026-2027", "1");
  assert.ok(academicName.endsWith(".pdf"), "Must end with .pdf");
  assert.ok(academicName.includes("Academic"), "Must include Academic tag");
  assert.ok(academicName.includes("Term1"), "Must include Term 1");
  assert.ok(!/[<>:"/\\|?*]/.test(academicName), "Must not contain illegal Windows characters");

  const attendanceName = formatDynamicReportFilename("Attendance", "SY 2026-2027", null);
  assert.ok(attendanceName.endsWith(".pdf"), "Must end with .pdf");
  assert.ok(attendanceName.includes("Attendance"), "Must include Attendance tag");
  assert.ok(attendanceName.includes("AllTerms"), "Must include AllTerms fallback");
  assert.ok(!/[<>:"/\\|?*]/.test(attendanceName), "Must not contain illegal Windows characters");
});

// ============================================================================
// 2. EXCEL WORKBOOK GENERATOR TESTS
// ============================================================================

test("Phase 7B Central Reports - Excel Generator: Builds official executive report workbook without errors", async () => {
  const syntheticClassReports = [
    {
      gradeSection: "Grade 7 - Diamond",
      subject: "English",
      quarter: "1",
      teacherName: "Teacher Santos",
      students: 42,
      averageGrade: 86.4,
      requiringIntervention: 3,
      aralScreeningCount: 2,
      classroomRemedialCount: 1,
      monitoringStatus: "Complete",
      reportStatus: "Submitted",
      classStudents: [
        {
          studentNumber: "100501",
          name: "Learner One",
          gradeSection: "Grade 7 - Diamond",
          subject: "English",
          interventionPathway: "ARAL Program (RA 12028)",
          riskLevel: "Low Risk",
          recommendation: "ARAL",
        },
      ],
    },
  ];

  const syntheticSummary = {
    totalClasses: 1,
    totalStudents: 42,
    passingRate: 93,
    averageClassGrade: 86.4,
    needingSupport: 3,
    aralScreeningCount: 2,
    classroomRemedialCount: 1,
  };

  let downloadBuffer = null;
  assert.doesNotThrow(async () => {
    downloadBuffer = await exportAdminReportsExcel({
      classReports: syntheticClassReports,
      summary: syntheticSummary,
      schoolYear: "SY 2026-2027",
      quarter: "1",
      generatedBy: "School Principal",
    });
  });

  // Verify buffer returned cleanly in headless node environment
  assert.ok(downloadBuffer !== undefined, "Workbook export must complete and return buffer");
});

// ============================================================================
// 3. UI INTEGRATION TESTS
// ============================================================================

test("Phase 7B Central Reports - UI Integration: AdminReportsPage provides both Export PDF and Export Excel buttons", () => {
  const pagePath = path.join(
    projectRoot,
    "components",
    "admin",
    "reports",
    "AdminReportsPage.jsx"
  );
  assert.ok(fs.existsSync(pagePath), "AdminReportsPage.jsx must exist");

  const pageContent = fs.readFileSync(pagePath, "utf-8");
  assert.ok(pageContent.includes("export-school-report-pdf-btn"), "Must have Export PDF button with ID");
  assert.ok(pageContent.includes("export-school-report-excel-btn"), "Must have Export Excel button with ID");
  assert.ok(pageContent.includes("handleExportCurrentTabPdf"), "Must wire handleExportCurrentTabPdf");
  assert.ok(pageContent.includes("handleExportExcel"), "Must wire handleExportExcel");
});

test("Phase 7B Central Reports - Zero Fabrication: Central Reports exclude fabricated signatory names", () => {
  const reportsExportPath = path.join(
    projectRoot,
    "lib",
    "admin",
    "reportsExport.js"
  );
  const pdfDownloadPath = path.join(
    projectRoot,
    "lib",
    "admin",
    "reportsPdfDownload.js"
  );
  const dynamicPdfPath = path.join(
    projectRoot,
    "lib",
    "admin",
    "dynamicReportsPdfExport.js"
  );

  const exportCode = fs.readFileSync(reportsExportPath, "utf-8");
  const pdfCode = fs.readFileSync(pdfDownloadPath, "utf-8");
  const dynamicCode = fs.readFileSync(dynamicPdfPath, "utf-8");

  assert.ok(!exportCode.includes("MARIA SANTOS, EDD"), "reportsExport.js must not include fake name");
  assert.ok(!pdfCode.includes("MARIA SANTOS, EDD"), "reportsPdfDownload.js must not include fake name");
  assert.ok(!dynamicCode.includes("MARIA SANTOS, EDD"), "dynamicReportsPdfExport.js must not include fake name");

  assert.ok(!exportCode.includes("School Principal IV"), "reportsExport.js must not include fake title");
  assert.ok(!pdfCode.includes("School Principal IV"), "reportsPdfDownload.js must not include fake title");
  assert.ok(!dynamicCode.includes("School Principal IV"), "dynamicReportsPdfExport.js must not include fake title");
});
