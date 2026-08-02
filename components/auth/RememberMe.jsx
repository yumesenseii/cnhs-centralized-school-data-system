"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function RememberMe({ checked, onChange, label, forgotLabel, onForgot }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="group flex cursor-pointer items-center gap-2 select-none">
        <span className="relative flex h-4 w-4 items-center justify-center">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            className="peer sr-only"
          />
          <motion.span
            animate={{ scale: checked ? 1 : 0.92 }}
            transition={{ type: "spring", stiffness: 420, damping: 22 }}
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded border transition-colors",
              checked
                ? "border-[#174D37] bg-[#174D37]"
                : "border-slate-300 bg-white group-hover:border-slate-400"
            )}
            aria-hidden="true"
          >
            {checked ? (
              <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-none stroke-white stroke-[2.2]">
                <path d="M2.5 6.2 4.8 8.5 9.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : null}
          </motion.span>
        </span>
        <span className="text-[12px] font-medium text-slate-600">{label}</span>
      </label>

      <button
        type="button"
        onClick={onForgot}
        className="cursor-pointer text-[12px] font-semibold text-[#F4C430] transition-opacity hover:opacity-80"
      >
        {forgotLabel}
      </button>
    </div>
  );
}
