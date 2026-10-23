import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { recommendationService } from "@/lib/services/recommendationService";
import { RECOMMENDATION, RISK_LEVEL } from "@/lib/monitoring/recommendations";
import { buildFeatureVector, RF_FEATURE_NAMES } from "@/lib/services/recommendation/features";
import { randomForestRecommendation, randomForestRecommendationBatch } from "@/lib/services/recommendation/randomForestEngine";
import { deriveInterventionRecommendation } from "@/lib/services/recommendation/interventionPolicy";
import { FEATURE_PLP_PERSISTENCE } from "@/lib/supabase/queries/plpQueries";
import { generateDraftPlp } from "@/lib/monitoring/plpGenerator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// ============================================================================
// 1. RULE-BASED OPERATIONAL AUTHORITY & ZERO RF OVERRIDE (Task 1 & Task 3)
// ============================================================================

test("Phase 5 RF Verification - Rule-Based Operational Authority: Passing student remains Low Risk with None intervention", async () => {
  // Passing student with verified complete curriculum
  const passingStudent = {
    classSubject: "Mathematics",
    requiredSubjects: ["Mathematics", "English", "Science"],
    isCompleteTerm: true,
    subjectGrades: [
      { subject: "Mathematics", finalGrade: 88 },
      { subject: "English", finalGrade: 86 },
      { subject: "Science", finalGrade: 90 },
    ],
  };

  const rec = await recommendationService.generate(passingStudent);

  // Authoritative operational risk and intervention must remain strictly rule-based
  assert.strictEqual(rec.riskLevel, "Low Risk", "Risk level must be Low Risk based on ECR grades");
  assert.strictEqual(rec.officialRiskLevel, "Low Risk");
  assert.strictEqual(rec.currentAcademicRisk, "Low Risk");
  assert.strictEqual(rec.recommendationType, RECOMMENDATION.NONE, "Passing student must NOT receive remediation");
  assert.strictEqual(rec.source, "authoritative-rule-based");

  // RF Analysis is populated as supplementary decision-support advisory
  assert.ok(rec.rfAnalysis, "rfAnalysis must be present");
  assert.strictEqual(rec.rfAnalysis.source, "pattern-analysis-experimental");
  assert.ok(rec.rfAnalysis.disclaimer.includes("does not represent a validated next-term forecast"));
});

test("Phase 5 RF Verification - Rule-Based Operational Authority: Failing grade gets Classroom Remediation, unaffected by RF", async () => {
  // Failing grade without subject scoping (learner record level)
  const failingStudent = {
    requiredSubjects: ["Mathematics", "English"],
    isCompleteTerm: true,
    subjectGrades: [
      { subject: "Mathematics", finalGrade: 70 },
      { subject: "English", finalGrade: 85 },
    ],
  };

  const rec = await recommendationService.generate(failingStudent);

  assert.strictEqual(rec.recommendationType, RECOMMENDATION.REMEDIATION, "Failing grade must trigger Classroom Remediation at student level");
  assert.strictEqual(rec.riskLevel, "Moderate Risk", "GWA 77.5 maps strictly to Moderate Risk band");
  assert.strictEqual(rec.source, "authoritative-rule-based");

  // Direct intervention policy check
  const intervention = deriveInterventionRecommendation(failingStudent, RISK_LEVEL.MODERATE);
  assert.strictEqual(intervention.recommendationType, RECOMMENDATION.REMEDIATION);
});

test("Phase 5 RF Verification - ARAL Independence: RF High Risk does NOT trigger ARAL", async () => {
  // Student with passing grades in English and complete curriculum
  const student = {
    classSubject: "English",
    requiredSubjects: ["English", "Filipino"],
    isCompleteTerm: true,
    subjectGrades: [
      { subject: "English", finalGrade: 82 },
      { subject: "Filipino", finalGrade: 84 },
    ],
  };

  const rec = await recommendationService.generate(student);

  // ARAL must NEVER be triggered by academic risk or RF prediction
  assert.notStrictEqual(rec.recommendationType, RECOMMENDATION.ARAL, "RF or academic risk must never trigger ARAL");
});

test("Phase 5 RF Verification - PLP Independence: PLP generator uses authoritative risk, not RF advisory", () => {
  const plp = generateDraftPlp({
    student: { id: "s-01", name: "Juan Dela Cruz", gradeLevel: 7 },
    academicContext: {
      classId: "cls-math-01",
      overallRisk: "High Risk",
      subjectGrade: 70,
      subjectName: "Mathematics",
      failingSubjects: [{ subjectName: "Mathematics", grade: 70 }],
    },
  });

  assert.strictEqual(plp.plan.plan_type, "academic_remedial", "Failing subject generates Academic Remedial Plan");
  assert.strictEqual(plp.plan.overall_risk_level, "High Risk");
  assert.strictEqual(FEATURE_PLP_PERSISTENCE, false, "FEATURE_PLP_PERSISTENCE must remain false");
});

// ============================================================================
// 2. DYNAMIC CURRICULUM COMPLETENESS & PROVISIONAL GRADE GUARD (Task 1 & Task 3)
// ============================================================================

test("Phase 5 RF Verification - Completeness Guard: Provisional/incomplete record returns pending_evidence state", async () => {
  // Student with incomplete curriculum (only 1 subject out of 3 required)
  const incompleteStudent = {
    classSubject: "Mathematics",
    requiredSubjects: ["Mathematics", "English", "Science"],
    subjectGrades: [
      { subject: "Mathematics", finalGrade: 85 },
    ],
  };

  const rec = await recommendationService.generate(incompleteStudent);

  assert.strictEqual(rec.rfAnalysis.status, "pending_evidence", "Incomplete curriculum must yield pending_evidence");
  assert.strictEqual(rec.rfAnalysis.predictedRisk, "—", "Predicted risk must be '—' for pending evidence");
  assert.strictEqual(rec.rfAnalysis.confidence, null, "Confidence must be null for pending evidence");
  assert.strictEqual(rec.rfAnalysis.probabilities, null, "Probabilities must be null for pending evidence");
  assert.ok(rec.rfAnalysis.message.includes("verified required subject"), "Message must explain missing required subjects");
});

test("Phase 5 RF Verification - Completeness Guard: Explicit isProvisional flag returns pending_evidence", async () => {
  const provisionalStudent = {
    classSubject: "Science",
    isProvisional: true,
    subjectGrades: [{ subject: "Science", finalGrade: 80 }],
  };

  const rec = await recommendationService.generate(provisionalStudent);

  assert.strictEqual(rec.rfAnalysis.status, "pending_evidence");
  assert.strictEqual(rec.rfAnalysis.confidence, null);
  assert.strictEqual(rec.rfAnalysis.probabilities, null);
});

test("Phase 5 RF Verification - Completeness Guard: Direct randomForestRecommendation honors dynamic completeness", async () => {
  const incompleteInput = {
    requiredSubjects: ["English", "Math", "Science"],
    subjectGrades: [{ subject: "English", grade: 80 }],
  };

  const rfOutput = await randomForestRecommendation(incompleteInput);
  assert.strictEqual(rfOutput.status, "pending_evidence", "Direct RF call must guard incomplete curriculum");
  assert.strictEqual(rfOutput.riskLevel, "—");
  assert.strictEqual(rfOutput.confidence, null);
});

test("Phase 5 RF Verification - Batch Completeness: generateBatch correctly partitions complete vs incomplete", async () => {
  const students = [
    // 1. Incomplete student
    {
      id: "std-inc",
      classSubject: "English",
      requiredSubjects: ["English", "Math"],
      subjectGrades: [{ subject: "English", finalGrade: 85 }],
    },
    // 2. Complete student
    {
      id: "std-comp",
      classSubject: "English",
      requiredSubjects: ["English", "Math"],
      isCompleteTerm: true,
      subjectGrades: [
        { subject: "English", finalGrade: 85 },
        { subject: "Math", finalGrade: 90 },
      ],
    },
  ];

  const batchResults = await recommendationService.generateBatch(students);

  assert.strictEqual(batchResults.length, 2);
  // Student 1 (Incomplete)
  assert.strictEqual(batchResults[0].rfAnalysis.status, "pending_evidence");
  assert.strictEqual(batchResults[0].rfAnalysis.predictedRisk, "—");
  assert.strictEqual(batchResults[0].rfAnalysis.confidence, null);

  // Student 2 (Complete)
  assert.ok(
    batchResults[1].rfAnalysis.status === "available" ||
    batchResults[1].rfAnalysis.status === "unavailable",
    "Complete student must yield either available or unavailable state"
  );
});

// ============================================================================
// 3. HONEST AVAILABILITY STATES (Task 3 & User Requirement 3)
// ============================================================================

test("Phase 5 RF Verification - Honest States: Rule-based fallback is NEVER presented as an RF prediction", async () => {
  // Complete record evaluated without remote ML server (offline fallback)
  const completeStudent = {
    classSubject: "Science",
    requiredSubjects: ["Science"],
    isCompleteTerm: true,
    subjectGrades: [{ subject: "Science", finalGrade: 88 }],
  };

  const rec = await recommendationService.generate(completeStudent);

  // When remote ML inference is not active, status must be 'unavailable'
  // (unless remote inference is configured in the environment)
  if (rec.rfAnalysis.status === "unavailable") {
    assert.strictEqual(rec.rfAnalysis.predictedRisk, "—", "Unavailable RF must not fabricate a prediction");
    assert.strictEqual(rec.rfAnalysis.confidence, null, "Unavailable RF must set confidence to null");
    assert.strictEqual(rec.rfAnalysis.probabilities, null, "Unavailable RF must set probabilities to null");
    assert.ok(rec.rfAnalysis.message.includes("unavailable"), "Must explain ML service unavailability");
  } else if (rec.rfAnalysis.status === "available") {
    assert.ok(rec.rfAnalysis.probabilities, "Available RF must include genuine probabilities");
    assert.ok(typeof rec.rfAnalysis.confidence === "number", "Available RF must include confidence");
  }
});

// ============================================================================
// 4. FEATURE CONTRACT & TARGET LEAKAGE PREVENTION (Task 1 & Task 4)
// ============================================================================

test("Phase 5 RF Verification - Feature Contract: Model B strictly excludes general_average and SF2 attendance", () => {
  assert.strictEqual(RF_FEATURE_NAMES.length, 13, "Model B contract requires exactly 13 features");
  assert.ok(!RF_FEATURE_NAMES.includes("general_average"), "No target leakage: general_average excluded");
  assert.ok(!RF_FEATURE_NAMES.includes("attendance"), "Attendance excluded from academic feature vector");
  assert.ok(!RF_FEATURE_NAMES.includes("sf2"), "SF2 excluded from academic feature vector");

  const student = {
    gwa: 87.5,
    attendanceRate: 98,
    subjectGrades: [
      { subject: "English", finalGrade: 85 },
      { subject: "Math", finalGrade: 90 },
    ],
  };

  const features = buildFeatureVector(student);
  assert.strictEqual(features.featureNames.length, 13);
  assert.ok(!Object.keys(features.featureVector).includes("general_average"));
  assert.ok(!Object.keys(features.featureVector).includes("attendanceRate"));
});

// ============================================================================
// 5. NEXT-TERM PREDICTION READINESS GATING (Task 2 & Task 5)
// ============================================================================

test("Phase 5 RF Verification - Next-Term Gated: FastAPI endpoints do NOT expose next-term forecasting", () => {
  const fastApiMain = path.join(projectRoot, "ml-service", "app", "main.py");
  const content = fs.readFileSync(fastApiMain, "utf-8");

  assert.ok(!content.includes("/predict_next_term"), "Next-term forecasting must NOT be deployed in FastAPI endpoints");
  assert.ok(content.includes("/predict"), "/predict preserved");
  assert.ok(content.includes("/predict_batch"), "/predict_batch preserved");
});

// ============================================================================
// 6. UI COMPONENT INTEGRATION & FABRICATION REMOVAL (Task 3 & User Requirement 4 & 5)
// ============================================================================

test("Phase 5 RF Verification - UI Integration: LearnerAcademicDetailModal contains dedicated RF Advisory Card", () => {
  const modalPath = path.join(
    projectRoot,
    "components",
    "monitoring",
    "shared",
    "LearnerAcademicDetailModal.jsx"
  );
  const content = fs.readFileSync(modalPath, "utf-8");

  assert.ok(
    content.includes("Experimental Same-Term Pattern Analysis — Decision Support Only"),
    "LearnerAcademicDetailModal must contain the exact required label"
  );
  assert.ok(
    content.includes("Model B Advisory"),
    "LearnerAcademicDetailModal must identify Model B"
  );
  assert.ok(
    content.includes("Trained on synthetic cohort data"),
    "Disclaimer must explain synthetic training baseline"
  );
  assert.ok(
    content.includes("does not determine official academic risk, ARAL placement, or PLP activation"),
    "Disclaimer must disclaim authoritative risk override"
  );
  assert.ok(
    content.includes("Evidence Pending / Provisional Academic Record"),
    "Modal must display honest pending state when evidence is incomplete"
  );
  assert.ok(
    content.includes("ML Decision Support Unavailable"),
    "Modal must display honest unavailable state when ML service is offline"
  );
});

test("Phase 5 RF Verification - Fabrication Removal: AralLearnerProfileModal does NOT hardcode 87% confidence and strictly checks provenance", () => {
  const aralModalPath = path.join(
    projectRoot,
    "components",
    "teacher",
    "monitoring",
    "AralLearnerProfileModal.jsx"
  );
  const content = fs.readFileSync(aralModalPath, "utf-8");

  assert.ok(!content.includes(": 87;"), "Fake 87% confidence fallback must be completely removed");
  assert.ok(
    !content.includes("learner.riskLevel || (learner.academicRiskLevel === \"High Risk\""),
    "AralLearnerProfileModal must NOT fall back to rule-based riskLevel or academicRiskLevel for RF predictions"
  );
  assert.ok(
    !content.includes("learner.rfPredictedRisk !== \"—\" && learner.rfSource !== \"rule-based-fallback\""),
    "Must not accept legacy learner.rfPredictedRisk alone without verified rfData.status"
  );
  assert.ok(
    content.includes("rfData?.status === \"available\""),
    "Must strictly require rfData.status === 'available'"
  );
  assert.ok(
    content.includes("rfData?.source !== \"rule-based-fallback\""),
    "Must explicitly reject rule-based-fallback as an RF prediction"
  );
  assert.ok(
    content.includes("ML Prediction Unavailable"),
    "AralLearnerProfileModal must render honest 'ML Prediction Unavailable' status when RF is not available"
  );
  assert.ok(
    !content.includes("Low performance trajectory detected in formative reading quizzes"),
    "Misleading claim that formative reading quizzes are RF features must be removed"
  );
  assert.ok(
    content.includes("Phil-IRI scores govern statutory ARAL eligibility; Random Forest operates on finalized academic records only."),
    "Must clarify Phil-IRI is statutory and not an RF feature"
  );
});

test("Phase 5 RF Verification - Contract Hardening: Verification of RF availability logic against legacy/stale scenarios", () => {
  function evaluateRfAvailability(learner) {
    const rfData = learner.rfAnalysis;
    return Boolean(
      rfData?.status === "available" &&
        rfData?.predictedRisk &&
        rfData.predictedRisk !== "—" &&
        rfData?.source !== "rule-based-fallback"
    );
  }

  // Scenario 1: Stale legacy prediction without rfAnalysis
  assert.strictEqual(
    evaluateRfAvailability({ rfPredictedRisk: "High Risk", rfConfidence: 0.85 }),
    false,
    "Stale legacy rfPredictedRisk without rfAnalysis must be unavailable"
  );

  // Scenario 2: rfAnalysis with missing or unavailable status
  assert.strictEqual(
    evaluateRfAvailability({
      rfAnalysis: { status: "unavailable", predictedRisk: "—", source: "pattern-analysis-experimental" },
    }),
    false,
    "Status 'unavailable' must be rejected"
  );

  // Scenario 3: Fallback source presented as RF
  assert.strictEqual(
    evaluateRfAvailability({
      rfAnalysis: { status: "available", predictedRisk: "High Risk", source: "rule-based-fallback" },
    }),
    false,
    "Source 'rule-based-fallback' must never be accepted as a genuine RF prediction"
  );

  // Scenario 4: Valid, genuine Random Forest prediction
  assert.strictEqual(
    evaluateRfAvailability({
      rfAnalysis: {
        status: "available",
        predictedRisk: "High Risk",
        confidence: 0.88,
        source: "pattern-analysis-experimental",
      },
    }),
    true,
    "Valid RF result with available status and genuine prediction must be available"
  );
});

test("Phase 5 RF Verification - Fabrication Removal: listAralSummerRegistry does NOT hardcode 91% or 84% confidence", () => {
  const queriesPath = path.join(
    projectRoot,
    "lib",
    "supabase",
    "queries",
    "monitoring.js"
  );
  const content = fs.readFileSync(queriesPath, "utf-8");

  assert.ok(
    !content.includes("rfConfidence: isHighRisk ? 91 : 84"),
    "Fake 91/84 confidence must be removed from listAralSummerRegistry"
  );
  assert.ok(
    content.includes("rfConfidence: null"),
    "rfConfidence must default to null when unassigned in registry"
  );
});

test("Phase 5 RF Verification - Fabrication Removal: AdminAralSummerRegistryPanel handles null confidence gracefully", () => {
  const panelPath = path.join(
    projectRoot,
    "components",
    "admin",
    "monitoring",
    "AdminAralSummerRegistryPanel.jsx"
  );
  const content = fs.readFileSync(panelPath, "utf-8");

  assert.ok(
    content.includes("row.rfConfidence != null ? `(${row.rfConfidence}%)` : \"(Not evaluated)\""),
    "AdminAralSummerRegistryPanel table column must handle null rfConfidence as '(Not evaluated)'"
  );
  assert.ok(
    content.includes("selectedRecord.rfConfidence != null ? `${selectedRecord.rfConfidence}%` : \"Not evaluated\""),
    "AdminAralSummerRegistryPanel drawer must handle null rfConfidence as 'Not evaluated'"
  );
});

test("Phase 5 RF Verification - Preserved Invariants: Model B artifact exists and PLP persistence remains disabled", () => {
  const artifactPath = path.join(
    projectRoot,
    "ml-service",
    "artifacts",
    "random_forest_academic_risk.joblib"
  );
  assert.ok(fs.existsSync(artifactPath), "Model B artifact must exist at artifacts/random_forest_academic_risk.joblib");
  assert.strictEqual(FEATURE_PLP_PERSISTENCE, false, "FEATURE_PLP_PERSISTENCE must remain strictly false");
});

test("Phase 5 RF Verification - Concurrency Baseline: 11 concurrent staff users (1 Principal + 10 Teachers) in-memory service evaluation", async () => {
  // Scenario: Evaluation day baseline with exactly 1 Principal and 10 Teachers
  // Note: This verifies in-memory service layer concurrency and performance characteristics,
  // distinct from live authenticated network, Supabase database pool, or browser UI concurrency.

  const staffUsers = [
    { role: "principal", id: "principal-01", name: "Principal Maria Santos", task: "batch_monitoring" },
    ...Array.from({ length: 10 }, (_, i) => ({
      role: "teacher",
      id: `teacher-${String(i + 1).padStart(2, "0")}`,
      name: `Teacher ${i + 1}`,
      task: i % 2 === 0 ? "plp_generation" : "batch_monitoring",
    })),
  ];

  assert.strictEqual(staffUsers.length, 11, "Evaluation scenario must have exactly 11 staff respondents (1 Principal + 10 Teachers)");

  // Synthetic student dataset for batch processing (5 students per teacher batch)
  const syntheticClassStudents = [
    {
      id: "std-01",
      name: "Student Alpha",
      requiredSubjects: ["Mathematics", "English", "Science"],
      isCompleteTerm: true,
      subjectGrades: [{ subject: "Mathematics", finalGrade: 88 }, { subject: "English", finalGrade: 85 }, { subject: "Science", finalGrade: 87 }],
    },
    {
      id: "std-02",
      name: "Student Beta",
      requiredSubjects: ["Mathematics", "English", "Science"],
      isCompleteTerm: true,
      subjectGrades: [{ subject: "Mathematics", finalGrade: 72 }, { subject: "English", finalGrade: 80 }, { subject: "Science", finalGrade: 78 }],
    },
    {
      id: "std-03",
      name: "Student Gamma",
      requiredSubjects: ["Mathematics", "English", "Science"],
      isCompleteTerm: true,
      subjectGrades: [{ subject: "Mathematics", finalGrade: 92 }, { subject: "English", finalGrade: 94 }, { subject: "Science", finalGrade: 90 }],
    },
    {
      id: "std-04",
      name: "Student Delta",
      requiredSubjects: ["Mathematics", "English", "Science"],
      isCompleteTerm: true,
      subjectGrades: [{ subject: "Mathematics", finalGrade: 68 }, { subject: "English", finalGrade: 74 }, { subject: "Science", finalGrade: 71 }],
    },
    {
      id: "std-05",
      name: "Student Epsilon",
      requiredSubjects: ["Mathematics", "English", "Science"],
      isCompleteTerm: false, // Provisional
      subjectGrades: [{ subject: "Mathematics", finalGrade: 84 }],
    },
  ];

  const executionDurations = [];
  const errors = [];

  const promises = staffUsers.map(async (user) => {
    const t0 = performance.now();
    try {
      if (user.task === "batch_monitoring") {
        // Principal or Teacher running batch recommendation and monitoring evaluation
        const results = await recommendationService.generateBatch(syntheticClassStudents);
        assert.strictEqual(results.length, 5);
        assert.strictEqual(results[0].riskLevel, "Low Risk");
        assert.strictEqual(results[1].riskLevel, "Moderate Risk");
        assert.strictEqual(results[4].rfAnalysis.status, "pending_evidence");
      } else {
        // Teacher generating draft PLP for remediation
        const plp = generateDraftPlp({
          student: { id: "std-02", name: "Student Beta", gradeLevel: 8 },
          academicContext: {
            classId: "cls-math-08",
            overallRisk: "Moderate Risk",
            subjectGrade: 72,
            subjectName: "Mathematics",
            failingSubjects: [{ subjectName: "Mathematics", grade: 72 }],
          },
        });
        assert.ok(plp.success);
        assert.strictEqual(plp.plan.plan_type, "academic_remedial");
        assert.strictEqual(plp.plan.status, "draft");
      }
      const t1 = performance.now();
      executionDurations.push(t1 - t0);
    } catch (err) {
      errors.push({ user: user.id, error: err.message });
    }
  });

  await Promise.all(promises);

  assert.strictEqual(errors.length, 0, `All 11 concurrent staff operations must complete without error: ${JSON.stringify(errors)}`);
  assert.strictEqual(executionDurations.length, 11, "All 11 operations must record execution timings");

  executionDurations.sort((a, b) => a - b);
  const min = executionDurations[0];
  const max = executionDurations[executionDurations.length - 1];
  const median = executionDurations[Math.floor(executionDurations.length / 2)];
  const p95 = executionDurations[Math.floor(executionDurations.length * 0.95)];

  assert.ok(median >= 0, "Median response time must be non-negative");
  assert.ok(p95 >= 0, "p95 response time must be non-negative");
  assert.ok(max < 5000, `Max execution duration (${max}ms) should not freeze the process (<5000ms)`);
});


