"use client";

export default function SchoolSummary({ summary }) {
  const rows = [
    ["Overall School Average", summary.overallAverage],
    ["Total Learners", summary.totalLearners],
    ["Total At Risk Learners", summary.atRisk],
    ["ARAL Learners", summary.aralScreening],
    ["Classroom Remediation", summary.classroomRemediation],
    ["Monitoring Completion Rate", summary.monitoringCompletionRate],
    ["Lesson Plans Approved", summary.lessonPlansApproved],
    ["Academic Records Validated", summary.academicRecordsValidated],
  ];

  return (
    <section>
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        School Summary <span className="font-normal">· read-only</span>
      </h3>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2"
          >
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
              {label}
            </p>
            <p className="mt-1 text-[13px] font-semibold text-slate-800">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
