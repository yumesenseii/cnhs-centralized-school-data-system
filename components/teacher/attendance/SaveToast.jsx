"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Floating success toast with optional next-action link.
 */
export default function SaveToast({ message, open, href, linkLabel }) {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (open && message) {
      setMounted(true);
      const frame = window.requestAnimationFrame(() => setShown(true));
      return () => window.cancelAnimationFrame(frame);
    }
    setShown(false);
    const timer = window.setTimeout(() => setMounted(false), 220);
    return () => window.clearTimeout(timer);
  }, [open, message]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        "fixed right-4 top-4 z-[120] transition duration-200 ease-out",
        shown ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
        href ? "pointer-events-auto" : "pointer-events-none"
      )}
    >
      <div className="max-w-sm rounded-lg border border-green-100 bg-white px-3 py-2 text-[12px] font-semibold text-cnhs-green-dark shadow-lg">
        <p>{message}</p>
        {href && linkLabel ? (
          <Link
            href={href}
            className="mt-1 inline-block text-[11px] font-semibold text-cnhs-green-dark underline-offset-2 hover:underline"
          >
            {linkLabel}
          </Link>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
