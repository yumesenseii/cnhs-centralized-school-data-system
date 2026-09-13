/** Official DepEd ECR (GRADE7_SCIENCE.xlsx) cell map. */

export const OFFICIAL_ECR_TEMPLATE_URL = "/templates/official-ecr-template.xlsx";

export const OFFICIAL_ECR_SHEETS = {
  input: "INPUT",
  term: (n) => `TERM${n}`,
  summary: "SUMMARY OF GRADES",
};

export const OFFICIAL_INPUT = {
  region: "G4",
  division: "L4",
  schoolName: "G5",
  schoolId: "S5",
  schoolYear: "Y5",
  gradeAndSection: "J7",
  teacher: "Q7",
  subject: "Y7",
  indexCol: "A",
  nameCol: "B",
  maleStartRow: 12,
  maleCapacity: 50,
  femaleStartRow: 63,
  femaleCapacity: 50,
};

export const OFFICIAL_TERM = {
  hpsRow: 10,
  nameCol: "B",
  maleDataStartRow: 12,
  maleCapacity: 50,
  femaleDataStartRow: 63,
  femaleCapacity: 50,
  wwCols: ["F", "G", "H", "I", "J"],
  ptCols: ["N", "O", "P"],
  qaCols: ["T", "U", "V"],
  hpsWwCols: ["F", "G", "H", "I", "J"],
  hpsPtCols: ["N", "O", "P"],
  hpsQaCols: ["T", "U", "V"],
  weightCells: { ww: "M10", pt: "S10", qa: "Y10" },
};

export function officialScoreColumns() {
  return [...OFFICIAL_TERM.wwCols, ...OFFICIAL_TERM.ptCols, ...OFFICIAL_TERM.qaCols];
}

export function officialMaleDataRows() {
  return Array.from(
    { length: OFFICIAL_TERM.maleCapacity },
    (_, i) => OFFICIAL_TERM.maleDataStartRow + i
  );
}

export function officialFemaleDataRows() {
  return Array.from(
    { length: OFFICIAL_TERM.femaleCapacity },
    (_, i) => OFFICIAL_TERM.femaleDataStartRow + i
  );
}
