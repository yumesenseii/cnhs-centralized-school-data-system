/**
 * Soft UI snapshot for HT Academic Monitoring.
 * Survives App Router remount when navigating away and back,
 * so the page can paint immediately without a blank loading wipe.
 * Hard reload still clears module state; Refresh uses bustCache on roster TTL.
 */

const EMPTY_STATS = {
  totalAtRisk: 0,
  aral: 0,
  classroomRemedialLearners: 0,
  remediation: 0,
  completed: 0,
  ongoing: 0,
  notStarted: 0,
};

/** @type {null | {
 *   students: object[],
 *   classSummaries: object[],
 *   stats: typeof EMPTY_STATS,
 *   profile: object | null,
 *   savedAt: number,
 * }} */
let snapshot = null;

export function peekAdminMonitoringUiSnapshot() {
  return snapshot;
}

export function hasAdminMonitoringUiSnapshot() {
  return Boolean(
    snapshot &&
      (Array.isArray(snapshot.students) ||
        Array.isArray(snapshot.classSummaries))
  );
}

export function saveAdminMonitoringUiSnapshot({
  students = [],
  classSummaries = [],
  stats = EMPTY_STATS,
  profile = null,
} = {}) {
  snapshot = {
    students,
    classSummaries,
    stats: { ...EMPTY_STATS, ...stats },
    profile,
    savedAt: Date.now(),
  };
}

export function clearAdminMonitoringUiSnapshot() {
  snapshot = null;
}

export function getEmptyAdminMonitoringStats() {
  return { ...EMPTY_STATS };
}
