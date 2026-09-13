/**
 * Intervention caseload helpers — compose existing roster + records + scores.
 * Recommendation stays computed. Teacher sets status/evaluation. No auto-complete.
 */

import { formatAralRosterName } from "@/lib/monitoring/aralProgress";
import {
  MONITORING_STATUS,
  RECOMMENDATION,
  normalizeRecommendationType,
} from "@/lib/monitoring/recommendations";
import { scoreToPercent } from "@/lib/monitoring/aralAssessments";

export const INTERVENTION_STATUS = {
  NOT_STARTED: MONITORING_STATUS.NOT_STARTED,
  ONGOING: MONITORING_STATUS.ONGOING,
  COMPLETED: MONITORING_STATUS.COMPLETED,
  NEEDS_FURTHER_SUPPORT: "Needs Further Support",
  FOR_FURTHER_MONITORING: "For Further Monitoring",
  IMPROVED: MONITORING_STATUS.IMPROVED,
  NEEDS_FOLLOW_UP: MONITORING_STATUS.NEEDS_FOLLOW_UP,
};

export const INTERVENTION_STATUS_OPTIONS = [
  INTERVENTION_STATUS.ONGOING,
  INTERVENTION_STATUS.COMPLETED,
  INTERVENTION_STATUS.NEEDS_FURTHER_SUPPORT,
  INTERVENTION_STATUS.FOR_FURTHER_MONITORING,
];

export const PROGRESS_EVALUATION_OPTIONS = [
  "Improving",
  "Limited Improvement",
  "No Significant Improvement",
  "Requires Further Support",
];

export const NEXT_ACTION_OPTIONS = [
  "Continue Intervention",
  "Provide Additional Support",
  "Complete Intervention",
  "Further Monitoring",
];

/** Display alias — stored Needs Follow-up still reads as Further Support. */
export function displayInterventionStatus(status) {
  const raw = String(status ?? "").trim();
  if (!raw || raw === INTERVENTION_STATUS.NOT_STARTED) {
    return INTERVENTION_STATUS.NOT_STARTED;
  }
  if (raw === INTERVENTION_STATUS.NEEDS_FOLLOW_UP) {
    return INTERVENTION_STATUS.NEEDS_FURTHER_SUPPORT;
  }
  return raw;
}

export function statusMatchesFilter(stored, filter) {
  if (!filter || filter === "All Status") return true;
  const display = displayInterventionStatus(stored);
  if (filter === INTERVENTION_STATUS.NEEDS_FURTHER_SUPPORT) {
    return (
      display === INTERVENTION_STATUS.NEEDS_FURTHER_SUPPORT ||
      stored === INTERVENTION_STATUS.NEEDS_FOLLOW_UP
    );
  }
  return display === filter || stored === filter;
}

export function isInterventionCandidate(learner = {}) {
  const type = normalizeRecommendationType(
    learner.recommendationDisplay ?? learner.recommendation
  );
  if (type === RECOMMENDATION.ARAL) return true;
  if (learner.aralFacilitatorAssigned) return true;
  if (
    learner.monitoringStatus &&
    learner.monitoringStatus !== INTERVENTION_STATUS.NOT_STARTED
  ) {
    return true;
  }
  return false;
}

export function interventionTypeLabel(learner = {}) {
  const type = normalizeRecommendationType(
    learner.recommendationDisplay ?? learner.recommendation
  );
  if (type === RECOMMENDATION.ARAL || learner.aralFacilitatorAssigned) {
    return RECOMMENDATION.ARAL;
  }
  return "—";
}

/**
 * Recorded Pre/Mid/Post → baseline / latest / improvement.
 * Missing phases are omitted. No invented scores.
 */
export function buildRecordedProgress(scores = []) {
  const byPhase = new Map();
  for (const row of scores) {
    if (row?.score == null) continue;
    const pct = scoreToPercent(row.score, row.maxScore ?? row.max_score);
    if (pct == null) continue;
    byPhase.set(row.phase, {
      phase: row.phase,
      score: Number(row.score),
      max: Number(row.maxScore ?? row.max_score) || null,
      percent: Math.round(pct * 10) / 10,
      date: row.scoredAt ?? row.scored_at ?? row.startedAt ?? null,
      result: row.result || null,
    });
  }

  const ordered = ["pre", "mid", "post"]
    .map((phase) => byPhase.get(phase))
    .filter(Boolean);
  const baseline = ordered[0] || null;
  const latest = ordered[ordered.length - 1] || null;
  const improvement =
    baseline && latest && ordered.length >= 2
      ? Math.round((latest.percent - baseline.percent) * 10) / 10
      : null;

  return {
    checks: ordered,
    baseline,
    latest,
    improvement,
    checkCount: ordered.length,
    latestPercent: latest?.percent ?? null,
    latestDate: latest?.date ?? null,
    label: latest ? `${latest.percent}%` : "—",
  };
}

export function formatImprovement(points) {
  if (points == null) return "—";
  const sign = points > 0 ? "+" : "";
  return `${sign}${points} points`;
}

export function buildInterventionCards(learners = []) {
  const rows = learners.filter(isInterventionCandidate);
  const counts = {
    forIntervention: rows.length,
    notStarted: 0,
    ongoing: 0,
    completed: 0,
    needsFurtherSupport: 0,
    forFurtherMonitoring: 0,
  };
  for (const row of rows) {
    const status = displayInterventionStatus(row.monitoringStatus);
    if (status === INTERVENTION_STATUS.NOT_STARTED) counts.notStarted += 1;
    else if (status === INTERVENTION_STATUS.ONGOING) counts.ongoing += 1;
    else if (status === INTERVENTION_STATUS.COMPLETED) counts.completed += 1;
    else if (status === INTERVENTION_STATUS.NEEDS_FURTHER_SUPPORT) {
      counts.needsFurtherSupport += 1;
    } else if (status === INTERVENTION_STATUS.FOR_FURTHER_MONITORING) {
      counts.forFurtherMonitoring += 1;
    }
  }
  return counts;
}

export function buildHtInterventionSummary(learners = [], classSummaries = []) {
  const cards = buildInterventionCards(learners);
  const aral = learners.filter(
    (s) =>
      normalizeRecommendationType(s.recommendation) === RECOMMENDATION.ARAL
  ).length;
  const remedial = (classSummaries ?? []).filter(
    (c) => c.classroomRemedialRecommended
  ).length;

  const bySection = new Map();
  const bySubject = new Map();
  for (const row of learners.filter(isInterventionCandidate)) {
    const section = row.gradeSection || "—";
    bySection.set(section, (bySection.get(section) || 0) + 1);
    const subject = row.subject || "—";
    bySubject.set(subject, (bySubject.get(subject) || 0) + 1);
  }

  return {
    ...cards,
    aral,
    classroomRemedial: remedial,
    bySection: [...bySection.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    bySubject: [...bySubject.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export function filterInterventionCaseload(
  learners = [],
  {
    search = "",
    grade = "All grades",
    section = "All sections",
    subject = "All subjects",
    type = "All types",
    risk = "All risks",
    status = "All Status",
    facilitator = "All facilitators",
    schoolYear = "All years",
    card = null,
  } = {}
) {
  const q = search.trim().toLowerCase();
  return learners.filter((row) => {
    if (!isInterventionCandidate(row)) return false;
    if (q) {
      const hay =
        `${row.name} ${row.lastName} ${row.firstName} ${row.studentNumber} ${row.subject}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (grade !== "All grades" && row.grade !== grade) return false;
    if (section !== "All sections" && row.section !== section) return false;
    if (subject !== "All subjects" && row.subject !== subject) return false;
    if (type !== "All types" && interventionTypeLabel(row) !== type) {
      return false;
    }
    if (risk !== "All risks" && row.riskLevel !== risk) return false;
    if (!statusMatchesFilter(row.monitoringStatus, status)) return false;
    if (
      facilitator !== "All facilitators" &&
      (row.aralFacilitatorName || "Unassigned") !== facilitator
    ) {
      return false;
    }
    if (schoolYear !== "All years" && row.schoolYear !== schoolYear) {
      return false;
    }
    if (card) {
      const display = displayInterventionStatus(row.monitoringStatus);
      if (card === "notStarted" && display !== INTERVENTION_STATUS.NOT_STARTED) {
        return false;
      }
      if (card === "ongoing" && display !== INTERVENTION_STATUS.ONGOING) {
        return false;
      }
      if (card === "completed" && display !== INTERVENTION_STATUS.COMPLETED) {
        return false;
      }
      if (
        card === "needsFurtherSupport" &&
        display !== INTERVENTION_STATUS.NEEDS_FURTHER_SUPPORT
      ) {
        return false;
      }
      if (
        card === "forFurtherMonitoring" &&
        display !== INTERVENTION_STATUS.FOR_FURTHER_MONITORING
      ) {
        return false;
      }
    }
    return true;
  });
}

export function learnerDisplayName(learner = {}) {
  return formatAralRosterName({
    lastName: learner.lastName,
    firstName: learner.firstName,
    middleName: learner.middleName,
    last_name: learner.last_name,
    first_name: learner.first_name,
    middle_name: learner.middle_name,
    studentName: learner.name || learner.studentName,
  });
}
