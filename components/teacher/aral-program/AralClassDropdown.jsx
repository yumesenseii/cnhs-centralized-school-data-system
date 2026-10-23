"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";
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

  const selectedLabel = selectedClass
    ? `${selectedClass.gradeSection} · ${selectedClass.language} · ${selectedClass.total} learners`
    : "Select Class";

  return (
    <div ref={containerRef} className={cn("relative inline-block text-left", className)}>
      {/* Dropdown Toggle Button */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "inline-flex h-8.5 cursor-pointer items-center justify-between gap-3 rounded-lg border bg-white px-3 text-xs font-medium shadow-2xs transition-colors dark:bg-slate-900",
          "hover:border-slate-300 dark:hover:border-white/20",
          open
            ? "border-[#246f54] ring-1 ring-[#246f54]/20 dark:border-emerald-500"
            : "border-slate-200 dark:border-white/10"
        )}
      >
        <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
          {selectedLabel}
        </span>

        {/* Single Chevron Icon */}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="shrink-0 text-slate-400"
        >
          <ChevronDown size={14} strokeWidth={2} />
        </motion.span>
      </button>

      {/* Popover Menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            role="listbox"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute left-0 z-50 mt-1 min-w-[300px] max-w-[360px] overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-slate-900"
          >
            <div className="px-2.5 py-1.5 border-b border-slate-100 dark:border-white/5 mb-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Assigned Language Classes
              </p>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-0.5">
              {classes.map((c) => {
                const isSelected =
                  selectedClass &&
                  (selectedClass.classId === c.classId || selectedClass.key === c.key);

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
                      "flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
                      isSelected
                        ? "bg-slate-100 font-semibold text-slate-900 dark:bg-slate-800 dark:text-white"
                        : "hover:bg-slate-50 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
                    )}
                  >
                    <div className="min-w-0 truncate">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {c.gradeSection}
                      </span>
                      <span className="text-slate-400 mx-1.5">·</span>
                      <span className="text-slate-600 dark:text-slate-400">
                        {c.language}
                      </span>
                      <span className="text-slate-400 mx-1.5">·</span>
                      <span className="text-slate-400">
                        {c.total} learners
                      </span>
                    </div>

                    {isSelected ? (
                      <Check size={14} className="text-[#246f54] dark:text-emerald-400 shrink-0" />
                    ) : (
                      <span className="w-3.5" />
                    )}
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
