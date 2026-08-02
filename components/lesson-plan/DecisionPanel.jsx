"use client";

import { CheckCheck, RotateCcw } from "lucide-react";
import StatusBadge from "@/components/lesson-plan/StatusBadge";

export default function DecisionPanel({
  status,
  selectedDecision,
  onSelectDecision,
}) {
  const active = selectedDecision || null;

  function choose(decision) {
    onSelectDecision?.(decision);
  }

  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
        Decision
      </h3>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="font-semibold text-slate-800">Current Status</p>
          <StatusBadge value={status} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => choose("Approved")}
            className={`inline-flex h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 text-sm font-semibold transition-colors ${
              active === "Approved"
                ? "border-cnhs-green-dark bg-green-50 text-cnhs-green-dark"
                : "border-cnhs-green-dark bg-white text-cnhs-green-dark hover:bg-green-50"
            }`}
          >
            <CheckCheck size={17} />
            Approve
          </button>
          <button
            type="button"
            onClick={() => choose("Needs Revision")}
            className={`inline-flex h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 text-sm font-semibold transition-colors ${
              active === "Needs Revision"
                ? "border-red-500 bg-red-50 text-red-500"
                : "border-red-500 bg-white text-red-500 hover:bg-red-50"
            }`}
          >
            <RotateCcw size={17} />
            Needs Revision
          </button>
        </div>
      </div>
    </section>
  );
}
