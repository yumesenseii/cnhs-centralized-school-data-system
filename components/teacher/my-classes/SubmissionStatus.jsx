"use client";

import { StatusPill } from "@/components/teacher/my-classes/shared";

export default function SubmissionStatus({ submission }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <h3 className="text-sm font-semibold text-slate-900">Submission Status</h3>
      <div className="mt-4 space-y-3">
        <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
          <div>
            <p className="text-[12px] font-semibold text-slate-800">E-Class Record</p>
            <p className="mt-1 text-[11px] text-slate-500">{submission.eClass.detail}</p>
          </div>
          <StatusPill value={submission.eClass.status} />
        </div>
        <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
          <div>
            <p className="text-[12px] font-semibold text-slate-800">Lesson Plan</p>
            <p className="mt-1 text-[11px] text-slate-500">{submission.lessonPlan.detail}</p>
          </div>
          <StatusPill value={submission.lessonPlan.status} />
        </div>
      </div>
    </section>
  );
}
