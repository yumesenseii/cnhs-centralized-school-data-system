/**
 * Intervention caseload helpers — compose existing roster + records + scores.
 * Recommendation stays computed. Teacher sets status/evaluation. No auto-complete.
 */

import { formatAralRosterName } from "@/lib/monitoring/aralProgress";
import {
  MONITORING_STATUS,
  RECOMMENDATION,
  RISK_LEVEL,
  normalizeRecommendationType,
  normalizeRiskLevel,
} from "@/lib/monitoring/recommendations";
import { scoreToPercent } from "@/lib/monitoring/aralAssessments";
import { normalizeSubjectName } from "@/lib/services/recommendation/subjectCapabilities";

export const INTERVENTION_STATUS = {
  NOT_STARTED: MONITORING_STATUS.NOT_STARTED,
  ONGOING: MONITORING_STATUS.ONGOING,
  COMPLETED: MONITORING_STATUS.COMPLETED,
  NEEDS_FURTHER_SUPPORT: "Needs Further Support",
  FOR_FURTHER_MONITORING: "For Further Monitoring",
  IMPROVED: MONITORING_STATUS.IMPROVED,
  NEEDS_FOLLOW_UP: MONITORING_STATUS.NEEDS_FOLLOW_UP,
};

export const INTERVENTION_PATHWAY_OPTIONS = [
  "All Pathways",
  "ARAL Program (RA 12028)",
  "Classroom Remediation",
];

export const ARAL_TIER_OPTIONS = [
  "All Tiers",
  "Basic",
  "Plus",
];

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
  if (type === RECOMMENDATION.ARAL || type === RECOMMENDATION.REMEDIATION) return true;
  if (learner.aralFacilitatorAssigned) return true;
  if (learner.interventionPathway || learner.aralPlacementTier) return true;
  if (
    learner.monitoringStatus &&
    learner.monitoringStatus !== INTERVENTION_STATUS.NOT_STARTED
  ) {
    return true;
  }
  return false;
}

export function isAralCandidate(learner = {}) {
  const type = normalizeRecommendationType(
    learner.recommendationDisplay ?? learner.recommendation
  );
  return (
    type === RECOMMENDATION.ARAL ||
    Boolean(learner.aralFacilitatorAssigned) ||
    String(learner.interventionPathway || "").toLowerCase().includes("aral") ||
    Boolean(learner.aralPlacementTier)
  );
}

export function isRemediationCandidate(learner = {}) {
  const type = normalizeRecommendationType(
    learner.recommendationDisplay ?? learner.recommendation
  );
  return (
    type === RECOMMENDATION.REMEDIATION ||
    String(learner.interventionPathway || "").toLowerCase().includes("remediation")
  );
}

function caseloadStatusRank(status) {
  const display = displayInterventionStatus(status);
  if (
    display === INTERVENTION_STATUS.NEEDS_FURTHER_SUPPORT ||
    display === INTERVENTION_STATUS.NEEDS_FOLLOW_UP
  ) {
    return 5;
  }
  if (display === INTERVENTION_STATUS.FOR_FURTHER_MONITORING) return 4;
  if (display === INTERVENTION_STATUS.ONGOING) return 4;
  if (display === INTERVENTION_STATUS.IMPROVED) return 3;
  if (display === INTERVENTION_STATUS.COMPLETED) return 2;
  return 1;
}

function caseloadRiskRank(level) {
  const risk = normalizeRiskLevel(level);
  if (risk === RISK_LEVEL.HIGH) return 3;
  if (risk === RISK_LEVEL.MODERATE) return 2;
  return 1;
}

function caseloadGrade(row = {}) {
  const n = Number(row.classSubjectGrade ?? row.generalAverage);
  return Number.isFinite(n) ? n : 101;
}

/**
 * Prefer a row with facilitator, recorded progress, worse risk, then lower grade.
 */
export function pickPreferredCaseloadRow(a = {}, b = {}) {
  const aFacil = Boolean(a.aralFacilitatorAssigned || a.aralFacilitatorName);
  const bFacil = Boolean(b.aralFacilitatorAssigned || b.aralFacilitatorName);
  if (aFacil !== bFacil) return bFacil ? b : a;

  const statusDiff =
    caseloadStatusRank(b.monitoringStatus) -
    caseloadStatusRank(a.monitoringStatus);
  if (statusDiff !== 0) return statusDiff > 0 ? b : a;

  const progressA = Number(a.weeklyUpdateCount) || 0;
  const progressB = Number(b.weeklyUpdateCount) || 0;
  if (progressA !== progressB) return progressB > progressA ? b : a;

  const hasProgressA = Boolean(a.latestProgress && a.latestProgress !== "—");
  const hasProgressB = Boolean(b.latestProgress && b.latestProgress !== "—");
  if (hasProgressA !== hasProgressB) return hasProgressB ? b : a;

  const riskDiff = caseloadRiskRank(b.riskLevel) - caseloadRiskRank(a.riskLevel);
  if (riskDiff !== 0) return riskDiff > 0 ? b : a;

  return caseloadGrade(b) < caseloadGrade(a) ? b : a;
}

export function caseloadStudentSubjectKey(row = {}) {
  const id = row.studentId || row.student_id || "";
  const lrn = String(row.studentNumber || row.lrn || "").trim();
  const subject = normalizeSubjectName(row.subject || row.classSubject || "");
  return `${id || lrn}::${subject || "none"}`;
}

/**
 * One Intervention row per learner + subject.
 */
export function collapseInterventionCaseload(learners = []) {
  const byKey = new Map();
  for (const row of learners) {
    const key = caseloadStudentSubjectKey(row);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, row);
      continue;
    }
    byKey.set(key, pickPreferredCaseloadRow(prev, row));
  }
  return [...byKey.values()];
}

export function interventionTypeLabel(learner = {}) {
  if (learner.interventionPathway) {
    return learner.interventionPathway.includes("aral")
      ? "ARAL Program"
      : "Classroom Remediation";
  }
  const type = normalizeRecommendationType(
    learner.recommendationDisplay ?? learner.recommendation
  );
  if (type === RECOMMENDATION.ARAL || learner.aralFacilitatorAssigned) {
    return "ARAL Program";
  }
  if (type === RECOMMENDATION.REMEDIATION) {
    return "Classroom Remediation";
  }
  return "Classroom Support";
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

/**
 * HT summary. Pass unique grouped learners for people counts.
 * `classroomRemedial` is a class count, not unique learners.
 */
export function buildHtInterventionSummary(learners = [], classSummaries = []) {
  const cards = buildInterventionCards(learners);
  const aral = learners.filter(
    (s) =>
      normalizeRecommendationType(s.recommendation) === RECOMMENDATION.ARAL
  ).length;
  const remedialClasses = (classSummaries ?? []).filter(
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
    classroomRemedial: remedialClasses,
    classroomRemedialClasses: remedialClasses,
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
