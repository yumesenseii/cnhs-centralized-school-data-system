import { cn } from "@/lib/utils";

const styles = {
  Validated:
    "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300",
  "Pending Review":
    "border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300",
  "Pending Validation":
    "border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300",
  "Requires Correction":
    "border-red-200/80 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-950/40 dark:text-red-300",
  "Needs Correction":
    "border-red-200/80 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-950/40 dark:text-red-300",
  "Analysis Complete":
    "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300",
  Completed:
    "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300",
  Uploaded:
    "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300",
  Pending:
    "border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300",
  "Not Sub.":
    "border-red-200/80 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-950/40 dark:text-red-300",
};

function shortStatusLabel(value) {
  const raw = String(value ?? "");
  if (/validated|complete|uploaded|completed/i.test(raw)) return "Validated";
  if (/pending/i.test(raw)) return "Pending";
  if (/correction/i.test(raw)) return "Correction";
  if (/not sub/i.test(raw)) return "Not Sub.";
  return raw || "—";
}

export default function StatusBadge({ value, dot = true, dense = false }) {
  const showDot = dense ? false : dot;
  const displayValue = value === "Pending Review" ? "Pending" : value;

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium leading-tight border",
        dense
          ? "gap-1 rounded px-1.5 py-0.5 text-[10px] leading-4"
          : "gap-1.5 rounded-md px-2 py-0.5 text-xs",
        styles[displayValue] ?? styles[value] ?? "border-slate-200/80 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-300"
      )}
    >
      {showDot ? (
        <span
          className="h-1.5 w-1.5 rounded-full bg-current"
          aria-hidden="true"
        />
      ) : null}
      {dense ? shortStatusLabel(value) : displayValue}
    </span>
  );
}
