/**
 * Class Support & Progress Service for Teacher Class Overview.
 *
 * Strictly adheres to shared Academic Monitoring logic without inventing new thresholds:
 * 1. Reuses deriveAcademicRisk, deriveAcademicProgress, and deriveCurrentSupport.
 * 2. Compares same learner, same subject, comparable finalized term.
 * 3. User-facing progress labels: "Improving", "Declining", "No clear change", "No previous grade".
 * 4. Plain English teacher terminology: Doing Well, Needs Monitoring, Needs Attention.
 */

import { isAralLanguageSubject } from "./aralAcademicStatus.js";
import { parseRecordedGrade } from "../ecr/computeGrades.js";
import {
  deriveAcademicProgress,
  deriveAcademicRisk,
  deriveCurrentSupport,
  isHighPriority,
} from "./academicMonitoringState.js";
import { RISK_LEVEL } from "./recommendations.js";

/**
 * Calculates academic progress for a single learner in the class.
 *
 * @param {object} learner
 * @param {number} currentTerm (1, 2, 3, or 4)
 * @returns {object} { currentGrade, prevGrade, progress, progressLabel, hasPreviousGrade, diff }
 */
export function calculateLearnerClassProgress(learner = {}, currentTerm = 1) {
  const termGrades = learner.termGrades ?? {};
  const currentGrade = parseRecordedGrade(
    termGrades[currentTerm] ?? learner.averageGrade
  );

  const prevTerm = currentTerm > 1 ? currentTerm - 1 : null;
  const prevGrade = prevTerm ? parseRecordedGrade(termGrades[prevTerm]) : null;

  // Use the canonical Academic Monitoring progress derivation
  const result = deriveAcademicProgress(currentGrade, prevGrade);

  const progressLabel = result.hasPreviousGrade
    ? result.label
    : "No previous grade";

  return {
    learnerId: learner.id,
    currentGrade,
    prevGrade,
    progress: result.progress,
    progressLabel,
    hasPreviousGrade: result.hasPreviousGrade,
    diff: result.diff ?? 0,
  };
}

/**
 * Builds the Class Support breakdown and direction for the class overview.
 *
 * @param {object} classItem
 * @param {Array} students
 * @param {number} currentTerm
 * @returns {object}
 */
export function buildClassSupportSummary(classItem = {}, students = [], currentTerm = 1) {
  const subjectName = classItem.subject ?? "";
  const isLanguage = isAralLanguageSubject(subjectName);

  const analyzed = students.map((s) => {
    const termGrades = s.termGrades ?? {};
    const curGrade = parseRecordedGrade(
      termGrades[currentTerm] ?? s.averageGrade
    );
    const prevTerm = currentTerm > 1 ? currentTerm - 1 : null;
    const prevGrade = prevTerm ? parseRecordedGrade(termGrades[prevTerm]) : null;

    const progressInfo = calculateLearnerClassProgress(s, currentTerm);
    const risk = deriveAcademicRisk(s, curGrade);
    const support = deriveCurrentSupport(s);
    const highPri = isHighPriority(s);

    // Classification based strictly on canonical Academic Monitoring state
    // Needs Attention: Academic concern needing teacher review (Grade < 75, High Risk, or needs_review)
    const isNeedsAttention =
      (curGrade !== null && curGrade < 75) ||
      risk === RISK_LEVEL.HIGH ||
      support.key === "needs_review" ||
      highPri;

    // Needs Monitoring: Borderline passing (75–76) or active watchlist concern
    const isNeedsMonitoring =
      !isNeedsAttention &&
      ((curGrade !== null && curGrade >= 75 && curGrade <= 76) ||
        Boolean(s.isWatchlist) ||
        s.monitoringStatus === "Watchlist");

    // Doing Well: Passing without active concern (strictly requires a passing grade)
    const isDoingWell =
      curGrade !== null &&
      curGrade >= 75 &&
      !isNeedsAttention &&
      !isNeedsMonitoring;

    return {
      student: s,
      curGrade,
      prevGrade,
      progressInfo,
      risk,
      support,
      isNeedsAttention,
      isNeedsMonitoring,
      isDoingWell,
    };
  });

  const doingWellList = analyzed.filter((a) => a.isDoingWell);
  const needsMonitoringList = analyzed.filter((a) => a.isNeedsMonitoring);
  const needsAttentionList = analyzed
    .filter((a) => a.isNeedsAttention)
    .sort((a, b) => (a.curGrade ?? 99) - (b.curGrade ?? 99));

  // Previous term comparison for direction text
  let directionText = "Learner academic support status for this term.";
  if (currentTerm > 1) {
    const prevAttentionCount = students.filter((s) => {
      const g = parseRecordedGrade(s.termGrades?.[currentTerm - 1]);
      return g !== null && g < 75;
    }).length;

    const hasPrevData = students.some((s) => {
      return parseRecordedGrade(s.termGrades?.[currentTerm - 1]) !== null;
    });

    if (hasPrevData) {
      const currAttentionCount = needsAttentionList.length;
      const diff = prevAttentionCount - currAttentionCount;

      if (diff > 0) {
        directionText = `${diff} fewer learner${diff === 1 ? "" : "s"} need support compared with the previous term.`;
      } else if (diff < 0) {
        const absDiff = Math.abs(diff);
        directionText = `${absDiff} more learner${absDiff === 1 ? "" : "s"} need support compared with the previous term.`;
      } else {
        directionText = "No major change from the previous term.";
      }
    }
  }

  return {
    isLanguageSubject: isLanguage,
    directionText,
    doingWellCount: doingWellList.length,
    needsMonitoringCount: needsMonitoringList.length,
    needsAttentionCount: needsAttentionList.length,
    learnersNeedingAttention: needsAttentionList.map((item) => ({
      ...item.student,
      currentGrade: item.curGrade,
      progress: item.progressInfo.progress,
      progressLabel: item.progressInfo.progressLabel,
      diff: item.progressInfo.diff,
    })),
    topAttentionLearners: needsAttentionList.slice(0, 5).map((item) => ({
      ...item.student,
      currentGrade: item.curGrade,
      progress: item.progressInfo.progress,
      progressLabel: item.progressInfo.progressLabel,
      diff: item.progressInfo.diff,
    })),
  };
}

// Backward compatibility export aliases
export const calculateLearnerTrajectory = calculateLearnerClassProgress;
export const buildClassEarlyForecast = buildClassSupportSummary;
