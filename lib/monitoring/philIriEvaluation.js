/**
 * Tool-aware and language-aware evaluation module for DepEd Phil-IRI reading assessment.
 * Key Stage 3 (Grades 7–10) English & Filipino.
 *
 * Centralizes assessment thresholds and starting passage rules.
 * Keeps Reading Profile and Assessment Level strictly separate.
 */

export const PHIL_IRI_CONFIG = {
  keyStage3: {
    english: {
      toolName: "Phil-IRI English (GST Form 1B & Form 3)",
      maxGstScore: 40,
      independentCutoff: 28, // 28 to 40: Meets GST benchmark / At Grade Level
      instructionalBand: [16, 27], // 16 to 27: Individual assessment required, start 2 levels below
      frustrationBand: [0, 15], // 0 to 15: Individual assessment required, start 3 levels below
      startingLevelMap: {
        independent: "At Grade Level",
        instructional: "2 Grade Levels Below",
        frustration: "3 Grade Levels Below",
      },
    },
    filipino: {
      toolName: "Phil-IRI Filipino (Pangkatang Pagtatasa Form 1A & Form 3)",
      maxGstScore: 40,
      independentCutoff: 28, // 28 to 40: Meets GST benchmark / At Grade Level
      instructionalBand: [16, 27], // 16 to 27: Individual assessment required, start 2 levels below
      frustrationBand: [0, 15], // 0 to 15: Individual assessment required, start 3 levels below
      startingLevelMap: {
        independent: "At Grade Level",
        instructional: "2 Grade Levels Below",
        frustration: "3 Grade Levels Below",
      },
    },
  },
};

/**
 * Returns the assessment configuration for a given language and key stage.
 */
export function getPhilIriConfig(language = "English", keyStage = "keyStage3") {
  const stage = PHIL_IRI_CONFIG[keyStage] || PHIL_IRI_CONFIG.keyStage3;
  const langKey = String(language || "English").toLowerCase().includes("fil")
    ? "filipino"
    : "english";
  return stage[langKey] || stage.english;
}

/**
 * Evaluates a Group Screening Test (GST) score based on official Key Stage 3 thresholds.
 *
 * @param {object} params
 * @param {number|string} params.score
 * @param {string} [params.language="English"]
 * @param {string} [params.keyStage="keyStage3"]
 * @returns {object}
 */
export function evaluateGstScore(arg, maybeLanguage = "English", maybeKeyStage = "keyStage3") {
  if (Array.isArray(arg)) {
    return {
      rawScore: null,
      score: null,
      isEvaluated: false,
      needsIndividualAssessment: false,
      requiresIra: false,
      isBenchmarkMet: false,
      isIndependent: false,
      startingPassageLevel: null,
      readingProfile: null,
      status: "invalid_score",
      message: "Invalid GST score.",
      nextStepKey: "invalid_score",
    };
  }

  const isObj =
    arg !== null &&
    typeof arg === "object" &&
    ("score" in arg ||
      "rawScore" in arg ||
      "gstScore" in arg ||
      "isAbsent" in arg ||
      "candidateStatus" in arg ||
      "screeningStatus" in arg);
  const score = isObj ? (arg.score !== undefined ? arg.score : (arg.rawScore !== undefined ? arg.rawScore : arg.gstScore)) : arg;
  const language = isObj ? (arg.language || "English") : (maybeLanguage || "English");
  const keyStage = isObj ? (arg.keyStage || "keyStage3") : (maybeKeyStage || "keyStage3");

  // Preserve existing absent/reschedule workflow
  if (
    isObj &&
    (arg.isAbsent ||
      arg.candidateStatus === "Absent / For Reschedule" ||
      arg.screeningStatus === "Absent / For Reschedule" ||
      arg.rawPayload?.isAbsent)
  ) {
    return {
      rawScore: null,
      score: null,
      isEvaluated: false,
      isAbsent: true,
      needsIndividualAssessment: false,
      requiresIra: false,
      isBenchmarkMet: false,
      isIndependent: false,
      startingPassageLevel: null,
      readingProfile: null,
      status: "absent",
      message: "Absent / For Reschedule",
      nextStepKey: "absent_reschedule",
    };
  }

  // Missing, null, undefined, or empty/whitespace score
  if (
    score === null ||
    score === undefined ||
    (typeof score === "string" && score.trim() === "")
  ) {
    return {
      rawScore: null,
      score: null,
      isEvaluated: false,
      needsIndividualAssessment: false,
      requiresIra: false,
      isBenchmarkMet: false,
      isIndependent: false,
      startingPassageLevel: null,
      readingProfile: null,
      status: "not_recorded",
      message: "GST not yet recorded.",
      nextStepKey: "waiting_for_assessment",
    };
  }

  // Reject invalid, boolean, array, object, non-numeric, negative, or >40 values
  if (
    typeof score === "boolean" ||
    typeof score === "object" ||
    Array.isArray(score)
  ) {
    return {
      rawScore: null,
      score: null,
      isEvaluated: false,
      needsIndividualAssessment: false,
      requiresIra: false,
      isBenchmarkMet: false,
      isIndependent: false,
      startingPassageLevel: null,
      readingProfile: null,
      status: "invalid_score",
      message: "Invalid GST score. Score must be a valid number between 0 and 40.",
      nextStepKey: "invalid_score",
    };
  }

  const trimmed = typeof score === "string" ? score.trim() : score;
  const numScore = Number(trimmed);

  if (!Number.isFinite(numScore) || numScore < 0 || numScore > 40) {
    return {
      rawScore: null,
      score: null,
      isEvaluated: false,
      needsIndividualAssessment: false,
      requiresIra: false,
      isBenchmarkMet: false,
      isIndependent: false,
      startingPassageLevel: null,
      readingProfile: null,
      status: "invalid_score",
      message: "Invalid GST score. Score must be a valid number between 0 and 40.",
      nextStepKey: "invalid_score",
    };
  }

  const config = getPhilIriConfig(language, keyStage);

  if (numScore >= config.independentCutoff) {
    return {
      rawScore: numScore,
      score: numScore,
      isEvaluated: true,
      needsIndividualAssessment: false,
      requiresIra: false,
      isBenchmarkMet: true,
      isIndependent: false, // Strictly false: GST >= 28 indicates benchmark met, not Independent Reader
      gstClassification: "At Grade Level",
      status: "benchmark_met",
      startingPassageLevel: config.startingLevelMap.independent,
      recommendedStartingPassage: config.startingLevelMap.independent,
      readingProfile: null, // Strictly null: Independent / Instructional / Frustration come only from Form 3
      message: "At Grade Level. No individual reading assessment is required.",
      nextStepKey: "screening_complete_at_grade",
    };
  }

  if (numScore >= config.instructionalBand[0]) {
    return {
      rawScore: numScore,
      score: numScore,
      isEvaluated: true,
      needsIndividualAssessment: true,
      requiresIra: true,
      isBenchmarkMet: false,
      isIndependent: false,
      gstClassification: "Needs Further Reading Assessment",
      status: "needs_individual_assessment",
      startingPassageLevel: config.startingLevelMap.instructional,
      recommendedStartingPassage: config.startingLevelMap.instructional,
      readingProfile: null, // Reading profile is established by Form 3 / IRA, not GST
      message: "Needs Further Reading Assessment. Recommended starting passage: 2 grade levels below.",
      nextStepKey: "needs_individual_assessment",
    };
  }

  return {
    rawScore: numScore,
    score: numScore,
    isEvaluated: true,
    needsIndividualAssessment: true,
    requiresIra: true,
    isBenchmarkMet: false,
    isIndependent: false,
    gstClassification: "Needs Further Reading Assessment",
    status: "needs_individual_assessment",
    startingPassageLevel: config.startingLevelMap.frustration,
    recommendedStartingPassage: config.startingLevelMap.frustration,
    readingProfile: null, // Reading profile is established by Form 3 / IRA, not GST
    message: "Needs Further Reading Assessment. Recommended starting passage: 3 grade levels below.",
    nextStepKey: "needs_individual_assessment",
  };
}

function parsePercentage(val) {
  if (val === null || val === undefined || typeof val === "boolean") return null;
  if (typeof val === "string" && val.trim() === "") return null;
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Evaluates Individual Reading Assessment (IRA / Form 3) results.
 * Standard DepEd Phil-IRI criteria:
 * Word Reading: >=95% Independent, 90-94% Instructional, <90% Frustration
 * Comprehension: >=80% Independent, 59-79% Instructional, <59% Frustration
 *
 * Overall profile:
 * If either is Frustration -> Frustration
 * Else if either is Instructional -> Instructional
 * Both Independent -> Independent
 *
 * Missing or incomplete metrics must remain pending/null, never default to Frustration.
 */
export function evaluateIraResult({
  assessmentLevelUsed = "At Grade Level",
  wordReadingPct = null,
  comprehensionPct = null,
  readingRate = null,
}) {
  const hasWordPct =
    wordReadingPct !== null &&
    wordReadingPct !== undefined &&
    typeof wordReadingPct !== "boolean" &&
    (typeof wordReadingPct !== "string" || wordReadingPct.trim() !== "") &&
    Number.isFinite(Number(wordReadingPct)) &&
    Number(wordReadingPct) >= 0 &&
    Number(wordReadingPct) <= 100;

  const hasCompPct =
    comprehensionPct !== null &&
    comprehensionPct !== undefined &&
    typeof comprehensionPct !== "boolean" &&
    (typeof comprehensionPct !== "string" || comprehensionPct.trim() !== "") &&
    Number.isFinite(Number(comprehensionPct)) &&
    Number(comprehensionPct) >= 0 &&
    Number(comprehensionPct) <= 100;

  let wordLevel = null;
  if (hasWordPct) {
    const wPct = Number(wordReadingPct);
    if (wPct >= 95) wordLevel = "Independent";
    else if (wPct >= 90) wordLevel = "Instructional";
    else wordLevel = "Frustration";
  }

  let compLevel = null;
  if (hasCompPct) {
    const cPct = Number(comprehensionPct);
    if (cPct >= 80) compLevel = "Independent";
    else if (cPct >= 59) compLevel = "Instructional";
    else compLevel = "Frustration";
  }

  // Overall reading profile requires both completed metrics
  let overallProfile = null;
  const isComplete = hasWordPct && hasCompPct;

  if (isComplete) {
    if (wordLevel === "Frustration" || compLevel === "Frustration") {
      overallProfile = "Frustration";
    } else if (wordLevel === "Independent" && compLevel === "Independent") {
      overallProfile = "Independent";
    } else {
      overallProfile = "Instructional";
    }
  }

  const numRate = Number(readingRate);
  const validRate =
    readingRate !== null &&
    readingRate !== undefined &&
    typeof readingRate !== "boolean" &&
    (typeof readingRate !== "string" || readingRate.trim() !== "") &&
    Number.isFinite(numRate) &&
    numRate >= 0
      ? numRate
      : null;

  return {
    assessmentLevelUsed,
    wordReadingLevel: wordLevel,
    comprehensionLevel: compLevel,
    readingProfile: overallProfile,
    readingRate: validRate,
    isComplete,
    isEvaluated: isComplete,
    isPending: !isComplete,
  };
}

/**
 * Calculates raw metrics and derives reading profile for Form 3.
 * Automatically computes Word Reading %, Reading Rate (WPM), and Comprehension %
 * when raw counts/times are supplied, with support for direct percentage entry.
 */
export function calculateIraMetrics({
  assessmentLevelUsed = "At Grade Level",
  totalWords = null,
  miscues = null,
  readingTimeSeconds = null,
  wordReadingPct = null,
  comprehensionPct = null,
  comprehensionCorrect = null,
  comprehensionTotal = null,
  readingRate = null,
} = {}) {
  // Compute word reading percentage safely
  let finalWordPct = null;
  const numWords =
    totalWords !== null && totalWords !== undefined && typeof totalWords !== "boolean" && (typeof totalWords !== "string" || totalWords.trim() !== "")
      ? Number(totalWords)
      : NaN;
  const numMiscues =
    miscues !== null && miscues !== undefined && typeof miscues !== "boolean" && (typeof miscues !== "string" || miscues.trim() !== "")
      ? Number(miscues)
      : NaN;

  if (Number.isFinite(numWords) && numWords > 0 && Number.isFinite(numMiscues) && numMiscues >= 0) {
    finalWordPct = Math.max(0, Math.min(100, Math.round(((numWords - numMiscues) / numWords) * 100)));
  } else {
    finalWordPct = parsePercentage(wordReadingPct);
  }

  // Compute reading rate (WPM)
  let finalWpm = null;
  const numSeconds =
    readingTimeSeconds !== null && readingTimeSeconds !== undefined && typeof readingTimeSeconds !== "boolean" && (typeof readingTimeSeconds !== "string" || readingTimeSeconds.trim() !== "")
      ? Number(readingTimeSeconds)
      : NaN;
  if (Number.isFinite(numWords) && numWords > 0 && Number.isFinite(numSeconds) && numSeconds > 0) {
    finalWpm = Math.round((numWords / numSeconds) * 60);
  } else if (
    readingRate !== null &&
    readingRate !== undefined &&
    typeof readingRate !== "boolean" &&
    (typeof readingRate !== "string" || readingRate.trim() !== "") &&
    Number.isFinite(Number(readingRate)) &&
    Number(readingRate) >= 0
  ) {
    finalWpm = Math.round(Number(readingRate));
  }

  // Compute comprehension percentage safely
  let finalCompPct = null;
  const numCompCorrect =
    comprehensionCorrect !== null && comprehensionCorrect !== undefined && typeof comprehensionCorrect !== "boolean" && (typeof comprehensionCorrect !== "string" || comprehensionCorrect.trim() !== "")
      ? Number(comprehensionCorrect)
      : NaN;
  const numCompTotal =
    comprehensionTotal !== null && comprehensionTotal !== undefined && typeof comprehensionTotal !== "boolean" && (typeof comprehensionTotal !== "string" || comprehensionTotal.trim() !== "")
      ? Number(comprehensionTotal)
      : NaN;

  if (Number.isFinite(numCompCorrect) && numCompCorrect >= 0 && Number.isFinite(numCompTotal) && numCompTotal > 0) {
    finalCompPct = Math.max(0, Math.min(100, Math.round((numCompCorrect / numCompTotal) * 100)));
  } else {
    finalCompPct = parsePercentage(comprehensionPct);
  }

  const evalResult = evaluateIraResult({
    assessmentLevelUsed,
    wordReadingPct: finalWordPct,
    comprehensionPct: finalCompPct,
    readingRate: finalWpm,
  });

  return {
    ...evalResult,
    totalWords: Number.isFinite(numWords) ? numWords : null,
    miscues: Number.isFinite(numMiscues) ? numMiscues : null,
    readingTimeSeconds: Number.isFinite(numSeconds) ? numSeconds : null,
    wordReadingPct: finalWordPct,
    comprehensionPct: finalCompPct,
    readingRate: finalWpm,
  };
}

/**
 * Strips leading "Grade " prefix(es) if already present to prevent "Grade Grade 7".
 */
export function cleanGradeNumber(grade) {
  return String(grade || "")
    .replace(/^(Grade\s*)+/i, "")
    .trim();
}

/**
 * Strips leading grade prefixes or redundant markers from section name.
 */
export function cleanSectionName(section) {
  return String(section || "")
    .replace(/^(Grade\s*)+(\d+\s*[-—–:]*\s*)?/i, "")
    .replace(/^(Grade\s*\d+\s*[-—–:]*\s*)+/i, "")
    .replace(/^(Grade\s*)+/i, "")
    .trim();
}

/**
 * Formats Grade and Section cleanly to avoid "Grade Grade 7" or "Grade 7 – Grade 7 - Rizal".
 */
export function formatGradeSection(grade, section, separator = "–") {
  let g = grade;
  let s = section;
  if (!g && s) {
    const match = String(s).match(/Grade\s*(\d+)/i);
    if (match) {
      g = match[1];
    }
  }
  const cleanGrade = cleanGradeNumber(g);
  const cleanSec = cleanSectionName(s);
  const gradePart = cleanGrade ? `Grade ${cleanGrade}` : "Grade —";
  const sectionPart = cleanSec || "—";
  return `${gradePart} ${separator} ${sectionPart}`;
}
