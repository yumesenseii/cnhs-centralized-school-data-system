"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import ThemeSelector from "@/components/settings/ThemeSelector";
import {
  loadAppearanceSettings,
  saveAppearanceSettings,
} from "@/lib/settings/adminSettingsStorage";

export default function AppearanceCard({ appearance }) {
  const [theme, setTheme] = useState(appearance.selected.theme);
  const [sidebar, setSidebar] = useState(appearance.selected.sidebar);
  const [fontSize, setFontSize] = useState(appearance.selected.fontSize);
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const selected = loadAppearanceSettings();
    setTheme(selected.theme);
    setSidebar(selected.sidebar);
    setFontSize(selected.fontSize);
    setHydrated(true);
  }, []);

  function handleApply() {
    saveAppearanceSettings({ theme, sidebar, fontSize });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  if (!hydrated) {
    return (
      <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-4">
        <p className="text-xs text-slate-500">Loading appearance…</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-4">
      <div className="mb-3">
        <h2 className="text-base font-semibold tracking-[-0.02em] text-slate-900">
          Appearance
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Customize how the administrator portal looks on your device. Preferences
          are saved locally.
        </p>
      </div>

      <div className="space-y-6">
        <ThemeSelector
          label="Theme"
          name="theme"
          options={appearance.themes}
          value={theme}
          onChange={(v) => {
            setTheme(v);
            setSaved(false);
          }}
        />
        <ThemeSelector
          label="Sidebar"
          name="sidebar"
          options={appearance.sidebars}
          value={sidebar}
          onChange={(v) => {
            setSidebar(v);
            setSaved(false);
          }}
        />
        <ThemeSelector
          label="Font Size"
          name="fontSize"
          options={appearance.fontSizes}
          value={fontSize}
          onChange={(v) => {
            setFontSize(v);
            setSaved(false);
          }}
        />
      </div>

      <div className="mt-4 flex items-center justify-end gap-3">
        {saved ? (
          <p className="text-[11px] font-medium text-cnhs-green-dark">
            Appearance applied.
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleApply}
          className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-cnhs-green-dark px-4 text-xs font-semibold text-white transition-colors hover:bg-[#246f54]"
        >
          <Check size={14} />
          Apply Appearance
        </button>
      </div>
    </section>
  );
}
