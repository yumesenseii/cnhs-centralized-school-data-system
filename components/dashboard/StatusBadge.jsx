import { cn } from "@/lib/utils";

const STATUS_STYLES = {
  Pending: "bg-slate-100 text-slate-600 ring-slate-200",
  "Pending Review": "bg-slate-100 text-slate-600 ring-slate-200",
  Monitoring: "bg-yellow-100 text-yellow-700 ring-yellow-100",
  Approved: "bg-green-100 text-green-700 ring-green-100",
  Completed: "bg-blue-100 text-blue-700 ring-blue-100",
};

export default function StatusBadge({ value }) {
  const displayValue = value === "Pending Review" ? "Pending" : value;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none ring-1",
        STATUS_STYLES[displayValue] ?? STATUS_STYLES[value] ?? "bg-slate-100 text-slate-600 ring-slate-200"
      )}
    >
      {displayValue}
    </span>
  );
}
