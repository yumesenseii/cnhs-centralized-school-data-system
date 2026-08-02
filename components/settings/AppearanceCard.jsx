"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import ThemeSelector from "@/components/settings/ThemeSelector";

export default function AppearanceCard({ appearance }) {
  const [theme, setTheme] = useState(appearance.selected.theme);
  const [sidebar, setSidebar] = useState(appearance.selected.sidebar);
  const [fontSize, setFontSize] = useState(appearance.selected.fontSize);

  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-4">
      <div className="mb-3">
        <h2 className="text-base font-semibold tracking-[-0.02em] text-slate-900">Appearance</h2>
        <p className="mt-1 text-xs text-slate-500">
          Customize how the administrator portal looks on your device.
        </p>
      </div>

      <div className="space-y-6">
        <ThemeSelector
          label="Theme"
          name="theme"
          options={appearance.themes}
          value={theme}
          onChange={setTheme}
        />
        <ThemeSelector
          label="Sidebar"
          name="sidebar"
          options={appearance.sidebars}
          value={sidebar}
          onChange={setSidebar}
        />
        <ThemeSelector
          label="Font Size"
          name="fontSize"
          options={appearance.fontSizes}
          value={fontSize}
          onChange={setFontSize}
        />
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl bg-cnhs-green-dark px-4 text-xs font-semibold text-white transition-colors hover:bg-[#246f54]"
        >
          <Check size={14} />
          Apply Appearance
        </button>
      </div>
    </section>
  );
}
