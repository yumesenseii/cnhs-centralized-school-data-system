import { CheckCircle2 } from "lucide-react";
import StatusBadge from "@/components/lesson-plan/StatusBadge";

export default function SystemValidationCard({ validation }) {
  return (
    <section className="rounded-2xl border border-green-100 bg-green-50/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-cnhs-green-dark">{validation.title}</h3>
          <p className="mt-1 text-xs text-slate-500">Read-only completeness check.</p>
        </div>
        <StatusBadge value={validation.overallStatus} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {validation.items.map((item) => (
          <div key={item} className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <CheckCircle2 size={14} className="text-cnhs-green-dark" />
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}
