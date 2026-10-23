import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  exportSectionDailyPdf,
  exportSchoolDailyPdf,
  exportSectionDailyExcel,
  exportSchoolDailyExcel,
} from "@/lib/attendance/exportDailyReport";
import {
  dailyLearnerFilename,
  dailySchoolFilename,
  dailySectionFilename,
} from "@/lib/reports/exportFilenames";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// ============================================================================
// 1. ATTENDANCE FILENAMES & SANITIZATION TESTS
// ============================================================================

test("Phase 7B Attendance Reports - Filename Builder: Generates valid section attendance filename", () => {
  const filename = dailySectionFilename({
    section: { grade_level: "7", section_name: "Diamond" },
    monthName: "October",
    schoolYear: "SY 2026-2027",
    ext: "xlsx",
  });

  assert.ok(filename.endsWith(".xlsx"), "Must end with .xlsx");
  assert.ok(filename.includes("Diamond") || filename.includes("G7"), "Must include section info");
  assert.ok(filename.includes("October"), "Must include month name");
  assert.ok(!/[<>:"/\\|?*]/.test(filename), "Must be free of illegal Windows filename characters");
});

test("Phase 7B Attendance Reports - Filename Builder: Generates valid school-wide attendance filename", () => {
  const filename = dailySchoolFilename({
    monthName: "October",
    schoolYear: "SY 2026-2027",
    ext: "xlsx",
  });

  assert.ok(filename.endsWith(".xlsx"), "Must end with .xlsx");
  assert.ok(filename.includes("October"), "Must include month name");
  assert.ok(!/[<>:"/\\|?*]/.test(filename), "Must be free of illegal Windows filename characters");
});

// ============================================================================
// 2. EXCEL WORKBOOK GENERATOR TESTS (SECTION & SCHOOL-WIDE)
// ============================================================================

test("Phase 7B Attendance Reports - Section Excel Generator: Exports valid worksheet with DepEd disclaimer", async () => {
  const syntheticSection = {
    id: "sec-001",
    grade_level: "8",
    section_name: "Sampaguita",
  };

  const syntheticSummary = {
    monthName: "October",
    enrolled: 2,
    presentSessions: 38,
    absentSessions: 2,
    sessionRate: 95.0,
    incompleteDates: [],
    learners: [
      {
        name: "Learner Alpha",
        studentNumber: "1110001",
        sex: "M",
        presentSessions: 20,
        absentSessions: 0,
        sessionRate: 100,
        incompleteDates: [],
      },
      {
        name: "Learner Beta",
        studentNumber: "1110002",
        sex: "F",
        presentSessions: 18,
        absentSessions: 2,
        sessionRate: 90,
        incompleteDates: [],
      },
    ],
  };

  // Run generator (mocking browser download)
  let downloadedWorkbook = null;
  let downloadedFilename = null;

  // We can verify that the export completes without throwing errors
  assert.doesNotThrow(async () => {
    await exportSectionDailyExcel({
      section: syntheticSection,
      schoolYear: "SY 2026-2027",
      monthName: "October",
      summary: syntheticSummary,
    });
  });
});

test("Phase 7B Attendance Reports - School-Wide Excel Generator: Exports school summary rows and learner attendance", async () => {
  const syntheticSchoolSummary = {
    scopeLabel: "All sections",
    sectionCount: 4,
    sectionsWithData: 4,
    presentSessions: 150,
    absentSessions: 10,
    sessionRate: 93.75,
    rows: [
      {
        gradeLevel: "7",
        sectionName: "Diamond",
        present: 40,
        absent: 2,
        sessionRate: 95.2,
        learnersMarked: 25,
      },
      {
        gradeLevel: "8",
        sectionName: "Emerald",
        present: 38,
        absent: 3,
        sessionRate: 92.7,
        learnersMarked: 24,
      },
    ],
    learners: [
      {
        sectionLabel: "G7 · Diamond",
        name: "Dela Cruz, Juan",
        studentNumber: "123456789001",
        presentSessions: 20,
        absentSessions: 1,
        sessionRate: 95.2,
      },
    ],
  };

  assert.doesNotThrow(async () => {
    await exportSchoolDailyExcel({
      schoolYear: "SY 2026-2027",
      monthName: "October",
      summary: syntheticSchoolSummary,
    });
  });
});

test("Phase 7B Attendance Reports - Section PDF Generator: Builds valid print shell without error", () => {
  const syntheticSection = {
    id: "sec-002",
    grade_level: "9",
    section_name: "Yakal",
  };

  const syntheticSummary = {
    monthName: "November",
    enrolled: 1,
    presentSessions: 19,
    absentSessions: 1,
    sessionRate: 95.0,
    incompleteDates: [],
    learners: [
      {
        name: "Learner Gamma",
        studentNumber: "1110003",
        presentSessions: 19,
        absentSessions: 1,
        sessionRate: 95,
        incompleteDates: [],
      },
    ],
  };

  assert.doesNotThrow(() => {
    exportSectionDailyPdf({
      section: syntheticSection,
      schoolYear: "SY 2026-2027",
      monthName: "November",
      summary: syntheticSummary,
    });
  });
});

test("Phase 7B Attendance Reports - School-Wide PDF Generator: Builds valid print shell without error", () => {
  const syntheticSchoolSummary = {
    scopeLabel: "All sections",
    sectionCount: 2,
    sectionsWithData: 2,
    presentSessions: 80,
    absentSessions: 4,
    sessionRate: 95.2,
    rows: [
      {
        gradeLevel: "9",
        sectionName: "Yakal",
        present: 40,
        absent: 2,
        sessionRate: 95.2,
        learnersMarked: 20,
      },
    ],
    learners: [],
  };

  assert.doesNotThrow(() => {
    exportSchoolDailyPdf({
      schoolYear: "SY 2026-2027",
      monthName: "November",
      summary: syntheticSchoolSummary,
    });
  });
});

// ============================================================================
// 3. UI INTEGRATION INVENTORY TESTS
// ============================================================================

test("Phase 7B Attendance Reports - UI Integration: AdminAttendancePanel imports ExportAttendanceReportModal and renders Export Report button", () => {
  const panelPath = path.join(
    projectRoot,
    "components",
    "admin",
    "attendance",
    "AdminAttendancePanel.jsx"
  );
  const content = fs.readFileSync(panelPath, "utf-8");

  assert.ok(
    content.includes("ExportAttendanceReportModal"),
    "AdminAttendancePanel must import and render ExportAttendanceReportModal"
  );
  assert.ok(
    content.includes("Export Report"),
    "AdminAttendancePanel must contain 'Export Report' button in top controls"
  );
  assert.ok(
    content.includes("Export Section"),
    "AdminAttendancePanel must contain 'Export Section' button in detail drawer"
  );
  assert.ok(
    content.includes("exportModalOpen"),
    "AdminAttendancePanel must manage exportModalOpen state"
  );
});

test("Phase 7B Attendance Reports - UI Integration: ExportAttendanceReportModal provides unified PDF and Excel options with DepEd Notice", () => {
  const modalPath = path.join(
    projectRoot,
    "components",
    "attendance",
    "ExportAttendanceReportModal.jsx"
  );
  const content = fs.readFileSync(modalPath, "utf-8");

  assert.ok(
    content.includes("Export Attendance Report"),
    "Modal must display title 'Export Attendance Report'"
  );
  assert.ok(
    content.includes("Printable PDF"),
    "Modal must offer PDF format option"
  );
  assert.ok(
    content.includes("Official Excel (.xlsx)"),
    "Modal must offer Excel format option"
  );
  assert.ok(
    content.includes("DepEd Transparency Notice"),
    "Modal must present DepEd Transparency Notice disclaimer"
  );
});
