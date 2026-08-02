"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const priorityStyles = {
  "High Priority": "bg-red-50 text-red-600",
  "Due Today": "bg-orange-50 text-cnhs-orange",
  Medium: "bg-amber-50 text-amber-700",
  Completed: "bg-green-50 text-cnhs-green-dark",
};

export default function TodaysTasks({ tasks }) {
  const [items, setItems] = useState(tasks.items);

  useEffect(() => {
    setItems(tasks.items);
  }, [tasks.items]);

  function toggleTask(id) {
    setItems((prev) =>
      prev.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task))
    );
  }

  const pendingCount = items.filter((task) => !task.completed).length;

  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Today&apos;s Tasks</h2>
          <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-cnhs-green-dark">
            {pendingCount}
          </span>
        </div>
        <button
          type="button"
          className="cursor-pointer text-[11px] font-semibold text-cnhs-green-dark transition-colors hover:text-[#246f54]"
        >
          View All
        </button>
      </div>

      <ul className="space-y-2.5">
        {items.length ? items.map((task) => (
          <li
            key={task.id}
            className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-start gap-3">
              <button
                type="button"
                onClick={() => toggleTask(task.id)}
                aria-label={task.completed ? `Mark ${task.title} incomplete` : `Complete ${task.title}`}
                aria-pressed={task.completed}
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors",
                  task.completed
                    ? "border-cnhs-green bg-cnhs-green text-white"
                    : "border-slate-300 bg-white hover:border-cnhs-green"
                )}
              >
                {task.completed ? <Check size={12} strokeWidth={3} /> : null}
              </button>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-[12px] font-semibold text-slate-800",
                    task.completed && "text-slate-400 line-through"
                  )}
                >
                  {task.title}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">{task.subtitle}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <span className="text-[11px] font-medium text-slate-400">{task.deadline}</span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-semibold",
                  priorityStyles[task.priority] ?? "bg-slate-100 text-slate-500"
                )}
              >
                {task.priority}
              </span>
            </div>
          </li>
        )) : (
          <li className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-8 text-center text-xs text-slate-500">
            No pending tasks for the selected period.
          </li>
        )}
      </ul>
    </section>
  );
}
