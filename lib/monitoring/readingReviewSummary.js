/**
 * System-assisted reading review summary (derived helper only).
 *
 * Composes EXISTING roster outputs (risk level, grades, trend, reading
 * evidence already present on each row). It never recalculates risk or
 * priority and never decides ARAL eligibility — it only shortlists learners
 * for teacher review and explains why each learner was included.
 */

export const REVIEW_REASON_CODES = {
  HIGH_ACADEMIC_RISK: "HIGH_ACADEMIC_RISK",
  BELOW_GRADE_THRESHOLD: "BELOW_GRADE_THRESHOLD",
  DECLINING_TREND: "DECLINING_TREND",
  REPEATED_LOW_ASSESSMENTS: "REPEATED_LOW_ASSESSMENTS",
  MULTIPLE_CONCERNS: "MULTIPLE_CONCERNS",
};

/** Internal codes → teacher-friendly UI labels. */
export const REVIEW_REASON_LABELS = {
  [REVIEW_REASON_CODES.HIGH_ACADEMIC_RISK]: "High academic risk",
  [REVIEW_REASON_CODES.BELOW_GRADE_THRESHOLD]:
    "Low grade in English or Filipino",
  [REVIEW_REASON_CODES.DECLINING_TREND]: "Performance has gone down",
  [REVIEW_REASON_CODES.REPEATED_LOW_ASSESSMENTS]:
    "Several low activity or assessment scores",
  [REVIEW_REASON_CODES.MULTIPLE_CONCERNS]: "Several concerns were found",
};

/** Controlled teacher concern options (teacher confirms, never auto-chosen). */
export const READING_CONCERN_OPTIONS = [
  "Reading comprehension",
  "Reading fluency",
  "Vocabulary",
  "Difficulty understanding text",
  "Difficulty answering questions from a text",
  "Other",
];

function rowGrade(row) {
  const grade = row.classSubjectGrade ?? row.currentGrade ?? null;
  if (grade === null || grade === undefined || grade === "") return null;
  const n = Number(grade);
  return Number.isFinite(n) ? n : null;
}

function isLanguageSubject(row) {
  return (
    Boolean(row.isAralEligible) || /english|filipino/i.test(row.subject || "")
  );
}

/**
 * Derive internal reason codes from existing row outputs.
 * A reason is only present when the underlying data contains it.
 */
export function deriveReviewReasons(row) {
  const reasons = [];
  const grade = rowGrade(row);
  const risk = row.riskLevel || row.academicRisk || "";
  const trend = row.performanceTrend || "";

  if (risk === "High Risk" || risk === "High") {
    reasons.push(REVIEW_REASON_CODES.HIGH_ACADEMIC_RISK);
  }
  if (grade !== null && grade < 75) {
    reasons.push(REVIEW_REASON_CODES.BELOW_GRADE_THRESHOLD);
  }
  if (trend === "Declining") {
    reasons.push(REVIEW_REASON_CODES.DECLINING_TREND);
  }
  if (
    row.readingLevel === "Frustration" ||
    (row.philIriScore != null && Number(row.philIriScore) <= 13) ||
    row.candidateStatus === "ARAL Candidate" ||
    row.candidateStatus === "Referred to ARAL"
  ) {
    reasons.push(REVIEW_REASON_CODES.REPEATED_LOW_ASSESSMENTS);
  }
  if (reasons.length >= 2) {
    reasons.push(REVIEW_REASON_CODES.MULTIPLE_CONCERNS);
  }
  return reasons;
}

/**
 * System shortlist for reading review: English/Filipino learners with high
 * academic risk, low grades, or reading-assessment evidence. Prioritization
 * only — NOT ARAL eligibility.
 */
export function isReadingReviewCandidate(row) {
  return deriveLearnerReviewReasons(row).length > 0;
}

/**
 * Learner-level reasons. For aggregated rows (with subjectStandings),
 * reasons are unioned across language standings so a concern in ANY subject
 * counts; otherwise falls back to the single-row derivation.
 */
export function deriveLearnerReviewReasons(row = {}) {
  if (Array.isArray(row.subjectStandings) && row.subjectStandings.length) {
    if (Array.isArray(row.readingReview?.reasons)) {
      return [...row.readingReview.reasons];
    }
    const union = new Set();
    for (const st of row.subjectStandings) {
      if (!/english|filipino/i.test(st.subject || "")) continue;
      for (const code of deriveReviewReasons({
        subject: st.subject,
        isAralEligible: true,
        classSubjectGrade: st.grade,
        currentGrade: st.grade,
        riskLevel: st.riskLevel,
        performanceTrend: st.trend,
        readingLevel: row.readingLevel,
        philIriScore: row.philIriScore,
        candidateStatus: row.candidateStatus,
      })) {
        union.add(code);
      }
    }
    return [...union];
  }
  if (!isLanguageSubject(row)) return [];
  return deriveReviewReasons(row);
}

export function reviewReasonLabel(code) {
  return REVIEW_REASON_LABELS[code] || code;
}

/**
 * Build the review summary consumed by the teacher review modal / roster.
 * Every count is derived from the provided rows — nothing hardcoded.
 */
export function buildReadingReviewSummary(rows = [], { termLabel = "" } = {}) {
  const recommended = [];
  const reasonTotals = {};
  let englishCount = 0;
  let filipinoCount = 0;
  let highRiskCount = 0;
  let decliningCount = 0;
  let improvingCount = 0;
  let stableCount = 0;
  let multiConcernCount = 0;

  for (const row of rows) {
    if (!isLanguageSubject(row) && !Array.isArray(row.subjectStandings)) continue;
    const reasons = deriveLearnerReviewReasons(row);
    if (!reasons.length) continue;
    const key =
      row.id ||
      `${row.studentId || row.studentNumber}::${row.subject}::${row.section}`;
    recommended.push({ key, row, reasons });

    for (const code of reasons) {
      reasonTotals[code] = (reasonTotals[code] || 0) + 1;
    }
    const standings = Array.isArray(row.subjectStandings)
      ? row.subjectStandings
      : null;
    const subjectText = standings
      ? standings.map((s) => s.subject || "").join(" ")
      : String(row.subject || "");
    const subjectLower = subjectText.toLowerCase();
    if (subjectLower.includes("english")) englishCount += 1;
    if (subjectLower.includes("filipino")) filipinoCount += 1;
    const risk = row.riskLevel || row.academicRisk || "";
    if (risk === "High Risk" || risk === "High") highRiskCount += 1;
    const trends = standings
      ? standings.map((s) => s.trend || "")
      : [row.performanceTrend || ""];
    if (trends.includes("Declining")) decliningCount += 1;
    else if (trends.includes("Improving")) improvingCount += 1;
    else stableCount += 1;
    if (reasons.length >= 2) multiConcernCount += 1;
  }

  const reasonCounts = Object.entries(reasonTotals)
    .filter(([code]) => code !== REVIEW_REASON_CODES.HIGH_ACADEMIC_RISK)
    .map(([code, count]) => ({
      code,
      label: reviewReasonLabel(code),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    recommended,
    total: recommended.length,
    termLabel,
    reasonCounts,
    englishCount,
    filipinoCount,
    highRiskCount,
    decliningCount,
    improvingCount,
    stableCount,
    multiConcernCount,
  };
}
