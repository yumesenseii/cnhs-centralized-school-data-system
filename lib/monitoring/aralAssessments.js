/**
 * ARAL Pre / Mid / Post assessment helpers (facilitator scoring).
 */

import { formatAralRosterName } from "@/lib/monitoring/aralProgress";

export const ARAL_ASSESSMENT_PHASE = {
  PRE: "pre",
  MID: "mid",
  POST: "post",
};

export const ARAL_ASSESSMENT_RESULT = {
  PASSED: "Passed",
  FOR_ARAL: "For ARAL",
};

export const ARAL_ASSESSMENT_STATUS = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  SCORED: "scored",
};

export const DEFAULT_ARAL_MAX_SCORE = 40;
export const DEFAULT_ARAL_PASS_PERCENT = 75;

/**
 * Derive result from score / max vs pass percent threshold.
 * @returns {"Passed"|"For ARAL"|null}
 */
export function computeAralAssessmentResult(
  score,
  maxScore = DEFAULT_ARAL_MAX_SCORE,
  passPercent = DEFAULT_ARAL_PASS_PERCENT
) {
  if (score === null || score === undefined || score === "") return null;
  const s = Number(score);
  const m = Number(maxScore);
  const p = Number(passPercent);
  if (!Number.isFinite(s) || !Number.isFinite(m) || m <= 0) return null;
  if (!Number.isFinite(p)) return null;
  const pct = (s / m) * 100;
  return pct >= p
    ? ARAL_ASSESSMENT_RESULT.PASSED
    : ARAL_ASSESSMENT_RESULT.FOR_ARAL;
}

export function parseOptionalScore(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Teacher-friendly period labels. Stored phase values (pre/mid/post)
 * are unchanged — this is display only.
 */
export function aralAssessmentPhaseLabel(phase) {
  if (phase === ARAL_ASSESSMENT_PHASE.MID) return "Mid-Year Assessment";
  if (phase === ARAL_ASSESSMENT_PHASE.POST) return "End-of-Year Assessment";
  return "Beginning Assessment";
}

export function normalizeAralAssessmentPhase(phase) {
  if (phase === ARAL_ASSESSMENT_PHASE.MID) return ARAL_ASSESSMENT_PHASE.MID;
  if (phase === ARAL_ASSESSMENT_PHASE.POST) return ARAL_ASSESSMENT_PHASE.POST;
  return ARAL_ASSESSMENT_PHASE.PRE;
}

export function scoreToPercent(score, maxScore) {
  const s = Number(score);
  const m = Number(maxScore);
  if (!Number.isFinite(s) || !Number.isFinite(m) || m <= 0) return null;
  return (s / m) * 100;
}

/**
 * Trend across Pre → Mid → Post results.
 * @returns {"Improved"|"Same"|"Still For ARAL"|"Incomplete"|"—"}
 */
export function computeAralAssessmentTrend(preResult, midResult, postResult) {
  const sequence = [preResult, midResult, postResult].filter(Boolean);
  if (!sequence.length) return "—";
  if (sequence.length < 2) return "Incomplete";

  const last = sequence[sequence.length - 1];
  const first = sequence[0];

  if (last === ARAL_ASSESSMENT_RESULT.FOR_ARAL) {
    return "Still For ARAL";
  }
  if (
    first === ARAL_ASSESSMENT_RESULT.FOR_ARAL &&
    last === ARAL_ASSESSMENT_RESULT.PASSED
  ) {
    return "Improved";
  }
  if (first === last) return "Same";
  if (
    first === ARAL_ASSESSMENT_RESULT.PASSED &&
    last === ARAL_ASSESSMENT_RESULT.PASSED
  ) {
    return "Same";
  }
  return last === ARAL_ASSESSMENT_RESULT.PASSED ? "Improved" : "Still For ARAL";
}

/** One row per student (Eng + Fil roster pairs share studentId). */
export function uniqueAralLearners(learners = []) {
  const seen = new Set();
  const unique = [];
  for (const learner of learners) {
    const id = learner.studentId || learner.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(learner);
  }
  return unique;
}

/**
 * Build class + individual report model from learners + score rows.
 * @param {object[]} learners
 * @param {object[]} scores — flat list from aral_assessment_scores (any phases)
 */
export function buildAralSectionReport({ learners = [], scores = [] } = {}) {
  const roster = uniqueAralLearners(learners);
  const byStudentPhase = new Map();
  for (const row of scores) {
    const key = `${row.studentId}::${row.phase}`;
    byStudentPhase.set(key, row);
  }

  function phaseSummary(phase) {
    let scored = 0;
    let passed = 0;
    let forAral = 0;
    let pctSum = 0;
    let pctCount = 0;

    for (const learner of roster) {
      const row = byStudentPhase.get(`${learner.studentId}::${phase}`);
      if (!row || row.score == null) continue;
      scored += 1;
      if (row.result === ARAL_ASSESSMENT_RESULT.PASSED) passed += 1;
      if (row.result === ARAL_ASSESSMENT_RESULT.FOR_ARAL) forAral += 1;
      const pct = scoreToPercent(row.score, row.maxScore);
      if (pct != null) {
        pctSum += pct;
        pctCount += 1;
      }
    }

    const total = roster.length;
    const complete = total > 0 && scored === total;
    return {
      phase,
      label: aralAssessmentPhaseLabel(phase),
      total,
      scored,
      passed,
      forAral,
      avgPercent: pctCount ? pctSum / pctCount : null,
      status: complete
        ? "Complete"
        : scored > 0
          ? "In progress"
          : "Not started",
    };
  }

  const phases = [
    phaseSummary(ARAL_ASSESSMENT_PHASE.PRE),
    phaseSummary(ARAL_ASSESSMENT_PHASE.MID),
    phaseSummary(ARAL_ASSESSMENT_PHASE.POST),
  ];

  const individuals = roster.map((learner) => {
    const pre = byStudentPhase.get(
      `${learner.studentId}::${ARAL_ASSESSMENT_PHASE.PRE}`
    );
    const mid = byStudentPhase.get(
      `${learner.studentId}::${ARAL_ASSESSMENT_PHASE.MID}`
    );
    const post = byStudentPhase.get(
      `${learner.studentId}::${ARAL_ASSESSMENT_PHASE.POST}`
    );

    return {
      studentId: learner.studentId,
      studentName: formatAralRosterName(learner),
      studentNumber: learner.studentNumber,
      preScore: pre?.score ?? null,
      preMax: pre?.maxScore ?? null,
      preResult: pre?.result ?? null,
      midScore: mid?.score ?? null,
      midMax: mid?.maxScore ?? null,
      midResult: mid?.result ?? null,
      postScore: post?.score ?? null,
      postMax: post?.maxScore ?? null,
      postResult: post?.result ?? null,
      trend: computeAralAssessmentTrend(
        pre?.result ?? null,
        mid?.result ?? null,
        post?.result ?? null
      ),
    };
  });

  return { phases, individuals };
}
