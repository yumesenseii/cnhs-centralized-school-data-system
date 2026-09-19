"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import { consumeWelcomeToast } from "@/lib/auth/welcomeToast";
import { cn } from "@/lib/utils";

const DURATION_MS = 5_000;

/**
 * Top-right welcome toast after login. Shows once for ~5 seconds.
 * Same copy for all roles; follows light/dark theme.
 */
export default function WelcomeLoginToast() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const payload = consumeWelcomeToast();
    if (!payload?.name) return undefined;

    setName(payload.name);
    setOpen(true);
    const timer = window.setTimeout(() => setOpen(false), DURATION_MS);
    return () => window.clearTimeout(timer);
  }, []);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed right-4 top-4 z-[200] flex w-[min(22rem,calc(100vw-2rem))] items-start gap-3 rounded-2xl border px-3.5 py-3 shadow-[0_12px_40px_rgba(15,23,42,0.14)] backdrop-blur-md sm:right-6 sm:top-5",
        "border-emerald-100/80 bg-gradient-to-br from-emerald-50/95 via-white to-teal-50/90",
        "dark:border-cnhs-green/40 dark:bg-[var(--card)] dark:bg-none dark:shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
      )}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cnhs-green text-white shadow-sm">
        <Check size={15} strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[13px] font-semibold tracking-tight text-slate-900 dark:text-card-foreground">
          Welcome, {name}!
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-muted-foreground">
          You&apos;ve successfully logged in.
        </p>
      </div>
      <button
        type="button"
        aria-label="Dismiss welcome message"
        onClick={() => setOpen(false)}
        className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-muted-foreground dark:hover:bg-white/10 dark:hover:text-card-foreground"
      >
        <X size={14} />
      </button>
    </div>,
    document.body
  );
}
