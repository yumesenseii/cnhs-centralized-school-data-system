import { cn } from "@/lib/utils";

const styles = {
  Validated: "bg-green-50 text-cnhs-green-dark",
  "Pending Review": "bg-orange-50 text-cnhs-orange",
  "Pending Validation": "bg-orange-50 text-cnhs-orange",
  "Requires Correction": "bg-red-50 text-red-600",
  "Needs Correction": "bg-red-50 text-red-600",
  "Analysis Complete": "bg-green-50 text-cnhs-green-dark",
  Completed: "bg-green-50 text-cnhs-green-dark",
  Uploaded: "bg-green-50 text-cnhs-green-dark",
  Pending: "bg-orange-50 text-cnhs-orange",
  "Not Sub.": "bg-red-50 text-red-600",
};

function shortStatusLabel(value) {
  const raw = String(value ?? "");
  if (/validated|complete|uploaded|completed/i.test(raw)) return "Validated";
  if (/pending/i.test(raw)) return "Pending";
  if (/correction/i.test(raw)) return "Correction";
  if (/not sub/i.test(raw)) return "Not Sub.";
  return raw || "—";
}

export default function StatusBadge({ value, dot = true, dense = false }) {
  const showDot = dense ? false : dot;

  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold leading-tight",
        dense
          ? "gap-1 rounded-md px-1.5 py-0.5 text-[10px] leading-4"
          : "gap-1.5 rounded-full px-2.5 py-1 text-[11px]",
        styles[value] ?? "bg-slate-100 text-slate-500"
      )}
    >
      {showDot ? (
        <span
          className="h-1.5 w-1.5 rounded-full bg-current"
          aria-hidden="true"
        />
      ) : null}
      {dense ? shortStatusLabel(value) : value}
    </span>
  );
}
