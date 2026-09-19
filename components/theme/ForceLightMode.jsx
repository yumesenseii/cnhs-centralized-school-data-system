"use client";

import { useEffect } from "react";
import {
  applyThemePreference,
  isPublicForceLightPath,
  loadThemePreference,
} from "@/lib/settings/theme";

/**
 * Forces light appearance on public pages (landing / login).
 * Restores the user's saved portal theme on leave.
 */
export default function ForceLightMode({ children }) {
  useEffect(() => {
    applyThemePreference("light");
    return () => {
      if (
        typeof window !== "undefined" &&
        isPublicForceLightPath(window.location.pathname)
      ) {
        return;
      }
      applyThemePreference(loadThemePreference());
    };
  }, []);

  return children ?? null;
}
