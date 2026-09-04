"use client";

import { cn } from "@/lib/utils";

const TABS = [
  { id: 1, label: "Term 1" },
  { id: 2, label: "Term 2" },
  { id: 3, label: "Term 3" },
  { id: "summary", label: "Summary (AVE)" },
];

export default function EcrTermTabs({ activeTerm, onChange }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50/80 p-1">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "cursor-pointer rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors",
            String(activeTerm) === String(tab.id)
              ? "bg-white text-cnhs-green-dark shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
