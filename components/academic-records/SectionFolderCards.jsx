"use client";

import { motion } from "framer-motion";
import { Folder } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SectionFolderCards({ rows = [], onSelect }) {
  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center text-xs text-slate-500">
        No sections in this grade for the current filters.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {rows.map((row) => {
        const empty = Number(row.classCount ?? 0) === 0;
        return (
          <motion.button
            key={row.section}
            type="button"
            whileHover={{ y: -2 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={() => onSelect?.(row.section)}
            className="group flex cursor-pointer flex-col rounded-lg border border-slate-100 bg-white p-4 text-left shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition-colors hover:border-green-100 hover:bg-cnhs-green-soft/20"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-cnhs-green-soft text-cnhs-green-dark ring-1 ring-green-100">
                <Folder size={18} strokeWidth={1.75} />
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                  row.uploaded
                    ? "bg-green-50 text-cnhs-green-dark ring-green-100"
                    : "bg-slate-50 text-slate-500 ring-slate-100"
                )}
              >
                {row.uploaded ? "ECR uploaded" : "No grades yet"}
              </span>
            </div>
            <p className="mt-4 text-[13px] font-semibold tracking-[-0.01em] text-slate-900">
              {row.section}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {empty
                ? "No class lists yet"
                : `${row.classCount} class${row.classCount === 1 ? "" : "es"} · ${row.students} in lists`}
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3">
              <span className="text-[11px] text-slate-400">
                {row.graded ?? 0} graded · {row.pending ?? 0} pending
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
