import { cn } from "@/lib/utils";

const styles = {
  Priority:
    "border-red-200/80 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-950/40 dark:text-red-300",
  "High Risk":
    "border-red-200/80 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-950/40 dark:text-red-300",
  Moderate:
    "border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300",
  "Moderate Risk":
    "border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300",
  Low:
    "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300",
  "Low Risk":
    "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300",
};

function shortRiskLabel(value) {
  const raw = String(value ?? "");
  if (/high|priority/i.test(raw)) return "High";
  if (/moderate|medium/i.test(raw)) return "Moderate";
  if (/low/i.test(raw)) return "Low";
  return raw || "—";
}

export default function RiskBadge({ value, dense = false }) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium leading-tight border",
        dense
          ? "rounded px-1.5 py-0.5 text-[10px] leading-4"
          : "rounded-md px-2 py-0.5 text-xs",
        styles[value] ?? "border-slate-200/80 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-300"
      )}
    >
      {dense ? shortRiskLabel(value) : value}
    </span>
  );
}
