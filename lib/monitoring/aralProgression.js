/**
 * Authoritative term progression and active queue eligibility for ARAL Reading Assessment.
 *
 * Implements strict DepEd Phil-IRI multi-term progression:
 * - Term 1 (Beginning / BOSY): All enrolled learners take beginning assessment.
 *   - GST 28–40 -> At Grade Level / PASS -> Exits active progression ("No Further Assessment Required").
 *   - GST 0–27 -> Form 3 IRA. If Independent -> PASS / Exits. If Instructional/Frustration -> Continue to Term 2.
 *   - Absent -> "Absent / For Reschedule" (score null, remains in Term 1 active queue).
 * - Term 2 (Middle / MOSY):
 *   - Only learners who did NOT exit after Term 1 appear in active Term 2 queue.
 *   - Term 1 PASS learners do not appear in active Term 2 reassessment queue.
 * - Term 3 (End / EOSY):
 *   - Only learners who still require follow-up after Term 2 appear in active Term 3 queue.
 *   - Final reading need remains -> "For Further Review" ("Possible ARAL Summer Consideration").
 */

/**
 * Normalizes term string into canonical BOSY, MOSY, EOSY.
 */
export function normalizeTerm(period = "BOSY") {
  const p = String(period || "").toUpperCase();
  if (p.includes("EOSY") || p.includes("TERM 3") || p.includes("END") || p === "Q4") {
    return "EOSY";
  }
  if (p.includes("MOSY") || p.includes("TERM 2") || p.includes("MID") || p === "Q2" || p === "Q3") {
    return "MOSY";
  }
  return "BOSY";
}

/**
 * Evaluates a single term assessment result for pass/exit or continuation.
 */
export function evaluateTermResult(recordOrLearner = null) {
  if (!recordOrLearner) {
    return {
      hasRecord: false,
      isAbsent: false,
      hasPassed: false,
      needsFollowUp: false,
      outcome: "PENDING",
      statusLabel: "Pending Assessment",
      exitNotice: null,
    };
  }

  const isAbsent = Boolean(
    recordOrLearner.isAbsent ||
    recordOrLearner.candidateStatus === "Absent / For Reschedule" ||
    recordOrLearner.screeningStatus === "Absent / For Reschedule" ||
    recordOrLearner.status === "Absent / For Reschedule" ||
    recordOrLearner.rawPayload?.isAbsent ||
    recordOrLearner.raw_payload?.isAbsent
  );

  if (isAbsent) {
    return {
      hasRecord: true,
      isAbsent: true,
      hasPassed: false,
      needsFollowUp: true,
      outcome: "ABSENT",
      statusLabel: "Absent / For Reschedule",
      exitNotice: null,
    };
  }

  const scoreVal =
    recordOrLearner.philIriScore != null
      ? Number(recordOrLearner.philIriScore)
      : recordOrLearner.totalScore != null
      ? Number(recordOrLearner.totalScore)
      : recordOrLearner.total_score != null
      ? Number(recordOrLearner.total_score)
      : null;

  if (scoreVal == null || Number.isNaN(scoreVal)) {
    return {
      hasRecord: false,
      isAbsent: false,
      hasPassed: false,
      needsFollowUp: false,
      outcome: "PENDING",
      statusLabel: "Pending Assessment",
      exitNotice: null,
    };
  }

  // GST 28-40: At Grade Level -> PASS
  if (scoreVal >= 28) {
    return {
      hasRecord: true,
      isAbsent: false,
      hasPassed: true,
      needsFollowUp: false,
      outcome: "PASS",
      statusLabel: "Screening Complete — At Grade Level",
      exitNotice: "No Further Assessment Required",
    };
  }

  // GST < 28: Check Form 3 Reading Profile
  const readingProfile =
    recordOrLearner.readingLevel ||
    recordOrLearner.readingProfile ||
    recordOrLearner.oralReadingProfile ||
    recordOrLearner.reading_profile ||
    null;

  const hasValidIra = Boolean(
    readingProfile &&
    readingProfile !== "Not Screened" &&
    readingProfile !== "Not Assessed" &&
    readingProfile !== "Pending Oral Profile" &&
    readingProfile !== "Pending Individual Assessment" &&
    readingProfile !== "Not Set"
  );

  if (hasValidIra) {
    if (readingProfile === "Independent") {
      return {
        hasRecord: true,
        isAbsent: false,
        hasPassed: true,
        needsFollowUp: false,
        outcome: "PASS",
        statusLabel: "Reading Assessment Complete",
        exitNotice: "No Further Assessment Required",
      };
    }
    // Instructional or Frustration -> CONTINUE TO NEXT TERM
    return {
      hasRecord: true,
      isAbsent: false,
      hasPassed: false,
      needsFollowUp: true,
      outcome: "CONTINUE",
      statusLabel: readingProfile,
      exitNotice: "Continue to Next Term",
    };
  }

  // GST < 28 without completed Form 3
  return {
    hasRecord: true,
    isAbsent: false,
    hasPassed: false,
    needsFollowUp: true,
    outcome: "NEEDS_IRA",
    statusLabel: "Needs Reading Assessment",
    exitNotice: "Needs Reading Assessment",
  };
}

/**
 * Inspects a learner's past term records to determine if they passed in an earlier term.
 */
export function getPreviousTermOutcome(learner, targetPeriod = "BOSY") {
  const normTarget = normalizeTerm(targetPeriod);
  const records = Array.isArray(learner.philIriRecords) ? learner.philIriRecords : [];

  // Find Term 1 (BOSY) record
  const bosyRec = records.find((r) => normalizeTerm(r.assessmentPeriod || r.assessment_period) === "BOSY") || null;
  const bosyEval = bosyRec ? evaluateTermResult(bosyRec) : (normTarget === "BOSY" ? evaluateTermResult(learner) : evaluateTermResult(null));

  // Find Term 2 (MOSY) record
  const mosyRec = records.find((r) => normalizeTerm(r.assessmentPeriod || r.assessment_period) === "MOSY") || null;
  const mosyEval = mosyRec ? evaluateTermResult(mosyRec) : (normTarget === "MOSY" ? evaluateTermResult(learner) : evaluateTermResult(null));

  return {
    bosy: bosyEval,
    mosy: mosyEval,
    hasPassedEarlier:
      normTarget === "MOSY"
        ? bosyEval.hasPassed
        : normTarget === "EOSY"
        ? bosyEval.hasPassed || mosyEval.hasPassed
        : false,
    passedInTerm: bosyEval.hasPassed ? "Term 1" : mosyEval.hasPassed ? "Term 2" : null,
  };
}

/**
 * Filters the class roster for the active assessment period.
 * - Term 1 (BOSY): Returns all enrolled learners.
 * - Term 2 (MOSY): Returns only learners who did not pass in Term 1.
 * - Term 3 (EOSY): Returns only learners who did not pass in Term 1 or Term 2.
 */
export function filterActiveLearnersForTerm(learners = [], currentPeriod = "BOSY") {
  const normPeriod = normalizeTerm(currentPeriod);
  if (normPeriod === "BOSY") {
    // Term 1: All applicable enrolled learners take beginning assessment
    return learners;
  }

  return learners.filter((learner) => {
    const { hasPassedEarlier } = getPreviousTermOutcome(learner, normPeriod);
    return !hasPassedEarlier;
  });
}

/**
 * Builds the comprehensive 3-term timeline for the Learner Record Modal.
 */
export function getLearnerTimelineSummary(learner = {}) {
  const records = Array.isArray(learner.philIriRecords) ? learner.philIriRecords : [];

  const bosyRec = records.find((r) => normalizeTerm(r.assessmentPeriod || r.assessment_period) === "BOSY") || null;
  const mosyRec = records.find((r) => normalizeTerm(r.assessmentPeriod || r.assessment_period) === "MOSY") || null;
  const eosyRec = records.find((r) => normalizeTerm(r.assessmentPeriod || r.assessment_period) === "EOSY") || null;

  // Term 1 evaluation
  const t1Eval = bosyRec ? evaluateTermResult(bosyRec) : evaluateTermResult(learner);
  let t1Status = "Not Recorded";
  let t1Sub = "Beginning assessment pending";

  if (t1Eval.isAbsent) {
    t1Status = "Absent / For Reschedule";
    t1Sub = "Screening reschedule pending";
  } else if (t1Eval.hasPassed) {
    t1Status = "At Grade Level";
    t1Sub = "No Further Assessment Required";
  } else if (t1Eval.hasRecord) {
    t1Status = t1Eval.statusLabel;
    t1Sub = "Continued to Term 2";
  }

  // Term 2 evaluation
  let t2Status = "Pending Term 2";
  let t2Sub = "Midyear review";

  if (t1Eval.hasPassed) {
    t2Status = "Not Required after Term 1";
    t2Sub = "No Further Assessment Required";
  } else if (mosyRec) {
    const t2Eval = evaluateTermResult(mosyRec);
    if (t2Eval.isAbsent) {
      t2Status = "Absent / For Reschedule";
      t2Sub = "Midyear reschedule pending";
    } else if (t2Eval.hasPassed) {
      t2Status = "Reading Assessment Complete";
      t2Sub = "No Further Assessment Required";
    } else {
      t2Status = t2Eval.statusLabel;
      t2Sub = "Continued to Term 3";
    }
  }

  // Term 3 evaluation
  let t3Status = "Pending Term 3";
  let t3Sub = "End-of-year review";

  if (t1Eval.hasPassed) {
    t3Status = "Not Required after Term 1";
    t3Sub = "No Further Assessment Required";
  } else if (mosyRec && evaluateTermResult(mosyRec).hasPassed) {
    t3Status = "Not Required after Term 2";
    t3Sub = "No Further Assessment Required";
  } else if (eosyRec) {
    const t3Eval = evaluateTermResult(eosyRec);
    if (t3Eval.isAbsent) {
      t3Status = "Absent / For Reschedule";
      t3Sub = "End-of-year reschedule pending";
    } else if (t3Eval.hasPassed) {
      t3Status = "Reading Assessment Complete";
      t3Sub = "Final Outcome: Completed";
    } else {
      t3Status = "For Further Review";
      t3Sub = "Possible ARAL Summer Consideration";
    }
  }

  return {
    term1: { status: t1Status, sub: t1Sub, score: t1Eval.hasRecord && !t1Eval.isAbsent ? (learner.philIriScore || bosyRec?.total_score) : null },
    term2: { status: t2Status, sub: t2Sub, score: mosyRec?.total_score || null },
    term3: { status: t3Status, sub: t3Sub, score: eosyRec?.total_score || null },
  };
}
