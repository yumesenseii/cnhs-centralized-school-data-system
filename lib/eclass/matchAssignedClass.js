import {
  extractGradeNumber,
  normalizeKey,
  normalizeSubject,
} from "@/lib/eclass/normalize";
import { validateEClassAgainstAssignedClass } from "@/lib/eclass/validateEClassMetadata";

/**
 * Pick the assigned class that best matches ECR INPUT DATA metadata.
 * Prefers a full validation pass; falls back to grade + section + subject.
 */
export function findBestMatchingClass(classes = [], metadata, teacherName) {
  if (!metadata || !classes.length) return null;

  const exact = classes.find(
    (classItem) =>
      validateEClassAgainstAssignedClass({
        metadata,
        assignedClass: classItem,
        teacherName: teacherName || classItem.teacher,
      }).ok
  );
  if (exact) return exact;

  const grade =
    extractGradeNumber(metadata.grade_level) ?? metadata.grade_level_number;
  const section = normalizeKey(metadata.section);
  const subject = normalizeSubject(metadata.subject);

  if (grade == null || !section || !subject) return null;

  return (
    classes.find((classItem) => {
      const classGrade =
        extractGradeNumber(classItem.grade) ??
        Number(classItem.gradeLevel) ??
        null;
      return (
        Number(classGrade) === Number(grade) &&
        normalizeKey(classItem.section) === section &&
        normalizeSubject(classItem.subject) === subject
      );
    }) ?? null
  );
}
