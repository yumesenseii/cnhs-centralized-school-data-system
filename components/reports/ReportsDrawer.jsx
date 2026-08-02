"use client";

import { Download, FileSpreadsheet, Printer, X } from "lucide-react";
import ChartsPreview from "@/components/reports/ChartsPreview";
import ReportInformation from "@/components/reports/ReportInformation";
import ReportPagesPreview from "@/components/reports/ReportPagesPreview";
import SummaryStatistics from "@/components/reports/SummaryStatistics";

export default function ReportsDrawer({
  open,
  report,
  academicPerformance,
  riskDistribution,
  onClose,
}) {
  if (!open || !report) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/35 backdrop-blur-[1px]" onClick={onClose} />
      <aside
        className="absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col bg-white shadow-[-18px_0_40px_rgba(15,23,42,0.18)]"
        aria-label="Report preview drawer"
      >
        <div className="border-b border-slate-100 px-7 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 max-w-[430px]">
              <p className="text-xs font-semibold text-slate-400">
                Report Preview · {report.id}
              </p>
              <h2 className="mt-1 break-words text-xl font-semibold leading-7 tracking-[-0.03em] text-slate-900">
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
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-7 py-7 pb-28">
          <ReportInformation report={report} />
          <SummaryStatistics stats={report.summaryStats} />
          <ChartsPreview
            academicPerformance={academicPerformance}
            riskDistribution={riskDistribution}
          />
          <ReportPagesPreview pages={report.pages} />
        </div>

        <div className="sticky bottom-0 grid grid-cols-[1fr_1fr_48px] gap-3 border-t border-slate-100 bg-white/95 px-7 py-4 backdrop-blur">
          <button
            type="button"
            className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-cnhs-green-dark text-sm font-semibold text-white transition-colors hover:bg-[#246f54]"
          >
            <Download size={16} />
            Download PDF
          </button>
          <button
            type="button"
            className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <FileSpreadsheet size={16} />
            Excel
          </button>
          <button
            type="button"
            aria-label="Print report"
            className="inline-flex h-12 cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
          >
            <Printer size={16} />
          </button>
        </div>
      </aside>
    </div>
  );
}
