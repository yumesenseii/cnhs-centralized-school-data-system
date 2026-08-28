"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import ThemeSelector from "@/components/settings/ThemeSelector";
import { useTheme } from "@/components/theme/ThemeProvider";
import { THEME_OPTIONS } from "@/lib/settings/theme";

const themeIcons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

export default function ThemeSettingsCard({
  title = "Appearance",
  description = "Choose how the portal looks on this browser. Your preference stays after logout.",
}) {
  const { theme, resolvedTheme, hydrated, setTheme } = useTheme();
  const ThemeIcon = themeIcons[theme] ?? Monitor;

  if (!hydrated) {
    return (
      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-5">
        <p className="text-xs text-slate-500">Loading appearance…</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-5">
      <div className="mb-3 border-b border-slate-100 pb-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
          {description}
        </p>
      </div>

      <ThemeSelector
        label="Theme"
        name="portal-theme"
        options={THEME_OPTIONS}
        value={theme}
        onChange={setTheme}
      />

      <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
        <ThemeIcon
          size={14}
          className="text-cnhs-green-dark"
          aria-hidden="true"
        />
        <p className="text-[10px] text-slate-500">
          Current display:{" "}
          <span className="font-semibold capitalize text-slate-700">
            {resolvedTheme}
          </span>
          . Saved on this device.
        </p>
      </div>
    </section>
  );
}
