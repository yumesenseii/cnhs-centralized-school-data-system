import { cellText, normalizeKey } from "@/lib/eclass/normalize";
import { buildDummyStudentNumber } from "@/lib/eclass/dummyStudentNumber";
import {
  DEPED_ADJUSTED_TRANSMUTATION,
  transmuteInitialGrade,
} from "@/lib/eclass/depedTransmutation";
import { isSkippedName } from "@/lib/eclass/parseInputData";
import { getSheetCell, getSheetRange } from "@/lib/eclass/xlsxRead";

/**
 * Simple approach: for the assigned quarter, read one sheet that is
 * basically Name + final grade. Accept official DepEd TERM tabs and
 * common aliases (Q1, Quarter 1, etc.).
 */
const TERM_SPECS = [
  {
    quarter: 1,
    sheetAliases: [
      "term 1",
      "term1",
      "first term",
      "1st term",
      "quarter 1",
      "1st quarter",
      "first quarter",
      "q1",
    ],
    label: "TERM 1",
  },
  {
    quarter: 2,
    sheetAliases: [
      "term 2",
      "term2",
      "second term",
      "2nd term",
      "quarter 2",
      "2nd quarter",
      "second quarter",
      "q2",
    ],
    label: "TERM 2",
  },
  {
    quarter: 3,
    sheetAliases: [
      "term 3",
      "term3",
      "third term",
      "3rd term",
      "quarter 3",
      "3rd quarter",
      "third quarter",
      "q3",
    ],
    label: "TERM 3",
  },
];

export { TERM_SPECS };

export function resolveAssignedQuarter(options = {}) {
  const raw =
    options.quarter ??
    options.assignedClass?.quarter ??
    options.assignedClass?.currentQuarter ??
    options.assignedClass?.quarterLabel ??
    null;

  const number = Number(String(raw ?? "").replace(/\D/g, ""));
  if (Number.isFinite(number) && number >= 1 && number <= 3) return number;
  if (Number.isFinite(number) && number === 4) return 3;
  return 1;
}

export function findTermSheetName(sheetNames = [], quarter) {
  const spec =
    TERM_SPECS.find((item) => item.quarter === Number(quarter)) ?? TERM_SPECS[0];

  // Prefer exact / stronger matches first (e.g. "TERM 1" over a long title).
  let best = null;
  for (const name of sheetNames) {
    const key = normalizeKey(name);
    for (const alias of spec.sheetAliases) {
      if (key === alias) {
        return { name, label: spec.label, quarter: spec.quarter };
      }
      if (key.includes(alias)) {
        const score = alias.length;
        if (!best || score > best.score) {
          best = { name, score };
        }
      }
    }
  }

  if (best) {
    return { name: best.name, label: spec.label, quarter: spec.quarter };
  }

  return { name: null, label: spec.label, quarter: spec.quarter };
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

function scoreGradeHeader(key) {
  if (!key) return -1;
  // TERM GRADE is the only value we store for Term 1–3.
  if (key === "term grade" || key.includes("term grade")) return 100;
  if (key.includes("transmuted grade") || key === "transmuted") return 90;
  if (key.includes("quarterly grade") || key === "qg") return 85;
  if (key === "final grade" || key.includes("final grade")) return 80;
  // Initial Grade is NEVER selected as the stored grade column.
  if (key.includes("initial grade") || key === "initial") return -1;
  // Simple dummy / summary sheets
  if (key === "grade" || key === "grades") return 60;
  if (key === "score" || key === "scores") return 55;
  if (key.includes("final") && key.includes("grade")) return 75;
  return -1;
}

function isInitialGradeHeader(key) {
  if (!key) return false;
  return key.includes("initial grade") || key === "initial";
}

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

/**
 * Locate learner name + final grade columns on a quarter sheet.
 * Scans a wider header band so simple Name|Grade sheets also work.
 */
function findTermColumns(sheet) {
  const range = getSheetRange(sheet);
  let nameCol = null;
  let gradeCol = null;
  let initialGradeCol = null;
  let headerRow = range.s.r;
  let bestGrade = null;
  let foundNameHeader = false;

  const headerEnd = Math.min(range.e.r, 30);
  for (let r = range.s.r; r <= headerEnd; r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const key = normalizeKey(cellText(getSheetCell(sheet, r, c)));
      if (!key) continue;

      if (isNameHeader(key)) {
        // Official layout: LEARNERS' NAMES merge often starts at col 0, names in col 1
        nameCol = c === 0 ? Math.min(c + 1, range.e.c) : c;
        headerRow = r;
        foundNameHeader = true;
      }

      if (isInitialGradeHeader(key)) {
        initialGradeCol = c;
        headerRow = Math.max(headerRow, r);
      }

      const score = scoreGradeHeader(key);
      if (score < 0) continue;
      // Prefer Term Grade over Initial Grade for the primary grade column.
      if (isInitialGradeHeader(key) && bestGrade && bestGrade.score >= 100) {
        continue;
      }
      if (
        !bestGrade ||
        score > bestGrade.score ||
        (score === bestGrade.score && c > bestGrade.col)
      ) {
        bestGrade = { col: c, row: r, score };
        gradeCol = c;
        headerRow = Math.max(headerRow, r);
      }
    }
  }

  // Fallback for minimal sheets: names usually in column B on Class Record.
  if (nameCol === null) {
    nameCol = range.s.c === 0 ? Math.min(1, range.e.c) : range.s.c;
  }
  if (gradeCol === null && foundNameHeader) {
    const sampleStart = headerRow + 1;
    let bestHits = 0;
    let bestCol = null;
    // Class-Record Term Grade often sits far right (e.g. column AA).
    for (let c = nameCol + 1; c <= range.e.c; c += 1) {
      let hits = 0;
      for (
        let r = sampleStart;
        r <= Math.min(range.e.r, sampleStart + 50);
        r += 1
      ) {
        if (parseGradeValue(getSheetCell(sheet, r, c)) !== null) hits += 1;
      }
      if (hits >= 2 && hits > bestHits) {
        bestHits = hits;
        bestCol = c;
      }
    }
    if (bestCol !== null) gradeCol = bestCol;
  }

  // If primary column is Initial Grade, keep it; also allow Initial as fallback col.
  if (
    initialGradeCol === null &&
    bestGrade &&
    bestGrade.score === 70
  ) {
    initialGradeCol = gradeCol;
  }

  return {
    nameCol: nameCol ?? 1,
    gradeCol,
    initialGradeCol:
      initialGradeCol !== null && initialGradeCol !== gradeCol
        ? initialGradeCol
        : initialGradeCol,
    headerRow,
    maxRow: range.e.r,
  };
}

/**
 * Locate WW / PT / QA score groups from the HIGHEST POSSIBLE SCORE row.
 * Groups are runs of item max-scores ending at a weight cell (0 < w ≤ 1).
 */
function findComponentGroups(sheet, columns) {
  const range = getSheetRange(sheet);
  let hpsRow = null;
  const scanEnd = Math.min(range.e.r, (columns?.headerRow ?? 0) + 12);
  for (let r = range.s.r; r <= scanEnd; r += 1) {
    for (let c = range.s.c; c <= Math.min(range.e.c, 8); c += 1) {
      const key = normalizeKey(cellText(getSheetCell(sheet, r, c)));
      if (key.includes("highest possible")) {
        hpsRow = r;
        break;
      }
    }
    if (hpsRow !== null) break;
  }
  if (hpsRow === null) return [];

  const startCol = Math.max((columns?.nameCol ?? 1) + 1, range.s.c);
  const endCol = Math.min(
    range.e.c,
    columns?.gradeCol != null ? columns.gradeCol - 1 : range.e.c
  );

  const groups = [];
  let itemCols = [];
  let itemHps = [];

  for (let c = startCol; c <= endCol; c += 1) {
    const raw = getSheetCell(sheet, hpsRow, c);
    const num =
      typeof raw === "number"
        ? raw
        : Number(String(raw ?? "").replace(/,/g, "").trim());
    // Blank Total/gap cells must not wipe the item run before PS/WS.
    if (!Number.isFinite(num) || num <= 0) {
      continue;
    }

    // Weight cell (e.g. 0.2 / 0.5 / 0.3)
    if (num > 0 && num <= 1) {
      if (itemCols.length) {
        groups.push({
          itemCols: [...itemCols],
          itemHps: [...itemHps],
          weight: num,
        });
      }
      itemCols = [];
      itemHps = [];
      continue;
    }

    // Skip Percentage Score caps (always 100 before WS on Class Record).
    if (num === 100) {
      continue;
    }

    // Item highest possible score (e.g. 25, 50, 30)
    if (num > 1 && num < 100) {
      itemCols.push(c);
      itemHps.push(num);
    }
  }

  return groups;
}

function computeInitialFromComponents(sheet, rowIndex, columns) {
  const groups = findComponentGroups(sheet, columns);
  if (!groups.length) return null;

  let initial = 0;
  let usedGroups = 0;

  for (const group of groups) {
    let earned = 0;
    let possible = 0;
    let scoredItems = 0;
    for (let i = 0; i < group.itemCols.length; i += 1) {
      const score = parseGradeValue(
        getSheetCell(sheet, rowIndex, group.itemCols[i])
      );
      const hps = group.itemHps[i];
      if (score === null || !hps) continue;
      // Raw component scores can exceed 100 (e.g. out of 25/50).
      const capped = Math.min(score, hps);
      earned += capped;
      possible += hps;
      scoredItems += 1;
    }
    if (!scoredItems || possible <= 0) continue;
    const ps = (earned / possible) * 100;
    initial += ps * group.weight;
    usedGroups += 1;
  }

  if (!usedGroups) return null;
  return initial;
}

/**
 * Read TERM GRADE only (never Initial Grade as the stored value).
 * When TERM GRADE is empty, derive it via DepEd transmutation from Initial
 * Grade or from WW/PT/QA components.
 */
function readRowGrade(
  sheet,
  rowIndex,
  columns,
  transmuteTable = DEPED_ADJUSTED_TRANSMUTATION
) {
  // 1) Prefer TERM GRADE column value when Excel saved it.
  const termGrade =
    columns.gradeCol !== null && columns.gradeCol !== undefined
      ? parseGradeValue(getSheetCell(sheet, rowIndex, columns.gradeCol))
      : null;
  if (termGrade !== null) return termGrade;

  // 2) Initial Grade cell → transmute to TERM GRADE (do not store Initial).
  if (
    columns.initialGradeCol !== null &&
    columns.initialGradeCol !== undefined &&
    columns.initialGradeCol !== columns.gradeCol
  ) {
    const initial = parseGradeValue(
      getSheetCell(sheet, rowIndex, columns.initialGradeCol)
    );
    if (initial !== null) {
      return transmuteInitialGrade(initial, transmuteTable);
    }
  }

  // 3) Component scores only (common when formulas were not cached).
  const computedInitial = computeInitialFromComponents(
    sheet,
    rowIndex,
    columns
  );
  if (computedInitial !== null) {
    return transmuteInitialGrade(computedInitial, transmuteTable);
  }

  return null;
}

/**
 * Read learner name + final grade from the assigned quarter sheet.
 * Tolerates official DepEd spacer/label rows before the first learner.
 */
export function parseAssignedTermSheet(
  sheet,
  { quarter, label, sheetName, transmuteTable = DEPED_ADJUSTED_TRANSMUTATION }
) {
  if (!sheet) {
    return {
      sheetName: null,
      label,
      quarter,
      gradesByName: new Map(),
      grades: [],
      count: 0,
      error: `Worksheet not found: ${label}`,
    };
  }

  const columns = findTermColumns(sheet);
  if (columns.gradeCol === null) {
    return {
      sheetName,
      label,
      quarter,
      gradesByName: new Map(),
      grades: [],
      count: 0,
      error: `No Term Grade column found on ${label}`,
    };
  }

  const gradesByName = new Map();
  const grades = [];
  let blankStreak = 0;
  let foundAny = false;
  let seenFemaleHeader = false;
  const start = columns.headerRow + 1;

  for (let r = start; r <= columns.maxRow; r += 1) {
    const name = cellText(getSheetCell(sheet, r, columns.nameCol));
    const key = normalizeKey(name);

    if (key === "male" || key.startsWith("male ")) {
      blankStreak = 0;
      continue;
    }
    if (key === "female" || key.startsWith("female ")) {
      seenFemaleHeader = true;
      blankStreak = 0;
      continue;
    }
    if (key.includes("highest possible")) {
      blankStreak = 0;
      continue;
    }

    if (!name || isSkippedName(name)) {
      blankStreak += 1;
      // Never stop before FEMALE — Class-Record reserves large male spacer blocks.
      if (seenFemaleHeader && foundAny && blankStreak >= 30) break;
      continue;
    }

    blankStreak = 0;
    const grade = readRowGrade(sheet, r, columns, transmuteTable);
    if (grade === null) continue;

    foundAny = true;
    gradesByName.set(key, grade);
    for (const alt of alternateNameKeys(name)) {
      if (!gradesByName.has(alt)) gradesByName.set(alt, grade);
    }

    grades.push({
      full_name: name,
      quarter,
      final_grade: grade,
    });
  }

  return {
    sheetName,
    label,
    quarter,
    gradesByName,
    grades,
    count: grades.length,
    error: null,
  };
}

/**
 * Class-Record-v1 path: build full roster + Term Grades from a TERM sheet
 * (no AVE). Tracks Male/Female blocks and assigns dummy student numbers.
 */
export function buildRosterFromTermSheet(
  sheet,
  {
    quarter,
    label,
    sheetName,
    section = "",
    transmuteTable = DEPED_ADJUSTED_TRANSMUTATION,
  } = {}
) {
  if (!sheet) {
    return {
      ok: false,
      sheetName: null,
      label,
      quarter,
      learners: [],
      gradesByName: new Map(),
      grades: [],
      count: 0,
      error: `Worksheet not found: ${label}. Class-Record-v1 needs TERM1–TERM3 sheets.`,
    };
  }

  const columns = findTermColumns(sheet);
  // Names-only is OK for Class-Record when Term Grade cells are blank formulas.
  // gradeCol may still be null if the header row uses nonstandard labels.

  const gradesByName = new Map();
  const grades = [];
  const learners = [];
  const seenNumbers = new Set();
  let currentSex = null;
  let maleIndex = 1;
  let femaleIndex = 1;
  let blankStreak = 0;
  let foundAny = false;
  let seenFemaleHeader = false;
  const start = columns.headerRow + 1;

  for (let r = start; r <= columns.maxRow; r += 1) {
    const name = cellText(getSheetCell(sheet, r, columns.nameCol));
    const nameKey = normalizeKey(name);

    // Gender headers before isSkippedName (male/female are skip labels there).
    if (nameKey === "male" || nameKey.startsWith("male ")) {
      currentSex = "Male";
      blankStreak = 0;
      continue;
    }
    if (nameKey === "female" || nameKey.startsWith("female ")) {
      currentSex = "Female";
      seenFemaleHeader = true;
      blankStreak = 0;
      continue;
    }
    if (nameKey.includes("highest possible")) {
      blankStreak = 0;
      continue;
    }

    if (!name || isSkippedName(name)) {
      blankStreak += 1;
      // Never stop before FEMALE — Class-Record templates pad 20–40+ empty male rows.
      if (seenFemaleHeader && foundAny && blankStreak >= 30) break;
      continue;
    }

    blankStreak = 0;
    foundAny = true;

    const grade = readRowGrade(sheet, r, columns, transmuteTable);
    const sex = currentSex || "Male";
    const index = sex === "Female" ? femaleIndex : maleIndex;
    if (sex === "Female") femaleIndex += 1;
    else maleIndex += 1;

    const studentNumber = buildDummyStudentNumber(
      {
        fullName: name,
        sex,
        index,
        section,
      },
      seenNumbers
    );

    const term_grades =
      grade === null || grade === undefined ? {} : { [quarter]: grade };

    learners.push({
      student_number: studentNumber,
      full_name: name,
      gender: sex,
      general_average: grade,
      weak_subject: null,
      subject_grades: {},
      quarterly_grade: grade,
      term_grades,
    });

    if (grade !== null && grade !== undefined) {
      gradesByName.set(nameKey, grade);
      for (const alt of alternateNameKeys(name)) {
        if (!gradesByName.has(alt)) gradesByName.set(alt, grade);
      }
      grades.push({
        full_name: name,
        quarter,
        final_grade: grade,
      });
    }
  }

  if (!learners.length) {
    return {
      ok: false,
      sheetName,
      label,
      quarter,
      learners: [],
      gradesByName,
      grades: [],
      count: 0,
      error: `No learner names were found on ${label}. Check the LEARNERS' NAMES column on the Class Record TERM sheet.`,
    };
  }

  // Accept roster even when Term Grade formulas have no cached values.
  return {
    ok: true,
    sheetName,
    label,
    quarter,
    learners,
    gradesByName,
    grades,
    count: learners.length,
    gradesCount: grades.length,
    error:
      grades.length === 0
        ? `Learner names were found on ${label}, but no Term Grades could be read from cached cell values.`
        : null,
  };
}

function alternateNameKeys(fullName) {
  const text = String(fullName ?? "").trim();
  if (!text) return [];
  const keys = new Set();

  const commaParts = text.split(",").map((p) => p.trim()).filter(Boolean);
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

function lookupGrade(map, fullName) {
  const key = normalizeKey(fullName);
  if (map.has(key)) return map.get(key);
  for (const alt of alternateNameKeys(fullName)) {
    if (map.has(alt)) return map.get(alt);
  }
  return undefined;
}

/**
 * Attach the assigned quarter's term grade onto learners.
 * gradesAttached = how many INPUT DATA learners received a matched grade.
 */
export function attachAssignedTermGrades(learners, termResult) {
  const quarter = Number(termResult?.quarter) || 1;
  const map = termResult?.gradesByName ?? new Map();
  let matched = 0;

  const nextLearners = (learners ?? []).map((learner) => {
    const grade = lookupGrade(map, learner.full_name);
    const term_grades =
      grade === undefined || grade === null
        ? { ...(learner.term_grades ?? {}) }
        : { ...(learner.term_grades ?? {}), [quarter]: grade };

    if (grade !== undefined && grade !== null) matched += 1;

    return {
      ...learner,
      term_grades,
      quarterly_grade: grade ?? learner.quarterly_grade ?? null,
      general_average: grade ?? learner.general_average ?? null,
    };
  });

  return {
    learners: nextLearners,
    grades: termResult?.grades ?? [],
    gradesAttached: matched,
    gradeCounts: {
      [termResult?.label || `TERM ${quarter}`]: matched,
      parsedFromSheet: termResult?.count ?? 0,
    },
  };
}

/**
 * When TERM/SUMMARY name cells are empty (formula retrieval from INPUT with no
 * cached values), attach Term Grade by matching INPUT `source_row` to the TERM sheet.
 */
export function attachTermGradesBySourceRow(
  learners = [],
  sheet,
  {
    quarter = 1,
    label = "TERM",
    sheetName = null,
    transmuteTable = DEPED_ADJUSTED_TRANSMUTATION,
  } = {}
) {
  if (!sheet || !learners.length) {
    return {
      learners,
      grades: [],
      gradesAttached: 0,
      gradeCounts: { [label]: 0 },
    };
  }

  const columns = findTermColumns(sheet);
  let matched = 0;
  const grades = [];

  const nextLearners = learners.map((learner) => {
    const row = Number(learner.source_row);
    if (!Number.isFinite(row)) return learner;

    const grade = readRowGrade(sheet, row, columns, transmuteTable);
    if (grade === null || grade === undefined) return learner;

    matched += 1;
    grades.push({
      full_name: learner.full_name,
      quarter,
      final_grade: grade,
    });

    return {
      ...learner,
      term_grades: { ...(learner.term_grades ?? {}), [quarter]: grade },
      quarterly_grade: grade,
      general_average: grade,
    };
  });

  return {
    learners: nextLearners,
    grades,
    gradesAttached: matched,
    gradeCounts: {
      [label]: matched,
      parsedFromSheet: matched,
      sheetName,
    },
  };
}
