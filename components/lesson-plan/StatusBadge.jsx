import { cn } from "@/lib/utils";

const styles = {
  Pending:
    "border border-slate-200/80 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-300",
  "Pending Review":
    "border border-slate-200/80 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-300",
  "Under Review":
    "border border-slate-200/80 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-300",
  Approved:
    "border border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/50 dark:text-emerald-300",
  "Needs Revision":
    "border border-red-200/80 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/50 dark:text-red-300",
  Complete:
    "border border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/50 dark:text-emerald-300",
  "Not Reviewed":
    "border border-slate-200/80 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/10 dark:text-slate-400",
  Meets:
    "border border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/50 dark:text-emerald-300",
  "Needs Revision Check":
    "border border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/50 dark:text-amber-300",
  "Not Applicable":
    "border border-slate-200/80 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/10 dark:text-slate-400",
};

export default function StatusBadge({ value, className }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-[11px] font-semibold leading-tight",
        styles[value] ?? styles.Pending,
        className
      )}
    >
      {value}
    </span>
  );
}
