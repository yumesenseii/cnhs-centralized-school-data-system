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

/** Confirm before signing out (all portals). */
export function confirmLogout() {
  return window.confirm(
    "Are you sure you want to log out? You will need to sign in again to continue."
  );
}
