import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  Pending:
    "border-slate-200/80 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-300",
  "Pending Review":
    "border-slate-200/80 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-300",
  Monitoring:
    "border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300",
  Approved:
    "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300",
  Completed:
    "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300",
};

export default function StatusBadge({ value }) {
  const displayValue = value === "Pending Review" ? "Pending" : value;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium leading-tight",
        STATUS_STYLES[displayValue] ?? STATUS_STYLES[value] ?? "border-slate-200/80 bg-slate-100 text-slate-700"
      )}
    >
      {displayValue}
    </span>
  );
}
