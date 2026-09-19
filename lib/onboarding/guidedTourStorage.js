/**
 * First-time guided tour dismiss flags (per auth user).
 * localStorage is a fast cache; profiles.guided_tour_completed_at is source of truth.
 */

export function tourStorageKey(role, userId) {
  return `cnhs.guidedTour.${role}.${userId}.v1`;
}

export function hasCompletedTourLocal(role, userId) {
  if (typeof window === "undefined" || !role || !userId) return true;
  try {
    return window.localStorage.getItem(tourStorageKey(role, userId)) === "1";
  } catch {
    return true;
  }
}

/** @deprecated use hasCompletedTourLocal */
export function hasCompletedTour(role, userId) {
  return hasCompletedTourLocal(role, userId);
}

export function markTourCompletedLocal(role, userId) {
  if (typeof window === "undefined" || !role || !userId) return;
  try {
    window.localStorage.setItem(tourStorageKey(role, userId), "1");
  } catch {
    /* ignore quota / private mode */
  }
}

/** @deprecated use markTourCompletedLocal */
export function markTourCompleted(role, userId) {
  markTourCompletedLocal(role, userId);
}
