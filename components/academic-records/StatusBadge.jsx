import { cn } from "@/lib/utils";

const styles = {
  Validated: "bg-green-50 text-cnhs-green-dark",
  "Pending Review": "bg-orange-50 text-cnhs-orange",
  "Pending Validation": "bg-orange-50 text-cnhs-orange",
  "Requires Correction": "bg-red-50 text-red-600",
  "Needs Correction": "bg-red-50 text-red-600",
  "Analysis Complete": "bg-green-50 text-cnhs-green-dark",
  Completed: "bg-green-50 text-cnhs-green-dark",
  Uploaded: "bg-green-50 text-cnhs-green-dark",
  Pending: "bg-orange-50 text-cnhs-orange",
  "Not Sub.": "bg-red-50 text-red-600",
};

export default function StatusBadge({ value, dot = true }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-tight",
        styles[value] ?? "bg-slate-100 text-slate-500"
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
      {value}
    </span>
  );
}
