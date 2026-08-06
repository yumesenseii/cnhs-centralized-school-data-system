import {
  cellText,
  extractGradeNumber,
  normalizeKey,
  normalizeText,
} from "@/lib/eclass/normalize";
import { buildDummyStudentNumber } from "@/lib/eclass/dummyStudentNumber";
import { isSkippedName } from "@/lib/eclass/parseInputData";
import { getSheetCell, getSheetRange } from "@/lib/eclass/xlsxRead";

/**
 * DepEd AVE / Final Grades sheet — primary source for roster + quarterly grades.
 * Layout: LEARNERS' NAMES | FIRST TERM | SECOND TERM | THIRD TERM | AVERAGE
 * Gender bands: MALE then FEMALE (or labels in the name column).
 */

const AVE_SHEET_ALIASES = [
  "ave",
  "average",
  "averages",
  "final grades",
  "final grade",
  "summary",
];

const QUARTER_COLUMN_ALIASES = {
  1: [
    "first term",
    "1st term",
    "term 1",
    "term1",
    "term grade",
    "q1",
    "quarter 1",
    "1st quarter",
  ],
  2: [
    "second term",
    "2nd term",
    "term 2",
    "term2",
    "q2",
    "quarter 2",
    "2nd quarter",
  ],
  3: [
    "third term",
    "3rd term",
    "term 3",
    "term3",
    "q3",
    "quarter 3",
    "3rd quarter",
  ],
  4: [
    "final grade",
    "final grades",
    "general average",
    "final average",
    "average",
    "ave",
    "ga",
  ],
};

function isNameHeader(key) {
  if (!key) return false;
  return (
    key.includes("learners name") ||
    key.includes("learner name") ||
    key.includes("student name") ||
    key === "name" ||
    key === "names" ||
    key === "learner" ||
    key === "learners"
  );
}

function parseGradeValue(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.round(raw * 100) / 100;
  }
  const text = String(raw).replace(/,/g, "").trim();
  if (!text || /^[a-zA-Z]+$/.test(text)) return null;
  const num = Number(text);
  if (!Number.isFinite(num) || num < 0 || num > 100) return null;
  return Math.round(num * 100) / 100;
}

function scoreColumnAlias(key, aliases) {
  if (!key) return -1;
  for (const alias of aliases) {
    if (key === alias) return 100 + alias.length;
    if (key.includes(alias)) return 50 + alias.length;
  }
  return -1;
}

/**
 * Prefer FINAL GRADE over Average / AVE for quarter 4 on official ECR + SUMMARY.
 */
function scoreFinalGradeHeader(key) {
  if (!key) return -1;
  if (key === "final grade" || key === "final grades") return 200;
  if (key.includes("final grade")) return 180;
  return scoreColumnAlias(key, QUARTER_COLUMN_ALIASES[4]);
}

function buildFallbackStudentNumber(identity, seenNumbers) {
  return buildDummyStudentNumber(identity, seenNumbers);
}

export function findAveSheetName(sheetNames = []) {
  // Prefer official DepEd "AVE" before SUMMARY / Final Grades aliases.
  const exactPrefer = ["ave", "average", "averages", "final grades", "final grade"];
  for (const want of exactPrefer) {
    const hit = sheetNames.find((name) => normalizeKey(name) === want);
    if (hit) return hit;
  }

  let best = null;
  for (const name of sheetNames) {
    const key = normalizeKey(name);
    for (const alias of AVE_SHEET_ALIASES) {
      if (key.includes(alias)) {
        const score = alias.length;
        // Prefer AVE-like names over long "summary of grades" titles when tied.
        const boost = key === alias || key.startsWith("ave") ? 20 : 0;
        const total = score + boost;
        if (!best || total > best.score) best = { name, score: total };
      }
    }
  }
  return best?.name ?? null;
}

export function alternateNameKeys(fullName) {
  const text = String(fullName ?? "").trim();
  if (!text) return [];
  const keys = new Set();

  const commaParts = text
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (commaParts.length >= 2) {
    const last = commaParts[0];
    const rest = commaParts.slice(1).join(" ");
    keys.add(normalizeKey(`${rest} ${last}`));
    keys.add(normalizeKey(`${last} ${rest}`));
    keys.add(normalizeKey(commaParts.join(" ")));
  } else {
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const last = parts[parts.length - 1];
      const first = parts.slice(0, -1).join(" ");
      keys.add(normalizeKey(`${last}, ${first}`));
    }
  }

  return [...keys];
}

export function nameMatchKeys(fullName) {
  const primary = normalizeKey(fullName);
  return primary ? [primary, ...alternateNameKeys(fullName)] : [];
}

function findAveColumns(sheet, quarter) {
  const range = getSheetRange(sheet);
  let nameCol = null;
  let headerRow = range.s.r;
  const gradeColsByQuarter = {};
  const bestByQuarter = {};

  const headerEnd = Math.min(range.e.r, 40);
  for (let r = range.s.r; r <= headerEnd; r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const key = normalizeKey(cellText(getSheetCell(sheet, r, c)));
      if (!key) continue;

      if (isNameHeader(key)) {
        // Official / Class-Record: LEARNERS' NAMES merge often starts at col 0,
        // with names in col 1 (same as TERM sheets).
        nameCol = c === 0 ? Math.min(c + 1, range.e.c) : c;
        headerRow = Math.max(headerRow, r);
      }

      for (const q of [1, 2, 3, 4]) {
        const score =
          q === 4
            ? scoreFinalGradeHeader(key)
            : scoreColumnAlias(key, QUARTER_COLUMN_ALIASES[q]);
        if (score < 0) continue;
        const prev = bestByQuarter[q];
        if (
          !prev ||
          score > prev.score ||
          (score === prev.score && c > prev.col)
        ) {
          bestByQuarter[q] = { col: c, row: r, score };
          gradeColsByQuarter[q] = c;
          headerRow = Math.max(headerRow, r);
        }
      }
    }
  }

  if (nameCol === null) nameCol = range.s.c === 0 ? Math.min(1, range.e.c) : 0;

  const assignedQ = Number(quarter) || 1;
  let gradeCol = gradeColsByQuarter[assignedQ] ?? null;

  // Fallback: pick densest numeric column if assigned term header missing.
  if (gradeCol === null) {
    const sampleStart = headerRow + 1;
    let bestHits = 0;
    let bestCol = null;
    for (let c = nameCol + 1; c <= range.e.c; c += 1) {
      let hits = 0;
      for (
        let r = sampleStart;
        r <= Math.min(range.e.r, sampleStart + 40);
        r += 1
      ) {
        if (parseGradeValue(getSheetCell(sheet, r, c)) !== null) hits += 1;
      }
      if (hits >= 3 && hits > bestHits) {
        bestHits = hits;
        bestCol = c;
      }
    }
    if (bestCol !== null) {
      gradeCol = bestCol;
      if (gradeColsByQuarter[assignedQ] == null) {
        gradeColsByQuarter[assignedQ] = bestCol;
      }
    }
  }

  return {
    nameCol,
    gradeCol,
    gradeColsByQuarter,
    headerRow,
    maxRow: range.e.r,
  };
}

/**
 * Lightweight metadata from AVE header (fallback when INPUT DATA is incomplete).
 */
export function extractAveMetadata(sheet) {
  const metadata = {
    teacher_name: null,
    grade_level: null,
    grade_level_number: null,
    section: null,
    subject: null,
    school_year: null,
  };
  if (!sheet) return { metadata, missingLabels: [], foundLabels: [] };

  const range = getSheetRange(sheet);
  const maxRows = Math.min(range.e.r, 25);
  const maxCols = Math.min(range.e.c, 30);
  const foundLabels = [];

  for (let r = range.s.r; r <= maxRows; r += 1) {
    for (let c = range.s.c; c <= maxCols; c += 1) {
      const label = normalizeKey(cellText(getSheetCell(sheet, r, c)));
      if (!label) continue;

      const readValue = () => {
        for (let dc = 1; dc <= 6; dc += 1) {
          const value = cellText(getSheetCell(sheet, r, c + dc));
          if (value && !/^(teacher|subject|school year|grade|section)/i.test(value)) {
            return value;
          }
        }
        const below = cellText(getSheetCell(sheet, r + 1, c));
        if (below) return below;
        return "";
      };

      if (!metadata.school_year && (label === "school year" || label.includes("school year"))) {
        const value = readValue();
        if (value) {
          metadata.school_year = value;
          foundLabels.push("SCHOOL YEAR");
        }
      }

      if (!metadata.subject && (label === "subject" || label.startsWith("subject "))) {
        const value = readValue();
        if (value) {
          metadata.subject = value;
          foundLabels.push("SUBJECT");
        }
      }

      if (
        !metadata.teacher_name &&
        (label === "teacher" || label.includes("teacher"))
      ) {
        const value = readValue();
        if (value && /[a-zA-Z]/.test(value)) {
          metadata.teacher_name = value;
          foundLabels.push("TEACHER");
        }
      }

      // "Grade Level and Section" / Class-Record "Grade & Section"
      // → "8 - SAMPAGUITA" or "8 SAMPAGUITA"
      if (
        (!metadata.grade_level || !metadata.section) &&
        (label.includes("grade level") ||
          label.includes("grade and section") ||
          label.includes("grade section") ||
          (label.includes("grade") && label.includes("section")))
      ) {
        const value = readValue();
        if (value) {
          const gradeNum = extractGradeNumber(value);
          if (gradeNum !== null && !metadata.grade_level) {
            metadata.grade_level_number = gradeNum;
            metadata.grade_level = `Grade ${gradeNum}`;
            foundLabels.push("GRADE LEVEL");
          }
          const sectionMatch = value.match(
            /(?:grade\s*)?\d+\s*[-–—]?\s*(.+)$/i
          );
          if (sectionMatch?.[1] && !metadata.section) {
            metadata.section = normalizeText(sectionMatch[1]);
            foundLabels.push("SECTION");
          }
        }
      }

      if (!metadata.section && label === "section") {
        const value = readValue();
        if (value) {
          metadata.section = value;
          foundLabels.push("SECTION");
        }
      }
    }
  }

  const required = [
    "teacher_name",
    "grade_level",
    "section",
    "subject",
    "school_year",
  ];
  const missingLabels = required
    .filter((field) => !metadata[field])
    .map((field) => field.replace(/_/g, " ").toUpperCase());

  return { metadata, missingLabels, foundLabels };
}

/**
 * Parse AVE / SUMMARY OF GRADES into learners with Term 1–3 + Final grades.
 * `quarter` selects which term fills quarterly_grade (assigned class period).
 */
export function parseAveRoster(sheet, { quarter, sheetName, section = "" } = {}) {
  const label = "AVE";
  const assignedQuarter = Number(quarter) || 1;
  if (!sheet) {
    return {
      sheetName: null,
      label,
      quarter: assignedQuarter,
      learners: [],
      gradesByName: new Map(),
      grades: [],
      count: 0,
      error: "Worksheet not found: AVE",
    };
  }

  const columns = findAveColumns(sheet, assignedQuarter);
  const termCols = columns.gradeColsByQuarter ?? {};
  const hasAnyTermCol =
    columns.gradeCol !== null || Object.keys(termCols).length > 0;

  if (!hasAnyTermCol) {
    return {
      sheetName,
      label,
      quarter: assignedQuarter,
      learners: [],
      gradesByName: new Map(),
      grades: [],
      count: 0,
      error: `No FIRST/SECOND/THIRD TERM grade column found on AVE for quarter ${assignedQuarter}`,
    };
  }

  const learners = [];
  const gradesByName = new Map();
  const grades = [];
  const seenNumbers = new Set();
  let blankStreak = 0;
  let foundAny = false;
  let seenFemaleHeader = false;
  let currentSex = "Male";
  let maleIndex = 1;
  let femaleIndex = 1;
  const start = columns.headerRow + 1;
  const gradeCountByTerm = { 1: 0, 2: 0, 3: 0, 4: 0 };

  for (let r = start; r <= columns.maxRow; r += 1) {
    const name = cellText(getSheetCell(sheet, r, columns.nameCol));
    const key = normalizeKey(name);

    // Gender headers before isSkippedName (which treats male/female as skip labels).
    if (key === "male" || key.startsWith("male ")) {
      currentSex = "Male";
      blankStreak = 0;
      continue;
    }
    if (key === "female" || key.startsWith("female ")) {
      currentSex = "Female";
      seenFemaleHeader = true;
      blankStreak = 0;
      continue;
    }
    if (key.includes("highest possible") || key === "total") {
      blankStreak = 0;
      continue;
    }

    if (!name || isSkippedName(name)) {
      blankStreak += 1;
      // Never stop before FEMALE — Class-Record SUMMARY/AVE pads large male blocks.
      if (seenFemaleHeader && foundAny && blankStreak >= 30) break;
      continue;
    }

    blankStreak = 0;
    foundAny = true;

    const term_grades = {};
    for (const q of [1, 2, 3, 4]) {
      const col = termCols[q];
      if (col === null || col === undefined) continue;
      const value = parseGradeValue(getSheetCell(sheet, r, col));
      if (value === null) continue;
      term_grades[q] = value;
      gradeCountByTerm[q] += 1;
      grades.push({
        full_name: name,
        quarter: q,
        final_grade: value,
      });
    }

    // Fallback: assigned column only (legacy single-column sheets).
    if (
      Object.keys(term_grades).length === 0 &&
      columns.gradeCol !== null &&
      columns.gradeCol !== undefined
    ) {
      const value = parseGradeValue(
        getSheetCell(sheet, r, columns.gradeCol)
      );
      if (value !== null) {
        term_grades[assignedQuarter] = value;
        gradeCountByTerm[assignedQuarter] += 1;
        grades.push({
          full_name: name,
          quarter: assignedQuarter,
          final_grade: value,
        });
      }
    }

    const grade =
      term_grades[assignedQuarter] ??
      term_grades[1] ??
      term_grades[2] ??
      term_grades[3] ??
      term_grades[4] ??
      null;

    const index = currentSex === "Female" ? femaleIndex : maleIndex;
    if (currentSex === "Female") femaleIndex += 1;
    else maleIndex += 1;

    const studentNumber = buildFallbackStudentNumber(
      {
        fullName: name,
        sex: currentSex,
        index,
        section,
      },
      seenNumbers
    );

    learners.push({
      student_number: studentNumber,
      full_name: name,
      gender: currentSex,
      general_average: term_grades[4] ?? grade,
      weak_subject: null,
      subject_grades: {},
      quarterly_grade: grade,
      term_grades,
    });

    if (grade !== null) {
      gradesByName.set(key, grade);
      for (const alt of alternateNameKeys(name)) {
        if (!gradesByName.has(alt)) gradesByName.set(alt, grade);
      }
    }
  }

  return {
    sheetName,
    label,
    quarter: assignedQuarter,
    learners,
    gradesByName,
    grades,
    count: learners.length,
    gradesCount: grades.length,
    gradeCountByTerm,
    error: learners.length
      ? null
      : "No learner names were found on the AVE sheet.",
  };
}

/**
 * Merge Term 1–3 + Final grades from an AVE/SUMMARY roster onto learners by name.
 * Keeps existing term_grades keys (e.g. from TERM sheet) when already set.
 */
export function mergeMultiTermGradesOntoLearners(
  learners = [],
  aveLearners = [],
  { preferredQuarter = 1 } = {}
) {
  if (!learners.length || !aveLearners.length) return learners;

  const termGradesByName = new Map();
  for (const source of aveLearners) {
    const tg = source.term_grades ?? {};
    if (!Object.keys(tg).length) continue;
    for (const key of nameMatchKeys(source.full_name)) {
      if (!termGradesByName.has(key)) termGradesByName.set(key, tg);
    }
  }
  if (!termGradesByName.size) return learners;

  const q = Number(preferredQuarter) || 1;

  return learners.map((learner) => {
    let fromAve = null;
    for (const key of nameMatchKeys(learner.full_name)) {
      if (termGradesByName.has(key)) {
        fromAve = termGradesByName.get(key);
        break;
      }
    }
    if (!fromAve) return learner;

    const merged = { ...fromAve, ...(learner.term_grades ?? {}) };
    const quarterly =
      merged[q] ??
      learner.quarterly_grade ??
      merged[1] ??
      merged[2] ??
      merged[3] ??
      merged[4] ??
      null;

    return {
      ...learner,
      term_grades: merged,
      quarterly_grade: quarterly,
      general_average: merged[4] ?? quarterly ?? learner.general_average,
    };
  });
}

/**
 * @deprecated Prefer parseAveRoster — kept for callers that only need gradesByName.
 */
export function parseAveSheet(sheet, options = {}) {
  const roster = parseAveRoster(sheet, options);
  return {
    sheetName: roster.sheetName,
    label: roster.label,
    quarter: roster.quarter,
    gradesByName: roster.gradesByName,
    grades: roster.grades,
    count: roster.gradesCount ?? roster.grades.length,
    error: roster.error,
  };
}

/**
 * Apply real LRNs from INPUT DATA learners onto AVE roster by name match.
 */
export function backfillLrnFromInputData(aveLearners = [], inputLearners = []) {
  if (!aveLearners.length || !inputLearners.length) return aveLearners;

  const lrnByName = new Map();
  for (const learner of inputLearners) {
    const number = String(learner.student_number ?? "").trim();
    if (!number || number.startsWith("ECR-")) continue;
    for (const key of nameMatchKeys(learner.full_name)) {
      if (!lrnByName.has(key)) lrnByName.set(key, number);
    }
  }

  if (!lrnByName.size) return aveLearners;

  const used = new Set();
  return aveLearners.map((learner) => {
    for (const key of nameMatchKeys(learner.full_name)) {
      const lrn = lrnByName.get(key);
      if (!lrn || used.has(lrn)) continue;
      used.add(lrn);
      return { ...learner, student_number: lrn };
    }
    return learner;
  });
}

/**
 * Merge metadata: prefer INPUT DATA fields, fill gaps from AVE.
 */
export function mergeEcrMetadata(primary, fallback) {
  const base = primary ?? {};
  const extra = fallback ?? {};
  return {
    teacher_name: base.teacher_name || extra.teacher_name || null,
    grade_level: base.grade_level || extra.grade_level || null,
    grade_level_number:
      base.grade_level_number ?? extra.grade_level_number ?? null,
    section: base.section || extra.section || null,
    subject: base.subject || extra.subject || null,
    school_year: base.school_year || extra.school_year || null,
  };
}
