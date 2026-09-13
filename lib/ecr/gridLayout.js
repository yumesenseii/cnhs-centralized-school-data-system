import { ECR_COMPONENTS } from "@/lib/ecr/constants";

/** Sticky learner columns: #, LRN, Name */
export const ECR_NAME_COLS = 3;

/** Fixed pixel widths for frozen left columns (must match sticky left offsets). */
export const STICKY_COL = {
  numW: 40,
  lrnW: 112,
  nameW: 180,
  frozenW: 332,
  lrnLeft: 40,
  nameLeft: 152,
};

const SUMMARY_COLS_PER_GROUP = 3; // Total, PS, WS
const RESULTS_COLS = 3; // Initial, Term, Desc

/**
 * Total table column count for the E-Record grid.
 * Name (3) + score items + per-group summaries + results.
 */
export function getEcrGridColumnCount(config = []) {
  return (
    ECR_NAME_COLS +
    config.length +
    ECR_COMPONENTS.length * SUMMARY_COLS_PER_GROUP +
    RESULTS_COLS
  );
}

export function getComponentGroupSpan(config = [], component) {
  const rows = config.filter((r) => r.component === component);
  return rows.length + SUMMARY_COLS_PER_GROUP;
}

export function normalizeStudentSex(student = {}) {
  const value = student.sex ?? student.gender ?? "";
  const lower = String(value).toLowerCase().trim();
  if (!lower || lower === "—" || lower === "-") return "Unknown";
  if (lower.startsWith("m") || lower === "boy") return "Male";
  if (lower.startsWith("f") || lower === "girl") return "Female";
  return "Unknown";
}

function surnameOf(student = {}) {
  const last = String(student.last_name ?? "").trim();
  if (last) return last;
  const name = String(student.name ?? "").trim();
  if (name.includes(",")) return name.split(",")[0].trim();
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.at(-1) ?? "";
}

function givenNameOf(student = {}) {
  const first = String(student.first_name ?? "").trim();
  if (first) return first;
  const name = String(student.name ?? "").trim();
  if (name.includes(",")) return name.split(",").slice(1).join(" ").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.slice(0, -1).join(" ");
}

export function compareLearnersBySurname(a, b) {
  const lastCmp = surnameOf(a).localeCompare(surnameOf(b), "en", {
    sensitivity: "base",
  });
  if (lastCmp !== 0) return lastCmp;
  return givenNameOf(a).localeCompare(givenNameOf(b), "en", {
    sensitivity: "base",
  });
}

export function partitionStudentsBySex(students = []) {
  const male = [];
  const female = [];
  const unknown = [];

  for (const student of students) {
    const sex = normalizeStudentSex(student);
    if (sex === "Female") female.push(student);
    else if (sex === "Male") male.push(student);
    else unknown.push(student);
  }

  male.sort(compareLearnersBySurname);
  female.sort(compareLearnersBySurname);
  unknown.sort(compareLearnersBySurname);

  // DepEd sheets list males first; unknown learners follow females.
  return { male, female: [...female, ...unknown] };
}

export function getLearnerRowStatus(
  scoresByKey = {},
  configRows = [],
  { termGrade = null } = {}
) {
  if (!configRows.length) return "empty";

  let filled = 0;
  for (const cfg of configRows) {
    const raw = scoresByKey[`${cfg.component}:${cfg.item_index}`];
    if (raw !== "" && raw !== null && raw !== undefined) filled += 1;
  }

  if (filled === 0) {
    if (termGrade !== null && termGrade !== undefined && Number.isFinite(Number(termGrade))) {
      return "imported";
    }
    return "empty";
  }
  if (filled >= configRows.length) return "complete";
  return "partial";
}
