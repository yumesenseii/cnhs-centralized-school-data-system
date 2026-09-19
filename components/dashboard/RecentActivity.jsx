import { useState } from "react";
import { BarChart3, CheckCircle2, Clock3, FileText, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  upload: UploadCloud,
  file: FileText,
  analysis: BarChart3,
  approved: CheckCircle2,
};

const VARIANTS = {
  success: "border-green-100 bg-green-50 text-cnhs-green-dark",
  warning: "border-orange-100 bg-orange-50 text-cnhs-orange",
  purple: "border-violet-100 bg-violet-50 text-violet-500",
};

const DEFAULT_LIMIT = 5;

/**
 * Dashboard recent activity. "View all" expands in place (same list source)
 * instead of navigating to an empty Notifications page.
 */
export default function RecentActivity({
  activities = [],
  limit = DEFAULT_LIMIT,
}) {
  const [expanded, setExpanded] = useState(false);

  if (!activities.length) {
    return (
      <p className="py-6 text-center text-xs text-slate-400">
        No recent school activity yet.
      </p>
    );
  }

  const visible = expanded ? activities : activities.slice(0, limit);
  const hasMore = activities.length > limit;

  return (
    <div>
      <div className="space-y-2">
        {visible.map((activity, index) => {
          const Icon = ICONS[activity.icon] ?? FileText;
          const isLast = index === visible.length - 1;

          return (
            <div key={activity.id} className="relative flex gap-2.5">
              {!isLast ? (
                <span
                  className="absolute left-[13px] top-7 h-[calc(100%-16px)] w-px bg-slate-100"
                  aria-hidden="true"
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                  VARIANTS[activity.variant] ?? VARIANTS.success
                )}
              >
                <Icon size={13} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <div className="min-w-0 pb-0.5">
                <p className="text-xs font-medium leading-4 text-slate-700">
                  {activity.description}
                </p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-slate-400">
                  <Clock3 size={10} aria-hidden="true" />
                  {activity.time}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {hasMore ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-2 inline-block cursor-pointer text-[11px] font-semibold text-cnhs-green-dark transition-colors duration-200 hover:underline"
        >
          {expanded ? "Show less" : `View all (${activities.length})`}
        </button>
      ) : null}
    </div>
  );
}
