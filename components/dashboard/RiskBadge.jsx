import { cn } from "@/lib/utils";

const RISK_STYLES = {
  Priority: "bg-red-100 text-red-700 ring-red-100",
  "High Risk": "bg-red-100 text-red-700 ring-red-100",
  Moderate: "bg-orange-100 text-orange-700 ring-orange-100",
  "Moderate Risk": "bg-orange-100 text-orange-700 ring-orange-100",
  Low: "bg-green-100 text-green-700 ring-green-100",
  "Low Risk": "bg-green-100 text-green-700 ring-green-100",
};

export default function RiskBadge({ value }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none ring-1",
        RISK_STYLES[value] ?? "bg-slate-100 text-slate-600 ring-slate-100"
      )}
    >
      {value}
    </span>
  );
}
