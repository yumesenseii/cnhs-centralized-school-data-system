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
      independentCutoff: 28, // 28 to 40: Meets GST benchmark / Independent
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
      independentCutoff: 28, // 28 to 40: Meets GST benchmark / Independent
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
  const isObj = arg !== null && typeof arg === "object" && !Array.isArray(arg) && "score" in arg;
  const score = isObj ? arg.score : arg;
  const language = isObj ? (arg.language || "English") : (maybeLanguage || "English");
  const keyStage = isObj ? (arg.keyStage || "keyStage3") : (maybeKeyStage || "keyStage3");

  if (score === null || score === undefined || score === "") {
    return {
      rawScore: null,
      isEvaluated: false,
      needsIndividualAssessment: false,
      isIndependent: false,
      startingPassageLevel: null,
      readingProfile: null,
      message: "GST not yet recorded.",
      nextStepKey: "waiting_for_assessment",
    };
  }

  const numScore = Number(score);
  const config = getPhilIriConfig(language, keyStage);

  if (numScore >= config.independentCutoff) {
    return {
      rawScore: numScore,
      isEvaluated: true,
      needsIndividualAssessment: false,
      isIndependent: false,
      gstClassification: "At Grade Level",
      startingPassageLevel: config.startingLevelMap.independent,
      readingProfile: null, // Strictly null: Independent / Instructional / Frustration come only from Form 3
      message: "Learner is At Grade Level. No individual assessment required.",
      nextStepKey: "assessment_complete",
    };
  }

  if (numScore >= config.instructionalBand[0]) {
    return {
      rawScore: numScore,
      isEvaluated: true,
      needsIndividualAssessment: true,
      isIndependent: false,
      gstClassification: "Needs Individual Assessment (2 Levels Below)",
      startingPassageLevel: config.startingLevelMap.instructional,
      readingProfile: null, // Reading profile is established by Form 3 / IRA, not GST
      message: "GST indicates individual reading assessment is required. Start passage 2 grade levels below.",
      nextStepKey: "needs_individual_assessment",
    };
  }

  return {
    rawScore: numScore,
    isEvaluated: true,
    needsIndividualAssessment: true,
    isIndependent: false,
    gstClassification: "Needs Individual Assessment (3 Levels Below)",
    startingPassageLevel: config.startingLevelMap.frustration,
    readingProfile: null, // Reading profile is established by Form 3 / IRA, not GST
    message: "GST indicates individual reading assessment is required. Start passage 3 grade levels below.",
    nextStepKey: "needs_individual_assessment",
  };
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
 */
export function evaluateIraResult({
  assessmentLevelUsed = "At Grade Level",
  wordReadingPct = null,
  comprehensionPct = null,
  readingRate = null,
}) {
  const wPct = Number(wordReadingPct);
  const cPct = Number(comprehensionPct);

  let wordLevel = "Instructional";
  if (Number.isFinite(wPct)) {
    if (wPct >= 95) wordLevel = "Independent";
    else if (wPct >= 90) wordLevel = "Instructional";
    else wordLevel = "Frustration";
  }

  let compLevel = "Instructional";
  if (Number.isFinite(cPct)) {
    if (cPct >= 80) compLevel = "Independent";
    else if (cPct >= 59) compLevel = "Instructional";
    else compLevel = "Frustration";
  }

  // Overall reading profile
  let overallProfile = "Instructional";
  if (wordLevel === "Frustration" || compLevel === "Frustration") {
    overallProfile = "Frustration";
  } else if (wordLevel === "Independent" && compLevel === "Independent") {
    overallProfile = "Independent";
  }

  return {
    assessmentLevelUsed,
    wordReadingLevel: wordLevel,
    comprehensionLevel: compLevel,
    readingProfile: overallProfile,
    readingRate: Number.isFinite(Number(readingRate)) ? Number(readingRate) : null,
  };
}

/**
 * Formats Grade and Section cleanly to avoid "Grade Grade 7".
 */
export function formatGradeSection(grade, section) {
  const cleanGrade = String(grade || "")
    .replace(/^Grade\s+/i, "")
    .trim();
  const gradePart = cleanGrade ? `Grade ${cleanGrade}` : "Grade —";
  const sectionPart = section ? String(section).trim() : "—";
  return `${gradePart} · ${sectionPart}`;
}
