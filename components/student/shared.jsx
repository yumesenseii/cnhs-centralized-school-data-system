import { cn } from "@/lib/utils";

export const riskStyles = {
  "High Risk": "bg-red-50 text-red-600",
  Priority: "bg-red-50 text-red-600",
  "Moderate Risk": "bg-amber-50 text-amber-700",
  Moderate: "bg-amber-50 text-amber-700",
  "Low Risk": "bg-green-50 text-cnhs-green-dark",
  Low: "bg-green-50 text-cnhs-green-dark",
};

export const interventionTypeStyles = {
  "ARAL Learners": "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
  "ARAL Screening": "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
  "Recommended for ARAL Learners": "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
  "Recommended for ARAL Screening": "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
  "Classroom Remedial": "bg-orange-50 text-cnhs-orange ring-1 ring-orange-100",
  "Classroom Remediation": "bg-orange-50 text-cnhs-orange ring-1 ring-orange-100",
  "No Recommendation": "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
};

export const gradeStatusStyles = {
  Passing: "bg-green-50 text-cnhs-green-dark",
  "Below 75": "bg-red-50 text-red-600",
  "No grade": "bg-slate-100 text-slate-500",
};

export function Pill({ value, styles, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold",
        styles?.[value] ?? "bg-slate-100 text-slate-500",
        className
      )}
    >
      {value}
    </span>
  );
}

export function RiskPill({ value }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold",
        riskStyles[value] ?? "bg-slate-100 text-slate-500"
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {value}
    </span>
  );
}
