/**
 * Local Random Forest–style ensemble fallback.
 *
 * Used when no remote inference service (FastAPI / Flask / ONNX API) is
 * configured or reachable. Several feature-threshold "trees" vote, and the
 * majority outcome becomes the recommendation. Confidence is vote share.
 *
 * Replace this with true model weights once the trained RF artifact is served.
 */

import {
  RECOMMENDATION,
  RISK_LEVEL,
} from "@/lib/monitoring/recommendations";

function gradeOf(features, key) {
  const value = features.featureVector?.[key];
  return value === null || value === undefined ? null : Number(value);
}

function vote(recommendationType, reason) {
  return { recommendationType, reason };
}

/**
 * @param {ReturnType<import('./features').buildFeatureVector>} features
 */
export function predictViaLocalEnsemble(features) {
  const v = features.featureVector || {};
  const english = gradeOf(features, "english_grade");
  const filipino = gradeOf(features, "filipino_grade");
  const mathematics = gradeOf(features, "mathematics_grade");
  const science = gradeOf(features, "science_grade");
  const mapeh = gradeOf(features, "mapeh_grade");
  const ap = gradeOf(features, "araling_panlipunan_grade");
  const tle = gradeOf(features, "tle_grade");
  const gwa = gradeOf(features, "general_average");
  const languageFails = Number(v.language_fail_count || 0);
  const nonLanguageFails = Number(v.non_language_fail_count || 0);
  const failingCount = Number(v.failing_subject_count || 0);
  const available = Number(v.available_grade_count || 0);

  const trees = [];

  // Tree 1 — language proficiency
  if (english !== null && english < 75) {
    trees.push(vote(RECOMMENDATION.ARAL, `English below 75 (${english})`));
  } else if (filipino !== null && filipino < 75) {
    trees.push(vote(RECOMMENDATION.ARAL, `Filipino below 75 (${filipino})`));
  } else if (available > 0) {
    trees.push(
      vote(RECOMMENDATION.NONE, "Language subjects meet the passing threshold")
    );
  } else {
    trees.push(vote(RECOMMENDATION.NONE, "No graded subjects available yet"));
  }

  // Tree 2 — literacy signal via language fail count
  if (languageFails > 0) {
    trees.push(
      vote(
        RECOMMENDATION.ARAL,
        `${languageFails} language subject(s) below 75`
      )
    );
  } else {
    trees.push(vote(RECOMMENDATION.NONE, "No language subject failures"));
  }

  // Tree 3 — core academic subjects
  const coreFails = [
    ["Mathematics", mathematics],
    ["Science", science],
    ["MAPEH", mapeh],
    ["Araling Panlipunan", ap],
    ["TLE", tle],
  ].filter(([, grade]) => grade !== null && grade < 75);

  if (coreFails.length > 0) {
    const [subject, grade] = coreFails[0];
    trees.push(
      vote(
        RECOMMENDATION.REMEDIATION,
        `${subject} below 75 (${grade})`
      )
    );
  } else if (available > 0) {
    trees.push(
      vote(RECOMMENDATION.NONE, "Non-language subjects meet the passing threshold")
    );
  } else {
    trees.push(vote(RECOMMENDATION.NONE, "Insufficient subject grade features"));
  }

  // Tree 4 — breadth of failure
  if (nonLanguageFails >= 2) {
    trees.push(
      vote(
        RECOMMENDATION.REMEDIATION,
        `${nonLanguageFails} non-language subjects below 75`
      )
    );
  } else if (failingCount === 0 && available > 0) {
    trees.push(vote(RECOMMENDATION.NONE, "No failing subjects detected"));
  } else if (languageFails > 0) {
    trees.push(vote(RECOMMENDATION.ARAL, "Failure pattern concentrated in language"));
  } else if (nonLanguageFails === 1) {
    trees.push(
      vote(RECOMMENDATION.REMEDIATION, "Single non-language subject below 75")
    );
  } else {
    trees.push(vote(RECOMMENDATION.NONE, "No multi-subject failure pattern"));
  }

  // Tree 5 — general average
  if (gwa !== null && gwa < 75 && languageFails > 0) {
    trees.push(
      vote(
        RECOMMENDATION.ARAL,
        `General average ${gwa.toFixed(1)} with language risk`
      )
    );
  } else if (gwa !== null && gwa < 75) {
    trees.push(
      vote(
        RECOMMENDATION.REMEDIATION,
        `General average below 75 (${gwa.toFixed(1)})`
      )
    );
  } else if (gwa !== null && gwa >= 80 && failingCount === 0) {
    trees.push(
      vote(RECOMMENDATION.NONE, `Strong general average (${gwa.toFixed(1)})`)
    );
  } else if (gwa !== null) {
    trees.push(
      vote(RECOMMENDATION.NONE, `General average within acceptable range (${gwa.toFixed(1)})`)
    );
  } else {
    trees.push(vote(RECOMMENDATION.NONE, "General average unavailable"));
  }

  const tally = {
    [RECOMMENDATION.ARAL]: 0,
    [RECOMMENDATION.REMEDIATION]: 0,
    [RECOMMENDATION.NONE]: 0,
  };
  for (const tree of trees) {
    tally[tree.recommendationType] += 1;
  }

  // Prefer actionable recommendations when votes tie with "None".
  let recommendationType = RECOMMENDATION.NONE;
  let bestVotes = -1;
  for (const type of [
    RECOMMENDATION.ARAL,
    RECOMMENDATION.REMEDIATION,
    RECOMMENDATION.NONE,
  ]) {
    if (tally[type] > bestVotes) {
      bestVotes = tally[type];
      recommendationType = type;
    }
  }

  const supporting = trees.filter(
    (tree) => tree.recommendationType === recommendationType
  );
  const confidence = Number((bestVotes / trees.length).toFixed(2));

  let riskLevel = RISK_LEVEL.LOW;
  if (recommendationType === RECOMMENDATION.ARAL) riskLevel = RISK_LEVEL.HIGH;
  if (recommendationType === RECOMMENDATION.REMEDIATION) {
    riskLevel = RISK_LEVEL.MODERATE;
  }

  const reasons = [
    ...new Set(supporting.map((tree) => tree.reason)),
  ].slice(0, 4);

  return {
    recommendationType,
    riskLevel,
    confidence: available === 0 ? Math.min(confidence, 0.5) : confidence,
    reasons: reasons.length
      ? reasons
      : ["Ensemble produced no supporting reasons"],
    generatedAt: new Date().toISOString(),
    source: "local-ensemble",
  };
}
