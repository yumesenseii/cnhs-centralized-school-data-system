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
  Teacher: "bg-green-50 text-cnhs-green-dark",
  "School Principal": "bg-amber-50 text-amber-700",
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
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold",
        roleStyles[value] ?? "bg-slate-100 text-slate-600"
      )}
    >
      {value}
    </span>
  );
}

export default StatusBadge;
