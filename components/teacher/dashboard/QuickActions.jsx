import Link from "next/link";
import { BookOpen, ChevronRight, ClipboardList, FilePlus2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  upload: Upload,
  file: FilePlus2,
  clipboard: ClipboardList,
  classes: BookOpen,
};

export default function QuickActions({ actions }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
      <h2 className="mb-2.5 text-sm font-semibold text-slate-900">Quick Actions</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {actions.map((action) => {
          const Icon = icons[action.icon] ?? Upload;

          return (
            <Link
              key={action.id}
              href={action.href}
              className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-3 transition-all hover:border-cnhs-green/30 hover:bg-green-50/50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-cnhs-green-dark">
                <Icon size={16} strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-semibold text-slate-800">{action.title}</span>
                <span className="mt-0.5 block text-[11px] text-slate-400">{action.description}</span>
              </span>
              <ChevronRight
                size={14}
                className={cn("shrink-0 text-slate-300 transition-colors group-hover:text-cnhs-green-dark")}
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
