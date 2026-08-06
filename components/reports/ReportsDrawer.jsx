"use client";

import { Download, FileSpreadsheet, Printer, X } from "lucide-react";
import ChartsPreview from "@/components/reports/ChartsPreview";
import ReportInformation from "@/components/reports/ReportInformation";
import ReportPagesPreview from "@/components/reports/ReportPagesPreview";
import SummaryStatistics from "@/components/reports/SummaryStatistics";
import { VIEW_MODAL_BACKDROP, VIEW_MODAL_PANEL } from "@/lib/ui/viewModal";

export default function ReportsDrawer({
  open,
  report,
  academicPerformance,
  riskDistribution,
  onClose,
}) {
  if (!open || !report) return null;

  return (
    <div
      className={VIEW_MODAL_BACKDROP}
      role="dialog"
      aria-modal="true"
      aria-label="Report preview"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className={VIEW_MODAL_PANEL}>
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-3.5">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-400">
              Report Preview · {report.id}
            </p>
            <h2 className="mt-1 break-words text-lg font-semibold leading-6 tracking-[-0.03em] text-slate-900">
              {report.reportName}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {report.category} · {report.fileType} · {report.generatedDate}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report preview"
            className="cursor-pointer rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <ReportInformation report={report} />
          <SummaryStatistics stats={report.summaryStats} />
          <ChartsPreview
            academicPerformance={academicPerformance}
            riskDistribution={riskDistribution}
          />
          <ReportPagesPreview pages={report.pages} />
        </div>

        <div className="grid shrink-0 grid-cols-[1fr_1fr_48px] gap-2 border-t border-slate-100 bg-white px-5 py-3">
          <button
            type="button"
            className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-cnhs-green-dark text-sm font-semibold text-white transition-colors hover:bg-[#246f54]"
          >
            <Download size={16} />
            Download PDF
          </button>
          <button
            type="button"
            className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <FileSpreadsheet size={16} />
            Excel
          </button>
          <button
            type="button"
            aria-label="Print report"
            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
          >
            <Printer size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
