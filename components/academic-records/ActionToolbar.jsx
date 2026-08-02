import { ClipboardCheck, Download, FileSearch, HeartPulse, Loader2 } from "lucide-react";

const actions = [
  { label: "Review E-Class Record Uploads", icon: FileSearch },
  { label: "Validate Uploaded Records", icon: ClipboardCheck },
  { label: "View Intervention Summary", icon: HeartPulse },
  { label: "Export Records", icon: Download },
];

export default function ActionToolbar({ onAction, exporting = false }) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map(({ label, icon: Icon }) => {
        const isExport = label === "Export Records";
        return (
          <button
            key={label}
            type="button"
            onClick={() => onAction?.(label)}
            disabled={isExport && exporting}
            className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-cnhs-green-dark/50 bg-white px-3 text-[11px] font-semibold text-cnhs-green-dark shadow-sm transition-colors duration-200 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExport && exporting ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
}
