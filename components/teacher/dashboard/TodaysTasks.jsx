"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const priorityStyles = {
  "High Priority": "bg-red-50 text-red-600",
  "Due Today": "bg-orange-50 text-cnhs-orange",
  Medium: "bg-amber-50 text-amber-700",
  Completed: "bg-green-50 text-cnhs-green-dark",
};

export default function TodaysTasks({ tasks = { items: [] } }) {
  const [items, setItems] = useState(tasks.items || []);

  useEffect(() => {
    setItems(tasks.items || []);
  }, [tasks.items]);

  function toggleTask(id) {
    setItems((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  }

  const pendingCount = items.filter((task) => !task.completed).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.03)]">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-[-0.01em] text-slate-900">
            To Do
          </h2>
          <span className="rounded-full bg-cnhs-green-soft px-2 py-0.5 text-[10px] font-semibold text-cnhs-green-dark">
            {pendingCount} Pending
          </span>
        </div>
      </div>

      <ul className="divide-y divide-slate-100">
        {items.length ? (
          items.map((task) => (
            <li
              key={task.id}
              className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <button
                  type="button"
                  onClick={() => toggleTask(task.id)}
                  aria-label={
                    task.completed
                      ? `Mark ${task.title} incomplete`
                      : `Complete ${task.title}`
                  }
                  aria-pressed={task.completed}
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors",
                    task.completed
                      ? "border-cnhs-green bg-cnhs-green text-white"
                      : "border-slate-300 bg-white hover:border-cnhs-green"
                  )}
                >
                  {task.completed ? (
                    <Check size={10} strokeWidth={3} />
                  ) : null}
                </button>
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-xs font-semibold leading-snug text-slate-800",
                      task.completed && "text-slate-400 line-through"
                    )}
                  >
                    {task.title}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">
                    {task.subtitle}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 pl-6 sm:pl-0">
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                    priorityStyles[task.priority] ??
                      "bg-slate-100 text-slate-500"
                  )}
                >
                  {task.priority}
                </span>

                {task.href && !task.completed ? (
                  <Link
                    href={task.href}
                    className="inline-flex h-6 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-600 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900"
                  >
                    {task.actionLabel || "Open"}
                    <ArrowRight size={10} />
                  </Link>
                ) : null}
              </div>
            </li>
          ))
        ) : (
          <li className="flex flex-col items-center justify-center py-8 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cnhs-green-soft text-cnhs-green-dark">
              <CheckCircle2 size={20} strokeWidth={2.2} />
            </span>
            <p className="mt-2 text-xs font-semibold text-slate-800">
              You&apos;re all caught up.
            </p>
            <p className="text-[11px] text-slate-400">
              No pending tasks right now.
            </p>
          </li>
        )}
      </ul>
    </section>
  );
}
