import { parseTermNumber } from "@/lib/academic/termLabels";
import {
  deriveReviewReasons,
  isReadingReviewCandidate,
} from "@/lib/monitoring/readingReviewSummary";

/**
 * Academic Monitoring aggregation — visual dedup only, never deletes data.
 *
 * The roster emits one row per enrollment (row.id = "class_id:student_id"),
 * so a learner taking several subjects appears once per subject. This module
 * collapses those rows into ONE learner row per section per quarter while
 * preserving every subject's individual data in `subjectStandings`.
 *
 * Layer rule: aggregate in exactly one place (MonitoringDashboard, after
 * school-year + quarter filtering). Child components must NOT re-aggregate.
 */

const RISK_RANK = {
  "High Risk": 3,
  High: 3,
  "Moderate Risk": 2,
  Moderate: 2,
  "Low Risk": 1,
  Low: 1,
};

function riskRank(level) {
  return RISK_RANK[String(level || "").trim()] ?? 0;
}

function numericGrade(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Safe learner identity: studentId first, LRN fallback (never row.id). */
export function learnerIdentityKey(row = {}) {
  const id =
    row.studentId || row.student_id || row.student?.id || row.id?.split?.(":")?.[1];
  if (id) return String(id);
  const lrn = row.studentNumber || row.lrn || "unknown";
  return `lrn:${lrn}`;
}

function groupKey(row, includeQuarter) {
  const section = row.gradeSection || `${row.grade || ""} ${row.section || ""}`.trim();
  const parts = [learnerIdentityKey(row), section, row.schoolYear || ""];
  if (includeQuarter) {
    parts.push(String(parseTermNumber(row.quarterNumber ?? row.quarter) ?? row.quarter ?? ""));
  }
  return parts.join("::").toLowerCase();
}

function observationTime(row) {
  const raw = row.latestObservationDate;
  if (!raw || raw === "—") return Number.NEGATIVE_INFINITY;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
}

function buildStanding(row) {
  return {
    subject: row.subject || "Subject",
    subjectId: row.subjectId ?? null,
    classId: row.classId ?? null,
    grade: row.classSubjectGrade ?? row.currentGrade ?? null,
    riskLevel: row.riskLevel || row.academicRisk || "—",
    trend: row.performanceTrend || "Stable",
    monitoringStatus: row.monitoringStatus || "Not Started",
    recommendation: row.recommendation ?? null,
    recommendedSupport: row.recommendedSupport ?? null,
    aralApprovalStatus: row.aralApprovalStatus ?? null,
    observationTime: observationTime(row),
  };
}

/**
 * Collapse enrollment rows → one learner row per section per quarter.
 * - overallRisk = highest subject risk rank (never just the lowest grade)
 * - primary concern = highest risk, tie → lowest grade
 * - monitoringStatus = latest real timestamp across standings
 * - readingReview derived across language standings (not just primary)
 */
export function aggregateAcademicLearners(rows = [], { includeQuarterInKey = true } = {}) {
  const groups = new Map();
  for (const row of rows) {
    if (!row) continue;
    const key = groupKey(row, includeQuarterInKey);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const aggregated = [];
  for (const list of groups.values()) {
    const standings = list.map(buildStanding);

    // Primary concern: highest risk, then lowest grade.
    let primary = standings[0];
    for (const st of standings) {
      const rankDiff = riskRank(st.riskLevel) - riskRank(primary.riskLevel);
      if (rankDiff > 0) {
        primary = st;
        continue;
      }
      if (rankDiff === 0) {
        const g = numericGrade(st.grade);
        const pg = numericGrade(primary.grade);
        if (g !== null && (pg === null || g < pg)) primary = st;
      }
    }
    const primaryRow = list[standings.indexOf(primary)] ?? list[0];

    // Latest monitoring status by real timestamp (not array order).
    let latestStatus = primary.monitoringStatus;
    let latestTime = Number.NEGATIVE_INFINITY;
    for (const st of standings) {
      if (st.observationTime > latestTime) {
        latestTime = st.observationTime;
        latestStatus = st.monitoringStatus;
      }
    }

    const subjectNames = [...new Set(standings.map((s) => s.subject).filter(Boolean))];
    const referred = standings.some(
      (s) =>
        /submitted|approved|for your review|pending principal review|approved for assessment/i.test(
          String(s.aralApprovalStatus || "")
        ) || s.monitoringStatus === "Referred to ARAL"
    );

    // Reading-review candidacy across language standings (any standing).
    const languageStandings = standings.filter((s) =>
      /english|filipino/i.test(s.subject || "")
    );
    const reasonSet = new Set();
    let concernStanding = null;
    let concernRank = -1;
    for (const st of languageStandings) {
      const probe = {
        subject: st.subject,
        isAralEligible: true,
        classSubjectGrade: st.grade,
        currentGrade: st.grade,
        riskLevel: st.riskLevel,
        performanceTrend: st.trend,
        readingLevel: primaryRow.readingLevel,
        philIriScore: primaryRow.philIriScore,
        candidateStatus: primaryRow.candidateStatus,
      };
      const reasons = deriveReviewReasons(probe);
      for (const code of reasons) reasonSet.add(code);
      const rank = riskRank(st.riskLevel);
      if (reasons.length > 0 && rank > concernRank) {
        concernRank = rank;
        concernStanding = st;
      }
    }
    const candidateReasons = [...reasonSet];

    aggregated.push({
      ...primaryRow,
      id: `agg:${learnerIdentityKey(primaryRow)}:${(primaryRow.gradeSection || "").toLowerCase()}:${parseTermNumber(primaryRow.quarterNumber ?? primaryRow.quarter) ?? ""}`,
      subject: subjectNames.join(" · ") || primaryRow.subject,
      subjects: subjectNames,
      subjectStandings: standings,
      primarySubject: primary.subject,
      primaryClassId: primary.classId,
      classSubjectGrade: primary.grade,
      currentGrade: primary.grade,
      riskLevel: primary.riskLevel,
      academicRisk: primary.riskLevel,
      performanceTrend: primary.trend,
      monitoringStatus: latestStatus,
      atRisk: riskRank(primary.riskLevel) >= 3,
      alreadyReferred: referred,
      readingReview: {
        candidate: candidateReasons.length > 0,
        reasons: candidateReasons,
        concernSubject: concernStanding?.subject ?? null,
        concernClassId: concernStanding?.classId ?? null,
      },
    });
  }

  return aggregated;
}

/**
 * Filter-first context: active school year + selected quarter BEFORE
 * aggregation. "All quarters" keeps every term (group key still separates
 * them); a specific quarter narrows to that term only.
 */
export function filterRosterContext(
  rows = [],
  { schoolYear = null, quarter = null } = {}
) {
  return rows.filter((row) => {
    if (schoolYear && row.schoolYear && row.schoolYear !== schoolYear) return false;
    if (quarter && quarter !== "All quarters" && quarter !== "All Terms") {
      const rowTerm = parseTermNumber(row.quarterNumber ?? row.quarter);
      const wantTerm = parseTermNumber(quarter);
      if (rowTerm !== null && wantTerm !== null) return rowTerm === wantTerm;
      if (String(row.quarter ?? "") !== String(quarter)) return false;
    }
    return true;
  });
}
