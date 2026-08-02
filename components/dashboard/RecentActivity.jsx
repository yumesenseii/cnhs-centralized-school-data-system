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

export default function RecentActivity({ activities = [] }) {
  if (!activities.length) {
    return (
      <p className="py-8 text-center text-xs text-slate-400">
        No recent school activity yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity, index) => {
        const Icon = ICONS[activity.icon] ?? FileText;
        const isLast = index === activities.length - 1;

        return (
          <div key={activity.id} className="relative flex gap-3">
            {!isLast ? (
              <span
                className="absolute left-[17px] top-9 h-[calc(100%-24px)] w-px bg-slate-100"
                aria-hidden="true"
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
                VARIANTS[activity.variant] ?? VARIANTS.success
              )}
            >
              <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div className="min-w-0 pb-1">
              <p className="text-sm font-medium leading-5 text-slate-700">{activity.description}</p>
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-400">
                <Clock3 size={12} aria-hidden="true" />
                {activity.time}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
