export const THEME_STORAGE_KEY = "cnhs-theme";
export const THEME_CHANGE_EVENT = "cnhs-theme-change";

export const THEME_OPTIONS = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

const VALID_THEMES = new Set(THEME_OPTIONS.map((option) => option.id));
const LEGACY_APPEARANCE_KEY = "cnhs-admin-appearance";

export function normalizeTheme(value) {
  return VALID_THEMES.has(value) ? value : "light";
}

export function loadThemePreference() {
  if (typeof window === "undefined") return "light";

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored) return normalizeTheme(stored);

    const legacyRaw = window.localStorage.getItem(LEGACY_APPEARANCE_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw);
      return normalizeTheme(legacy?.theme);
    }
  } catch {
    return "light";
  }

  return "light";
}

export function resolveTheme(theme) {
  const preference = normalizeTheme(theme);
  if (preference !== "system") return preference;

  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
  return prefersDark ? "dark" : "light";
}

export function applyThemePreference(theme = loadThemePreference()) {
  if (typeof document === "undefined") return "light";

  const preference = normalizeTheme(theme);
  const resolved = resolveTheme(preference);
  const root = document.documentElement;

  root.classList.toggle("dark", resolved === "dark");
  root.dataset.theme = resolved;
  root.dataset.themePreference = preference;
  root.style.colorScheme = resolved;

  return resolved;
}

export function saveThemePreference(theme) {
  if (typeof window === "undefined") return "light";

  const preference = normalizeTheme(theme);
  window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  applyThemePreference(preference);
  window.dispatchEvent(
    new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme: preference } })
  );
  return preference;
}

export const THEME_BOOTSTRAP_SCRIPT = `
(() => {
  try {
    const valid = new Set(["light", "dark", "system"]);
    let preference = localStorage.getItem("${THEME_STORAGE_KEY}");
    if (!valid.has(preference)) {
      try {
        const legacy = JSON.parse(localStorage.getItem("${LEGACY_APPEARANCE_KEY}") || "{}");
        preference = valid.has(legacy.theme) ? legacy.theme : "light";
      } catch {
        preference = "light";
      }
    }
    const resolved =
      preference === "dark" ||
      (preference === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
        ? "dark"
        : "light";
    const root = document.documentElement;
    root.classList.toggle("dark", resolved === "dark");
    root.dataset.theme = resolved;
    root.dataset.themePreference = preference;
    root.style.colorScheme = resolved;
  } catch {
    document.documentElement.dataset.theme = "light";
  }
})();
`;
