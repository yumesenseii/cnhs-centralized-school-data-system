"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Modern user profile dropdown capsule & menu.
 * Displays user identity, role, handled subjects/department, settings, and logout.
 */
export default function UserProfileDropdown({
  name = "Dulce Galang",
  initials = "DG",
  role = "School Principal",
  subtitle = "School Principal · Admin",
  settingsHref = "/settings",
  onLogout,
  avatarBgColor = "bg-cnhs-sidebar",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Capsule */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className={cn(
          "group flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 py-1 pl-3 pr-2 shadow-xs backdrop-blur-xs transition-all duration-200 hover:border-cnhs-green/40 hover:bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-cnhs-green/50 dark:hover:bg-slate-800/80",
          isOpen && "ring-2 ring-cnhs-green/30 border-cnhs-green/60"
        )}
      >
        <div className="hidden flex-col text-right sm:flex">
          <span className="max-w-[170px] truncate text-[13px] font-semibold leading-tight text-slate-800 dark:text-slate-100">
            {name}
          </span>
          <span className="max-w-[170px] truncate text-[11px] font-medium leading-tight text-slate-500 dark:text-slate-400">
            {subtitle || role}
          </span>
        </div>

        {/* Circular Avatar */}
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white shadow-xs transition-transform duration-200 group-hover:scale-105",
            avatarBgColor
          )}
        >
          {initials}
        </div>

        <ChevronDown
          size={14}
          strokeWidth={2.2}
          className={cn(
            "text-slate-400 transition-transform duration-200 dark:text-slate-400",
            isOpen && "rotate-180 text-cnhs-green dark:text-cnhs-green"
          )}
        />
      </button>

      {/* Floating Menu Card */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 top-full z-50 mt-2 w-56 origin-top-right rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150 dark:border-slate-800 dark:bg-slate-900 dark:shadow-2xl dark:ring-white/5"
        >
          {/* Header Profile Identity */}
          <div className="flex items-center gap-2.5 px-0.5">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white shadow-sm ring-2 ring-cnhs-green/20",
                avatarBgColor
              )}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold tracking-tight text-slate-900 dark:text-white">
                {name}
              </p>
              <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {subtitle || role}
              </p>
              <div className="mt-1 flex items-center">
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 ring-1 ring-inset ring-emerald-700/10 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-700/30">
                  {role}
                </span>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="mt-2.5 space-y-0.5 border-t border-slate-100 pt-2 dark:border-slate-800/80">
            <Link
              href={settingsHref}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Settings size={15} className="text-slate-400 dark:text-slate-400" />
              <span>Settings</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onLogout?.();
              }}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <LogOut size={15} className="text-red-500 dark:text-red-400" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
