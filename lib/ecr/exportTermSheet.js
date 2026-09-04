import ExcelJS from "exceljs";
import { settingsData } from "@/data/settings";
import { ECR_COMPONENTS, scoreKey } from "@/lib/ecr/constants";
import { partitionStudentsBySex } from "@/lib/ecr/gridLayout";
import {
  PONCE_INPUT_DATA,
  PONCE_SHEETS,
  PONCE_TEMPLATE_URL,
  PONCE_TERM,
  ponceFemaleDataRows,
  ponceMaleDataRows,
  ponceScoreColumns,
} from "@/lib/ecr/ponceTemplateMap";
import { downloadWorkbook } from "@/lib/reports/excelOfficialTemplate";

function normalizeSchoolYear(schoolYear) {
  if (!schoolYear) return "";
  return String(schoolYear)
    .replace(/^SY\s*/i, "")
    .replace(/–/g, "-")
    .trim();
}

function formatLearnerName(name) {
  return String(name ?? "")
    .trim()
    .toUpperCase();
}

function normalizeGradeLevel(gradeLevel) {
  const digits = String(gradeLevel ?? "").replace(/\D/g, "");
  return digits || String(gradeLevel ?? "").trim();
}

function isFormulaCell(cell) {
  return (
    cell.type === ExcelJS.ValueType.Formula ||
    (typeof cell.value === "object" &&
      cell.value !== null &&
      "formula" in cell.value)
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

function fillInputData(sheet, { classItem, students }) {
  const school = settingsData.school;

  setPlainValue(sheet.getCell(PONCE_INPUT_DATA.schoolName), school.schoolName);
  setPlainValue(
    sheet.getCell(PONCE_INPUT_DATA.schoolYear),
    normalizeSchoolYear(classItem?.schoolYear) ||
      String(school.schoolYear ?? "").replace(/–/g, "-")
  );
  setPlainValue(
    sheet.getCell(PONCE_INPUT_DATA.teacher),
    classItem?.teacherName ?? ""
  );
  setPlainValue(
    sheet.getCell(PONCE_INPUT_DATA.gradeLevel),
    normalizeGradeLevel(classItem?.gradeLevel)
  );
  setPlainValue(sheet.getCell(PONCE_INPUT_DATA.section), classItem?.section ?? "");
  setPlainValue(sheet.getCell(PONCE_INPUT_DATA.subject), classItem?.subject ?? "");
  setPlainValue(sheet.getCell(PONCE_INPUT_DATA.subjectAlt), null);

  const { male, female } = partitionStudentsBySex(students);

  for (let i = 0; i < PONCE_INPUT_DATA.maleCapacity; i += 1) {
    const row = PONCE_INPUT_DATA.maleStartRow + i;
    setPlainValue(sheet.getCell(`${PONCE_INPUT_DATA.maleIndexCol}${row}`), null);
    setPlainValue(sheet.getCell(`${PONCE_INPUT_DATA.maleNameCol}${row}`), null);
  }
  for (let i = 0; i < PONCE_INPUT_DATA.femaleCapacity; i += 1) {
    const row = PONCE_INPUT_DATA.femaleStartRow + i;
    setPlainValue(
      sheet.getCell(`${PONCE_INPUT_DATA.femaleIndexCol}${row}`),
      null
    );
    setPlainValue(sheet.getCell(`${PONCE_INPUT_DATA.femaleNameCol}${row}`), null);
  }

  male.slice(0, PONCE_INPUT_DATA.maleCapacity).forEach((student, index) => {
    const row = PONCE_INPUT_DATA.maleStartRow + index;
    setPlainValue(
      sheet.getCell(`${PONCE_INPUT_DATA.maleIndexCol}${row}`),
      index + 1
    );
    setPlainValue(
      sheet.getCell(`${PONCE_INPUT_DATA.maleNameCol}${row}`),
      formatLearnerName(student.name)
    );
  });

  female.slice(0, PONCE_INPUT_DATA.femaleCapacity).forEach((student, index) => {
    const row = PONCE_INPUT_DATA.femaleStartRow + index;
    setPlainValue(
      sheet.getCell(`${PONCE_INPUT_DATA.femaleIndexCol}${row}`),
      index + 1
    );
    setPlainValue(
      sheet.getCell(`${PONCE_INPUT_DATA.femaleNameCol}${row}`),
      formatLearnerName(student.name)
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

  PONCE_TERM.hpsWwCols.forEach((col, index) => {
    const cfg = byComponent.WW[index];
    if (!cfg) return;
    setPlainValue(
      sheet.getCell(`${col}${PONCE_TERM.hpsRow}`),
      Number(cfg.highest_possible_score)
    );
  });
  PONCE_TERM.hpsPtCols.forEach((col, index) => {
    const cfg = byComponent.PT[index];
    if (!cfg) return;
    setPlainValue(
      sheet.getCell(`${col}${PONCE_TERM.hpsRow}`),
      Number(cfg.highest_possible_score)
    );
  });
  PONCE_TERM.hpsQaCols.forEach((col, index) => {
    const cfg = byComponent.QA[index];
    if (!cfg) return;
    setPlainValue(
      sheet.getCell(`${col}${PONCE_TERM.hpsRow}`),
      Number(cfg.highest_possible_score)
    );
  });

  const wwWeight = byComponent.WW[0]?.component_weight;
  const ptWeight = byComponent.PT[0]?.component_weight;
  const qaWeight = byComponent.QA[0]?.component_weight;
  if (wwWeight != null) {
    setPlainValue(sheet.getCell(PONCE_TERM.weightCells.ww), Number(wwWeight));
  }
  if (ptWeight != null) {
    setPlainValue(sheet.getCell(PONCE_TERM.weightCells.pt), Number(ptWeight));
  }
  if (qaWeight != null) {
    setPlainValue(sheet.getCell(PONCE_TERM.weightCells.qa), Number(qaWeight));
  }
}

function clearTermScoreRows(sheet) {
  const scoreCols = ponceScoreColumns();
  const rows = [...ponceMaleDataRows(), ...ponceFemaleDataRows()];

  for (const row of rows) {
    for (const col of scoreCols) {
      const cell = sheet.getCell(`${col}${row}`);
      if (!isFormulaCell(cell)) cell.value = null;
    }
  }
}

function fillTermScores(sheet, { male, female, studentScores, config }) {
  const colMap = {
    WW: PONCE_TERM.wwCols,
    PT: PONCE_TERM.ptCols,
    QA: PONCE_TERM.qaCols,
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

  fillBlock(male, PONCE_TERM.maleDataStartRow, PONCE_TERM.maleCapacity);
  fillBlock(female, PONCE_TERM.femaleDataStartRow, PONCE_TERM.femaleCapacity);
}

function fillTermSheet(workbook, termNumber, { students, config, studentScores }) {
  const sheet = workbook.getWorksheet(PONCE_SHEETS.term(termNumber));
  if (!sheet) return;

  const { male, female } = partitionStudentsBySex(students);
  fillHpsRow(sheet, config);
  clearTermScoreRows(sheet);
  fillTermScores(sheet, { male, female, studentScores, config });
}

function buildFilename(classItem) {
  const section = String(classItem?.section ?? "class").replace(/\s+/g, "-");
  const subject = String(classItem?.subject ?? "subject").replace(/\s+/g, "-");
  const sy = normalizeSchoolYear(classItem?.schoolYear).replace(/\s+/g, "");
  return `ECR-${section}-${subject}-${sy || "export"}.xlsx`;
}

/**
 * Export a full DepEd Class-Record-v1 workbook from the PONCE template.
 * Fills INPUT DATA roster + TERM 1–3 score columns; AVE/Helper formulas stay intact.
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

  const response = await fetch(PONCE_TEMPLATE_URL);
  if (!response.ok) {
    throw new Error("Unable to load the Class Record template.");
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await response.arrayBuffer());

  const inputSheet = workbook.getWorksheet(PONCE_SHEETS.inputData);
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
