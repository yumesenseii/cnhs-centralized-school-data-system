import { cn } from "@/lib/utils";

export const riskStyles = {
  "High Risk": "bg-red-50 text-red-600 dark:bg-red-950/45 dark:text-red-300",
  Priority: "bg-red-50 text-red-600 dark:bg-red-950/45 dark:text-red-300",
  "Moderate Risk":
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  Moderate:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  "Low Risk":
    "bg-green-50 text-cnhs-green-dark dark:bg-emerald-950/40 dark:text-emerald-300",
  Low: "bg-green-50 text-cnhs-green-dark dark:bg-emerald-950/40 dark:text-emerald-300",
  "Not Assessed":
    "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  "—": "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400",
};

export const interventionTypeStyles = {
  "ARAL Learners": "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  "ARAL Screening":
    "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  "Recommended for ARAL Learners":
    "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  "Recommended for ARAL Screening":
    "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  "Classroom Remedial":
    "bg-orange-50 text-cnhs-orange ring-1 ring-orange-100 dark:bg-orange-950/35 dark:text-orange-300 dark:ring-orange-900/50",
  "Classroom Remediation":
    "bg-orange-50 text-cnhs-orange ring-1 ring-orange-100 dark:bg-orange-950/35 dark:text-orange-300 dark:ring-orange-900/50",
  "No Recommendation":
    "bg-muted text-muted-foreground ring-1 ring-border",
};

export const gradeStatusStyles = {
  // Official DepEd descriptors
  Outstanding:
    "bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50",
  "Very Satisfactory":
    "bg-emerald-50 text-cnhs-green-dark border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50",
  Satisfactory:
    "bg-blue-50 text-blue-700 border border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/50",
  "Fairly Satisfactory":
    "bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50",
  "Did Not Meet Expectations":
    "bg-red-50 text-red-600 border border-red-200/60 dark:bg-red-950/45 dark:text-red-300 dark:border-red-800/50",
  "No grade recorded":
    "bg-muted/60 text-muted-foreground border border-border/70",
  // Legacy / fallback keys
  Passing:
    "bg-green-50 text-cnhs-green-dark dark:bg-emerald-950/40 dark:text-emerald-300",
  "Below 75":
    "bg-red-50 text-red-600 dark:bg-red-950/45 dark:text-red-300",
  "No grade":
    "bg-muted text-muted-foreground",
};

export function Pill({ value, styles, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold",
        styles?.[value] ?? "bg-muted text-muted-foreground",
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
        riskStyles[value] ?? "bg-muted text-muted-foreground"
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {value}
    </span>
  );
}
