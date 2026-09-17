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
      <section className="rounded-2xl border border-border bg-card p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
        <p className="text-xs text-muted-foreground">Loading appearance…</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
      <div className="mb-2.5 border-b border-border pb-2.5">
        <h2 className="text-[13px] font-semibold text-card-foreground">{title}</h2>
        <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
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

      <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
        <ThemeIcon
          size={14}
          className="text-cnhs-green-dark"
          aria-hidden="true"
        />
        <p className="text-[10px] text-muted-foreground">
          Current display:{" "}
          <span className="font-semibold capitalize text-card-foreground">
            {resolvedTheme}
          </span>
          . Saved on this device.
        </p>
      </div>
    </section>
  );
}
