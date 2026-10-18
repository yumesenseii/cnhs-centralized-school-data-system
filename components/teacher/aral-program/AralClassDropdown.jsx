"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AralClassDropdown({
  classes = [],
  selectedClassId = null,
  onSelectClass,
  className,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedClass =
    classes.find((c) => c.classId === selectedClassId || c.key === selectedClassId) ||
    classes[0] ||
    null;

  // Click-outside listener & Escape key handler
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!classes || classes.length === 0) {
    return null;
  }

  const isEnglish = selectedClass?.language?.toLowerCase().includes("eng");

  return (
    <div ref={containerRef} className={cn("relative inline-block text-left", className)}>
      {/* Dropdown Toggle Button */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "inline-flex h-10 cursor-pointer items-center justify-between gap-3 rounded-xl border bg-white px-3.5 text-xs font-semibold shadow-2xs transition-all duration-200 dark:bg-slate-900",
          "hover:border-slate-300 dark:hover:border-white/20",
          open
            ? "border-[#246f54] ring-2 ring-emerald-100 dark:border-emerald-500 dark:ring-emerald-950/40"
            : "border-slate-200 dark:border-white/10"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-bold text-slate-900 dark:text-white truncate">
            {selectedClass?.gradeSection || "Select Class"}
          </span>

          {selectedClass && (
            <>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold shrink-0",
                  isEnglish
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                    : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                )}
              >
                {selectedClass.language}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300 shrink-0">
                <Users size={11} className="text-slate-400" />
                <span>{selectedClass.total}</span>
              </span>
            </>
          )}
        </div>

        {/* Single Animated Chevron Icon */}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="shrink-0 text-slate-400"
        >
          <ChevronDown size={15} strokeWidth={2} />
        </motion.span>
      </button>

      {/* Smooth Popover Menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute left-0 z-50 mt-1.5 min-w-[320px] max-w-[380px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl backdrop-blur-xs dark:border-white/10 dark:bg-slate-900"
          >
            <div className="px-2.5 py-1.5 border-b border-slate-100 dark:border-white/5 mb-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Assigned Language Classes
              </p>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-0.5">
              {classes.map((c) => {
                const isSelected =
                  selectedClass &&
                  (selectedClass.classId === c.classId || selectedClass.key === c.key);
                const isItemEng = c.language?.toLowerCase().includes("eng");

                return (
                  <button
                    key={c.classId || c.key}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelectClass?.(c.classId || c.key);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors duration-150",
                      isSelected
                        ? "bg-slate-50 font-bold text-slate-900 dark:bg-slate-800 dark:text-white"
                        : "hover:bg-slate-50 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs truncate">{c.gradeSection}</span>
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[10px] font-semibold shrink-0",
                          isItemEng
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                            : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        )}
                      >
                        {c.language}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-medium text-slate-400">
                        {c.total} learners
                      </span>
                      {isSelected ? (
                        <Check size={14} className="text-[#246f54] dark:text-emerald-400" />
                      ) : (
                        <span className="w-3.5" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
