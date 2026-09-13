import ExcelJS from "exceljs";
import { settingsData } from "@/data/settings";
import { formatSf2LearnerName } from "@/lib/attendance/sf2Daily";
import { ECR_COMPONENTS, scoreKey } from "@/lib/ecr/constants";
import { partitionStudentsBySex } from "@/lib/ecr/gridLayout";
import {
  OFFICIAL_ECR_SHEETS,
  OFFICIAL_ECR_TEMPLATE_URL,
  OFFICIAL_INPUT,
  OFFICIAL_TERM,
  officialFemaleDataRows,
  officialMaleDataRows,
  officialScoreColumns,
} from "@/lib/ecr/officialEcrTemplateMap";
import { downloadWorkbook } from "@/lib/reports/excelOfficialTemplate";

function normalizeSchoolYear(schoolYear) {
  if (!schoolYear) return "";
  return String(schoolYear)
    .replace(/^SY\s*/i, "")
    .replace(/–/g, "-")
    .trim();
}

function formatOfficialSchoolYear(schoolYear) {
  const raw = normalizeSchoolYear(schoolYear);
  const match = raw.match(/(\d{4})\s*-\s*(\d{4})/);
  if (match) return `${match[1]} - ${match[2]}`;
  return raw;
}

function formatOfficialLearnerName(student) {
  const name = formatSf2LearnerName(student);
  return !name || name === "—" ? "" : name;
}

function formatGradeAndSection(gradeLevel, section) {
  const digits = String(gradeLevel ?? "").replace(/\D/g, "");
  const sec = String(section ?? "").trim().toUpperCase();
  if (digits && sec) return `${digits} - ${sec}`;
  return digits || sec;
}

function toOfficialWeight(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n > 1 && n <= 100) return n / 100;
  return n;
}

function isFormulaCell(cell) {
  return (
    cell.type === ExcelJS.ValueType.Formula ||
    (typeof cell.value === "object" &&
      cell.value !== null &&
      ("formula" in cell.value || "sharedFormula" in cell.value))
  );
}

function setPlainValue(cell, value) {
  if (isFormulaCell(cell)) return;
  if (value === "" || value === null || value === undefined) {
    cell.value = null;
    return;
  }
  cell.value = value;
}

function rosterRows(startRow, capacity) {
  return Array.from({ length: capacity }, (_, i) => startRow + i);
}

function fillInputData(sheet, { classItem, students }) {
  const school = settingsData.school;

  setPlainValue(sheet.getCell(OFFICIAL_INPUT.schoolName), school.schoolName);
  setPlainValue(
    sheet.getCell(OFFICIAL_INPUT.schoolYear),
    formatOfficialSchoolYear(
      classItem?.schoolYear || school.schoolYear
    )
  );
  setPlainValue(
    sheet.getCell(OFFICIAL_INPUT.teacher),
    classItem?.teacherName ?? ""
  );
  setPlainValue(
    sheet.getCell(OFFICIAL_INPUT.gradeAndSection),
    formatGradeAndSection(classItem?.gradeLevel, classItem?.section)
  );
  setPlainValue(
    sheet.getCell(OFFICIAL_INPUT.subject),
    String(classItem?.subject ?? "").trim().toUpperCase()
  );

  const { male, female } = partitionStudentsBySex(students);
  const maleRows = rosterRows(
    OFFICIAL_INPUT.maleStartRow,
    OFFICIAL_INPUT.maleCapacity
  );
  const femaleRows = rosterRows(
    OFFICIAL_INPUT.femaleStartRow,
    OFFICIAL_INPUT.femaleCapacity
  );

  for (const row of [...maleRows, ...femaleRows]) {
    setPlainValue(sheet.getCell(`${OFFICIAL_INPUT.nameCol}${row}`), null);
  }

  male.slice(0, OFFICIAL_INPUT.maleCapacity).forEach((student, index) => {
    const row = OFFICIAL_INPUT.maleStartRow + index;
    setPlainValue(
      sheet.getCell(`${OFFICIAL_INPUT.nameCol}${row}`),
      formatOfficialLearnerName(student)
    );
  });

  female.slice(0, OFFICIAL_INPUT.femaleCapacity).forEach((student, index) => {
    const row = OFFICIAL_INPUT.femaleStartRow + index;
    setPlainValue(
      sheet.getCell(`${OFFICIAL_INPUT.nameCol}${row}`),
      formatOfficialLearnerName(student)
    );
  });
}

function fillHpsRow(sheet, config = []) {
  const byComponent = Object.fromEntries(
    ECR_COMPONENTS.map((component) => [
      component,
      config.filter((row) => row.component === component),
    ])
  );

  const writeHps = (cols, rows) => {
    cols.forEach((col, index) => {
      const cfg = rows[index];
      const cell = sheet.getCell(`${col}${OFFICIAL_TERM.hpsRow}`);
      if (isFormulaCell(cell)) return;
      if (!cfg) {
        cell.value = null;
        return;
      }
      const n = Number(cfg.highest_possible_score);
      cell.value = Number.isFinite(n) ? n : null;
    });
  };

  writeHps(OFFICIAL_TERM.hpsWwCols, byComponent.WW);
  writeHps(OFFICIAL_TERM.hpsPtCols, byComponent.PT);
  writeHps(OFFICIAL_TERM.hpsQaCols, byComponent.QA);

  const weights = {
    ww: toOfficialWeight(byComponent.WW[0]?.component_weight),
    pt: toOfficialWeight(byComponent.PT[0]?.component_weight),
    qa: toOfficialWeight(byComponent.QA[0]?.component_weight),
  };
  if (weights.ww != null) {
    setPlainValue(sheet.getCell(OFFICIAL_TERM.weightCells.ww), weights.ww);
  }
  if (weights.pt != null) {
    setPlainValue(sheet.getCell(OFFICIAL_TERM.weightCells.pt), weights.pt);
  }
  if (weights.qa != null) {
    setPlainValue(sheet.getCell(OFFICIAL_TERM.weightCells.qa), weights.qa);
  }
}

function restoreNameFormulas(sheet) {
  for (const row of [...officialMaleDataRows(), ...officialFemaleDataRows()]) {
    sheet.getCell(`${OFFICIAL_TERM.nameCol}${row}`).value = {
      formula: `INPUT!B${row}`,
    };
  }
}

function clearTermScoreRows(sheet) {
  const scoreCols = officialScoreColumns();
  const rows = [...officialMaleDataRows(), ...officialFemaleDataRows()];

  for (const row of rows) {
    for (const col of scoreCols) {
      const cell = sheet.getCell(`${col}${row}`);
      if (!isFormulaCell(cell)) cell.value = null;
    }
  }
}

function fillTermScores(sheet, { male, female, studentScores, config }) {
  const colMap = {
    WW: OFFICIAL_TERM.wwCols,
    PT: OFFICIAL_TERM.ptCols,
    QA: OFFICIAL_TERM.qaCols,
  };

  function fillBlock(students, dataStartRow, capacity) {
    students.slice(0, capacity).forEach((student, index) => {
      const row = dataStartRow + index;
      const scores = studentScores[student.id] ?? {};

      for (const component of ECR_COMPONENTS) {
        const cols = colMap[component];
        const configRows = config.filter((entry) => entry.component === component);
        cols.forEach((col, itemIndex) => {
          const cfg = configRows[itemIndex];
          if (!cfg) return;
          const key = scoreKey(cfg.component, cfg.item_index);
          const raw = scores[key];
          const cell = sheet.getCell(`${col}${row}`);
          if (isFormulaCell(cell)) return;
          if (raw === "" || raw === null || raw === undefined) {
            cell.value = null;
            return;
          }
          const num = Number(raw);
          cell.value = Number.isFinite(num) ? num : raw;
        });
      }
    });
  }

  fillBlock(male, OFFICIAL_TERM.maleDataStartRow, OFFICIAL_TERM.maleCapacity);
  fillBlock(female, OFFICIAL_TERM.femaleDataStartRow, OFFICIAL_TERM.femaleCapacity);
}

function fillTermSheet(workbook, termNumber, { students, config, studentScores }) {
  const sheet = workbook.getWorksheet(OFFICIAL_ECR_SHEETS.term(termNumber));
  if (!sheet) return;

  const { male, female } = partitionStudentsBySex(students);
  restoreNameFormulas(sheet);
  fillHpsRow(sheet, config);
  clearTermScoreRows(sheet);
  fillTermScores(sheet, { male, female, studentScores, config });
}

function buildFilename(classItem) {
  const gradeDigits = String(classItem?.gradeLevel ?? "").replace(/\D/g, "");
  const grade = gradeDigits ? `GRADE${gradeDigits}` : "GRADE";
  const section = String(classItem?.section ?? "SECTION")
    .toUpperCase()
    .replace(/[\s\-–—]/g, "");
  const year = normalizeSchoolYear(classItem?.schoolYear).replace(/\s+/g, "");
  const sy = year ? `SY${year}` : "SY";
  const raw = `${grade}_${section}_${sy}`;
  const safe = raw.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").replace(/_+/g, "_");
  return `${safe || "EXPORT"}.xlsx`;
}

/**
 * Export official DepEd ECR from the GRADE7_SCIENCE layout.
 * Fills INPUT roster + TERM1–3 raw scores; SUMMARY/Helper formulas stay intact.
 */
export async function exportEcrTermExcel({
  classItem,
  term,
  students = [],
  config = [],
  studentScores = {},
  computedByStudent = {},
  termDataByTerm = {},
} = {}) {
  void computedByStudent;

  const response = await fetch(OFFICIAL_ECR_TEMPLATE_URL);
  if (!response.ok) {
    throw new Error("Unable to load the official E-Class Record template.");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await response.arrayBuffer());

  const inputSheet = workbook.getWorksheet(OFFICIAL_ECR_SHEETS.input);
  if (inputSheet) {
    fillInputData(inputSheet, { classItem, students });
  }

  const mergedTerms = { ...termDataByTerm };
  if (term && term !== "summary") {
    mergedTerms[term] = {
      config,
      studentScores,
      computedByStudent,
    };
  }

  const termsToFill = Object.keys(mergedTerms).length
    ? Object.keys(mergedTerms)
        .map(Number)
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 3)
        .sort((a, b) => a - b)
    : term && term !== "summary"
      ? [Number(term)]
      : [1, 2, 3];

  for (const termNumber of termsToFill) {
    const data = mergedTerms[termNumber];
    fillTermSheet(workbook, termNumber, {
      students,
      config: data?.config?.length ? data.config : config,
      studentScores: data?.studentScores ?? {},
    });
  }

  await downloadWorkbook(workbook, buildFilename(classItem));
}
