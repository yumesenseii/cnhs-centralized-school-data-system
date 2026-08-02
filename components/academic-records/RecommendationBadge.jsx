import { cn } from "@/lib/utils";

export default function RecommendationBadge({ value }) {
  const text = String(value ?? "No recommendation");
  const isAral = text.includes("ARAL");
  const isEmpty =
    text === "No recommendation" || text === "No Recommendation" || !text;

  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold",
        isEmpty && "bg-transparent px-0 text-slate-400",
        isAral && "bg-blue-50 text-blue-700",
        !isAral && !isEmpty && "bg-green-50 text-cnhs-green-dark"
      )}
    >
      {isEmpty ? "—" : text.replace("Recommended for ", "")}
    </span>
  );
}
