"use client";

import { CircleAlert, Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Short honesty note for Monitoring: ECR grades only + optional fallback banner.
 * Scoped to Intervention caseload (interventions only). No PLP / pathway list.
 */
export default function RecommendationHonestyNote({
  showFallback = false,
  className = "",
}) {
  if (showFallback) {
    return (
      <div
        className={cn(
          "flex gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-[11px] leading-5 text-amber-950",
          className
        )}
      >
        <CircleAlert
          size={14}
          className="mt-0.5 shrink-0 text-amber-700"
          aria-hidden
        />
        <p>
          <span className="font-semibold">Prediction service unavailable.</span>{" "}
          Showing the ECR grade-band fallback. Risk still uses{" "}
          <span className="font-semibold">ECR grades only</span>.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-[11px] leading-5 text-slate-600",
        className
      )}
    >
      <Info
        size={14}
        className="mt-0.5 shrink-0 text-cnhs-green-dark"
        aria-hidden
      />
      <p>
        Risk uses{" "}
        <span className="font-semibold text-slate-700">ECR grades only</span>.
        Attendance is not a prediction input.
      </p>
    </div>
  );
}
