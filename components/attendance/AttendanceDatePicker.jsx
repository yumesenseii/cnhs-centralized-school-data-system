"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { todayIsoDateManila } from "@/lib/attendance/sf2Daily";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parseIso(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function toIso(year, month, day) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatTriggerLabel(iso) {
  const parts = parseIso(iso);
  if (!parts) return "Pick a date";
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return date.toLocaleDateString("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function monthTitle(year, month) {
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function buildMonthCells(year, month) {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const daysInPrev = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const cells = [];
  for (let i = 0; i < firstDow; i += 1) {
    const day = daysInPrev - firstDow + 1 + i;
    cells.push({
      iso: toIso(prevYear, prevMonth, day),
      day,
      inMonth: false,
    });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      iso: toIso(year, month, day),
      day,
      inMonth: true,
    });
  }
  let nextDay = 1;
  while (cells.length < 42) {
    cells.push({
      iso: toIso(nextYear, nextMonth, nextDay),
      day: nextDay,
      inMonth: false,
    });
    nextDay += 1;
  }
  return cells;
}

/**
 * Custom CNHS date picker — replaces native <input type="date"> for roll call.
 * @param {{ value: string, onChange: (iso: string) => void, markedDates?: string[]|Set<string>, className?: string, disabled?: boolean }} props
 */
export default function AttendanceDatePicker({
  value,
  onChange,
  markedDates,
  className,
  disabled = false,
}) {
  const reduceMotion = useReducedMotion();
  const listId = useId();
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 280 });
  const [direction, setDirection] = useState(0);

  const selected = parseIso(value) || parseIso(todayIsoDateManila());
  const [viewYear, setViewYear] = useState(selected.year);
  const [viewMonth, setViewMonth] = useState(selected.month);

  const marked = useMemo(() => {
    if (!markedDates) return new Set();
    if (markedDates instanceof Set) return markedDates;
    return new Set(Array.from(markedDates).map(String));
  }, [markedDates]);

  const todayIso = todayIsoDateManila();
  const cells = useMemo(
    () => buildMonthCells(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const parts = parseIso(value);
    if (parts) {
      setViewYear(parts.year);
      setViewMonth(parts.month);
      setDirection(0);
    }
  }, [open, value]);

  function updateCoords() {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(280, Math.min(320, rect.width));
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }
    setCoords({
      top: rect.bottom + 6,
      left,
      width,
    });
  }

  useEffect(() => {
    if (!open) return;
    updateCoords();
    const onScroll = () => updateCoords();
    const onResize = () => updateCoords();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointer(e) {
      const t = e.target;
      if (rootRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  function shiftMonth(delta) {
    setDirection(delta);
    let nextMonth = viewMonth + delta;
    let nextYear = viewYear;
    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    } else if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    setViewYear(nextYear);
    setViewMonth(nextMonth);
  }

  function pickDay(iso) {
    onChange?.(iso);
    setOpen(false);
  }

  const motionDuration = reduceMotion ? 0 : 0.17;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <p className="text-[11px] font-medium text-slate-500">Date</p>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        className={cn(
          "mt-1 inline-flex h-8 w-full min-w-[9.5rem] cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-left text-[12px] font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-[var(--card)] dark:text-slate-200 dark:hover:bg-white/5"
        )}
      >
        <CalendarDays size={13} className="shrink-0 text-cnhs-green-dark dark:text-cnhs-green" />
        <span className="truncate">{formatTriggerLabel(value)}</span>
      </button>

      {mounted
        ? createPortal(
            <AnimatePresence>
              {open ? (
                <motion.div
                  ref={panelRef}
                  id={listId}
                  role="dialog"
                  aria-label="Choose attendance date"
                  initial={
                    reduceMotion ? false : { opacity: 0, y: 6, scale: 0.98 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={
                    reduceMotion
                      ? undefined
                      : { opacity: 0, y: 4, scale: 0.98 }
                  }
                  transition={{ duration: motionDuration, ease: "easeOut" }}
                  style={{
                    position: "fixed",
                    top: coords.top,
                    left: coords.left,
                    width: coords.width,
                    zIndex: 80,
                  }}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2.5 shadow-[0_12px_32px_rgba(15,23,42,0.12)] dark:border-white/5 dark:bg-[var(--card)] dark:shadow-none"
                >
                  <div className="flex items-center justify-between gap-1 px-0.5">
                    <button
                      type="button"
                      aria-label="Previous month"
                      onClick={() => shiftMonth(-1)}
                      className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-white/10 dark:hover:text-slate-100"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <p className="text-[12px] font-semibold text-slate-800 dark:text-slate-100">
                      {monthTitle(viewYear, viewMonth)}
                    </p>
                    <button
                      type="button"
                      aria-label="Next month"
                      onClick={() => shiftMonth(1)}
                      className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-white/10 dark:hover:text-slate-100"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>

                  <div className="mt-2 grid grid-cols-7 gap-0.5">
                    {WEEKDAYS.map((d) => (
                      <div
                        key={d}
                        className="py-1 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-400"
                      >
                        {d}
                      </div>
                    ))}
                  </div>

                  <div className="relative min-h-[192px] overflow-hidden">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={`${viewYear}-${viewMonth}`}
                        initial={
                          reduceMotion
                            ? false
                            : {
                                opacity: 0,
                                x: direction === 0 ? 0 : direction > 0 ? 12 : -12,
                              }
                        }
                        animate={{ opacity: 1, x: 0 }}
                        exit={
                          reduceMotion
                            ? undefined
                            : {
                                opacity: 0,
                                x: direction > 0 ? -12 : 12,
                              }
                        }
                        transition={{
                          duration: motionDuration,
                          ease: "easeOut",
                        }}
                        className="grid grid-cols-7 gap-0.5"
                      >
                        {cells.map((cell) => {
                          const isSelected = cell.iso === value;
                          const isToday = cell.iso === todayIso;
                          const hasMarks = marked.has(cell.iso);
                          return (
                            <button
                              key={cell.iso}
                              type="button"
                              onClick={() => pickDay(cell.iso)}
                              className={cn(
                                "relative flex h-8 cursor-pointer flex-col items-center justify-center rounded-md text-[11px] font-semibold transition-[color,background-color,box-shadow,opacity,transform] duration-150 ease-out",
                                !cell.inMonth &&
                                  "text-slate-300 dark:text-slate-600",
                                cell.inMonth &&
                                  !isSelected &&
                                  "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/10",
                                isSelected &&
                                  "bg-cnhs-green-dark text-white hover:bg-[#246f54]",
                                !isSelected &&
                                  isToday &&
                                  "ring-1 ring-cnhs-green/50 ring-inset"
                              )}
                            >
                              {cell.day}
                              {hasMarks ? (
                                <span
                                  className={cn(
                                    "absolute bottom-0.5 h-1 w-1 rounded-full",
                                    isSelected
                                      ? "bg-white/90"
                                      : "bg-cnhs-green-dark dark:bg-cnhs-green"
                                  )}
                                  aria-hidden
                                />
                              ) : null}
                            </button>
                          );
                        })}
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  <div className="mt-2 flex items-center justify-end border-t border-slate-100 pt-2 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => pickDay(todayIso)}
                      className="cursor-pointer rounded-md px-2 py-1 text-[11px] font-semibold text-cnhs-green-dark transition-colors hover:bg-cnhs-green-soft dark:text-cnhs-green dark:hover:bg-cnhs-green/15"
                    >
                      Today
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </div>
  );
}
