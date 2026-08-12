/**
 * Virtual ARAL section file cabinet entries (Weekly / Assessment / Report).
 */

import {
  ARAL_ASSESSMENT_PHASE,
  aralAssessmentPhaseLabel,
} from "@/lib/monitoring/aralAssessments";
import { withWeekNumbers } from "@/lib/monitoring/aralProgress";

function formatModified(isoOrDate) {
  if (!isoOrDate) return "—";
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return String(isoOrDate);
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function initialsFromName(name = "") {
  const parts = String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "FC";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""}`.toUpperCase();
}

/** Prefer explicit [Week N] marker in remarks when present. */
export function weekNumberFromRemarks(remarks = "") {
  const match = String(remarks || "").match(/^\[Week\s+(\d+)\]/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Group monitoring records by learner pair and attach week numbers.
 * @returns {Map<string, object[]>} key = studentId::classId → week-numbered records
 */
export function groupMonitoringRecordsByLearner(learners = [], records = []) {
  const byPair = new Map();
  for (const record of records) {
    const key = `${record.student_id}::${record.class_id}`;
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key).push(record);
  }

  const result = new Map();
  for (const learner of learners) {
    if (!learner.studentId || !learner.sourceClassId) continue;
    const key = `${learner.studentId}::${learner.sourceClassId}`;
    const raw = byPair.get(key) ?? [];
    const mapped = raw.map((record) => ({
      id: record.id,
      observationDateRaw: record.observation_date,
      observationDate: record.observation_date,
      interventionGiven: record.intervention_given || "",
      teacherRemarks: record.teacher_remarks || "",
      studentProgress: record.student_progress || "",
      monitoringStatus: record.monitoring_status || "",
      followUpNeeded: Boolean(record.follow_up_needed),
      updatedAt: record.updated_at || record.created_at || record.observation_date,
      raw: record,
    }));
    result.set(key, withWeekNumbers(mapped).map((row) => {
      const tagged = weekNumberFromRemarks(row.teacherRemarks);
      if (!tagged) return row;
      return {
        ...row,
        weekNumber: tagged,
        weekLabel: `Week ${tagged}`,
      };
    }));
  }
  return result;
}

/**
 * Highest week number present across the section (0 if none).
 */
export function maxWeekAcrossSection(byLearner = new Map()) {
  let max = 0;
  for (const weeks of byLearner.values()) {
    for (const row of weeks) {
      if (row.weekNumber && row.weekNumber > max) max = row.weekNumber;
    }
  }
  return max;
}

/**
 * Rows for one week file: one entry per learner (record or empty).
 */
export function buildWeekFileRows(learners = [], byLearner = new Map(), weekNumber = 1) {
  return learners.map((learner) => {
    const key = `${learner.studentId}::${learner.sourceClassId}`;
    const weeks = byLearner.get(key) ?? [];
    const match = weeks.find((w) => w.weekNumber === weekNumber) || null;
    return {
      learner,
      record: match,
      weekNumber,
    };
  });
}

/**
 * Build file list for a section folder.
 * Only weeks/phases with saved data. Report row is opt-in after Generate.
 */
export function buildAralSectionFiles({
  learners = [],
  records = [],
  assessmentScores = [],
  gradeSection = "Section",
  teacherName = "Facilitator",
  includeReport = false,
} = {}) {
  const byLearner = groupMonitoringRecordsByLearner(learners, records);
  const maxWeek = maxWeekAcrossSection(byLearner);
  const files = [];
  const uploadedBy = teacherName;
  const uploadedByInitials = initialsFromName(teacherName);

  const weeksWithData = new Set();
  for (const weeks of byLearner.values()) {
    for (const row of weeks) {
      if (row.weekNumber) weeksWithData.add(row.weekNumber);
    }
  }

  for (const week of [...weeksWithData].sort((a, b) => a - b)) {
    const rows = buildWeekFileRows(learners, byLearner, week);
    const filled = rows.filter((r) => r.record);
    let latest = null;
    for (const row of filled) {
      const t = row.record.updatedAt || row.record.observationDate;
      if (!latest || String(t) > String(latest)) latest = t;
    }
    files.push({
      id: `weekly-${week}`,
      kind: "weekly",
      weekNumber: week,
      fileName: `ARAL Weekly · Week ${week}.xlsx`,
      typeLabel: "Weekly",
      typeTone: "weekly",
      modifiedLabel: formatModified(latest),
      modifiedAt: latest,
      status: "Uploaded",
      statusTone: "saved",
      filledCount: filled.length,
      learnerCount: learners.length,
      uploadedBy,
      uploadedByInitials,
      canEdit: false,
      canUpload: true,
      hasUpload: true,
      subtitle: `${filled.length} of ${learners.length} updated`,
    });
  }

  const uniqueLearnerCount = new Set(
    learners.map((l) => l.studentId).filter(Boolean)
  ).size;
  const rosterCount = uniqueLearnerCount || learners.length;

  const phases = [
    ARAL_ASSESSMENT_PHASE.PRE,
    ARAL_ASSESSMENT_PHASE.MID,
    ARAL_ASSESSMENT_PHASE.POST,
  ];
  for (const phase of phases) {
    const phaseScores = assessmentScores.filter((s) => s.phase === phase);
    const scoredIds = new Set(
      phaseScores.filter((s) => s.score != null).map((s) => s.studentId)
    );
    const scored = scoredIds.size;
    const hasUpload = scored > 0;
    let latest = null;
    for (const row of phaseScores) {
      const t = row.updatedAt || row.scoredAt || row.startedAt;
      if (t && (!latest || String(t) > String(latest))) latest = t;
    }
    if (!hasUpload) continue;

    const label = aralAssessmentPhaseLabel(phase);
    const status =
      scored >= rosterCount ? "Complete" : "Uploaded · In progress";

    files.push({
      id: `assessment-${phase}`,
      kind: "assessment",
      phase,
      fileName: `ARAL ${label}.xlsx`,
      typeLabel: "Assessment",
      typeTone: "assessment",
      modifiedLabel: formatModified(latest),
      modifiedAt: latest,
      status,
      statusTone: scored >= rosterCount ? "saved" : "progress",
      filledCount: scored,
      learnerCount: rosterCount,
      uploadedBy,
      uploadedByInitials,
      canEdit: false,
      canUpload: true,
      hasUpload: true,
      subtitle: `${scored} of ${rosterCount} scored`,
    });
  }

  if (includeReport) {
    files.push({
      id: "report",
      kind: "report",
      fileName: `ARAL Section Report · ${gradeSection}.xlsx`,
      typeLabel: "Report",
      typeTone: "report",
      modifiedLabel: formatModified(new Date().toISOString()),
      modifiedAt: new Date().toISOString(),
      status: "Ready",
      statusTone: "ready",
      filledCount: learners.length,
      learnerCount: learners.length,
      uploadedBy,
      uploadedByInitials,
      canEdit: false,
      canUpload: false,
      hasUpload: true,
      subtitle: "From saved scores and weekly progress",
    });
  }

  return {
    files,
    byLearner,
    maxWeek,
    weekCount: weeksWithData.size,
    nextWeekNumber: maxWeek > 0 ? maxWeek + 1 : 1,
  };
}

/**
 * Resolve next week number to create.
 * If only empty Week 1 exists (no records), still allow Week 2 after user adds slot;
 * next create target = weekCount + 1 when adding a slot.
 */
export function nextWeeklyFileNumber(maxWeek, weekCount) {
  return Math.max(maxWeek, weekCount, 1) + 1;
}
