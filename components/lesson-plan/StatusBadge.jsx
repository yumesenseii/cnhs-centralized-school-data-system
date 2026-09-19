import { cn } from "@/lib/utils";

const styles = {
  Pending:
    "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  "Pending Review":
    "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  "Under Review":
    "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  Approved:
    "bg-green-100 text-green-700 dark:bg-cnhs-green/20 dark:text-[#a7f3d0]",
  "Needs Revision":
    "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  Complete:
    "bg-green-100 text-green-700 dark:bg-cnhs-green/20 dark:text-[#a7f3d0]",
  "Not Reviewed":
    "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300",
  Meets:
    "bg-green-100 text-green-700 dark:bg-cnhs-green/20 dark:text-[#a7f3d0]",
  "Needs Revision Check":
    "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  "Not Applicable":
    "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300",
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
