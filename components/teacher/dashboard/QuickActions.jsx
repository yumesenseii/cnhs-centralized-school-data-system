import Link from "next/link";
import {
  BookOpen,
  ChevronRight,
  ClipboardList,
  FilePlus2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  upload: Upload,
  file: FilePlus2,
  clipboard: ClipboardList,
  classes: BookOpen,
};

export default function QuickActions({ actions }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
      <div className="border-b border-slate-100 px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-900">Quick Actions</h2>
      </div>
      <div className="grid grid-cols-1 gap-1 p-2 sm:grid-cols-2">
        {actions.map((action) => {
          const Icon = icons[action.icon] ?? Upload;

          return (
            <Link
              key={action.id}
              href={action.href}
              className="group flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-2 py-1.5 transition-all hover:border-cnhs-green/30 hover:bg-green-50/50"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-50 text-cnhs-green-dark">
                <Icon size={13} strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-semibold leading-4 text-slate-800">
                  {action.title}
                </span>
                <span className="block text-[9px] text-slate-400">
                  {action.description}
                </span>
              </span>
              <ChevronRight
                size={12}
                className={cn(
                  "shrink-0 text-slate-300 transition-colors group-hover:text-cnhs-green-dark"
                )}
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
