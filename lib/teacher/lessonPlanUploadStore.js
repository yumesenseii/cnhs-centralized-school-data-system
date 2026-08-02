/**
 * Holds the selected File object during the multi-step upload wizard.
 * sessionStorage only keeps file metadata (name/size/type).
 */
let pendingLessonPlanFile = null;

export function setPendingLessonPlanFile(file) {
  pendingLessonPlanFile = file ?? null;
}

export function getPendingLessonPlanFile() {
  return pendingLessonPlanFile;
}

export function clearPendingLessonPlanFile() {
  pendingLessonPlanFile = null;
}
