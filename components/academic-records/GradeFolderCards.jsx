"use client";

import { motion } from "framer-motion";
import { Folder } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * OneData-style grade folder cards for Academic Records browse.
 */
export default function GradeFolderCards({
  rows = [],
  activeGrade = "All Grades",
  onSelect,
}) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center text-xs text-slate-500">
        No grade-level folders for this period.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {rows.map((row) => {
        const high = Number(row.priority ?? 0);
        const aral = Number(row.aral ?? 0);
        const empty = Number(row.students ?? 0) === 0;
        const attention = !empty && (high > 0 || aral > 0);
        const active =
          activeGrade === row.grade ||
          activeGrade === String(row.grade).replace(/^Grade\s+/i, "");

        return (
          <motion.button
            key={row.grade}
            type="button"
            whileHover={{ y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={() => onSelect?.(row.grade)}
            className={cn(
              "group flex cursor-pointer flex-col rounded-2xl border bg-white p-4 text-left shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition-colors",
              active
                ? "border-cnhs-green bg-cnhs-green-soft/30 ring-1 ring-green-100"
                : empty
                  ? "border-dashed border-slate-200 hover:border-green-100 hover:bg-cnhs-green-soft/10"
                  : "border-slate-100 hover:border-green-100 hover:bg-cnhs-green-soft/20"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl ring-1",
                  empty
                    ? "bg-slate-50 text-slate-400 ring-slate-100"
                    : "bg-cnhs-green-soft text-cnhs-green-dark ring-green-100"
                )}
              >
                <Folder size={18} strokeWidth={1.75} />
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  empty
                    ? "bg-slate-50 text-slate-400 ring-1 ring-slate-100"
                    : attention
                      ? "bg-orange-50 text-cnhs-orange ring-1 ring-orange-100"
                      : "bg-green-50 text-cnhs-green-dark ring-1 ring-green-100"
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    empty
                      ? "bg-slate-300"
                      : attention
                        ? "bg-cnhs-orange"
                        : "bg-cnhs-green"
                  )}
                />
                {empty ? "Empty" : attention ? "Attention" : "Active"}
              </span>
            </div>

            <p className="mt-4 text-[13px] font-semibold tracking-[-0.01em] text-slate-900">
              {row.grade}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {empty
                ? "No learners yet"
                : `${row.students} learner${row.students === 1 ? "" : "s"}${
                    Number(row.ungraded) > 0
                      ? ` · ${row.ungraded} ungraded`
                      : ""
                  }`}
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {high > 0 ? (
                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-cnhs-orange ring-1 ring-orange-100">
                  {high} high risk
                </span>
              ) : null}
              {aral > 0 ? (
                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-100">
                  {aral} ARAL
                </span>
              ) : null}
              {empty ? (
                <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-400 ring-1 ring-slate-100">
                  Awaiting roster / ECR
                </span>
              ) : high === 0 && aral === 0 ? (
                <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-100">
                  No priority flags
                </span>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3">
              <span className="text-[11px] text-slate-400">
                {empty
                  ? "Mod 0 · Low 0"
                  : `Mod ${row.moderate ?? 0} · Low ${row.low ?? 0}`}
              </span>
              <span className="text-[11px] font-semibold text-cnhs-green-dark opacity-0 transition-opacity group-hover:opacity-100">
                Open →
              </span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
