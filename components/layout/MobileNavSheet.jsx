"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { SIDEBAR_SHEET_CLASS } from "@/lib/constants/layout";

/**
 * Mobile hamburger + slide-out nav. Sheet mounts after hydration so Base UI
 * ids do not mismatch server HTML.
 */
export default function MobileNavSheet({ ariaLabel, title, children }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function close() {
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors duration-200 hover:bg-slate-50 lg:hidden"
        onClick={() => {
          if (mounted) setOpen(true);
        }}
      >
        <Menu size={18} aria-hidden="true" />
      </button>
      {mounted ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="left"
            showCloseButton={false}
            className={SIDEBAR_SHEET_CLASS}
          >
            <SheetTitle className="sr-only">{title}</SheetTitle>
            {typeof children === "function" ? children(close) : children}
          </SheetContent>
        </Sheet>
      ) : null}
    </>
  );
}
