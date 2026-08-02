"use client";

import { StatusPill, riskStyles } from "@/components/teacher/my-classes/shared";

export default function RiskAssessment({ assessment }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <h3 className="text-sm font-semibold text-slate-900">Risk Assessment</h3>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500">Weak Subject</span>
          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-semibold text-sky-700">
            {assessment.weakSubject}
          </span>
        </div>
        <div className="inline-flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500">Risk Level</span>
          <StatusPill value={assessment.riskLevel} styles={riskStyles} />
        </div>
        <div className="inline-flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-500">Risk Score</span>
          <span className="text-[12px] font-semibold text-slate-800">{assessment.riskScore}</span>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-semibold text-slate-700">Reasons for Identification</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[12px] text-slate-600">
          {assessment.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>

      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
        <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
          System Recommendation
        </p>
        <p className="mt-1 text-[12px] font-medium text-slate-700">
          {assessment.systemRecommendation}
        </p>
        <p className="mt-2 text-[11px] text-slate-400">Generated {assessment.generatedDate}</p>
      </div>
    </section>
  );
}
