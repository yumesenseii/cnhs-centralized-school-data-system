"use client";

import { cn } from "@/lib/utils";

export default function ThemeSelector({ label, options, value, onChange, name }) {
  return (
    <fieldset>
      <legend className="mb-2.5 text-[11px] font-semibold text-muted-foreground">{label}</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const selected = option.id === value;

          return (
            <label
              key={option.id}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-medium transition-all duration-200",
                selected
                  ? "border-cnhs-green-dark/40 bg-green-50 text-cnhs-green-dark shadow-sm dark:bg-cnhs-green/15 dark:text-emerald-300"
                  : "border-border bg-muted/40 text-muted-foreground hover:border-cnhs-green/35 hover:bg-muted hover:text-card-foreground"
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.id}
                checked={selected}
                onChange={() => onChange(option.id)}
                className="accent-cnhs-green-dark"
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
