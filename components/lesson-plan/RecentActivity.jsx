import { Activity, CheckCircle2, Clock3, RotateCcw, Send, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  submit: Send,
  approve: CheckCircle2,
  revision: Undo2,
  resubmit: RotateCcw,
};

const tones = {
  green: "border-green-100 bg-green-50 text-cnhs-green-dark",
  orange: "border-orange-100 bg-orange-50 text-cnhs-orange",
  purple: "border-violet-100 bg-violet-50 text-violet-500",
};

export default function RecentActivity({ items = [] }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Recent Activity</h2>
        <Activity size={14} className="text-slate-300" />
      </div>
      {!items.length ? (
        <p className="text-[11px] text-slate-400">No recent lesson plan activity yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const Icon = icons[item.type] ?? Send;
            return (
              <div key={item.id} className="flex gap-2.5">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                    tones[item.tone]
                  )}
                >
                  <Icon size={14} />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium leading-4 text-slate-700">
                    {item.text}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-400">
                    <Clock3 size={10} /> {item.time}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
