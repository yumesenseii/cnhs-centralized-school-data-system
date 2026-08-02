import { cn } from "@/lib/utils";

const styles = {
  Academic: "bg-green-50 text-cnhs-green-dark",
  Risk: "bg-red-50 text-red-600",
  Teacher: "bg-violet-50 text-violet-700",
  "Lesson Plans": "bg-orange-50 text-cnhs-orange",
  School: "bg-blue-50 text-blue-700",
  Trends: "bg-slate-100 text-slate-600",
};

export default function CategoryBadge({ value }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold leading-tight",
        styles[value] ?? "bg-slate-100 text-slate-600"
      )}
    >
      {value}
    </span>
  );
}
