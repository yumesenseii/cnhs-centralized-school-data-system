import { CheckCircle2 } from "lucide-react";

export default function AcademicPerformanceAnalysis({ analysis }) {
  return (
    <section className="rounded-xl border border-green-100 bg-green-50/70 p-2.5 shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-cnhs-green-dark">
          Academic Analysis
        </h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-semibold text-cnhs-green-dark">
          <CheckCircle2 size={11} aria-hidden="true" />
          {analysis.status}
        </span>
      </div>

      <dl className="mt-2 space-y-1.5 text-[10px]">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Last Analysis</dt>
          <dd className="font-semibold text-cnhs-green-dark">
            {analysis.lastAnalysis}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Records Processed</dt>
          <dd className="font-semibold text-cnhs-green-dark">
            {analysis.recordsProcessed}
          </dd>
        </div>
      </dl>
    </section>
  );
}
