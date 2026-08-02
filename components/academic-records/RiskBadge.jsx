import { cn } from "@/lib/utils";

const styles = {
  Priority: "bg-red-100 text-red-700",
  "High Risk": "bg-red-100 text-red-700",
  Moderate: "bg-orange-100 text-orange-700",
  "Moderate Risk": "bg-orange-100 text-orange-700",
  Low: "bg-green-100 text-green-700",
  "Low Risk": "bg-green-100 text-green-700",
};

export default function RiskBadge({ value }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold",
        styles[value] ?? "bg-slate-100 text-slate-600"
      )}
    >
      {value}
    </span>
  );
}
