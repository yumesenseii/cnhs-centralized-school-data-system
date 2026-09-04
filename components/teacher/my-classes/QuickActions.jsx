"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  Eraser,
  FileBarChart2,
  FileUp,
  MoreHorizontal,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  upload: Upload,
  file: FileUp,
  report: FileBarChart2,
  trash: Trash2,
  users: Users,
  eraser: Eraser,
  book: BookOpen,
  classes: BookOpen,
};

const btnBase =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition-colors";

/**
 * Class overview nav strip: primary CTA + secondary links/buttons + ⋯ overflow.
 * Matches My Classes ClassCard action hierarchy.
 */
export default function QuickActions({
  primary = null,
  secondary = [],
  overflow = [],
  onAction,
  busyId = null,
  menuLabel = "More class actions",
  align = "start",
  compact = false,
  title = null,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;

    function handlePointerDown(event) {
      if (
        !menuRef.current?.contains(event.target) &&
        !triggerRef.current?.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  function runAction(action) {
    setMenuOpen(false);
    onAction?.(action);
  }

  const PrimaryIcon = icons[primary?.icon] ?? Upload;
  // When right-aligned, keep buttons compact so they sit in the corner.
  const grow = align === "end" || compact ? "flex-none" : "flex-1 sm:flex-none";

  const primaryClassName = cn(
    btnBase,
    grow,
    "min-w-[9.5rem] cursor-pointer bg-cnhs-green-dark text-white hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-60"
  );

  return (
    <section
      aria-label={title || "Class navigation"}
      className={cn(
        compact
          ? "w-full sm:w-auto"
          : "rounded-xl border border-slate-100 bg-white p-2.5 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3"
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-2",
          align === "end" && "justify-end",
          title && align === "end" && "sm:justify-between"
        )}
      >
        {title ? (
          <p className="mr-auto text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400">
            {title}
          </p>
        ) : null}

        {primary ? (
          primary.href ? (
            <Link href={primary.href} className={primaryClassName}>
              <PrimaryIcon size={14} />
              {primary.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => runAction(primary)}
              disabled={busyId === primary.id}
              className={primaryClassName}
            >
              <PrimaryIcon
                size={14}
                className={busyId === primary.id ? "animate-pulse" : undefined}
              />
              {busyId === primary.id ? "Working…" : primary.label}
            </button>
          )
        ) : null}

        {secondary.map((action) => {
          const Icon = icons[action.icon] ?? Upload;
          const busy = busyId === action.id;
          const className = cn(
            btnBase,
            grow,
            "min-w-0 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
            action.tone === "orange" &&
              "border-cnhs-orange/40 text-cnhs-orange hover:bg-orange-50",
            action.tone === "violet" &&
              "border-violet-200 text-violet-700 hover:bg-violet-50",
            busy && "cursor-not-allowed opacity-60"
          );

          if (action.href) {
            return (
              <Link key={action.id} href={action.href} className={className}>
                <Icon size={14} />
                {action.label}
              </Link>
            );
          }

          return (
            <button
              key={action.id}
              type="button"
              onClick={() => runAction(action)}
              disabled={busy}
              className={cn(className, "cursor-pointer")}
            >
              <Icon size={14} className={busy ? "animate-pulse" : undefined} />
              {busy ? "Working…" : action.label}
            </button>
          );
        })}

        {overflow.length ? (
          <div className="relative">
            <button
              ref={triggerRef}
              type="button"
              aria-label={menuLabel}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
            >
              <MoreHorizontal size={16} />
            </button>

            {menuOpen ? (
              <div
                ref={menuRef}
                id={menuId}
                role="menu"
                aria-label={menuLabel}
                className="absolute right-0 top-full z-20 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_28px_rgba(15,23,42,0.14)]"
              >
                {overflow.map((action, index) => {
                  const Icon = icons[action.icon] ?? ChevronRight;
                  const busy = busyId === action.id;
                  const danger = action.tone === "danger";
                  const showDivider =
                    action.dividerBefore ||
                    (danger &&
                      index > 0 &&
                      overflow[index - 1]?.tone !== "danger");

                  const itemClass = cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                    danger
                      ? "text-red-600 hover:bg-red-50"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  );

                  return (
                    <div key={action.id}>
                      {showDivider ? (
                        <div className="my-1 border-t border-slate-100" />
                      ) : null}
                      {action.href ? (
                        <Link
                          href={action.href}
                          role="menuitem"
                          className={itemClass}
                          onClick={() => setMenuOpen(false)}
                        >
                          <Icon size={13} aria-hidden="true" />
                          {action.label}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          role="menuitem"
                          disabled={busy}
                          onClick={() => runAction(action)}
                          className={itemClass}
                        >
                          <Icon size={13} aria-hidden="true" />
                          {busy ? "Working…" : action.label}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
