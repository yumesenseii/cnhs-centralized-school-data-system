import {
  cellText,
  extractGradeNumber,
  normalizeKey,
  normalizeText,
  parseGradeAndSection,
} from "@/lib/eclass/normalize";
import { buildDummyStudentNumber } from "@/lib/eclass/dummyStudentNumber";
import { getSheetCell, getSheetRange } from "@/lib/eclass/xlsxRead";

/**
 * Official DepEd JHS ECR metadata labels (searched by text, not fixed cells).
 */
const METADATA_FIELDS = [
  {
    field: "teacher_name",
    label: "TEACHER",
    aliases: [
      "teacher",
      "teachers name",
      "teacher's name",
      "name of teacher",
      "subject teacher",
    ],
  },
  {
    field: "grade_and_section",
    label: "GRADE & SECTION",
    aliases: [
      "grade section",
      "grade and section",
      "grade sec",
      "grade and sec",
      "grade level and section",
      "grade level section",
    ],
  },
  {
    field: "grade_level",
    label: "GRADE LEVEL",
    aliases: ["grade level", "grade lvl", "yr level", "year level"],
  },
  {
    field: "section",
    label: "SECTION",
    aliases: ["section", "section name"],
  },
  {
    field: "subject",
    label: "SUBJECT",
    aliases: [
      "subject",
      "learning area",
      "subject learning area",
      "subject / learning area",
      "subject/learning area",
    ],
  },
  {
    field: "school_year",
    label: "SCHOOL YEAR",
    aliases: [
      "school year",
      "schoolyear",
      "school yr",
      "academic year",
      "sy",
    ],
  },
];

export function findInputDataSheetName(sheetNames = []) {
  const preferred = sheetNames.find((name) =>
    normalizeKey(name).includes("input data")
  );
  if (preferred) return preferred;
  return sheetNames.find((name) => normalizeKey(name) === "input") ?? null;
}

function labelKey(raw) {
  return normalizeKey(String(raw ?? "").replace(/[:*]/g, ""));
}

function matchMetadataField(rawLabel) {
  const key = labelKey(rawLabel);
  if (!key) return null;

  if (key.includes(" and ") || key.includes(",")) return null;
  if (key.split(/\s+/).length > 3) return null;

  for (const entry of METADATA_FIELDS) {
    for (const alias of entry.aliases) {
      if (key === alias) return entry;
    }
  }

  for (const entry of METADATA_FIELDS) {
    for (const alias of entry.aliases) {
      if (alias.includes(" ") && key.startsWith(`${alias} `)) return entry;
    }
  }

  return null;
}

function isMetadataLabelCell(value) {
  return Boolean(matchMetadataField(value));
}

function isIgnorableMetadataValue(value) {
  const text = normalizeText(value);
  if (!text) return true;
  if (/^[:\-=_|./\\]+$/.test(text)) return true;
  if (/^\(.*\)$/.test(text)) return true;
  return false;
}

function isPlausibleMetadataValue(field, value) {
  const text = normalizeText(value);
  if (!text || isIgnorableMetadataValue(text)) return false;

  if (field === "teacher_name") {
    return /[a-zA-Z]/.test(text) && !/^\d+$/.test(text);
  }
  if (field === "grade_level") {
    return extractGradeNumber(text) !== null || /grade/i.test(text);
  }
  if (field === "grade_and_section") {
    return extractGradeNumber(text) !== null;
  }
  if (field === "section" || field === "subject") {
    return /[a-zA-Z]/.test(text);
  }
  if (field === "school_year") {
    return /\d{4}/.test(text);
  }
  return true;
}

function readNeighborValue(sheet, rowIndex, colIndex, field) {
  const same = cellText(getSheetCell(sheet, rowIndex, colIndex));
  const split = same.split(/[:]/);
  if (split.length > 1) {
    const maybe = normalizeText(split.slice(1).join(":"));
    if (
      maybe &&
      !isMetadataLabelCell(maybe) &&
      isPlausibleMetadataValue(field, maybe)
    ) {
      return maybe;
    }
  }

  for (let c = colIndex + 1; c <= colIndex + 10; c += 1) {
    const value = cellText(getSheetCell(sheet, rowIndex, c));
    if (!value) continue;
    if (isIgnorableMetadataValue(value)) continue;
    if (isMetadataLabelCell(value)) break;
    if (!isPlausibleMetadataValue(field, value)) continue;
    return value;
  }

  for (let rOffset = 1; rOffset <= 2; rOffset += 1) {
    const below = cellText(getSheetCell(sheet, rowIndex + rOffset, colIndex));
    if (
      below &&
      !isMetadataLabelCell(below) &&
      isPlausibleMetadataValue(field, below)
    ) {
      return below;
    }

    const belowRight = cellText(
      getSheetCell(sheet, rowIndex + rOffset, colIndex + 1)
    );
    if (
      belowRight &&
      !isMetadataLabelCell(belowRight) &&
      isPlausibleMetadataValue(field, belowRight)
    ) {
      return belowRight;
    }
  }

  return "";
}

export function extractMetadata(sheet) {
  const metadata = {
    teacher_name: null,
    grade_level: null,
    grade_level_number: null,
    section: null,
    subject: null,
    school_year: null,
    grade_and_section: null,
  };
  const foundLabels = new Set();
  const missingLabels = [];
  const range = getSheetRange(sheet);
  const maxRows = Math.min(range.e.r, 80);
  // Class-Record-v1 places teacher/subject further right than official INPUT DATA.
  const maxCols = Math.min(range.e.c, 45);

  for (let r = range.s.r; r <= maxRows; r += 1) {
    for (let c = range.s.c; c <= maxCols; c += 1) {
      const label = cellText(getSheetCell(sheet, r, c));
      if (!label) continue;
      const entry = matchMetadataField(label);
      if (!entry || metadata[entry.field]) continue;

      const value = readNeighborValue(sheet, r, c, entry.field);
      if (!value) continue;

      metadata[entry.field] = value;
      foundLabels.add(entry.label);
    }
  }

  if (metadata.grade_and_section) {
    const parsed = parseGradeAndSection(metadata.grade_and_section);
    if (!metadata.grade_level && parsed.grade_level) {
      metadata.grade_level = parsed.grade_level;
      metadata.grade_level_number = parsed.grade_level_number;
      foundLabels.add("GRADE LEVEL");
    }
    if (!metadata.section && parsed.section) {
      metadata.section = parsed.section;
      foundLabels.add("SECTION");
    }
  }

  // Sometimes grade_level cell itself holds "7 SAMPAGUITA".
  if (metadata.grade_level && !metadata.section) {
    const parsed = parseGradeAndSection(metadata.grade_level);
    if (parsed.grade_level) {
      metadata.grade_level = parsed.grade_level;
      metadata.grade_level_number = parsed.grade_level_number;
    }
    if (parsed.section) {
      metadata.section = parsed.section;
      foundLabels.add("SECTION");
    }
  }

  if (metadata.grade_level) {
    const gradeNumber =
      metadata.grade_level_number ?? extractGradeNumber(metadata.grade_level);
    metadata.grade_level_number = gradeNumber;
    metadata.grade_level = gradeNumber
      ? `Grade ${gradeNumber}`
      : metadata.grade_level;
  }

  delete metadata.grade_and_section;

  for (const entry of METADATA_FIELDS) {
    if (entry.field === "grade_and_section") continue;
    if (!metadata[entry.field]) missingLabels.push(entry.label);
  }

  return { metadata, missingLabels, foundLabels: [...foundLabels] };
}

function isLrnHeader(key) {
  if (!key) return false;
  return (
    key === "lrn" ||
    key.includes("lrn") ||
    key.includes("learner reference") ||
    key === "student number" ||
    key === "student no" ||
    key.includes("student number")
  );
}

function isMaleHeader(key) {
  if (!key) return false;
  if (key.includes("female")) return false;
  return (
    key === "male" ||
    key.startsWith("male ") ||
    key.includes("male learner") ||
    key.includes("male names")
  );
}

function isFemaleHeader(key) {
  if (!key) return false;
  return (
    key === "female" ||
    key.startsWith("female ") ||
    key.includes("female learner") ||
    key.includes("female names")
  );
}

export function isSkippedName(name) {
  const key = normalizeKey(name);
  if (!key) return true;
  if (/^\d+$/.test(key)) return true;
  if (key.includes("highest possible")) return true;
  if (key.includes("test exam result")) return true;
  return [
    "total",
    "average",
    "ave",
    "male",
    "female",
    "name",
    "names",
    "learners name",
    "learner name",
    "learners names",
    "remarks",
    "lrn",
    "no",
    "number",
    "descriptor",
    "initial grade",
    "term grade",
  ].some((item) => key === item || key.startsWith(`${item} `));
}

function looksLikeLearnerName(value) {
  const text = cellText(value);
  if (!text || isSkippedName(text)) return false;
  if (/^\d+$/.test(text)) return false;
  if (!/[a-zA-Z]/.test(text)) return false;
  return text.includes(",") || text.split(/\s+/).length >= 2;
}

function resolveNameColumn(sheet, anchor, maxRow) {
  if (!anchor) return null;

  const candidates = [anchor.col + 1, anchor.col + 2, anchor.col];
  let best = null;
  let bestHits = 0;

  for (const col of candidates) {
    let hits = 0;
    for (let r = anchor.row + 1; r <= Math.min(maxRow, anchor.row + 20); r += 1) {
      if (looksLikeLearnerName(getSheetCell(sheet, r, col))) hits += 1;
    }
    if (hits > bestHits) {
      bestHits = hits;
      best = col;
    }
  }

  return bestHits >= 2 ? best : anchor.col + 1;
}

function findLearnerColumns(sheet) {
  const range = getSheetRange(sheet);
  let maleAnchor = null;
  let femaleAnchor = null;
  let maleLrnCol = null;
  let femaleLrnCol = null;
  let headerRow = -1;

  const scanRows = Math.min(range.e.r, 40);
  for (let r = range.s.r; r <= scanRows; r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const key = normalizeKey(cellText(getSheetCell(sheet, r, c)));
      if (!key) continue;

      if (maleAnchor === null && isMaleHeader(key)) {
        maleAnchor = { row: r, col: c };
        headerRow = r;
      }
      if (femaleAnchor === null && isFemaleHeader(key)) {
        femaleAnchor = { row: r, col: c };
        headerRow = r;
      }
    }
    if (maleAnchor && femaleAnchor) break;
  }

  const bandStart = Math.min(maleAnchor?.row ?? 0, femaleAnchor?.row ?? 0, 0);
  for (let r = bandStart; r <= Math.min(range.e.r, bandStart + 8); r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const key = normalizeKey(cellText(getSheetCell(sheet, r, c)));
      if (!isLrnHeader(key)) continue;
      const onFemaleSide = femaleAnchor !== null && c >= femaleAnchor.col;
      if (onFemaleSide && femaleLrnCol === null) femaleLrnCol = c;
      else if (maleLrnCol === null && !onFemaleSide) maleLrnCol = c;
    }
  }

  const maleNameCol = resolveNameColumn(sheet, maleAnchor, range.e.r);
  const femaleNameCol = resolveNameColumn(sheet, femaleAnchor, range.e.r);
  if (maleAnchor) headerRow = Math.max(headerRow, maleAnchor.row);
  if (femaleAnchor) headerRow = Math.max(headerRow, femaleAnchor.row);

  return {
    maleNameCol,
    femaleNameCol,
    maleLrnCol,
    femaleLrnCol,
    headerRow,
    maleAnchor,
    femaleAnchor,
    maxRow: range.e.r,
  };
}

/**
 * Visual / demo student number when ECR has learner names only (no LRN).
 * Format: 104793 + 6 digits.
 */
function buildFallbackStudentNumber(identity, seenNumbers) {
  return buildDummyStudentNumber(identity, seenNumbers);
}

/**
 * Extract learners until the first blank name in each gender column.
 */
function collectLearners(sheet, columns, metadata) {
  const learners = [];
  const start = Math.max(columns.headerRow + 1, 0);
  let maleIndex = 1;
  let femaleIndex = 1;
  let maleDone = columns.maleNameCol === null;
  let femaleDone = columns.femaleNameCol === null;
  const seenNumbers = new Set();

  const pushLearner = (nameRaw, _lrnRaw, sex, index) => {
    const fullName = cellText(nameRaw);
    if (isSkippedName(fullName)) return false;

    // Name-only ECRs: always assign a dummy visual student number.
    const studentNumber = buildFallbackStudentNumber(
      {
        fullName,
        sex,
        index,
        section: metadata.section,
      },
      seenNumbers
    );

    learners.push({
      student_number: studentNumber,
      full_name: fullName,
      gender: sex,
      general_average: null,
      weak_subject: null,
      subject_grades: {},
      quarterly_grade: null,
      term_grades: {},
    });
    return true;
  };

  for (let r = start; r <= columns.maxRow; r += 1) {
    if (maleDone && femaleDone) break;

    if (!maleDone) {
      const maleName = getSheetCell(sheet, r, columns.maleNameCol);
      if (!cellText(maleName)) {
        maleDone = true;
      } else {
        const lrn =
          columns.maleLrnCol !== null
            ? getSheetCell(sheet, r, columns.maleLrnCol)
            : "";
        if (pushLearner(maleName, lrn, "Male", maleIndex)) maleIndex += 1;
      }
    }

    if (!femaleDone) {
      const femaleName = getSheetCell(sheet, r, columns.femaleNameCol);
      if (!cellText(femaleName)) {
        femaleDone = true;
      } else {
        const lrn =
          columns.femaleLrnCol !== null
            ? getSheetCell(sheet, r, columns.femaleLrnCol)
            : "";
        if (pushLearner(femaleName, lrn, "Female", femaleIndex)) {
          femaleIndex += 1;
        }
      }
    }
  }

  return learners;
}

/**
 * Parse INPUT DATA from a single SheetJS worksheet (not the whole workbook).
 */
export function parseInputDataFromSheet(sheet, sheetName, worksheetNames = []) {
  if (!sheet) {
    return {
      ok: false,
      metadata: null,
      learners: [],
      sheetName: null,
      worksheetNames,
      missingLabels: ["INPUT DATA"],
      error:
        'Could not find the "INPUT DATA" sheet in this workbook. Please upload an official DepEd Electronic Class Record.',
    };
  }

  const { metadata, missingLabels, foundLabels } = extractMetadata(sheet);

  if (missingLabels.length) {
    return {
      ok: false,
      metadata,
      learners: [],
      sheetName,
      worksheetNames,
      missingLabels,
      foundLabels,
      error: `Missing label:\n${missingLabels.join("\n")}`,
    };
  }

  const columns = findLearnerColumns(sheet);
  const learners = collectLearners(sheet, columns, metadata);

  if (!learners.length) {
    return {
      ok: false,
      metadata,
      learners: [],
      sheetName,
      worksheetNames,
      missingLabels: [],
      foundLabels,
      error:
        "No learner names were found in the INPUT DATA sheet (Male/Female learner columns).",
    };
  }

  return {
    ok: true,
    metadata,
    learners,
    sheetName,
    worksheetNames,
    missingLabels: [],
    foundLabels,
    error: null,
  };
}

/**
 * @deprecated Prefer parseInputDataFromSheet with a selectively-loaded workbook.
 */
export function parseInputDataFromWorkbook(workbook) {
  const worksheetNames = workbook.SheetNames ?? [];
  const sheetName = findInputDataSheetName(worksheetNames);
  if (!sheetName) {
    return parseInputDataFromSheet(null, null, worksheetNames);
  }
  return parseInputDataFromSheet(
    workbook.Sheets[sheetName],
    sheetName,
    worksheetNames
  );
}
