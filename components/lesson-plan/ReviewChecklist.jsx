import { cn } from "@/lib/utils";

const cycleStates = [
  { label: "Meets", className: "bg-green-50 text-cnhs-green-dark ring-green-100" },
  { label: "Needs Revision", className: "bg-orange-50 text-cnhs-orange ring-orange-100" },
  { label: "Not Applicable", className: "bg-slate-100 text-slate-500 ring-slate-200" },
  { label: "Not Reviewed", className: "bg-white text-slate-400 ring-slate-200" },
];

export default function ReviewChecklist({ items }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Review Checklist</h3>
        <p className="text-xs text-slate-400">Click to cycle: Meets → Needs Revision → N/A</p>
      </div>
      <div className="space-y-2.5">
        {items.map((item, index) => {
          const state = cycleStates[index % cycleStates.length];
          const label = item.state === "Not Reviewed" ? state.label : item.state;

          return (
            <button
              key={item.label}
              type="button"
              className="flex min-h-[56px] w-full cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 text-left transition-colors hover:bg-slate-50"
            >
              <span className="font-semibold text-slate-700">{item.label}</span>
              <span className={cn("rounded-full px-3 py-1 text-xs font-semibold ring-1", state.className)}>{label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
