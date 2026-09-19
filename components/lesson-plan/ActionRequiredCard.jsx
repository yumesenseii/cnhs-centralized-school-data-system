import { Hourglass } from "lucide-react";

export default function ActionRequiredCard({ action }) {
  return (
    <section className="h-fit rounded-xl border border-slate-100 bg-white p-2.5 shadow-[0_4px_12px_rgba(15,23,42,0.03)] dark:border-white/10 dark:bg-[var(--card)] dark:shadow-none">
      <div className="flex items-center gap-1.5 text-cnhs-orange">
        <Hourglass size={13} aria-hidden="true" />
        <h2 className="text-[12px] font-semibold">Action Required</h2>
      </div>
      <div className="mt-2">
        <p className="text-xl font-semibold leading-none text-slate-900 dark:text-slate-100">
          {action?.pending ?? 0}
          <span className="ml-1 text-[11px] font-semibold text-cnhs-orange">
            pending
          </span>
        </p>
        <p className="mt-1 text-[10px] leading-3.5 text-slate-500 dark:text-slate-400">
          {action?.message}
        </p>
        <p className="mt-1.5 text-[10px] font-medium text-red-500 dark:text-red-400">
          {action?.needsRevision ?? 0} needs revision
        </p>
      </div>
    </section>
  );
}
