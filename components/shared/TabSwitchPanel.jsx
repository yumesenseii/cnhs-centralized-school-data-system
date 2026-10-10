"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Short fade/slide when switching tab panels.
 * Respects prefers-reduced-motion (instant swap).
 */
export default function TabSwitchPanel({
  activeKey,
  children,
  className,
  id,
  role,
  "aria-labelledby": ariaLabelledBy,
}) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeKey}
        id={id}
        role={role}
        aria-labelledby={ariaLabelledBy}
        className={cn(className)}
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: 4 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 0.22, ease: "easeOut" }
        }
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
