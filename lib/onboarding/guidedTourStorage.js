/**
 * First-time guided tour dismiss flags (per auth user).
 */

export function tourStorageKey(role, userId) {
  return `cnhs.guidedTour.${role}.${userId}.v1`;
}

export function hasCompletedTour(role, userId) {
  if (typeof window === "undefined" || !role || !userId) return true;
  try {
    return window.localStorage.getItem(tourStorageKey(role, userId)) === "1";
  } catch {
    return true;
  }
}

export function markTourCompleted(role, userId) {
  if (typeof window === "undefined" || !role || !userId) return;
  try {
    window.localStorage.setItem(tourStorageKey(role, userId), "1");
  } catch {
    /* ignore quota / private mode */
  }
}
