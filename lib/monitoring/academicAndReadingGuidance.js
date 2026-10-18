/**
 * Pure helper for connecting Academic Performance (finalized ECR grades)
 * and Reading Performance (Phil-IRI screening & reading level).
 *
 * Rules:
 * - Academic Monitoring = finalized ECR grades.
 * - Reading Assessment = Phil-IRI results.
 * - Independent assessment processes that connect in the Learner Profile for context.
 * - Do NOT make causal conclusions (e.g. no "concept-specific rather than reading-based").
 * - Conceptual reading tiers:
 *     - GST < 28: further reading assessment needed
 *     - Instructional: learner can read with teacher guidance
 *     - Frustration: stronger reading concern
 * - 5 Simplified Labels:
 *     - "Academic + Reading Concern"
 *     - "Academic Concern"
 *     - "Reading Concern"
 *     - "No Immediate Concern"
 *     - "Reading Assessment Pending"
 * - Teacher guidance is strictly ONE short sentence only.
 * - Informational only: does not alter grades, risk bands, or teacher decisions.
 */

export function evaluateAcademicAndReadingGuidance({
  grade = null,
  gstScore = null,
  readingLevel = null,
  hasFlaggedConcern = false,
}) {
  const numGrade =
    grade !== null && grade !== undefined && grade !== "" ? Number(grade) : null;
  const hasAcademicConcern =
    numGrade !== null && Number.isFinite(numGrade) && numGrade < 75;

  const numGst =
    gstScore !== null && gstScore !== undefined && gstScore !== ""
      ? Number(gstScore)
      : null;

  const cleanLevel = String(readingLevel || "").trim();
  const hasReadingData =
    (numGst !== null && Number.isFinite(numGst)) ||
    (Boolean(cleanLevel) &&
      cleanLevel !== "Not Screened" &&
      cleanLevel !== "Not Assessed" &&
      cleanLevel !== "Not Set" &&
      cleanLevel !== "Pending Oral Profile" &&
      cleanLevel !== "Pending Individual Assessment");

  // Determine reading tier with separate severities
  let readingTier = "pending";
  if (cleanLevel === "Frustration") {
    readingTier = "frustration";
  } else if (cleanLevel === "Instructional") {
    readingTier = "instructional";
  } else if (numGst !== null && numGst < 28) {
    readingTier = "needs_ira";
  } else if (hasFlaggedConcern) {
    readingTier = "flagged";
  } else if (
    cleanLevel === "Independent" ||
    (numGst !== null && numGst >= 28)
  ) {
    readingTier = "adequate";
  } else if (hasReadingData) {
    readingTier = "adequate";
  }

  const needsReadingReview =
    readingTier !== "adequate" && readingTier !== "pending";

  // Case A: Phil-IRI data pending
  if (!hasReadingData && !hasFlaggedConcern) {
    return {
      label: "Reading Assessment Pending",
      badgeStyle:
        "border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-300",
      sentence: hasAcademicConcern
        ? "Academic support is needed while Phil-IRI reading screening is pending."
        : "Phil-IRI reading screening is pending for this learner.",
      hasAcademicConcern,
      needsReadingReview: false,
      hasReadingData: false,
      readingTier: "pending",
    };
  }

  // Case B: Both Academic + Reading Concern
  if (hasAcademicConcern && needsReadingReview) {
    let sentence =
      "Academic and reading support may both be needed; further Phil-IRI assessment is indicated.";
    if (readingTier === "frustration") {
      sentence =
        "Academic and reading support may both be needed; Phil-IRI indicates a frustration reading level.";
    } else if (readingTier === "instructional") {
      sentence =
        "Academic and reading support may both be needed; learner can read instructional materials with teacher guidance.";
    }

    return {
      label: "Academic + Reading Concern",
      badgeStyle:
        "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300",
      sentence,
      hasAcademicConcern: true,
      needsReadingReview: true,
      hasReadingData: true,
      readingTier,
    };
  }

  // Case C: Academic Concern Only
  if (hasAcademicConcern && !needsReadingReview) {
    return {
      label: "Academic Concern",
      badgeStyle:
        "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300",
      sentence:
        "Current Phil-IRI results do not indicate a reading concern. The teacher may focus on subject-based academic support while continuing regular observation.",
      hasAcademicConcern: true,
      needsReadingReview: false,
      hasReadingData: true,
      readingTier,
    };
  }

  // Case D: Reading Concern Only
  if (!hasAcademicConcern && needsReadingReview) {
    let sentence =
      "Current grades meet passing standards, but further Phil-IRI assessment is needed.";
    if (readingTier === "frustration") {
      sentence =
        "Although subject grades are passing, Phil-IRI indicates a frustration reading level requiring attention.";
    } else if (readingTier === "instructional") {
      sentence =
        "Subject grades are passing; learner reads at an instructional level with teacher guidance.";
    }

    return {
      label: "Reading Concern",
      badgeStyle:
        "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300",
      sentence,
      hasAcademicConcern: false,
      needsReadingReview: true,
      hasReadingData: true,
      readingTier,
    };
  }

  // Case E: No Immediate Concern
  return {
    label: "No Immediate Concern",
    badgeStyle:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300",
    sentence:
      "Current grades meet passing standards and Phil-IRI results indicate adequate reading performance.",
    hasAcademicConcern: false,
    needsReadingReview: false,
    hasReadingData: true,
    readingTier: "adequate",
  };
}
