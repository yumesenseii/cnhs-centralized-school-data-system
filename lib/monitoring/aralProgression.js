/**
 * Authoritative term progression and active queue eligibility for ARAL Reading Assessment.
 *
 * Implements DepEd Phil-IRI multi-term progression:
 * - BOSY (Beginning of School Year): All enrolled learners take beginning assessment.
 *   - GST 28–40 -> At Grade Level -> Exits active progression ("No Further Assessment Required").
 *   - GST 0–27 -> Form 3 IRA. Teacher confirms progression outcome:
 *     - "No Further Assessment Required" -> Exits active progression.
 *     - "Continue to Next Assessment Period" -> Enters active MOSY queue.
 *   - Absent -> "Absent / For Reschedule" (remains in BOSY active queue, not finalized).
 * - MOSY (Middle of School Year):
 *   - Only learners whose finalized BOSY outcome required follow-up appear in active MOSY queue.
 *   - Learners with finalized "No Further Assessment Required" remain in history but exit active queue.
 * - EOSY (End of School Year):
 *   - Only learners whose finalized MOSY outcome required follow-up appear in active EOSY queue.
 *   - Learners with remaining reading needs receive internal administrative status:
 *     "For Further Review after EOSY" (no automated summer enrollment, scheduling, or facilitator assignment).
 */

/**
 * Normalizes reading assessment period string into canonical BOSY, MOSY, EOSY.
 * Returns null if the value is not a valid reading period (never silently defaults to BOSY).
 * Academic trimester terms (Term 1–3, Q1–Q4) are separate concepts and must not be mapped here.
 */
export function normalizeReadingPeriod(period) {
  if (period === null || period === undefined) return null;
  const p = String(period).trim().toUpperCase();
  if (!p) return null;

  // Reject academic terms and quarters
  if (p.includes("TERM") || /^Q[1-4]$/.test(p) || p.includes("QUARTER")) {
    return null;
  }

  if (p === "BOSY" || p === "BEG" || p.startsWith("BEGINNING")) return "BOSY";
  if (p === "MOSY" || p === "MID" || p.startsWith("MIDDLE") || p.startsWith("MID-YEAR")) return "MOSY";
  if (p === "EOSY" || p === "END" || p.startsWith("END-OF-YEAR")) return "EOSY";
  return null;
}

/** Legacy alias for normalizeReadingPeriod. Returns null when unknown. */
export function normalizeTerm(period) {
  return normalizeReadingPeriod(period);
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
      exitNotice: "For Reschedule",
    };
  }

  // Teacher-confirmed progression outcome takes priority
  const teacherOutcome =
    recordOrLearner.progressionOutcome ||
    recordOrLearner.iraMetrics?.progressionOutcome ||
    recordOrLearner.rawPayload?.iraMetrics?.progressionOutcome ||
    recordOrLearner.raw_payload?.iraMetrics?.progressionOutcome;

  if (teacherOutcome === "No Further Assessment Required") {
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

  if (teacherOutcome === "Continue to Next Assessment Period") {
    return {
      hasRecord: true,
      isAbsent: false,
      hasPassed: false,
      needsFollowUp: true,
      outcome: "CONTINUE",
      statusLabel: recordOrLearner.readingLevel || "Needs Support",
      exitNotice: "Continue to Next Assessment Period",
    };
  }

  if (teacherOutcome === "For Further Review after EOSY") {
    return {
      hasRecord: true,
      isAbsent: false,
      hasPassed: false,
      needsFollowUp: true,
      outcome: "EOSY_REVIEW",
      statusLabel: "For Further Review after EOSY",
      exitNotice: "For Further Review after EOSY",
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

  // GST 0-27: Check Form 3 Reading Profile
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
      exitNotice: "Continue to Next Assessment Period",
    };
  }

  // GST < 28 without completed Form 3
  return {
    hasRecord: true,
    isAbsent: false,
    hasPassed: false,
    needsFollowUp: true,
    outcome: "NEEDS_IRA",
    statusLabel: "Needs Further Assessment",
    exitNotice: "Needs Further Assessment",
  };
}

/**
 * Inspects a learner's past term records to determine if they passed in an earlier term.
 */
export function getPreviousTermOutcome(learner, targetPeriod = null) {
  const normTarget = normalizeTerm(targetPeriod);
  const records = Array.isArray(learner?.philIriRecords) ? learner.philIriRecords : [];

  // Find BOSY record
  const bosyRec = records.find((r) => normalizeTerm(r.assessmentPeriod || r.assessment_period) === "BOSY") || null;
  const bosyEval = bosyRec ? evaluateTermResult(bosyRec) : (normTarget === "BOSY" ? evaluateTermResult(learner) : evaluateTermResult(null));

  // Find MOSY record
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
    passedInTerm: bosyEval.hasPassed ? "BOSY" : mosyEval.hasPassed ? "MOSY" : null,
  };
}

/**
 * Filters the class roster for the active assessment period.
 * - BOSY: Returns all enrolled learners in the class.
 * - MOSY: Returns only learners whose finalized BOSY outcome requires follow-up.
 * - EOSY: Returns only learners whose finalized MOSY outcome requires follow-up.
 * - Unconfigured / invalid: Returns all learners (never silently assumes BOSY).
 */
export function filterActiveLearnersForTerm(learners = [], currentPeriod = null) {
  const normPeriod = normalizeTerm(currentPeriod);
  if (!normPeriod || normPeriod === "BOSY") {
    // BOSY or unconfigured: All applicable enrolled learners take beginning assessment / are shown
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

  // BOSY evaluation
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
    t1Sub = t1Eval.exitNotice || "Continue to Next Assessment Period";
  }

  // MOSY evaluation
  let t2Status = "Pending MOSY";
  let t2Sub = "Midyear assessment";

  if (t1Eval.hasPassed) {
    t2Status = "Not Required after BOSY";
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
      t2Sub = t2Eval.exitNotice || "Continue to Next Assessment Period";
    }
  }

  // EOSY evaluation
  let t3Status = "Pending EOSY";
  let t3Sub = "End-of-year assessment";

  if (t1Eval.hasPassed) {
    t3Status = "Not Required after BOSY";
    t3Sub = "No Further Assessment Required";
  } else if (mosyRec && evaluateTermResult(mosyRec).hasPassed) {
    t3Status = "Not Required after MOSY";
    t3Sub = "No Further Assessment Required";
  } else if (eosyRec) {
    const t3Eval = evaluateTermResult(eosyRec);
    if (t3Eval.isAbsent) {
      t3Status = "Absent / For Reschedule";
      t3Sub = "End-of-year reschedule pending";
    } else if (t3Eval.hasPassed) {
      t3Status = "Reading Assessment Complete";
      t3Sub = "No Further Assessment Required";
    } else {
      t3Status = "For Further Review after EOSY";
      t3Sub = "Internal administrative review";
    }
  }

  return {
    term1: { status: t1Status, sub: t1Sub, score: t1Eval.hasRecord && !t1Eval.isAbsent ? (learner.philIriScore || bosyRec?.total_score) : null },
    term2: { status: t2Status, sub: t2Sub, score: mosyRec?.total_score || null },
    term3: { status: t3Status, sub: t3Sub, score: eosyRec?.total_score || null },
  };
}
