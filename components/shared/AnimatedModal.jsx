"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { VIEW_MODAL_BACKDROP } from "@/lib/ui/viewModal";
import { cn } from "@/lib/utils";

const BACKDROP_TRANSITION = { duration: 0.18, ease: "easeOut" };
const PANEL_TRANSITION = { duration: 0.2, ease: [0.22, 1, 0.36, 1] };

/**
 * Shared centered modal shell — fade backdrop + light scale/slide panel.
 * Keep mounted with `open={false}` so exit animation can run.
 */
export default function AnimatedModal({
  open,
  onClose,
  children,
  labelledBy,
  describedBy,
  className,
  panelClassName,
  zClassName = "z-50",
  closeOnBackdrop = true,
  closeOnEscape = true,
  portal = true,
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !closeOnEscape) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, closeOnEscape, onClose]);

  const tree = (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="animated-modal-root"
          className={cn(VIEW_MODAL_BACKDROP, zClassName, className)}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          aria-describedby={describedBy}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={BACKDROP_TRANSITION}
          onClick={(e) => {
            if (e.target === e.currentTarget && closeOnBackdrop) onClose?.();
          }}
        >
          <motion.div
            className={cn("relative z-10", panelClassName)}
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={PANEL_TRANSITION}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  if (!mounted || typeof document === "undefined") return null;
  return portal ? createPortal(tree, document.body) : tree;
}
