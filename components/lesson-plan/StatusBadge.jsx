import { cn } from "@/lib/utils";

const styles = {
  Pending: "bg-yellow-100 text-yellow-700",
  "Pending Review": "bg-yellow-100 text-yellow-700",
  "Under Review": "bg-sky-100 text-sky-700",
  Approved: "bg-green-100 text-green-700",
  "Needs Revision": "bg-red-100 text-red-700",
  Complete: "bg-green-100 text-green-700",
  "Not Reviewed": "bg-slate-100 text-slate-500",
  Meets: "bg-green-100 text-green-700",
  "Needs Revision Check": "bg-orange-100 text-orange-700",
  "Not Applicable": "bg-slate-100 text-slate-500",
};

export default function StatusBadge({ value, className }) {
  return (
    <span className={cn("inline-flex rounded-full px-3 py-1 text-[11px] font-semibold leading-tight", styles[value] ?? styles.Pending, className)}>
      {value}
    </span>
  );
}
