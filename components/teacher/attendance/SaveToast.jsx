"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export default function SaveToast({ message, open }) {
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
        "pointer-events-none fixed right-4 top-4 z-[120] transition duration-200 ease-out",
        shown ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      )}
    >
      <div className="rounded-lg border border-green-100 bg-white px-3 py-2 text-[12px] font-semibold text-cnhs-green-dark shadow-lg">
        {message}
      </div>
    </div>,
    document.body
  );
}
