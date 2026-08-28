import { ATTENDANCE_STATUS } from "@/lib/attendance/constants";

export function gradeLabelFromLevel(gradeLevel) {
  if (gradeLevel == null || gradeLevel === "") return "Other";
  return `Grade ${gradeLevel}`;
}

export function gradeSortKey(grade) {
  const n = Number(String(grade).replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 999;
}

export function sectionDisplayName(section) {
  if (!section) return "Unassigned";
  return section.section_name || "Section";
}

export function formatGradeSection(section) {
  if (!section) return "—";
  const grade =
    section.grade_level != null ? `Grade ${section.grade_level}` : "";
  const name = section.section_name || "";
  return [grade, name].filter(Boolean).join(" · ") || "—";
}

export function isAtRiskStatus(status) {
  return (
    status === ATTENDANCE_STATUS.CRITICAL ||
    status === ATTENDANCE_STATUS.WARNING
  );
}

export function filterAttendanceRecords(records = [], { sectionId } = {}) {
  if (!sectionId) return records;
  return records.filter((row) => row.section_id === sectionId);
}

export function countByStatus(records = []) {
  return records.reduce(
    (acc, row) => {
      if (row.status === ATTENDANCE_STATUS.CRITICAL) acc.critical += 1;
      else if (row.status === ATTENDANCE_STATUS.WARNING) acc.warning += 1;
      else if (row.status === ATTENDANCE_STATUS.NORMAL) acc.normal += 1;
      else acc.unknown += 1;
      return acc;
    },
    { critical: 0, warning: 0, normal: 0, unknown: 0 }
  );
}

export function buildSectionGroups(records = []) {
  const bySection = new Map();

  for (const row of records) {
    const sectionId = row.section_id || "unknown";
    if (!bySection.has(sectionId)) {
      bySection.set(sectionId, {
        sectionId,
        section: row.section,
        sectionName: sectionDisplayName(row.section),
        grade: gradeLabelFromLevel(row.section?.grade_level),
        learners: [],
      });
    }
    bySection.get(sectionId).learners.push(row);
  }

  return [...bySection.values()]
    .map((group) => {
      const statusCounts = countByStatus(group.learners);
      return {
        ...group,
        learners: group.learners.sort(
          (a, b) => (b.absenceRate ?? 0) - (a.absenceRate ?? 0)
        ),
        count: group.learners.length,
        ...statusCounts,
      };
    })
    .sort((a, b) => a.sectionName.localeCompare(b.sectionName));
}

export function buildGradeFolders(records = []) {
  const sectionGroups = buildSectionGroups(records);
  const byGrade = new Map();

  for (const section of sectionGroups) {
    const grade = section.grade;
    if (!byGrade.has(grade)) {
      byGrade.set(grade, {
        grade,
        gradeLevel: section.section?.grade_level ?? null,
        sections: [],
        total: 0,
        critical: 0,
        warning: 0,
        normal: 0,
        unknown: 0,
      });
    }
    const folder = byGrade.get(grade);
    folder.sections.push(section);
    folder.total += section.count;
    folder.critical += section.critical;
    folder.warning += section.warning;
    folder.normal += section.normal;
    folder.unknown += section.unknown;
  }

  return [...byGrade.values()].sort(
    (a, b) => gradeSortKey(a.grade) - gradeSortKey(b.grade)
  );
}

export function getGradeAtRiskLearners(gradeFolder) {
  if (!gradeFolder) return [];
  const learners = [];
  for (const section of gradeFolder.sections) {
    for (const row of section.learners) {
      if (isAtRiskStatus(row.status)) learners.push(row);
    }
  }
  return learners.sort((a, b) => (b.absenceRate ?? 0) - (a.absenceRate ?? 0));
}

export function getGradeNormalLearners(gradeFolder) {
  if (!gradeFolder) return [];
  const learners = [];
  for (const section of gradeFolder.sections) {
    for (const row of section.learners) {
      if (row.status === ATTENDANCE_STATUS.NORMAL) learners.push(row);
    }
  }
  return learners.sort((a, b) =>
    String(a.learnerName || "").localeCompare(String(b.learnerName || ""))
  );
}

/**
 * Sort learners by section name, then absence rate (desc) or name for normal list.
 */
export function sortLearnersForDisplay(learners = [], { normal = false } = {}) {
  return [...learners].sort((a, b) => {
    const sectionCmp = sectionDisplayName(a.section).localeCompare(
      sectionDisplayName(b.section)
    );
    if (sectionCmp !== 0) return sectionCmp;
    if (normal) {
      return String(a.learnerName || "").localeCompare(
        String(b.learnerName || "")
      );
    }
    return (b.absenceRate ?? 0) - (a.absenceRate ?? 0);
  });
}
