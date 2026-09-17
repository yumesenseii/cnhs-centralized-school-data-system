"use client";

export default function MonitoringSummary({ interventions, monitoring }) {
  const data = interventions || monitoring || {};
  const tiles = [
    {
      label: "ARAL Learners",
      value: data.aral ?? data.aralScreening ?? "—",
      tone: "text-sky-700",
    },
    {
      label: "Classroom Remedial",
      value: data.classroomRemedial ?? data.classroomRemediation ?? "No",
      hint: "Class-level",
      tone: "text-cnhs-green-dark",
    },
    {
      label: "Monitoring Completed",
      value: data.monitoringCompleted ?? 0,
      tone: "text-cnhs-green-dark",
    },
    {
      label: "Still Under Monitoring",
      value: data.stillUnderMonitoring ?? 0,
      tone: "text-amber-600",
    },
    {
      label: "Showing Improvement",
      value: data.showingImprovement ?? 0,
      tone: "text-cnhs-green-dark",
    },
    {
      label: "Needs Follow-up",
      value: data.needsFollowUp ?? data.immediateFollowUp ?? 0,
      tone: "text-red-600",
    },
  ];

  return (
    <section>
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        Interventions & follow-up
      </h3>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {tiles.map((item) => (
          <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
              {item.label}
            </p>
            <p className={`mt-1 text-[12px] font-semibold ${item.tone}`}>
              {item.value}
            </p>
            {item.hint ? (
              <p className="mt-0.5 text-[10px] text-slate-400">{item.hint}</p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
