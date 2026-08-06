import { cn } from "@/lib/utils";

export default function RecommendationBadge({ value, dense = false }) {
  const text = String(value ?? "No recommendation");
  const isAral = text.includes("ARAL");
  const isEmpty =
    text === "No recommendation" || text === "No Recommendation" || !text;

  let label = text.replace("Recommended for ", "");
  if (dense && isAral) label = "ARAL";
  if (dense && !isAral && !isEmpty) {
    if (/remediation/i.test(text)) label = "Remediation";
  }

  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap font-semibold",
        dense
          ? "rounded-md px-1.5 py-0.5 text-[10px] leading-4"
          : "rounded-full px-3 py-1 text-[11px]",
        isEmpty && "bg-transparent px-0 text-slate-400",
        isAral && "bg-blue-50 text-blue-700",
        !isAral && !isEmpty && "bg-green-50 text-cnhs-green-dark"
      )}
    >
      {isEmpty ? "—" : label}
    </span>
  );
}
