import { cn } from "@/lib/utils";

const barTones = {
  green: "bg-cnhs-green",
  orange: "bg-cnhs-orange",
  red: "bg-red-500",
  slate: "bg-slate-300",
};

const labelTones = {
  green: "text-cnhs-green-dark",
  orange: "text-cnhs-orange",
  red: "text-red-600",
  slate: "text-slate-400",
};

export default function SubmissionProgress({ label, percent = 0, tone = "green", compact = false }) {
  if (compact) {
    return (
      <span className={cn("whitespace-nowrap text-[11px] font-semibold", labelTones[tone] ?? labelTones.slate)}>
        {label}
      </span>
    );
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-slate-600">{label}</span>
        <span className={cn("text-[11px] font-semibold", labelTones[tone] ?? labelTones.slate)}>
          {percent}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full transition-all", barTones[tone] ?? barTones.slate)}
          style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}
