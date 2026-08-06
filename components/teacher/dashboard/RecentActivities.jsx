import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Upload,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  check: CheckCircle2,
  upload: Upload,
  clipboard: ClipboardList,
  alert: AlertTriangle,
  user: UserRound,
};

const tones = {
  green: "bg-green-50 text-cnhs-green-dark",
  blue: "bg-sky-50 text-sky-600",
  orange: "bg-orange-50 text-cnhs-orange",
  violet: "bg-violet-50 text-violet-600",
  red: "bg-red-50 text-red-500",
};

export default function RecentActivities({ activities, embedded = false }) {
  const list = (
    <ol className={cn(embedded ? "pt-1" : "px-3 py-1.5")}>
      {activities.length ? (
        activities.map((item, index) => {
          const Icon = icons[item.icon] ?? CheckCircle2;

          return (
            <li key={item.id} className="relative flex gap-2 py-1.5 last:pb-0">
              {index < activities.length - 1 ? (
                <span
                  className="absolute left-[9px] top-6 h-[calc(100%-6px)] w-px bg-slate-100"
                  aria-hidden="true"
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  tones[item.tone] ?? tones.green
                )}
              >
                <Icon size={11} strokeWidth={1.9} />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold leading-4 text-slate-800">
                  {item.title}
                </p>
                <p className="text-[10px] leading-3.5 text-slate-400">
                  {item.description}
                </p>
                <p className="text-[9px] font-medium text-slate-400">
                  {item.time}
                </p>
              </div>
            </li>
          );
        })
      ) : (
        <li className="py-6 text-center text-[11px] text-slate-500">
          No recent lesson plan or monitoring activity.
        </li>
      )}
    </ol>
  );

  if (embedded) return list;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
      <div className="border-b border-slate-100 px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-900">
          Recent Activities
        </h2>
      </div>
      {list}
    </section>
  );
}
