"use client";

export default function RecommendationSummary({ recommendations }) {
  const tiles = [
    {
      label: "ARAL Learners",
      value: recommendations.recommendAral,
      tone: "text-sky-700",
    },
    {
      label: "Classroom Remedial (class-level)",
      value: recommendations.continueRemediation,
      tone: "text-cnhs-green-dark",
    },
    {
      label: "Learners Showing Improvement",
      value: recommendations.showingImprovement,
      tone: "text-cnhs-green-dark",
    },
    {
      label: "Needs Immediate Follow Up",
      value: recommendations.immediateFollowUp,
      tone: "text-red-600",
    },
  ];

  return (
    <section>
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        Recommendation Summary <span className="font-normal">· read-only</span>
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
          </div>
        ))}
      </div>
    </section>
  );
}
