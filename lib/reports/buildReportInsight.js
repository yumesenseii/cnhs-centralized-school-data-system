/**
 * One-sentence insight for Reports Performance module (CNHS-scoped).
 */
export function buildReportInsight({
  termLabel = "All Terms",
  summary = null,
  schoolSummary = null,
  lessonSummary = null,
  scope = "teacher",
} = {}) {
  if (!summary && !schoolSummary) {
    return "No report data for the selected filters yet.";
  }

  const atRisk =
    schoolSummary?.atRisk ??
    (summary
      ? Number(summary.aralScreeningCount ?? 0) +
        Number(summary.classroomRemedialCount ?? 0)
      : 0);
  const aral =
    schoolSummary?.aralScreening ?? summary?.aralScreeningCount ?? 0;
  const monitoring =
    schoolSummary?.monitoringCompletionRate ??
    (summary?.monitoringCompletionRate != null
      ? `${summary.monitoringCompletionRate}%`
      : null);
  const lpPending = lessonSummary?.pending ?? 0;
  const learners = schoolSummary?.totalLearners ?? summary?.totalStudents ?? 0;
  const pass =
    summary?.passingRate == null ? null : `${summary.passingRate}%`;

  const parts = [`${termLabel}:`];

  if (scope === "admin") {
    parts.push(`${learners} learners`);
    parts.push(`${atRisk} at-risk`);
    parts.push(`${aral} ARAL`);
    if (monitoring) parts.push(`monitoring ${monitoring}`);
    parts.push(`${lpPending} LPs pending`);
  } else {
    parts.push(`${learners} learners`);
    if (pass) parts.push(`${pass} passing`);
    parts.push(`${aral} ARAL`);
    if (monitoring) parts.push(`monitoring ${monitoring}`);
    if (lpPending > 0) parts.push(`${lpPending} LPs pending`);
  }

  return parts.join(" · ");
}
