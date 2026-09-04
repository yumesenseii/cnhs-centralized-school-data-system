/** DepEd Class-Record-v1 (PONCE.xlsx) cell map — discovered from template. */

export const PONCE_TEMPLATE_URL = "/templates/class-record-v1-template.xlsx";

export const PONCE_SHEETS = {
  inputData: "INPUT DATA",
  term: (n) => `TERM ${n}`,
  summary: "AVE",
  helper: "Helper(IMPORTANT!)",
};

export const PONCE_INPUT_DATA = {
  region: "F10",
  division: "F11",
  schoolId: "F13",
  schoolName: "F14",
  schoolYear: "F16",
  teacher: "F22",
  gradeLevel: "F24",
  section: "F26",
  subject: "F28",
  subjectAlt: "F30",
  maleIndexCol: "K",
  maleNameCol: "L",
  maleStartRow: 11,
  maleCapacity: 50,
  femaleIndexCol: "N",
  femaleNameCol: "O",
  femaleStartRow: 11,
  femaleCapacity: 50,
};

export const PONCE_TERM = {
  hpsRow: 11,
  maleHeaderRow: 12,
  maleDataStartRow: 13,
  maleCapacity: 50,
  femaleHeaderRow: 63,
  femaleDataStartRow: 64,
  femaleCapacity: 50,
  wwCols: ["F", "G", "H", "I", "J"],
  ptCols: ["N", "O", "P"],
  qaCols: ["T", "U", "V"],
  hpsWwCols: ["F", "G", "H", "I", "J"],
  hpsPtCols: ["N", "O", "P"],
  hpsQaCols: ["T", "U", "V"],
  weightCells: { ww: "M11", pt: "S11", qa: "Y11" },
};

export function ponceScoreColumns() {
  return [...PONCE_TERM.wwCols, ...PONCE_TERM.ptCols, ...PONCE_TERM.qaCols];
}

export function ponceMaleDataRows() {
  return Array.from(
    { length: PONCE_TERM.maleCapacity },
    (_, i) => PONCE_TERM.maleDataStartRow + i
  );
}

export function ponceFemaleDataRows() {
  return Array.from(
    { length: PONCE_TERM.femaleCapacity },
    (_, i) => PONCE_TERM.femaleDataStartRow + i
  );
}
