"use client";

import { useEffect, useState } from "react";
import { CircleHelp, X } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";

function useNarrowViewport(enabled) {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;
    const media = window.matchMedia("(max-width: 639px)");
    const sync = () => setNarrow(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [enabled]);

  return narrow;
}

const triggerClassName =
  "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-cnhs-green-dark/20 bg-white px-3 text-[11px] font-semibold text-cnhs-green-dark shadow-sm transition-colors duration-200 hover:bg-green-50 dark:border-cnhs-green/30 dark:bg-transparent dark:text-cnhs-green dark:hover:bg-white/5";

/**
 * Getting started help — ISO usability (learnability / assistance).
 * Opens a compact popover next to the trigger. Keep bullets short; no DepEd / PLP claims.
 * Popover mounts only after client hydration to avoid Base UI auto-id SSR mismatch.
 */
export default function PageHelp({
  title = "How to use this page",
  summary,
  steps = [],
  className = "",
}) {
  const [mounted, setMounted] = useState(false);
  const narrow = useNarrowViewport(mounted);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label={title}
        title={title}
        disabled
        className={cn(triggerClassName, "opacity-90", className)}
      >
        <CircleHelp size={15} strokeWidth={2} aria-hidden />
        Getting started
      </button>
    );
  }

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={title}
        title={title}
        className={cn(triggerClassName, className)}
      >
        <CircleHelp size={15} strokeWidth={2} aria-hidden />
        Getting started
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Backdrop className="fixed inset-0 z-50 bg-slate-900/20 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <Popover.Positioner
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            "z-50",
            narrow &&
              "!fixed !inset-0 !left-0 !top-0 !flex !translate-none !transform-none items-center justify-center p-4"
          )}
        >
          <Popover.Popup className="origin-[var(--transform-origin)] w-[min(24rem,calc(100vw-2rem))] max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl transition duration-200 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 dark:border-white/5 dark:bg-[var(--card)]">
            <div className="relative border-b border-slate-100 bg-green-50 px-4 py-3.5 pr-11 dark:border-white/5 dark:bg-cnhs-green-dark/15">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-cnhs-green-dark ring-1 ring-cnhs-green-dark/15 dark:bg-transparent dark:text-cnhs-green dark:ring-cnhs-green/30">
                  <CircleHelp size={15} strokeWidth={2} aria-hidden />
                </span>
                <div className="min-w-0">
                  <Popover.Title className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                    {title}
                  </Popover.Title>
                  {summary ? (
                    <Popover.Description className="mt-1 text-[12px] leading-5 text-slate-500">
                      {summary}
                    </Popover.Description>
                  ) : (
                    <Popover.Description className="sr-only">
                      Short steps for this page
                    </Popover.Description>
                  )}
                </div>
              </div>
              <Popover.Close
                aria-label="Close"
                className="absolute top-2.5 right-2.5 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/80 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-slate-200"
              >
                <X size={15} strokeWidth={2} />
              </Popover.Close>
            </div>
            <div className="max-h-[min(22rem,70vh)] overflow-y-auto px-4 py-4">
              <ol className="space-y-3">
                {steps.map((step, index) => (
                  <li key={step} className="flex gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cnhs-green-dark/10 text-[10px] font-bold text-cnhs-green-dark dark:text-cnhs-green">
                      {index + 1}
                    </span>
                    <span className="text-[12px] leading-5 text-slate-600 dark:text-slate-300">
                      {step}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
