import { cn } from "@/lib/utils";

const dots = {
  green: "bg-cnhs-green",
  blue: "bg-sky-500",
  orange: "bg-cnhs-orange",
  red: "bg-red-500",
  slate: "bg-slate-400",
};

export default function RecentActivity({ activities }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-800">Recent Activity</h3>
      <ol className="mt-4 space-y-0">
        {activities.map((item, index) => (
          <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
            {index < activities.length - 1 ? (
              <span className="absolute left-[5px] top-3 h-[calc(100%-4px)] w-px bg-slate-100" aria-hidden="true" />
            ) : null}
            <span
              className={cn(
                "relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                dots[item.tone] ?? dots.slate
              )}
              aria-hidden="true"
            />
            <div>
              <p className="text-xs font-medium text-slate-700">{item.text}</p>
              <p className="mt-0.5 text-[10px] text-slate-400">{item.time}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
