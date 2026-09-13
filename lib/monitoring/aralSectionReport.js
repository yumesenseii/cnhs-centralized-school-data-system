/**
 * ARAL section report models (Summary Cover + Detailed).
 * Saved Pre/Mid/Post + weekly rows only. Does not invent learners or blank weeks.
 */

import {
  ARAL_SESSION_LABELS,
  ARAL_WEEK_OPTIONS,
  countAralWeeklyProgressBands,
  formatAralRosterName,
  parseAralProgress,
  stripAralWeekPrefix,
} from "@/lib/monitoring/aralProgress";
import {
  uniqueAralLearners,
} from "@/lib/monitoring/aralAssessments";
import {
  groupMonitoringRecordsByLearner,
  maxWeekAcrossSection,
} from "@/lib/monitoring/aralSectionFiles";

export const ARAL_TREND_KEYS = [
  "Not started",
  "Incomplete",
  "Improved",
  "Same",
  "Still For ARAL",
];

const ARAL_TREND_HIDE_WHEN_ZERO = new Set([
  "Improved",
  "Same",
  "Still For ARAL",
]);

export function formatAralGeneratedAt(now = new Date()) {
  return now.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatAralAvgPercent(pct) {
  if (pct == null) return "—";
  return `${pct.toFixed(1)}%`;
}

export function formatAralScore(score, max) {
  if (score == null) return "—";
  if (max == null) return String(score);
  return `${score}/${max}`;
}

export function countAralTrendGroups(individuals = []) {
  const counts = Object.fromEntries(ARAL_TREND_KEYS.map((key) => [key, 0]));
  for (const row of individuals) {
    const trend = row.trend;
    if (trend === "Improved") counts.Improved += 1;
    else if (trend === "Same") counts.Same += 1;
    else if (trend === "Still For ARAL") counts["Still For ARAL"] += 1;
    else if (trend === "Incomplete") counts.Incomplete += 1;
    else counts["Not started"] += 1;
  }
  return ARAL_TREND_KEYS.map((label) => ({
    label,
    count: counts[label],
  }));
}

/** Cover chips: Not started / Incomplete first. Hide zero Improved/Same/Still. */
export function visibleAralTrendGroups(trends = []) {
  return (trends ?? []).filter((row) => {
    if (ARAL_TREND_HIDE_WHEN_ZERO.has(row.label)) return row.count > 0;
    return true;
  });
}

export function formatAralTrendLine(trends = []) {
  return visibleAralTrendGroups(trends)
    .map((row) => `${row.label} ${row.count}`)
    .join(" · ");
}

/** English / Filipino from assigned roster — do not invent a subject. */
export function formatAralReportSubject(learners = []) {
  const subjects = [
    ...new Set(
      (learners ?? [])
        .map((row) => String(row.subject || "").trim())
        .filter((name) => name && name !== "—")
    ),
  ];
  return subjects.join(" / ");
}

export function buildAralWeeklyCoverSummary(learners = [], records = []) {
  const roster = uniqueAralLearners(learners);
  const byLearner = groupMonitoringRecordsByLearner(learners, records);
  const maxWeek = maxWeekAcrossSection(byLearner);
  const withEntries = new Set(
    records.map((row) => row.student_id).filter(Boolean)
  );
  const filled = roster.filter((l) => withEntries.has(l.studentId)).length;
  const bands = countAralWeeklyProgressBands(records);
  return {
    maxWeek,
    filled,
    total: roster.length,
    bands: bands.bands,
    hasWeekly: Boolean(maxWeek) && filled > 0,
  };
}

function weekCellFromRecord(record) {
  if (!record) {
    return {
      session: "",
      skill: "",
      progress: "",
      remarks: "",
      label: "",
    };
  }
  const session = ARAL_SESSION_LABELS[record.sessionStatus] || "";
  const skill = record.skillFocus || "";
  const progress = parseAralProgress(record.studentProgress) || "";
  const remarks = stripAralWeekPrefix(record.teacherRemarks);
  const parts = [session, skill, progress].filter(Boolean);
  return {
    session,
    skill,
    progress,
    remarks,
    label: parts.join(" · "),
  };
}

/**
 * One detailed weekly row per assigned learner. Blank week = not saved.
 */
export function buildAralWeeklyDetailRows(learners = [], records = []) {
  const roster = uniqueAralLearners(learners);
  const byLearner = groupMonitoringRecordsByLearner(learners, records);

  return roster.map((learner) => {
    const key = `${learner.studentId}::${learner.sourceClassId}`;
    const weeks = byLearner.get(key) ?? [];
    const byWeek = new Map(weeks.map((row) => [row.weekNumber, row]));
    const weekCells = {};
    let latestRemarks = "";
    let latestWeek = 0;

    for (const week of ARAL_WEEK_OPTIONS) {
      const cell = weekCellFromRecord(byWeek.get(week) || null);
      weekCells[week] = cell;
      if (cell.label && week >= latestWeek) {
        latestWeek = week;
        latestRemarks = cell.remarks;
      }
    }

    return {
      studentId: learner.studentId,
      studentName: formatAralRosterName(learner),
      studentNumber: learner.studentNumber || "—",
      weeks: weekCells,
      remarks: latestRemarks,
    };
  });
}

/**
 * Always Pre / Mid / Post on the axis.
 * Unscored phases stay as categories with null bars — not Passed 0 / For ARAL 0.
 */
export function buildAralPhaseChartRows(phases = []) {
  return (phases ?? []).map((phase) => {
    if (!phase.scored) {
      return {
        name: phase.label,
        Passed: null,
        "For ARAL": null,
      };
    }
    return {
      name: phase.label,
      Passed: phase.passed,
      "For ARAL": phase.forAral,
    };
  });
}

export function aralPhaseChartMax(rows = []) {
  let max = 0;
  for (const row of rows ?? []) {
    for (const value of [row.Passed, row["For ARAL"]]) {
      if (value == null) continue;
      const n = Number(value);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max;
}

/** Cover table: scored phases as counts; unscored as “Not started”, not 0. */
export function buildAralPhaseExcelChartRows(phases = []) {
  const rows = [];
  for (const phase of phases ?? []) {
    if (!phase.scored) {
      rows.push({
        category: phase.label,
        value: "Not started",
      });
      continue;
    }
    rows.push({ category: `${phase.label} Passed`, value: phase.passed });
    rows.push({ category: `${phase.label} For ARAL`, value: phase.forAral });
  }
  return rows;
}

/** Existing batch name only. Do not invent a season. */
export function formatAralProgramLabel(source = {}) {
  const name = String(
    source.batchName || source.batch_name || source.programName || ""
  ).trim();
  return name || "ARAL Program";
}

export function buildAralBandChartRows(bands = []) {
  return (bands ?? [])
    .filter((band) => band.count > 0)
    .map((band) => ({
      name: band.label,
      value: band.count,
    }));
}
