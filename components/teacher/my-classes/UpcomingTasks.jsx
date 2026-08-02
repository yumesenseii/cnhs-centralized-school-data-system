"use client";

import { Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";

const dueTones = {
  red: "text-red-600",
  orange: "text-cnhs-orange",
  slate: "text-slate-500",
};

export default function UpcomingTasks({ tasks }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <h3 className="text-sm font-semibold text-slate-900">Upcoming Tasks</h3>
      <ul className="mt-3 space-y-3">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2"
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-cnhs-orange">
              <Clock3 size={13} />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-slate-800">{task.title}</p>
              <p className={cn("mt-1 text-[11px] font-medium", dueTones[task.tone] ?? dueTones.orange)}>
                {task.due}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
