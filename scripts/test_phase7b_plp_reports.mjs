import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildPlpReportFilename,
  exportPlpPdf,
} from "@/lib/reports/plpReportExport";
import { FEATURE_PLP_PERSISTENCE } from "@/lib/supabase/queries/plpQueries";
import { SF9_SCHOOL_INFO } from "@/lib/reports/sf9DataService";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// ============================================================================
// 1. FILENAME BUILDER & SANITIZATION TESTS
// ============================================================================

test("Phase 7B PLP Reports - Filename Builder: Generates valid Windows-safe PDF filename", () => {
  const filename = buildPlpReportFilename({
    learnerName: "Juan Dela Cruz",
    schoolYear: "SY 2026-2027",
    planType: "composite",
    format: "pdf",
  });

  assert.ok(filename.endsWith(".pdf"), "Must end with .pdf");
  assert.ok(filename.includes("CNHS_PLP"), "Must include PLP prefix");
  assert.ok(filename.includes("Juan-Dela-Cruz") || filename.includes("Juan"), "Must include learner name");
  assert.ok(filename.includes("composite"), "Must include plan type");
  assert.ok(!/[<>:"/\\|?*]/.test(filename), "Must not contain illegal Windows characters");
});

// ============================================================================
// 2. PDF GENERATOR & AUTHENTICITY TESTS
// ============================================================================

test("Phase 7B PLP Reports - PDF Generator: Builds valid print shell with DepEd letterhead & School ID 300793", () => {
  const syntheticPlp = {
    plan_type: "composite",
    overall_risk_level: "High Risk",
    recommended_support_level: "Classroom Remediation & ARAL Targeted Reading Support",
    school_year: "SY 2026-2027",
    status: "draft",
    learning_needs: [
      "Struggling with quadratic equations and algebraic factorization.",
      "Frustration reading profile in English reading comprehension.",
    ],
    target_objectives: [
      "Achieve at least 75% mastery in factoring quadratic polynomials.",
      "Transition from Frustration to Instructional reading level by EOSY.",
    ],
    recommended_activities: [
      "Targeted after-class remedial sessions twice a week.",
      "Participation in ARAL peer-assisted reading circle.",
    ],
    monitoring_indicators: [
      "Weekly formative quiz score >= 75%.",
      "Phil-IRI midyear reading assessment evaluation.",
    ],
    teacher_notes: "Learner shows high motivation during interactive exercises.",
  };

  const syntheticLearner = {
    name: "Dela Cruz, Juan M.",
    studentNumber: "100452",
    gradeSectionDisplay: "Grade 8 - Sampaguita",
  };

  const result = exportPlpPdf({
    plp: syntheticPlp,
    learner: syntheticLearner,
    teacherName: "Teacher Maria",
  });

  assert.ok(result.success, "Export must succeed");
  assert.ok(result.html, "HTML content must be returned");

  // Official DepEd metadata
  assert.ok(result.html.includes("CAMBAOG NATIONAL HIGH SCHOOL"), "Must include official school name");
  assert.ok(result.html.includes("300793"), "Must include official School ID 300793");
  assert.ok(result.html.includes("REGION III"), "Must include official Region III");
  assert.ok(result.html.includes("BULACAN"), "Must include Bulacan");

  // PLP Content Verification
  assert.ok(result.html.includes("PERSONALIZED LEARNING PLAN (PLP)"), "Must include PLP title");
  assert.ok(result.html.includes("Dela Cruz, Juan M."), "Must include learner name");
  assert.ok(result.html.includes("100452"), "Must include student number");
  assert.ok(result.html.includes("quadratic equations"), "Must include learning needs");
  assert.ok(result.html.includes("factoring quadratic polynomials"), "Must include target objectives");
  assert.ok(result.html.includes("ARAL peer-assisted reading circle"), "Must include recommended activities");
  assert.ok(result.html.includes("formative quiz score"), "Must include monitoring indicators");
  assert.ok(result.html.includes("Learner shows high motivation"), "Must include teacher notes");

  // Zero Fabricated Signatories
  assert.ok(!result.html.includes("MARIA SANTOS, EDD"), "Must NEVER include fabricated 'MARIA SANTOS, EDD'");
  assert.ok(!result.html.includes("School Principal IV"), "Must NEVER include fabricated 'School Principal IV'");

  // Authentic Signatories
  assert.ok(
    result.html.includes("DULCE VILMA R. GALANG") || result.html.includes("Signature over Printed Name"),
    "Must include official School Head or honest signature line"
  );

  // Policy Note
  assert.ok(result.html.includes("RA 12028"), "Must cite RA 12028 ARAL Program Act");
  assert.ok(result.html.includes("AUTHORITATIVE POLICY NOTE"), "Must include authoritative policy note");
});

test("Phase 7B PLP Reports - PDF Generator: Handles academic-only remedial plan cleanly", () => {
  const academicPlp = {
    plan_type: "academic_remedial",
    overall_risk_level: "Moderate Risk",
    recommended_support_level: "Classroom Remediation",
    school_year: "SY 2026-2027",
    status: "draft",
    learning_needs: ["Competency reinforcement in Science (Cellular Biology)."],
    target_objectives: ["Attain 75% or above on quarterly summative exam."],
    recommended_activities: ["Guided module worksheets."],
    monitoring_indicators: ["Bi-weekly check-in."],
  };

  const result = exportPlpPdf({
    plp: academicPlp,
    learner: { name: "Santos, Clara" },
  });

  assert.ok(result.success, "Must succeed");
  assert.ok(result.html.includes("Academic Remediation Plan"), "Must include Academic Remediation label");
  assert.ok(result.html.includes("Cellular Biology"), "Must include subject competency");
});

// ============================================================================
// 3. UI INTEGRATION TESTS
// ============================================================================

test("Phase 7B PLP Reports - UI Integration: PlpDocumentModal imports exportPlpPdf and provides Export PLP button", () => {
  const modalPath = path.join(
    projectRoot,
    "components",
    "monitoring",
    "plp",
    "PlpDocumentModal.jsx"
  );
  assert.ok(fs.existsSync(modalPath), "PlpDocumentModal.jsx must exist");

  const modalContent = fs.readFileSync(modalPath, "utf-8");
  assert.ok(modalContent.includes("exportPlpPdf"), "Must import exportPlpPdf");
  assert.ok(modalContent.includes("handleExportPdf"), "Must implement handleExportPdf");
  assert.ok(modalContent.includes("Export PLP (PDF)"), "Must render Export PLP (PDF) button");
});

test("Phase 7B PLP Reports - Safety Invariant: FEATURE_PLP_PERSISTENCE remains false", () => {
  assert.equal(
    FEATURE_PLP_PERSISTENCE,
    false,
    "FEATURE_PLP_PERSISTENCE must remain strictly false (zero database mutations)"
  );
});
