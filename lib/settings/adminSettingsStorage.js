/**
 * Admin Settings persistence (browser localStorage).
 * School branding + appearance preferences for the admin portal.
 */

import { settingsData } from "@/data/settings";

export const SCHOOL_STORAGE_KEY = "cnhs-admin-school";
export const APPEARANCE_STORAGE_KEY = "cnhs-admin-appearance";

export function getDefaultSchool() {
  return { ...settingsData.school };
}

export function getDefaultAppearanceSelected() {
  return { ...settingsData.appearance.selected };
}

export function loadSchoolSettings() {
  if (typeof window === "undefined") return getDefaultSchool();
  try {
    const raw = window.localStorage.getItem(SCHOOL_STORAGE_KEY);
    if (!raw) return getDefaultSchool();
    const parsed = JSON.parse(raw);
    return {
      ...getDefaultSchool(),
      ...parsed,
      logoSrc: parsed.logoSrc || getDefaultSchool().logoSrc,
    };
  } catch {
    return getDefaultSchool();
  }
}

export function saveSchoolSettings(school) {
  if (typeof window === "undefined") return;
  const payload = {
    logoSrc: school.logoSrc || getDefaultSchool().logoSrc,
    schoolName: String(school.schoolName ?? "").trim() || getDefaultSchool().schoolName,
    schoolAddress: String(school.schoolAddress ?? "").trim(),
    division: String(school.division ?? "").trim(),
    schoolYear: String(school.schoolYear ?? "").trim(),
  };
  window.localStorage.setItem(SCHOOL_STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new Event("cnhs-admin-settings"));
  return payload;
}

export function loadAppearanceSettings() {
  if (typeof window === "undefined") return getDefaultAppearanceSelected();
  try {
    const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return getDefaultAppearanceSelected();
    const parsed = JSON.parse(raw);
    return { ...getDefaultAppearanceSelected(), ...parsed };
  } catch {
    return getDefaultAppearanceSelected();
  }
}

export function saveAppearanceSettings(selected) {
  if (typeof window === "undefined") return;
  const payload = {
    theme: selected.theme || "light",
    sidebar: selected.sidebar || "expanded",
    fontSize: selected.fontSize || "medium",
  };
  window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(payload));
  applyAppearanceToDocument(payload);
  window.dispatchEvent(new Event("cnhs-admin-settings"));
  return payload;
}

/**
 * Apply theme / font / sidebar prefs to <html> for CSS hooks.
 */
export function applyAppearanceToDocument(selected = loadAppearanceSettings()) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const theme = selected.theme || "light";
  const fontSize = selected.fontSize || "medium";
  const sidebar = selected.sidebar || "expanded";

  root.dataset.fontSize = fontSize;
  root.dataset.sidebar = sidebar;

  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;

  const useDark = theme === "dark" || (theme === "system" && prefersDark);
  root.classList.toggle("dark", useDark);
  root.dataset.theme = useDark ? "dark" : "light";
}
