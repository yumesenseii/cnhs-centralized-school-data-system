"use client";

export default function MonitoringSummary({ monitoring }) {
  const rows = [
    ["ARAL Learners", monitoring.aralScreening],
    ["Classroom Remedial (class-level)", monitoring.classroomRemediation],
    ["Monitoring Completed", monitoring.monitoringCompleted],
    ["Still Under Monitoring", monitoring.stillUnderMonitoring],
  ];

  return (
    <section>
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        Monitoring Summary <span className="font-normal">· read-only</span>
      </h3>
      <dl className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 bg-white px-3 py-2.5"
          >
            <dt className="text-[12px] text-slate-600">{label}</dt>
            <dd className="text-[12px] font-semibold text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
