import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const styles = {
  Ready: "text-cnhs-green-dark",
  Processing: "text-cnhs-orange",
  Failed: "text-red-600",
};

const icons = {
  Ready: CheckCircle2,
  Processing: Loader2,
  Failed: XCircle,
};

export default function StatusBadge({ value }) {
  const Icon = icons[value] ?? CheckCircle2;

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-semibold", styles[value])}>
      <Icon size={13} className={value === "Processing" ? "animate-spin" : undefined} />
      {value}
    </span>
  );
}
