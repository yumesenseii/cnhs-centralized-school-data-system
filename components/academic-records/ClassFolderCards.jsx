"use client";

import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ClassFolderCards({ classes = [], onSelect }) {
  if (!classes.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center text-xs text-slate-500">
        No class lists match the current filters.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {classes.map((cls) => (
        <motion.button
          key={cls.id}
          type="button"
          whileHover={{ y: -2 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          onClick={() => onSelect?.(cls)}
          className="group flex cursor-pointer flex-col rounded-lg border border-slate-100 bg-white p-4 text-left shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition-colors hover:border-green-100 hover:bg-cnhs-green-soft/15"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-cnhs-green-soft text-cnhs-green-dark ring-1 ring-green-100">
              <BookOpen size={18} strokeWidth={1.75} />
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                cls.hasUpload
                  ? "bg-green-50 text-cnhs-green-dark ring-green-100"
                  : "bg-slate-50 text-slate-500 ring-slate-100"
              )}
            >
              {cls.hasUpload
                ? "ECR uploaded"
                : cls.assignedNoEcr || cls.learnerCount === 0
                  ? "Assigned, no ECR for this term"
                  : "No grades yet"}
            </span>
          </div>
          <p className="mt-3 text-[13px] font-semibold text-slate-900">
            {cls.subject}
          </p>
          <p className="mt-0.5 text-[12px] text-slate-600">
            {cls.gradeSection} · {cls.termLabel}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">{cls.teacherName}</p>
          <div className="mt-3 flex items-center justify-between border-t border-slate-50 pt-3">
            <span className="text-[11px] text-slate-500">
              {cls.learnerCount} learner{cls.learnerCount === 1 ? "" : "s"}
              {cls.pendingCount
                ? ` · ${cls.pendingCount} without grade`
                : ""}
            </span>
            <span className="text-[11px] font-semibold text-cnhs-green-dark opacity-0 transition-opacity group-hover:opacity-100">
              Open list →
            </span>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
