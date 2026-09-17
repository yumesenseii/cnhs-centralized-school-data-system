"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Animated filter dropdown for student portal (Term / Subject, etc.).
 * Dark-friendly theme tokens; not a native <select>.
 */
export default function StudentFilterDropdown({
  label,
  value,
  options = [],
  onChange,
  className,
  placeholder = "Select",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listId = useId();
  const selected = options.find((opt) => opt.value === value);
  const display = selected?.label ?? placeholder;

  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative min-w-[140px] flex-1 space-y-1", className)}>
      {label ? (
        <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
      ) : null}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "inline-flex h-9 w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-card px-2.5 text-left text-[11px] font-medium text-card-foreground shadow-sm",
          "transition-colors duration-200 hover:border-cnhs-green/50 hover:bg-muted/40",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cnhs-green/35",
          open && "border-cnhs-green/55 bg-muted/30"
        )}
      >
        <span className="min-w-0 truncate">{display}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="shrink-0 text-muted-foreground"
        >
          <ChevronDown size={14} strokeWidth={1.9} />
        </motion.span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.ul
            id={listId}
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute left-0 right-0 z-40 mt-1 max-h-56 overflow-auto rounded-xl border border-border bg-card p-1 shadow-[0_12px_28px_rgba(0,0,0,0.28)]"
          >
            {options.map((opt) => {
              const isActive = opt.value === value;
              return (
                <li key={opt.value} role="option" aria-selected={isActive}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange?.(opt.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-medium",
                      "transition-colors duration-200",
                      isActive
                        ? "bg-cnhs-green/15 text-cnhs-green-dark dark:text-emerald-300"
                        : "text-card-foreground hover:bg-muted/70"
                    )}
                  >
                    <span className="min-w-0 truncate">{opt.label}</span>
                    {isActive ? (
                      <Check size={13} className="shrink-0 text-cnhs-green-dark dark:text-emerald-300" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
