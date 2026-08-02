import Link from "next/link";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";

const recommendationStyles = {
  "ARAL Learners": "bg-sky-50 text-sky-700",
  "ARAL Screening": "bg-sky-50 text-sky-700",
  "Recommended for ARAL Learners": "bg-sky-50 text-sky-700",
  "Recommended for ARAL Screening": "bg-sky-50 text-sky-700",
  "No Recommendation": "bg-slate-100 text-slate-600",
  "Classroom Remediation": "bg-green-50 text-cnhs-green-dark",
  "Potential ARAL Learners": "bg-sky-50 text-sky-700",
  "Potential ARAL Screening": "bg-sky-50 text-sky-700",
  "Teacher-Based Intervention": "bg-green-50 text-cnhs-green-dark",
  "Classroom Remedial Recommended": "bg-green-50 text-cnhs-green-dark",
};

export default function SystemRecommendations({ recommendations }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-100 px-3 py-1.5 sm:px-4">
        <h2 className="text-sm font-semibold text-slate-900">System Recommendations</h2>
        <p className="mt-1 text-[11px] text-slate-400">
          Random Forest model suggestions. Teachers can view only — approval is reserved for Head
          Teacher / Administrator.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[640px] w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/80">
              {["Learner / Class", "Recommendation", "Reason", "Action"].map((column) => (
                <th
                  key={column}
                  className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recommendations.length ? (
              recommendations.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
                >
                <td className="px-3 py-1.5 text-xs font-semibold text-slate-800">{row.learner}</td>
                <td className="px-3 py-1.5">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold",
                      recommendationStyles[row.recommendation] ?? "bg-slate-100 text-slate-600"
                    )}
                  >
                    {row.recommendation}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-xs text-slate-500">{row.reason}</td>
                <td className="px-3 py-1.5">
                  <Link
                    href={row.href}
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    <Eye size={12} />
                    View
                  </Link>
                </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-10 text-center text-xs text-slate-500"
                >
                  No system recommendations for the selected period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
