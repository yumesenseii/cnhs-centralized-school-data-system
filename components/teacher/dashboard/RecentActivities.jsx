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

export default function RecentActivities({ activities }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
      <h2 className="mb-2.5 text-sm font-semibold text-slate-900">Recent Activities</h2>
      <ol className="space-y-0">
        {activities.length ? activities.map((item, index) => {
          const Icon = icons[item.icon] ?? CheckCircle2;

          return (
            <li key={item.id} className="relative flex gap-2.5 pb-3 last:pb-0">
              {index < activities.length - 1 ? (
                <span
                  className="absolute left-[13px] top-7 h-[calc(100%-10px)] w-px bg-slate-100"
                  aria-hidden="true"
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  tones[item.tone] ?? tones.green
                )}
              >
                <Icon size={13} strokeWidth={1.9} />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-[12px] font-semibold text-slate-800">{item.title}</p>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-400">{item.description}</p>
                <p className="mt-1 text-[10px] font-medium text-slate-400">{item.time}</p>
              </div>
            </li>
          );
        }) : (
          <li className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-8 text-center text-xs text-slate-500">
            No recent lesson plan or monitoring activity.
          </li>
        )}
      </ol>
    </section>
  );
}
