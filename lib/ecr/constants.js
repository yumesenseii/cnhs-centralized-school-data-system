/** DepEd Class-Record-v1 templates + CNHS subject-specific component weights. */

export const ECR_COMPONENTS = ["WW", "PT", "QA"];

/**
 * Default subjects (English, Filipino, Math, Science, AP, TLE, etc.):
 * WW 20% · PT 50% · QA 30%
 */
export const DEFAULT_ECR_TEMPLATE = [
  { component: "WW", item_index: 1, item_label: "1", highest_possible_score: 25, component_weight: 0.2 },
  { component: "WW", item_index: 2, item_label: "2", highest_possible_score: 25, component_weight: 0.2 },
  { component: "WW", item_index: 3, item_label: "3", highest_possible_score: 25, component_weight: 0.2 },
  { component: "WW", item_index: 4, item_label: "4", highest_possible_score: 25, component_weight: 0.2 },
  { component: "WW", item_index: 5, item_label: "5", highest_possible_score: 25, component_weight: 0.2 },
  { component: "PT", item_index: 1, item_label: "1", highest_possible_score: 30, component_weight: 0.5 },
  { component: "PT", item_index: 2, item_label: "2", highest_possible_score: 30, component_weight: 0.5 },
  { component: "PT", item_index: 3, item_label: "3", highest_possible_score: 30, component_weight: 0.5 },
  { component: "QA", item_index: 1, item_label: "SA1", highest_possible_score: 30, component_weight: 0.3 },
  { component: "QA", item_index: 2, item_label: "SA2", highest_possible_score: 30, component_weight: 0.3 },
  { component: "QA", item_index: 3, item_label: "TE", highest_possible_score: 50, component_weight: 0.3 },
];

/**
 * MAPEH and Values Education (CNHS records):
 * WW 20% · PT 60% · QA 20%
 */
export const MAPEH_VALUES_ECR_TEMPLATE = [
  { component: "WW", item_index: 1, item_label: "1", highest_possible_score: 25, component_weight: 0.2 },
  { component: "WW", item_index: 2, item_label: "2", highest_possible_score: 25, component_weight: 0.2 },
  { component: "WW", item_index: 3, item_label: "3", highest_possible_score: 25, component_weight: 0.2 },
  { component: "WW", item_index: 4, item_label: "4", highest_possible_score: 25, component_weight: 0.2 },
  { component: "WW", item_index: 5, item_label: "5", highest_possible_score: 25, component_weight: 0.2 },
  { component: "PT", item_index: 1, item_label: "1", highest_possible_score: 30, component_weight: 0.6 },
  { component: "PT", item_index: 2, item_label: "2", highest_possible_score: 30, component_weight: 0.6 },
  { component: "PT", item_index: 3, item_label: "3", highest_possible_score: 30, component_weight: 0.6 },
  { component: "QA", item_index: 1, item_label: "SA1", highest_possible_score: 30, component_weight: 0.2 },
  { component: "QA", item_index: 2, item_label: "SA2", highest_possible_score: 30, component_weight: 0.2 },
  { component: "QA", item_index: 3, item_label: "TE", highest_possible_score: 50, component_weight: 0.2 },
];

export const COMPONENT_LABELS = {
  WW: "Written/Oral Works",
  PT: "Product/Performance Tasks",
  QA: "Summative Tests",
};

/** Subjects that use CNHS MAPEH/Values weight split (20 / 60 / 20). */
export const PERFORMANCE_HEAVY_SUBJECTS = new Set([
  "mapeh",
  "values education",
  "values_education",
  "ve",
]);

function normalizeSubjectForTemplate(subjectName = "") {
  return String(subjectName ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Resolve ECR component template for a class subject.
 * @param {string|null|undefined} subjectName
 * @returns {typeof DEFAULT_ECR_TEMPLATE}
 */
export function getEcrTemplateForSubject(subjectName) {
  const key = normalizeSubjectForTemplate(subjectName);
  const compact = key.replace(/\s+/g, "_");
  if (
    PERFORMANCE_HEAVY_SUBJECTS.has(key) ||
    PERFORMANCE_HEAVY_SUBJECTS.has(compact) ||
    key.includes("mapeh") ||
    key.includes("values education")
  ) {
    return MAPEH_VALUES_ECR_TEMPLATE.map((row) => ({ ...row }));
  }
  return DEFAULT_ECR_TEMPLATE.map((row) => ({ ...row }));
}

/**
 * Display percentages for header labels from config rows.
 * @param {Array<{ component: string, component_weight?: number }>} config
 */
export function getComponentWeightPercents(config = []) {
  const out = { WW: 20, PT: 50, QA: 30 };
  for (const component of ECR_COMPONENTS) {
    const row = config.find((r) => r.component === component);
    if (row && Number.isFinite(Number(row.component_weight))) {
      out[component] = Math.round(Number(row.component_weight) * 100);
    }
  }
  return out;
}

export function scoreKey(component, itemIndex) {
  return `${component}:${itemIndex}`;
}
