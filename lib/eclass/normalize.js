/**
 * Shared string helpers for DepEd E-Class Record matching.
 */

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeKey(value) {
  return normalizeText(value)
    .toLowerCase()
    // Turn punctuation into spaces so "ABINGONA,REYDEN" == "ABINGONA, REYDEN"
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePersonName(value) {
  return normalizeKey(value)
    .replace(/^(sir|maam|ma'am|mr|mrs|ms|teacher)\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractGradeNumber(value) {
  const text = normalizeText(value);
  if (!text) return null;
  const match = text.match(/(?:grade\s*)?(\d{1,2})/i);
  if (!match) return null;
  const grade = Number(match[1]);
  return Number.isFinite(grade) ? grade : null;
}

/**
 * Split combined Class-Record labels like:
 * "7 SAMPAGUITA", "7 - SAMPAGUITA", "Grade 7 - Sampaguita"
 */
export function parseGradeAndSection(value) {
  const text = normalizeText(value);
  if (!text) {
    return { grade_level: null, grade_level_number: null, section: null };
  }

  const gradeNumber = extractGradeNumber(text);
  let section = null;

  const sectionMatch = text.match(
    /(?:grade\s*)?\d{1,2}\s*[-–—:]?\s*(.+)$/i
  );
  if (sectionMatch?.[1]) {
    section = normalizeText(
      sectionMatch[1]
        .replace(/^(grade\s*\d{1,2}\s*[-–—:]?\s*)/i, "")
        .replace(/^section\s*/i, "")
    );
  }

  if (section && /^grade\s*\d{1,2}$/i.test(section)) {
    section = null;
  }

  return {
    grade_level: gradeNumber != null ? `Grade ${gradeNumber}` : null,
    grade_level_number: gradeNumber,
    section: section || null,
  };
}

export function normalizeSchoolYear(value) {
  const text = normalizeText(value).toUpperCase();
  if (!text) return "";
  // "2026-2027" / "2026 - 27" or AVE-style "2026 2027"
  const hyphen = text.match(/(\d{4})\s*[-–—]\s*(\d{2,4})/);
  const spaced = !hyphen ? text.match(/(\d{4})\s+(\d{4})/) : null;
  const match = hyphen || spaced;
  if (!match) return normalizeKey(text);
  const start = match[1];
  let end = match[2];
  if (end.length === 2) end = `${start.slice(0, 2)}${end}`;
  return `${start}-${end}`;
}

export function normalizeSubject(value) {
  const key = normalizeKey(value);
  const aliases = {
    math: "mathematics",
    maths: "mathematics",
    mathematics: "mathematics",
    eng: "english",
    english: "english",
    sci: "science",
    science: "science",
    fil: "filipino",
    filipino: "filipino",
    ap: "araling panlipunan",
    "araling panlipunan": "araling panlipunan",
    mapeh: "mapeh",
    tle: "tle",
    "values education": "values education",
    ve: "values education",
    "learning area": key,
  };
  return aliases[key] ?? key;
}

export function cellText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return normalizeText(value);
}
