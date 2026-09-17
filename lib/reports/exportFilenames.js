/**
 * Shared Windows-safe export filenames (em dash style).
 * Scope rules:
 * - Section: Daily — G{#} {Section} — {Month} — {SY}
 * - School:  Daily — School — {Month} — {SY}
 * - Reports school: Reports — School — {Term} — {SY}
 * - Class: Class — {Grade Section} — {Subject} — {Term} — {SY}
 */

export function formatSchoolYearForFilename(value) {
  const year = String(value ?? "").trim();
  if (!year) return "SY";
  if (/^sy\b/i.test(year)) return year;
  return `SY ${year}`;
}

export function windowsSafeFilename(name, maxLen = 150) {
  return (
    String(name ?? "")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxLen) || "CNHS Export"
  );
}

/** Join parts with " — " and optionally append .ext */
export function buildExportFilename(parts = [], ext = "") {
  const base = windowsSafeFilename(
    parts
      .map((part) => String(part ?? "").trim())
      .filter(Boolean)
      .join(" — ")
  );
  if (!ext) return base;
  const suffix = ext.startsWith(".") ? ext : `.${ext}`;
  return `${base}${suffix}`;
}

export function gradeSectionScopeLabel({
  grade,
  gradeLevel,
  sectionName,
  section_name,
  gradeSection,
} = {}) {
  if (gradeSection) return String(gradeSection).trim();
  const g = grade ?? gradeLevel;
  const name = sectionName ?? section_name ?? "Section";
  if (g != null && String(g).trim() !== "") {
    return `G${g} ${name}`.trim();
  }
  return String(name).trim() || "Section";
}

export function dailySchoolFilename({
  monthName,
  schoolYear,
  ext = "xlsx",
} = {}) {
  return buildExportFilename(
    [
      "Daily",
      "School",
      monthName || "Month",
      formatSchoolYearForFilename(schoolYear),
    ],
    ext
  );
}

export function dailySectionFilename({
  section,
  grade,
  sectionName,
  monthName,
  schoolYear,
  ext = "xlsx",
} = {}) {
  const scope = gradeSectionScopeLabel({
    grade: grade ?? section?.grade_level ?? section?.gradeLevel,
    sectionName:
      sectionName ?? section?.section_name ?? section?.sectionName,
  });
  return buildExportFilename(
    [
      "Daily",
      scope,
      monthName || "Month",
      formatSchoolYearForFilename(schoolYear),
    ],
    ext
  );
}

/** Multi-month section pack: Daily — G# Section — {SY} */
export function dailySectionYearFilename({
  section,
  schoolYear,
  ext = "xlsx",
} = {}) {
  const scope = gradeSectionScopeLabel({
    grade: section?.grade_level ?? section?.gradeLevel,
    sectionName: section?.section_name ?? section?.sectionName,
  });
  return buildExportFilename(
    ["Daily", scope, formatSchoolYearForFilename(schoolYear)],
    ext
  );
}

export function dailyLearnerFilename({
  learnerName,
  monthName,
  schoolYear,
  ext = "xlsx",
} = {}) {
  return buildExportFilename(
    [
      "Daily",
      learnerName || "Learner",
      monthName || "Month",
      formatSchoolYearForFilename(schoolYear),
    ],
    ext
  );
}

export function reportsSchoolFilename({
  schoolYear,
  termLabel: term,
  ext = "xlsx",
} = {}) {
  return buildExportFilename(
    [
      "Reports",
      "School",
      term || "All Terms",
      formatSchoolYearForFilename(schoolYear),
    ],
    ext
  );
}

export function reportsClassFilename({
  gradeSection,
  subject,
  termLabel: term,
  schoolYear,
  ext = "xlsx",
} = {}) {
  return buildExportFilename(
    [
      "Class",
      gradeSection || "Section",
      subject || "Subject",
      term || "Term",
      formatSchoolYearForFilename(schoolYear),
    ],
    ext
  );
}
