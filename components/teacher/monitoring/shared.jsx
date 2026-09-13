"use client";

import { cn } from "@/lib/utils";
import {
  MONITORING_STATUS,
  RECOMMENDATION,
} from "@/lib/monitoring/recommendations";
import { CLASSROOM_REMEDIAL } from "@/lib/teacher/reportsConstants";

export const riskStyles = {
  "High Risk": "bg-red-50 text-red-600",
  Priority: "bg-red-50 text-red-600",
  "Moderate Risk": "bg-amber-50 text-amber-700",
  Moderate: "bg-amber-50 text-amber-700",
  "Low Risk": "bg-green-50 text-cnhs-green-dark",
  Low: "bg-green-50 text-cnhs-green-dark",
};

export const interventionStyles = {
  [RECOMMENDATION.ARAL]: "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
  "ARAL Screening": "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
  "Recommended for ARAL Learners": "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
  "Recommended for ARAL Screening": "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
  "Potential ARAL Learners": "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
  "Potential ARAL Screening": "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
  [RECOMMENDATION.REMEDIATION]:
    "bg-green-50 text-cnhs-green-dark ring-1 ring-green-100",
  [RECOMMENDATION.NONE]: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
};

export const classroomRemedialStyles = {
  [CLASSROOM_REMEDIAL.RECOMMENDED]: "bg-orange-50 text-cnhs-orange",
  [CLASSROOM_REMEDIAL.NOT_NEEDED]: "bg-green-50 text-cnhs-green-dark",
};

export const monitoringStatusStyles = {
  [MONITORING_STATUS.NOT_STARTED]: "bg-slate-100 text-slate-500",
  [MONITORING_STATUS.ONGOING]: "bg-sky-50 text-sky-700",
  [MONITORING_STATUS.IMPROVED]: "bg-emerald-50 text-emerald-700",
  [MONITORING_STATUS.NEEDS_FOLLOW_UP]: "bg-orange-50 text-cnhs-orange",
  [MONITORING_STATUS.NEEDS_FURTHER_SUPPORT]: "bg-orange-50 text-cnhs-orange",
  [MONITORING_STATUS.FOR_FURTHER_MONITORING]: "bg-amber-50 text-amber-800",
  [MONITORING_STATUS.COMPLETED]: "bg-green-50 text-cnhs-green-dark",
  "Needs Update": "bg-orange-50 text-cnhs-orange",
};

export const subjectStyles = {
  English: "text-sky-600",
  Mathematics: "text-violet-600",
  Science: "text-emerald-600",
  Filipino: "text-amber-700",
  "Araling Panlipunan": "text-orange-700",
  MAPEH: "text-pink-600",
  TLE: "text-indigo-600",
};

export const avatarTones = {
  red: "bg-red-100 text-red-700",
  orange: "bg-orange-100 text-orange-700",
  amber: "bg-amber-100 text-amber-700",
  violet: "bg-violet-100 text-violet-700",
  blue: "bg-sky-100 text-sky-700",
  green: "bg-green-100 text-cnhs-green-dark",
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
