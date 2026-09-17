"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const TOAST_DURATION_MS = 5000;

function inferTone(message, explicit) {
  if (explicit) return explicit;
  const text = String(message || "");
  if (/unable|error|fail|invalid|denied/i.test(text)) return "error";
  if (/preparing|loading/i.test(text)) return "info";
  return "success";
}

const TONE_STYLES = {
  success: {
    accent: "text-cnhs-green",
    bar: "bg-cnhs-green",
    iconWrap: "bg-cnhs-green-soft text-cnhs-green-dark",
    Icon: Check,
  },
  error: {
    accent: "text-red-500",
    bar: "bg-red-500",
    iconWrap: "bg-red-50 text-red-600",
    Icon: Info,
  },
  info: {
    accent: "text-slate-500",
    bar: "bg-slate-400",
    iconWrap: "bg-slate-100 text-slate-600",
    Icon: Info,
  },
};

export function AppToast({
  message,
  tone = "success",
  durationMs = TOAST_DURATION_MS,
  onDismiss,
  action,
}) {
  const [mounted, setMounted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState(durationMs);
  const startedAtRef = useRef(Date.now());
  const visible = Boolean(message);
  const resolvedTone = inferTone(message, tone);
  const styles = TONE_STYLES[resolvedTone] ?? TONE_STYLES.success;
  const Icon = styles.Icon;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    setPaused(false);
    setRemaining(durationMs);
    startedAtRef.current = Date.now();
  }, [visible, message, durationMs]);

  useEffect(() => {
    if (!visible || paused) return undefined;
    startedAtRef.current = Date.now();
    const timer = window.setTimeout(() => onDismiss?.(), remaining);
    return () => window.clearTimeout(timer);
  }, [visible, paused, remaining, onDismiss]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {visible ? (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 8 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="pointer-events-auto fixed right-4 top-4 z-[120] w-[min(22rem,calc(100vw-2rem))] sm:right-6 sm:top-5"
          onMouseEnter={() => {
            setPaused(true);
            setRemaining((current) =>
              Math.max(0, current - (Date.now() - startedAtRef.current))
            );
          }}
          onMouseLeave={() => {
            startedAtRef.current = Date.now();
            setPaused(false);
          }}
        >
          <div
            className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-[#1c1c1c] dark:shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
            onClick={() => onDismiss?.()}
          >
            <div className="flex items-start gap-2.5 px-3 py-2.5">
              <span
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  styles.iconWrap
                )}
              >
                <Icon size={14} strokeWidth={2.4} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[12px] font-medium leading-4 text-slate-700 dark:text-white/85">
                  {message}
                </p>
                {action?.href && action?.label ? (
                  <Link
                    href={action.href}
                    onClick={(event) => event.stopPropagation()}
                    className={cn(
                      "mt-1 inline-block text-[11px] font-semibold underline-offset-2 hover:underline",
                      styles.accent
                    )}
                  >
                    {action.label}
                  </Link>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={(event) => {
                  event.stopPropagation();
                  onDismiss?.();
                }}
                className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/8 dark:hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
            <div className="h-[3px] bg-slate-100 dark:bg-white/8">
              <motion.div
                key={`${message}-${paused}-${remaining}`}
                className={cn("h-full origin-left", styles.bar)}
                initial={{ scaleX: remaining / Math.max(durationMs, 1) }}
                animate={{ scaleX: paused ? remaining / Math.max(durationMs, 1) : 0 }}
                transition={{
                  duration: paused ? 0 : remaining / 1000,
                  ease: "linear",
                }}
              />
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  const dismiss = useCallback(() => {
    setToast(null);
  }, []);

  const showToast = useCallback((message, options = {}) => {
    const text = String(message ?? "").trim();
    if (!text) {
      setToast(null);
      return;
    }
    setToast({
      id: `${Date.now()}-${text}`,
      message: text,
      tone: inferTone(text, options.tone),
      action: options.action ?? null,
      durationMs: options.durationMs ?? TOAST_DURATION_MS,
    });
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismiss }}>
      {children}
      <AppToast
        key={toast?.id ?? "empty"}
        message={toast?.message ?? ""}
        tone={toast?.tone}
        durationMs={toast?.durationMs}
        action={toast?.action}
        onDismiss={dismiss}
      />
    </ToastContext.Provider>
  );
}

export function useAppToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useAppToast must be used inside ToastProvider.");
  }
  return context;
}
