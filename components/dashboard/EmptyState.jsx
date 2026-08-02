import { Inbox } from "lucide-react";

export default function EmptyState({ title = "No data available", description = "Dashboard data will appear here once connected." }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
        <Inbox size={20} aria-hidden="true" />
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}
