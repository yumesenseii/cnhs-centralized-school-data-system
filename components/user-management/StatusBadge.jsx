import { cn } from "@/lib/utils";

const statusStyles = {
  Active: "text-cnhs-green-dark",
  Inactive: "text-slate-500",
  Suspended: "text-red-600",
};

const statusDots = {
  Active: "bg-cnhs-green",
  Inactive: "bg-slate-400",
  Suspended: "bg-red-500",
};

const roleStyles = {
  Teacher:
    "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300",
  "School Principal":
    "border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300",
};

export function StatusBadge({ value }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-semibold", statusStyles[value])}>
      <span className={cn("h-1.5 w-1.5 rounded-full", statusDots[value])} aria-hidden="true" />
      {value}
    </span>
  );
}

export function RoleBadge({ value }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium leading-tight",
        roleStyles[value] ??
          "border-slate-200/80 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-300"
      )}
    >
      {value}
    </span>
  );
}

export default StatusBadge;
