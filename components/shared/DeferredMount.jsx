"use client";

import { useEffect, useState } from "react";

/**
 * Mount children after first paint (or after `delayMs`) so the primary
 * dashboard content is not blocked by secondary panels.
 */
export default function DeferredMount({ children, delayMs = 50, fallback = null }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const start = () => {
      if (!cancelled) setReady(true);
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = window.requestIdleCallback(start, { timeout: delayMs + 400 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback?.(id);
      };
    }

    const timer = window.setTimeout(start, delayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [delayMs]);

  if (!ready) return fallback;
  return children;
}
