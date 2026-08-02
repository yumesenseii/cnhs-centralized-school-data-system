import { BarChart3, CheckCircle2 } from "lucide-react";

export default function AcademicPerformanceAnalysis({ analysis }) {
  return (
    <section className="rounded-xl border border-green-100 bg-green-50/70 p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <BarChart3 size={17} className="text-cnhs-green-dark" aria-hidden="true" />
          <h2 className="text-base font-semibold leading-5 text-cnhs-green-dark">
            Academic
            <br />
            Analysis
          </h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-[11px] font-semibold text-cnhs-green-dark">
          <CheckCircle2 size={12} aria-hidden="true" />
          {analysis.status}
        </span>
      </div>

      <dl className="mt-3 space-y-3 text-xs">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-slate-500">Last Analysis</dt>
          <dd className="font-semibold text-cnhs-green-dark">{analysis.lastAnalysis}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-slate-500">Records Processed</dt>
          <dd className="font-semibold text-cnhs-green-dark">{analysis.recordsProcessed}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-slate-500">Learners Requiring Intervention</dt>
          <dd className="font-semibold text-cnhs-green-dark">{analysis.learnersRequiringIntervention}</dd>
        </div>
      </dl>
    </section>
  );
}
