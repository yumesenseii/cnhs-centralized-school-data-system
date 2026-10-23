import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { GRADE_RISK_BANDS, riskLevelFromGrade } from "@/lib/services/recommendation/riskFromGrade";
import { FEATURE_PLP_PERSISTENCE } from "@/lib/supabase/queries/plpQueries";
import { recommendationService } from "@/lib/services/recommendationService";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("Phase 5 - Preserved System Invariants: Risk bands and persistence status", () => {
  // 1. Authoritative school-defined risk bands
  assert.strictEqual(GRADE_RISK_BANDS.highBelow, 75, "High risk boundary must remain < 75");
  assert.strictEqual(GRADE_RISK_BANDS.moderateMax, 80, "Moderate risk upper boundary must be 80");
  assert.strictEqual(GRADE_RISK_BANDS.lowMin, 80, "Low risk boundary must be > 80");

  assert.strictEqual(riskLevelFromGrade(74), "High Risk");
  assert.strictEqual(riskLevelFromGrade(75), "Moderate Risk");
  assert.strictEqual(riskLevelFromGrade(80), "Moderate Risk");
  assert.strictEqual(riskLevelFromGrade(80.01), "Low Risk");
  assert.strictEqual(riskLevelFromGrade(84), "Low Risk");
  assert.strictEqual(riskLevelFromGrade(85), "Low Risk");

  // 2. PLP Persistence remains disabled
  assert.strictEqual(FEATURE_PLP_PERSISTENCE, false, "FEATURE_PLP_PERSISTENCE must remain false");
});

test("Phase 5 - Preserved Model B Artifact & Endpoint Integrity", () => {
  const modelBArtifact = path.join(
    projectRoot,
    "ml-service",
    "artifacts",
    "random_forest_academic_risk.joblib"
  );
  assert.ok(fs.existsSync(modelBArtifact), "Existing Model B artifact must exist");

  const fastApiMain = path.join(projectRoot, "ml-service", "app", "main.py");
  const mainContent = fs.readFileSync(fastApiMain, "utf-8");
  assert.ok(mainContent.includes("/predict"), "FastAPI /predict endpoint preserved");
  assert.ok(mainContent.includes("/predict_batch"), "FastAPI /predict_batch endpoint preserved");
  assert.ok(
    !mainContent.includes("/predict_next_term"),
    "Next-term prediction must NOT be deployed or exposed on FastAPI endpoints yet"
  );
});

test("Phase 5 - Existing Model B Labeling: Kept strictly as experimental same-term analysis", async () => {
  const rec = await recommendationService.generate({
    classSubject: "Math",
    subjectGrades: [
      { subject: "Math", finalGrade: 72 },
      { subject: "English", finalGrade: 80 },
    ],
  });

  assert.ok(rec.rfAnalysis, "rfAnalysis must be present");
  assert.strictEqual(
    rec.rfAnalysis.source,
    "pattern-analysis-experimental",
    "Model B must be clearly labeled as experimental same-term pattern analysis"
  );
  assert.ok(
    rec.rfAnalysis.disclaimer.includes("does not represent a validated next-term forecast"),
    "Disclaimer must confirm it is not a validated next-term forecast"
  );
});

test("Phase 5 - Offline ML Preparation Files Inventory", () => {
  const requiredFiles = [
    "ml-service/app/longitudinal_contract.py",
    "ml-service/scripts/prepare_longitudinal_dataset.py",
    "ml-service/scripts/generate_synthetic_longitudinal_fixture.py",
    "ml-service/scripts/eval_next_term_model.py",
    "ml-service/tests/test_longitudinal_offline.py",
  ];

  for (const relPath of requiredFiles) {
    const fullPath = path.join(projectRoot, relPath);
    assert.ok(fs.existsSync(fullPath), `Required offline preparation file missing: ${relPath}`);
  }
});

test("Phase 5 - Python Offline Unit Tests Execution", () => {
  const venvPython = path.join(
    projectRoot,
    "ml-service",
    ".venv",
    "Scripts",
    "python.exe"
  );

  assert.ok(fs.existsSync(venvPython), "Python virtualenv executable must exist");

  const cmd = `"${venvPython}" -m unittest ml-service/tests/test_longitudinal_offline.py 2>&1`;
  const result = execSync(cmd, { cwd: projectRoot, encoding: "utf-8", shell: true });

  assert.ok(result.includes("OK"), "All Python offline longitudinal unit tests must pass");
});
