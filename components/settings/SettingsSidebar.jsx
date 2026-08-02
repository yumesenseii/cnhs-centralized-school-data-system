"use client";

import { Info, Lock, Palette, School, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  school: School,
  user: UserRound,
  palette: Palette,
  lock: Lock,
  info: Info,
};

export default function SettingsSidebar({ items, activeId, onSelect }) {
  return (
    <nav
      aria-label="Settings sections"
      className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]"
    >
      <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        Settings
      </p>
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = icons[item.icon] ?? Info;
          const isActive = item.id === activeId;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[12px] font-medium transition-all duration-200",
                isActive
                  ? "bg-cnhs-green-dark text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon size={15} strokeWidth={1.9} className={isActive ? "text-white" : "text-slate-400"} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
