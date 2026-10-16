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
import { AlertCircle, Check, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const TOAST_DURATION_MS = 5000;

function inferTone(message, explicit) {
  if (explicit) return explicit;
  const text = String(message || "");
  if (/unable|error|fail|invalid|denied|choose approve|required/i.test(text)) return "error";
  if (/preparing|loading/i.test(text)) return "info";
  return "success";
}

const TONE_STYLES = {
  success: {
    accent: "text-cnhs-green",
    bar: "bg-cnhs-green",
    iconWrap: "bg-cnhs-green text-white shadow-xs",
    container:
      "border-emerald-100/80 bg-gradient-to-br from-emerald-50/95 via-white to-teal-50/90 shadow-[0_12px_40px_rgba(16,185,129,0.14)] backdrop-blur-md dark:border-cnhs-green/40 dark:bg-[var(--card)] dark:bg-none dark:shadow-[0_12px_40px_rgba(0,0,0,0.55)]",
    title: "text-slate-900 dark:text-card-foreground",
    desc: "text-slate-600 dark:text-muted-foreground",
    Icon: Check,
  },
  error: {
    accent: "text-red-500",
    bar: "bg-red-500",
    iconWrap: "bg-red-500 text-white shadow-xs",
    container:
      "border-red-200/80 bg-gradient-to-br from-red-50/95 via-white to-rose-50/90 shadow-[0_12px_40px_rgba(239,68,68,0.14)] backdrop-blur-md dark:border-red-500/30 dark:bg-[var(--card)] dark:bg-none dark:shadow-[0_12px_40px_rgba(0,0,0,0.55)]",
    title: "text-red-950 dark:text-white",
    desc: "text-red-900/80 dark:text-slate-300",
    Icon: AlertCircle,
  },
  info: {
    accent: "text-slate-500",
    bar: "bg-slate-400",
    iconWrap: "bg-slate-700 text-white shadow-xs dark:bg-slate-600",
    container:
      "border-slate-200/80 bg-gradient-to-br from-slate-50/95 via-white to-slate-100/90 shadow-[0_12px_40px_rgba(15,23,42,0.12)] backdrop-blur-md dark:border-white/10 dark:bg-[var(--card)] dark:bg-none dark:shadow-[0_12px_40px_rgba(0,0,0,0.55)]",
    title: "text-slate-900 dark:text-card-foreground",
    desc: "text-slate-600 dark:text-muted-foreground",
    Icon: Info,
  },
};

export function AppToast({
  title = null,
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
  const visible = Boolean(message || title);
  const resolvedTone = inferTone(title || message, tone);
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
  }, [visible, message, title, durationMs]);

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
          initial={{ opacity: 0, y: -12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.96 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="pointer-events-auto fixed right-4 top-4 z-[200] w-[min(26rem,calc(100vw-2rem))] sm:right-6 sm:top-5"
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
            className={cn(
              "relative overflow-hidden rounded-2xl border transition-shadow",
              styles.container
            )}
            onClick={() => onDismiss?.()}
          >
            <div className="flex items-start gap-3 px-3.5 py-3">
              <span
                className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  styles.iconWrap
                )}
              >
                <Icon size={15} strokeWidth={2.4} />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                {title ? (
                  <p
                    className={cn(
                      "text-[13px] font-semibold tracking-tight leading-snug",
                      styles.title
                    )}
                  >
                    {title}
                  </p>
                ) : null}
                {message ? (
                  <p
                    className={cn(
                      "text-[11px] leading-snug break-words",
                      styles.desc,
                      title && "mt-0.5"
                    )}
                  >
                    {message}
                  </p>
                ) : null}
                {action?.href && action?.label ? (
                  <Link
                    href={action.href}
                    onClick={(event) => event.stopPropagation()}
                    className={cn(
                      "mt-1.5 inline-block text-[11px] font-semibold underline-offset-2 hover:underline",
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
                className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-black/5 hover:text-slate-700 dark:text-muted-foreground dark:hover:bg-white/10 dark:hover:text-card-foreground"
              >
                <X size={14} />
              </button>
            </div>
            <div className="h-[2.5px] bg-slate-200/50 dark:bg-white/10 overflow-hidden">
              <motion.div
                key={`${title}-${message}-${paused}-${remaining}`}
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

  const showToast = useCallback((firstArg, secondArg = {}) => {
    let title = null;
    let message = "";
    let options = {};

    if (firstArg && typeof firstArg === "object" && !Array.isArray(firstArg)) {
      options = firstArg;
      title = options.title ? String(options.title).trim() : null;
      message = options.message ? String(options.message).trim() : "";
    } else if (typeof firstArg === "string") {
      const trimmedFirst = firstArg.trim();
      // Handle legacy positional arguments like showToast("success", "Item saved")
      if (
        (trimmedFirst === "success" ||
          trimmedFirst === "error" ||
          trimmedFirst === "info" ||
          trimmedFirst === "warning") &&
        typeof secondArg === "string"
      ) {
        options = { tone: trimmedFirst };
        message = secondArg.trim();
      } else {
        message = trimmedFirst;
        if (secondArg && typeof secondArg === "object") {
          options = secondArg;
          if (options.title) title = String(options.title).trim();
          if (options.message) message = String(options.message).trim();
        }
      }
    }

    if (!message && !title) {
      setToast(null);
      return;
    }

    const toastTone = inferTone(title || message, options.tone);
    setToast({
      id: `${Date.now()}-${title || ""}-${message}`,
      title,
      message,
      tone: toastTone,
      action: options.action ?? null,
      durationMs: options.durationMs ?? TOAST_DURATION_MS,
    });
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismiss }}>
      {children}
      <AppToast
        key={toast?.id ?? "empty"}
        title={toast?.title ?? null}
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
