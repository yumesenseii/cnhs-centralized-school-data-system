import { cn } from "@/lib/utils";

const styles = {
  Priority: "bg-red-100 text-red-700",
  "High Risk": "bg-red-100 text-red-700",
  Moderate: "bg-orange-100 text-orange-700",
  "Moderate Risk": "bg-orange-100 text-orange-700",
  Low: "bg-green-100 text-green-700",
  "Low Risk": "bg-green-100 text-green-700",
};

function shortRiskLabel(value) {
  const raw = String(value ?? "");
  if (/high|priority/i.test(raw)) return "High";
  if (/moderate|medium/i.test(raw)) return "Moderate";
  if (/low/i.test(raw)) return "Low";
  return raw || "—";
}

export default function RiskBadge({ value, dense = false }) {
  return (
    <span
      className={cn(
        "inline-flex font-semibold",
        dense
          ? "rounded-md px-1.5 py-0.5 text-[10px] leading-4"
          : "rounded-full px-2.5 py-1 text-[11px]",
        styles[value] ?? "bg-slate-100 text-slate-600"
      )}
    >
      {dense ? shortRiskLabel(value) : value}
    </span>
  );
}
