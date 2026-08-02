import {
  BookOpen,
  CheckCircle2,
  FileText,
  BarChart3,
  ClipboardList,
  RefreshCw,
  Upload,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap = {
  upload: Upload,
  book: BookOpen,
  file: FileText,
  revision: RefreshCw,
  check: CheckCircle2,
  chart: BarChart3,
  user: UserRound,
  monitor: ClipboardList,
};

const tones = {
  green: "bg-green-50 text-cnhs-green-dark",
  teal: "bg-teal-50 text-teal-700",
  violet: "bg-violet-50 text-violet-700",
  orange: "bg-orange-50 text-cnhs-orange",
  blue: "bg-sky-50 text-sky-700",
  slate: "bg-slate-100 text-slate-600",
};

export default function TimelineItem({ item, isLast = false }) {
  const Icon = iconMap[item.icon] ?? CheckCircle2;

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!isLast ? (
        <span
          className="absolute left-[15px] top-8 h-[calc(100%-12px)] w-px bg-slate-100"
          aria-hidden="true"
        />
      ) : null}

      <span
        className={cn(
          "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          tones[item.tone] ?? tones.green
        )}
      >
        <Icon size={14} strokeWidth={1.9} />
      </span>

      <div className="min-w-0 pt-0.5">
        <p className="text-[12px] font-semibold leading-4 text-slate-800">{item.title}</p>
        {item.description ? (
          <p className="mt-1 text-[11px] leading-4 text-slate-400">{item.description}</p>
        ) : null}
        <p className="mt-1.5 text-[10px] font-medium text-slate-400">{item.timestamp}</p>
      </div>
    </li>
  );
}
