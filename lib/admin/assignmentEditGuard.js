import { createClient } from "@/lib/supabase/client";

/**
 * Assignment Edit Rule — historical data integrity guard.
 *
 * A class assignment's subject (or a section's advisory assignment) may only
 * be changed while no data records are associated with the current assignment.
 * When records exist the edit is blocked: nothing is modified, migrated, or
 * silently reassigned. The caller receives a coded error so the UI can show
 * the dedicated "Cannot change assignment" error modal.
 */

export const ASSIGNMENT_BLOCKED_CODE = "ASSIGNMENT_HAS_RECORDS";
export const ASSIGNMENT_VERIFY_FAILED_CODE = "ASSIGNMENT_VERIFY_FAILED";

export const ASSIGNMENT_BLOCKED_MESSAGE =
  "Cannot change assignment. Existing data records are already associated with this subject/advisory assignment.";

// Class-keyed dependents: changing subject_id / section_id on a classes row
// would orphan or misattribute these records.
const CLASS_RECORD_TABLES = [
  { table: "class_students", column: "class_id", label: "Enrolled students" },
  { table: "grades", column: "class_id", label: "Grade records" },
  { table: "monitoring_records", column: "class_id", label: "Monitoring records" },
  { table: "ecr_workbooks", column: "class_id", label: "ECR workbooks" },
  {
    table: "aral_recommendation_approvals",
    column: "class_id",
    label: "ARAL endorsements",
  },
  {
    table: "learner_intervention_history",
    column: "class_id",
    label: "Intervention history",
  },
  {
    table: "phil_iri_baseline_records",
    column: "class_id",
    label: "Reading baseline records",
  },
  { table: "lesson_plans", column: "class_id", label: "Lesson plans" },
];

// Section-keyed dependents: changing a section's adviser while learners,
// classes, or attendance are tied to the section would rewrite accountability
// for existing records.
const SECTION_RECORD_TABLES = [
  { table: "classes", column: "section_id", label: "Class assignments" },
  { table: "students", column: "section_id", label: "Enrolled learners" },
  { table: "attendance_daily", column: "section_id", label: "Daily attendance" },
  { table: "attendance_records", column: "section_id", label: "Attendance records" },
  {
    table: "attendance_section_months",
    column: "section_id",
    label: "Attendance month locks",
  },
];

async function countRows(table, column, id) {
  const supabase = createClient();
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, id);
  if (error) return { count: 0, error };
  return { count: count ?? 0, error: null };
}

/**
 * Count dependent records across the given table definitions.
 * Fail-closed: if any count query errors we cannot prove the assignment is
 * clean, so the caller must abort the edit with a verification error.
 */
export async function countDependentRecords(tableDefs, column, id) {
  const breakdown = [];
  for (const def of tableDefs) {
    const { count, error } = await countRows(def.table, column, id);
    if (error) {
      return { total: 0, breakdown: [], error };
    }
    if (count > 0) {
      breakdown.push({ table: def.table, label: def.label, count });
    }
  }
  const total = breakdown.reduce((sum, row) => sum + row.count, 0);
  return { total, breakdown, error: null };
}

export async function countClassDependentRecords(classId) {
  return countDependentRecords(CLASS_RECORD_TABLES, "class_id", classId);
}

export async function countSectionDependentRecords(sectionId) {
  return countDependentRecords(SECTION_RECORD_TABLES, "section_id", sectionId);
}

function attachCode(error, code, details = null) {
  error.code = code;
  if (details) error.details = details;
  return error;
}

export function buildAssignmentBlockedError(breakdown = []) {
  return attachCode(
    new Error(ASSIGNMENT_BLOCKED_MESSAGE),
    ASSIGNMENT_BLOCKED_CODE,
    breakdown
  );
}

export function buildAssignmentVerifyFailedError() {
  return attachCode(
    new Error(
      "Unable to verify existing records for this assignment. Please try again."
    ),
    ASSIGNMENT_VERIFY_FAILED_CODE
  );
}
