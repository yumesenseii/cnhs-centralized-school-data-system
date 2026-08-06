"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  applyThemePreference,
  loadThemePreference,
  normalizeTheme,
  saveThemePreference,
} from "@/lib/settings/theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("light");
  const [resolvedTheme, setResolvedTheme] = useState("light");
  const [hydrated, setHydrated] = useState(false);

  const apply = useCallback((preference) => {
    const normalized = normalizeTheme(preference);
    setThemeState(normalized);
    setResolvedTheme(applyThemePreference(normalized));
  }, []);

  const setTheme = useCallback(
    (preference) => {
      const saved = saveThemePreference(preference);
      apply(saved);
    },
    [apply]
  );

  useEffect(() => {
    apply(loadThemePreference());
    setHydrated(true);
  }, [apply]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function handleSystemChange() {
      if (loadThemePreference() === "system") {
        apply("system");
      }
    }

    function handleStorage(event) {
      if (!event.key || event.key === THEME_STORAGE_KEY) {
        apply(loadThemePreference());
      }
    }

    function handleThemeChange(event) {
      apply(event.detail?.theme ?? loadThemePreference());
    }

    media.addEventListener?.("change", handleSystemChange);
    window.addEventListener("storage", handleStorage);
    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);

    return () => {
      media.removeEventListener?.("change", handleSystemChange);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    };
  }, [apply]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, hydrated, setTheme }),
    [hydrated, resolvedTheme, setTheme, theme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }
  return context;
}
