import { transmuteInitialGrade } from "@/lib/eclass/depedTransmutation";
import { ECR_COMPONENTS } from "@/lib/ecr/constants";

function round2(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

export function termGradeDescription(termGrade) {
  const n = Number(termGrade);
  if (!Number.isFinite(n)) return "";
  if (n >= 90) return "Outstanding";
  if (n >= 85) return "Very Satisfactory";
  if (n >= 80) return "Satisfactory";
  if (n >= 75) return "Fairly Satisfactory";
  return "Did Not Meet Expectations";
}

function parseRawScore(raw) {
  if (raw === null || raw === undefined || String(raw).trim() === "") return null;
  const n = Number(String(raw).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Compute PS/WS for one component group from raw scores + config rows.
 */
export function computeComponentGroup(scoresByKey, configRows = []) {
  if (!configRows.length) {
    return { total: null, ps: null, ws: null, weight: null };
  }

  let earned = 0;
  let possible = 0;
  let hasAny = false;
  const weight = Number(configRows[0]?.component_weight ?? 0);

  for (const cfg of configRows) {
    const raw = scoresByKey[`${cfg.component}:${cfg.item_index}`];
    const parsed = parseRawScore(raw);
    if (parsed === null) continue;
    const hps = Number(cfg.highest_possible_score);
    if (!Number.isFinite(hps) || hps <= 0) continue;
    earned += Math.min(parsed, hps);
    possible += hps;
    hasAny = true;
  }

  if (!hasAny || possible <= 0) {
    return { total: null, ps: null, ws: null, weight };
  }

  const ps = (earned / possible) * 100;
  const ws = ps * weight;
  return {
    total: round2(earned),
    ps: round2(ps),
    ws: round2(ws),
    weight,
  };
}

/**
 * Full row computation for one learner (WW + PT + QA → Initial → Term).
 */
export function computeLearnerRow(scoresByKey, configRows = []) {
  const byComponent = {};
  for (const component of ECR_COMPONENTS) {
    const rows = configRows.filter((r) => r.component === component);
    byComponent[component] = computeComponentGroup(scoresByKey, rows);
  }

  const ww = byComponent.WW;
  const pt = byComponent.PT;
  const qa = byComponent.QA;

  const parts = [ww.ws, pt.ws, qa.ws].filter((v) => v !== null && Number.isFinite(v));
  const initial =
    parts.length > 0 ? round2(parts.reduce((sum, v) => sum + v, 0)) : null;

  const termGrade =
    initial !== null ? transmuteInitialGrade(initial) : null;

  return {
    ww_total: ww.total,
    ww_ps: ww.ps,
    ww_ws: ww.ws,
    pt_total: pt.total,
    pt_ps: pt.ps,
    pt_ws: pt.ws,
    qa_total: qa.total,
    qa_ps: qa.ps,
    qa_ws: qa.ws,
    initial_grade: initial,
    term_grade: termGrade,
    description: termGrade !== null ? termGradeDescription(termGrade) : "",
  };
}

/** Columns persisted on ecr_computed_grades (excludes display-only totals). */
export function pickComputedForStorage(row = {}) {
  return {
    ww_ps: row.ww_ps,
    ww_ws: row.ww_ws,
    pt_ps: row.pt_ps,
    pt_ws: row.pt_ws,
    qa_ps: row.qa_ps,
    qa_ws: row.qa_ws,
    initial_grade: row.initial_grade,
    term_grade: row.term_grade,
    description: row.description,
  };
}

/**
 * Parse a stored term grade. Empty / null / "" → null.
 * Does not coerce null/"" to 0 (Number(null) === 0).
 * A real encoded 0 stays 0.
 */
export function parseRecordedGrade(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * AVE summary: average of available term grades; sync as quarter 4.
 */
export function computeFinalFromTerms(termGrades = []) {
  const values = termGrades
    .map((g) => parseRecordedGrade(g))
    .filter((g) => g !== null);
  if (!values.length) return null;
  const avg = values.reduce((sum, g) => sum + g, 0) / values.length;
  return Math.round(avg * 100) / 100;
}
