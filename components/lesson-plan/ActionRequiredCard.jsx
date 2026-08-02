import { Hourglass } from "lucide-react";

export default function ActionRequiredCard({ action }) {
  return (
    <section className="rounded-xl border border-orange-100 bg-orange-50/70 p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2 text-cnhs-orange">
        <Hourglass size={15} />
        <h2 className="text-sm font-semibold">Action Required</h2>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-semibold leading-none text-slate-900">
          {action.pending}
          <span className="ml-1 text-sm font-semibold text-cnhs-orange">pending</span>
        </p>
        <p className="mt-1 text-[11px] leading-4 text-slate-500">{action.message}</p>
        <p className="mt-2 text-[11px] font-medium text-red-500">{action.needsRevision} needs revision</p>
      </div>
    </section>
  );
}
