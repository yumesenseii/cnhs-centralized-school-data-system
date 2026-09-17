"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

const ENTER = { opacity: 0, y: -6 };
const SHOW = { opacity: 1, y: 0 };
const EXIT = { opacity: 0, y: -4 };
const TRANSITION = { duration: 0.18, ease: "easeOut" };

const TONE = {
  error:
    "rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-600",
  success:
    "rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-medium text-cnhs-green-dark",
  info: "rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700",
  toast:
    "rounded-xl bg-slate-900 px-4 py-2.5 text-[11px] font-medium text-white shadow-lg",
};

/** Inline validation / status banner with enter-exit motion. */
export function AnimatedBanner({
  message,
  tone = "error",
  className,
  role,
}) {
  const resolvedRole =
    role ?? (tone === "error" ? "alert" : "status");

  return (
    <AnimatePresence mode="wait">
      {message ? (
        <motion.div
          key={String(message)}
          initial={ENTER}
          animate={SHOW}
          exit={EXIT}
          transition={TRANSITION}
          role={resolvedRole}
          className={cn(TONE[tone] ?? TONE.error, className)}
        >
          {message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Floating / page toast — pass className for fixed positioning. */
export function AnimatedToast({ message, tone = "info", className }) {
  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          key={String(message)}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={TRANSITION}
          role="status"
          className={cn(TONE[tone] ?? TONE.info, "shadow-lg", className)}
        >
          {message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
