import { Download, Eye, FileSpreadsheet, FileText, Plus, Printer } from "lucide-react";
import { cn } from "@/lib/utils";

export function HeaderActions() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#246f54]"
      >
        <Plus size={13} />
        Generate Report
      </button>
      <button
        type="button"
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-sm transition-colors duration-200 hover:bg-slate-50"
      >
        <FileText size={12} />
        Export PDF
      </button>
      <button
        type="button"
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-sm transition-colors duration-200 hover:bg-slate-50"
      >
        <FileSpreadsheet size={12} />
        Export Excel
      </button>
      <button
        type="button"
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 shadow-sm transition-colors duration-200 hover:bg-slate-50"
      >
        <Printer size={12} />
        Print
      </button>
    </div>
  );
}

export function FileTypeBadge({ value }) {
  const isPdf = value === "PDF";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        isPdf ? "bg-red-50 text-red-600" : "bg-green-50 text-cnhs-green-dark"
      )}
    >
      {isPdf ? <FileText size={11} /> : <FileSpreadsheet size={11} />}
      {value}
    </span>
  );
}

export function RowActions({ onPreview }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onPreview}
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-cnhs-green-dark/40 bg-white px-3 text-[11px] font-semibold text-cnhs-green-dark transition-colors duration-200 hover:bg-green-50"
      >
        <Eye size={12} />
        Preview
      </button>
      <button
        type="button"
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition-colors duration-200 hover:bg-slate-50"
      >
        <Download size={12} />
        Download
      </button>
    </div>
  );
}
