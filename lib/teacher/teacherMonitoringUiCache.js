/**
 * Soft UI snapshot for Teacher Academic Monitoring.
 * Survives App Router remount when navigating away and back.
 */

/** @type {null | {
 *   students: object[],
 *   classSummaries: object[],
 *   kpis: object[],
 *   teacher: object | null,
 *   profile: object | null,
 *   savedAt: number,
 * }} */
let snapshot = null;

export function peekTeacherMonitoringUiSnapshot() {
  return snapshot;
}

export function hasTeacherMonitoringUiSnapshot() {
  return Boolean(
    snapshot &&
      (Array.isArray(snapshot.students) ||
        Array.isArray(snapshot.classSummaries))
  );
}

export function saveTeacherMonitoringUiSnapshot({
  students = [],
  classSummaries = [],
  kpis = [],
  teacher = null,
  profile = null,
} = {}) {
  snapshot = {
    students,
    classSummaries,
    kpis,
    teacher,
    profile,
    savedAt: Date.now(),
  };
}

export function clearTeacherMonitoringUiSnapshot() {
  snapshot = null;
}
