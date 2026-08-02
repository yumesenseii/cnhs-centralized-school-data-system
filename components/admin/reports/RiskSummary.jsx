"use client";

import { cn } from "@/lib/utils";

const tones = {
  red: "border-red-100 bg-red-50/70 text-red-600",
  orange: "border-orange-100 bg-orange-50/70 text-cnhs-orange",
  green: "border-green-100 bg-green-50/70 text-cnhs-green-dark",
};

export default function RiskSummary({ risk }) {
  return (
    <section>
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        Risk Classification <span className="font-normal">· read-only</span>
      </h3>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {risk.map((item) => (
          <div
            key={item.level}
            className={cn(
              "rounded-xl border px-3 py-4",
              tones[item.tone] ?? tones.green
            )}
          >
            <p className="text-[11px] font-semibold">{item.level}</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{item.learners}</p>
            <p className="mt-1 text-[11px] font-medium opacity-80">{item.percent} of flagged</p>
          </div>
        ))}
      </div>
    </section>
  );
}
