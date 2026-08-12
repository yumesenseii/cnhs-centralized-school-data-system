/**
 * Consistent destructive-action confirmations (browser dialog).
 */

export function confirmDelete(itemLabel) {
  const name =
    itemLabel != null && String(itemLabel).trim()
      ? String(itemLabel).trim()
      : "this item";
  return window.confirm(
    `Are you sure you want to delete ${name}? This cannot be undone.`
  );
}

/** For archive / deactivate / remove-from-assignment (not hard delete). */
export function confirmDestructive(message) {
  return window.confirm(String(message || "Are you sure?"));
}

/**
 * Admin recovery: clear ECR grades for a class without removing the assignment.
 * @param {string} classLabel e.g. "English · Grade 7 Mabini · Term 1 · SY 2026-2027"
 */
export function confirmClearClassGrades(classLabel) {
  const label =
    classLabel != null && String(classLabel).trim()
      ? String(classLabel).trim()
      : "this class";
  return window.confirm(
    `Clear all imported grades for ${label}?\n\nThis cannot be undone. Class assignment and lesson plans will stay. The teacher can re-upload the correct E-Class Record afterward.`
  );
}

/** Confirm before signing out (all portals).
 * @deprecated Prefer LogoutConfirmModal in sidebars — browser confirm is blocked/ugly.
 */
export function confirmLogout() {
  return window.confirm(
    "Are you sure you want to log out? You will need to sign in again to continue."
  );
}
