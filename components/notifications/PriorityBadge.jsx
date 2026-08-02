import { cn } from "@/lib/utils";

const styles = {
  High: "bg-red-50 text-red-600",
  Medium: "bg-orange-50 text-cnhs-orange",
  Low: "bg-slate-100 text-slate-500",
};

export default function PriorityBadge({ value }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold",
        styles[value] ?? styles.Low
      )}
    >
      {value}
    </span>
  );
}
