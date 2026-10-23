import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateAcademicSupport,
  ACADEMIC_SUPPORT_LEVEL,
  EVALUATION_STATUS,
} from "../lib/services/recommendation/academicSupportEngine.js";
import { deriveInterventionRecommendation } from "../lib/services/recommendation/interventionPolicy.js";
import {
  getLearnerAralReferralState,
  READING_ASSESSMENT_STATE,
  ARAL_REFERRAL_STATE,
  ARAL_WORDING,
} from "../lib/monitoring/aralAcademicStatus.js";
import { isAralRecommended } from "../lib/monitoring/aralProgress.js";
import { recommendationService } from "../lib/services/recommendationService.js";
import { RECOMMENDATION, RISK_LEVEL } from "../lib/monitoring/recommendations.js";
import { deriveAcademicRisk } from "../lib/monitoring/academicMonitoringState.js";

// ============================================================================
// 1. DYNAMIC ACADEMIC COMPLETENESS VALIDATION (Safeguard 1 & 5)
// ============================================================================

test("Phase 3 - Completeness: All verified required subjects finalized -> Complete status & Authoritative GWA", () => {
  const requiredSubjects = [
    "English",
    "Filipino",
    "Mathematics",
    "Science",
    "Araling Panlipunan",
    "TLE",
    "MAPEH",
    "Values Education",
  ];

  const result = evaluateAcademicSupport({
    requiredSubjects,
    subjects: {
      English: 88,
      Filipino: 86,
      Mathematics: 85,
      Science: 87,
      "Araling Panlipunan": 89,
      TLE: 90,
      MAPEH: 88,
      "Values Education": 91,
    },
  });

  assert.equal(result.evaluationStatus, EVALUATION_STATUS.COMPLETE);
  assert.equal(result.isCompleteTerm, true);
  assert.equal(result.currentAcademicRisk, RISK_LEVEL.LOW);
  assert.equal(result.officialRiskLevel, RISK_LEVEL.LOW);
  assert.ok(result.gwa !== null && result.gwa >= 85, "Authoritative GWA must be computed");
  assert.deepEqual(result.missingRequiredSubjects, []);
  assert.equal(result.recommendedSupportLevel, ACADEMIC_SUPPORT_LEVEL.REGULAR_MONITORING);
});

test("Phase 3 - Completeness: Partial subjects finalized -> Provisional status, gwa is null, risk is Pending Full-Term Evaluation", () => {
  const requiredSubjects = [
    "English",
    "Filipino",
    "Mathematics",
    "Science",
    "Araling Panlipunan",
    "TLE",
    "MAPEH",
    "Values Education",
  ];

  // Only 4 out of 8 subjects finalized
  const result = evaluateAcademicSupport({
    requiredSubjects,
    subjects: {
      English: 84,
      Mathematics: 80,
      Science: 82,
      Filipino: 85,
    },
  });

  assert.equal(result.evaluationStatus, EVALUATION_STATUS.PROVISIONAL);
  assert.equal(result.isCompleteTerm, false);
  // Authoritative term GWA must NOT be computed from an incomplete subset!
  assert.equal(result.gwa, null);
  assert.ok(result.provisionalAverage !== null, "Provisional average may exist for teacher view");
  assert.equal(result.currentAcademicRisk, "Provisional");
  assert.equal(result.officialRiskLevel, "Pending Full-Term Evaluation");
  assert.equal(result.missingRequiredSubjects.length, 4);
  assert.ok(result.missingRequiredSubjects.includes("Araling Panlipunan"));
});

test("Phase 3 - Completeness: Unverified required configuration -> safely retains Provisional status", () => {
  const result = evaluateAcademicSupport({
    // requiredSubjects omitted or cannot be verified from active records
    subjects: {
      English: 85,
      Math: 80,
    },
  });

  assert.equal(result.evaluationStatus, EVALUATION_STATUS.PROVISIONAL);
  assert.equal(result.isCompleteTerm, false);
  assert.equal(result.gwa, null);
  assert.equal(result.officialRiskLevel, "Pending Full-Term Evaluation");
  assert.ok(result.completenessLimitation.includes("cannot be verified"));
});

test("Phase 3 - Provisional Risk: Finalized failing subject in partial record immediately gets Subject Remediation", () => {
  const requiredSubjects = ["English", "Math", "Science", "Filipino"];

  const result = evaluateAcademicSupport({
    requiredSubjects,
    subjects: {
      English: 85,
      Math: 72, // Failing (< 75)
    },
  });

  assert.equal(result.evaluationStatus, EVALUATION_STATUS.PROVISIONAL);
  assert.equal(result.gwa, null);
  assert.equal(result.officialRiskLevel, "Pending Full-Term Evaluation");
  assert.deepEqual(result.weakSubjects, ["Math"]);
  assert.equal(
    result.recommendedSupportLevel,
    ACADEMIC_SUPPORT_LEVEL.SUBJECT_REMEDIATION
  );
  assert.ok(
    result.recommendationReason.includes("Subject-specific remediation is recommended for finalized failing subject(s): Math")
  );

  // academicMonitoringState respects provisional status
  const riskDisplay = deriveAcademicRisk({
    evaluationStatus: result.evaluationStatus,
    riskLevel: result.currentAcademicRisk,
  });
  assert.equal(riskDisplay, "Pending Full-Term Evaluation");
});

// ============================================================================
// 2. SEVERING GRADE-BASED ARAL TRIGGERS
// ============================================================================

test("Phase 3 - Decoupling: Failing English or Filipino triggers Classroom Remediation, NOT ARAL", () => {
  const student = {
    classSubject: "English",
    subjectGrades: [
      { subject: "English", finalGrade: 72 },
      { subject: "Filipino", finalGrade: 70 },
      { subject: "Math", finalGrade: 80 },
    ],
  };

  const intervention = deriveInterventionRecommendation(student, RISK_LEVEL.HIGH);
  assert.equal(
    intervention.recommendationType,
    RECOMMENDATION.REMEDIATION,
    "Failing language grades must trigger Classroom Remediation, not ARAL"
  );
  assert.notEqual(intervention.recommendationType, RECOMMENDATION.ARAL);
});

// ============================================================================
// 3. SEPARATE READING ASSESSMENT & ARAL REFERRAL STATES
// ============================================================================

test("Phase 3 - Reading State: GST below 28 triggers Form 3 IRA, not automatic ARAL referral", () => {
  const learner = {
    subject: "English",
    philIriScore: 24, // below 28 cutoff
    readingLevel: null, // Form 3 not yet conducted
  };

  const refState = getLearnerAralReferralState(learner);

  assert.equal(
    refState.readingAssessmentState,
    READING_ASSESSMENT_STATE.NEEDS_IRA,
    "GST < 28 must set Needs Individual Reading Assessment"
  );
  assert.equal(
    refState.aralReferralState,
    ARAL_REFERRAL_STATE.NOT_ELIGIBLE,
    "GST < 28 alone does not make learner eligible for ARAL referral"
  );
  assert.equal(refState.canSubmitReferral, false);
});

test("Phase 3 - Reading State: Form 3 Frustration/Instructional qualifies for teacher referral", () => {
  const learner = {
    subject: "English",
    philIriScore: 22,
    readingLevel: "Frustration", // Form 3 IRA completed
  };

  const refState = getLearnerAralReferralState(learner);

  assert.equal(
    refState.readingAssessmentState,
    READING_ASSESSMENT_STATE.ASSESSMENT_COMPLETED
  );
  assert.equal(
    refState.aralReferralState,
    ARAL_REFERRAL_STATE.ELIGIBLE_FOR_REFERRAL
  );
  assert.equal(refState.canSubmitReferral, true);
});

test("Phase 3 - Reading State: Independent profile does not qualify for ARAL but stays on masterlist", () => {
  const learner = {
    subject: "English",
    philIriScore: 24,
    readingLevel: "Independent", // Completed Form 3 at Independent level
  };

  const refState = getLearnerAralReferralState(learner);

  assert.equal(
    refState.readingAssessmentState,
    READING_ASSESSMENT_STATE.ASSESSMENT_COMPLETED
  );
  assert.equal(refState.aralReferralState, ARAL_REFERRAL_STATE.NOT_ELIGIBLE);
  assert.equal(refState.canSubmitReferral, false);
  // Learner remains monitored at grade level
  assert.equal(refState.isLanguageSubject, true);
});

test("Phase 3 - Referral Workflow: Principal approval actions preserve distinct states", () => {
  // A. Submitted
  const submittedLearner = {
    subject: "English",
    aralApprovalDbStatus: "submitted",
  };
  const submittedState = getLearnerAralReferralState(submittedLearner);
  assert.equal(submittedState.standardizedStatus, ARAL_WORDING.PENDING);
  assert.equal(submittedState.aralReferralState, ARAL_REFERRAL_STATE.REFERRAL_SUBMITTED);
  assert.equal(submittedState.canSubmitReferral, false);

  // B. Approved for Assessment (Principal approved, NOT automatically Under ARAL Support!)
  const approvedLearner = {
    subject: "English",
    aralApprovalDbStatus: "approved",
    inAralProgram: false,
  };
  const approvedState = getLearnerAralReferralState(approvedLearner);
  assert.equal(approvedState.standardizedStatus, ARAL_WORDING.APPROVED);
  assert.equal(approvedState.aralReferralState, ARAL_REFERRAL_STATE.APPROVED);
  assert.equal(approvedState.isUnderSupport, false, "Approved for assessment is NOT yet under ARAL support");

  // C. Under ARAL Support (Facilitator assigned / Active intervention)
  const activeLearner = {
    subject: "English",
    aralApprovalDbStatus: "approved",
    inAralProgram: true,
  };
  const activeState = getLearnerAralReferralState(activeLearner);
  assert.equal(activeState.standardizedStatus, ARAL_WORDING.UNDER_SUPPORT);
  assert.equal(activeState.aralReferralState, ARAL_REFERRAL_STATE.UNDER_ARAL_SUPPORT);
  assert.equal(activeState.isUnderSupport, true);
});

// ============================================================================
// 4. BOSY ZERO-GRADE INDEPENDENCE
// ============================================================================

test("Phase 3 - BOSY: Learner without academic grades can undergo reading screening & referral", () => {
  const bosyLearner = {
    subject: "English",
    classSubjectGrade: null, // No grades at BOSY
    philIriScore: 20,
    readingLevel: "Frustration", // Verified Form 3
  };

  const refState = getLearnerAralReferralState(bosyLearner);
  assert.equal(refState.canSubmitReferral, true, "BOSY learner with verified reading need can be referred");
  assert.equal(refState.aralReferralState, ARAL_REFERRAL_STATE.ELIGIBLE_FOR_REFERRAL);
});

// ============================================================================
// 5. UNIVERSAL RANDOM FOREST LABELING AUDIT (Safeguard 6)
// ============================================================================

test("Phase 3 - RF Labeling: Recommendation service outputs experimental same-term pattern analysis", async () => {
  const result = await recommendationService.generate({
    classSubject: "English",
    subjectGrades: [{ subject: "English", finalGrade: 85 }],
  });

  assert.ok(result.rfAnalysis, "rfAnalysis must be present");
  assert.equal(result.rfAnalysis.source, "pattern-analysis-experimental");
  assert.equal(
    result.rfAnalysis.modelDescription,
    "Pattern Analysis (Same-Term Model / Experimental)"
  );
  assert.ok(
    result.rfAnalysis.disclaimer.includes("does not represent a validated next-term forecast"),
    "Disclaimer must disclaim next-term forecast"
  );
  // Ensure no next-term forecast claims in publicResult
  assert.equal(result.nextTermForecast, undefined);
  assert.equal(result.predictedNextTermRisk, undefined);
});
