"use client";

import { ChevronRight, FileBarChart2, FileUp, Upload } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const icons = {
  upload: Upload,
  file: FileUp,
  report: FileBarChart2,
};

const tones = {
  primary: "bg-cnhs-green-dark text-white hover:bg-[#246f54]",
  violet: "border border-violet-200 bg-white text-violet-700 hover:bg-violet-50",
  orange: "border border-orange-200 bg-white text-cnhs-orange hover:bg-orange-50",
};

export default function QuickActions({ actions, classId, onAction, busyId = null }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <h3 className="text-sm font-semibold text-slate-900">Quick Actions</h3>
      <div className="mt-3 space-y-2">
        {actions.map((action) => {
          const Icon = icons[action.icon] ?? Upload;
          const busy = busyId === action.id;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onAction?.(action)}
              disabled={busy}
              className={cn(
                "inline-flex h-10 w-full cursor-pointer items-center gap-2 rounded-xl px-3 text-left text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                tones[action.tone] ?? tones.primary
              )}
            >
              <Icon size={14} className={busy ? "animate-pulse" : undefined} />
              <span className="flex-1">{busy ? "Generating…" : action.label}</span>
              <ChevronRight size={14} className="opacity-70" />
            </button>
          );
        })}
        {classId ? (
          <Link
            href={`/teacher/my-classes/${classId}/students`}
            className="inline-flex h-10 w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <span className="flex-1">View Students</span>
            <ChevronRight size={14} className="opacity-70" />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
