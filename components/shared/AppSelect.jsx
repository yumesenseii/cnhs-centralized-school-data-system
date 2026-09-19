"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

function normalizeOptions(options = []) {
  return options.map((option) => {
    if (option != null && typeof option === "object") {
      const value = String(option.value ?? "");
      return {
        value,
        label: String(option.label ?? option.value ?? ""),
        disabled: Boolean(option.disabled),
      };
    }
    return { value: String(option), label: String(option), disabled: false };
  });
}

function findLabel(items, value, placeholder) {
  const match = items.find((item) => item.value === String(value ?? ""));
  if (match?.label) return match.label;
  if (placeholder) return placeholder;
  return items[0]?.label || "Select";
}

export default function AppSelect({
  label,
  value,
  defaultValue,
  onChange,
  options = [],
  icon: Icon,
  disabled = false,
  className,
  triggerClassName,
  size = "field",
  name,
  required = false,
  placeholder,
  id,
  align = "start",
}) {
  const items = useMemo(() => normalizeOptions(options), [options]);
  const isControlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = useState(
    defaultValue !== undefined
      ? String(defaultValue)
      : items[0]?.value ?? ""
  );
  const selectedValue = isControlled ? String(value ?? "") : uncontrolled;
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [coords, setCoords] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const reactId = useId();
  const listId = `${reactId}-list`;
  const triggerId = id || `${reactId}-trigger`;
  const selectedLabel = findLabel(items, selectedValue, placeholder);
  const selectedIndex = items.findIndex((item) => item.value === selectedValue);
  const pill = size === "pill";

  useEffect(() => {
    setMounted(true);
  }, []);

  function commit(next) {
    if (!isControlled) setUncontrolled(next);
    onChange?.(next);
    setOpen(false);
  }

  function measureCoords() {
    const node = triggerRef.current;
    if (!node || typeof window === "undefined") return null;
    const rect = node.getBoundingClientRect();
    const width = Math.max(rect.width, pill ? 148 : 168);
    const maxHeight = 240;
    const gap = 6;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const openUp = spaceBelow < 120 && rect.top > spaceBelow;
    const left =
      align === "end"
        ? Math.min(rect.right - width, window.innerWidth - width - 8)
        : Math.min(rect.left, window.innerWidth - width - 8);
    return {
      top: openUp ? undefined : rect.bottom + gap,
      bottom: openUp ? window.innerHeight - rect.top + gap : undefined,
      left: Math.max(8, left),
      width,
      maxHeight,
    };
  }

  function updateCoords() {
    const next = measureCoords();
    if (next) setCoords(next);
  }

  useEffect(() => {
    if (!open) return;
    updateCoords();
    const nextIndex = selectedIndex >= 0 ? selectedIndex : 0;
    setActiveIndex(nextIndex);

    function onPointer(event) {
      if (rootRef.current?.contains(event.target)) return;
      if (listRef.current?.contains(event.target)) return;
      setOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onReposition() {
      updateCoords();
    }

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, selectedIndex, align, pill]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const option = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    option?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function onTriggerKeyDown(event) {
    if (disabled) return;
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
    }
    if (!open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(items.length - 1, (index < 0 ? selectedIndex : index) + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, (index < 0 ? selectedIndex : index) - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(items.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const item = items[activeIndex] ?? items[selectedIndex];
      if (item && !item.disabled) commit(item.value);
    }
  }

  const panel =
    !mounted
      ? null
      : createPortal(
          <AnimatePresence>
            {open && coords ? (
              <motion.ul
                ref={listRef}
                id={listId}
                role="listbox"
                aria-labelledby={triggerId}
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
                style={{
                  position: "fixed",
                  top: coords.top,
                  bottom: coords.bottom,
                  left: coords.left,
                  width: coords.width,
                  maxHeight: coords.maxHeight,
                  transformOrigin: coords.bottom ? "bottom center" : "top center",
                }}
                className="z-[200] overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.14)] dark:border-white/10 dark:bg-[#1c1c1c] dark:shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
              >
                {items.length ? (
                  items.map((item, index) => {
                    const selected = item.value === selectedValue;
                    const active = index === activeIndex;
                    return (
                      <li key={`${item.value}-${index}`} role="none">
                        <button
                          type="button"
                          role="option"
                          data-index={index}
                          aria-selected={selected}
                          disabled={item.disabled}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => {
                            if (!item.disabled) commit(item.value);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-[12px] transition-colors",
                            item.disabled && "cursor-not-allowed opacity-40",
                            selected
                              ? "bg-cnhs-green-soft text-cnhs-green-dark"
                              : active
                                ? "bg-slate-50 text-slate-800 dark:bg-white/8 dark:text-white"
                                : "text-slate-600 dark:text-white/75"
                          )}
                        >
                          <span className="min-w-0 truncate">{item.label}</span>
                          {selected ? (
                            <Check
                              size={13}
                              strokeWidth={2.2}
                              className="shrink-0 text-cnhs-green"
                            />
                          ) : null}
                        </button>
                      </li>
                    );
                  })
                ) : (
                  <li className="px-3 py-2 text-[12px] text-slate-400">No options</li>
                )}
              </motion.ul>
            ) : null}
          </AnimatePresence>,
          document.body
        );

  return (
    <div ref={rootRef} className={cn("relative min-w-0", className)}>
      {label ? (
        <label htmlFor={triggerId} className="sr-only">
          {label}
        </label>
      ) : null}
      {name || required ? (
        <input type="hidden" name={name} value={selectedValue} required={required} />
      ) : null}
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => {
          if (disabled) return;
          if (!open) {
            updateCoords();
            setOpen(true);
            return;
          }
          setOpen(false);
        }}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "relative inline-flex w-full items-center gap-1.5 border text-left font-medium outline-none transition-colors",
          "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
          "focus-visible:border-cnhs-green focus-visible:ring-2 focus-visible:ring-cnhs-green/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          pill
            ? "h-8 rounded-full pl-3 pr-2.5 text-[11px] shadow-sm"
            : "h-10 rounded-xl px-3 text-[12px]",
          Icon && "pl-8",
          triggerClassName
        )}
      >
        {Icon ? (
          <Icon
            size={12}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
        ) : null}
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            placeholder && selectedValue === "" && "text-slate-400"
          )}
        >
          {selectedLabel}
        </span>
        <ChevronDown
          size={13}
          strokeWidth={2}
          className={cn(
            "shrink-0 text-slate-400 transition-transform duration-160",
            open && "rotate-180"
          )}
        />
      </button>
      {panel}
    </div>
  );
}
