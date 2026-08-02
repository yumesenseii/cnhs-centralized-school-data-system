import { Eye } from "lucide-react";
import ReportsTable from "@/components/reports/ReportsTable";

export default function RecentReports({ reports, onPreview }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Recently Generated Reports</h2>
          <p className="mt-1 text-[10px] text-slate-400">Click a report to preview or download.</p>
        </div>
        <button
          type="button"
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-cnhs-green-dark/40 bg-white px-3 text-[11px] font-semibold text-cnhs-green-dark transition-colors hover:bg-green-50"
        >
          <Eye size={12} />
          View All
        </button>
      </div>
      <ReportsTable reports={reports} onPreview={onPreview} />
    </section>
  );
}
