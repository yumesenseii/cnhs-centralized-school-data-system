import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
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

export default function RecentActivities({ activities = [], embedded = false }) {
  const displayActivities = activities.slice(0, 5);

  const list = (
    <ol className={cn(embedded ? "pt-1" : "p-4")}>
      {displayActivities.length ? (
        displayActivities.map((item, index) => {
          const Icon = icons[item.icon] ?? CheckCircle2;

          return (
            <li key={item.id} className="relative flex gap-2.5 py-2 first:pt-0 last:pb-0">
              {index < displayActivities.length - 1 ? (
                <span
                  className="absolute left-[11px] top-6 h-[calc(100%-4px)] w-px bg-slate-100"
                  aria-hidden="true"
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full shadow-xs",
                  tones[item.tone] ?? tones.green
                )}
              >
                <Icon size={12} strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold leading-snug text-slate-800">
                  {item.title}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                  {item.description}
                </p>
                <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                  {item.time}
                </p>
              </div>
            </li>
          );
        })
      ) : (
        <li className="py-8 text-center text-xs text-slate-400">
          No recent lesson plan or monitoring activity.
        </li>
      )}
    </ol>
  );

  if (embedded) return list;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.03)]">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-slate-900">
          Recent Activity
        </h2>
        <Link
          href="/teacher/reports"
          className="inline-flex items-center gap-1 text-xs font-semibold text-cnhs-green-dark transition-colors hover:text-[#246f54]"
        >
          View All
          <ArrowRight size={12} />
        </Link>
      </div>
      {list}
    </section>
  );
}
