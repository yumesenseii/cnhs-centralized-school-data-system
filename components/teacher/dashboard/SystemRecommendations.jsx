import Link from "next/link";
import { Eye } from "lucide-react";
import LearnerName from "@/components/shared/LearnerName";
import { cn } from "@/lib/utils";

const recommendationStyles = {
  "ARAL Learner": "bg-sky-50 text-sky-700",
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

export default function SystemRecommendations({
  recommendations = [],
  compact = false,
  limit,
}) {
  const rows =
    typeof limit === "number"
      ? recommendations.slice(0, limit)
      : recommendations;

  if (compact) {
    return (
      <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
        <div className="border-b border-slate-100 px-3 py-2">
          <h2 className="text-sm font-semibold text-slate-900">
            System Recommendations
          </h2>
          <p className="mt-0.5 text-[10px] text-slate-400">
            View only — HT/Admin approval required.
          </p>
        </div>
        <ul className="divide-y divide-slate-100">
          {rows.length ? (
            rows.map((row) => (
              <li
                key={row.id}
                className="flex items-start justify-between gap-2 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate">
                    {row.isLearner ? (
                      <LearnerName
                        firstName={row.firstName}
                        middleName={row.middleName}
                        lastName={row.lastName}
                        name={row.learner}
                      />
                    ) : (
                      <span className="text-[12px] font-semibold leading-4 text-slate-800">
                        {row.learner}
                      </span>
                    )}
                  </p>
                  <span
                    className={cn(
                      "mt-1 inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-4",
                      recommendationStyles[row.recommendation] ??
                        "bg-slate-100 text-slate-600"
                    )}
                  >
                    {row.recommendation}
                  </span>
                </div>
                <Link
                  href={row.href}
                  className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  <Eye size={11} />
                  View
                </Link>
              </li>
            ))
          ) : (
            <li className="px-3 py-5 text-center text-[11px] text-slate-500">
              No system recommendations for the selected period.
            </li>
          )}
        </ul>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
      <div className="border-b border-slate-100 px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-900">
          System Recommendations
        </h2>
        <p className="mt-0.5 text-[10px] text-slate-400">
          View only — HT/Admin approval required.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[520px] w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/80">
              {["Learner / Class", "Recommendation", "Reason", "Action"].map(
                (column) => (
                  <th
                    key={column}
                    className="px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                  >
                    {column}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
                >
                  <td className="px-2 py-1">
                    {row.isLearner ? (
                      <LearnerName
                        firstName={row.firstName}
                        middleName={row.middleName}
                        lastName={row.lastName}
                        name={row.learner}
                      />
                    ) : (
                      <span className="text-[12px] font-semibold leading-4 text-slate-800">
                        {row.learner}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1">
                    <span
                      className={cn(
                        "inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-4",
                        recommendationStyles[row.recommendation] ??
                          "bg-slate-100 text-slate-600"
                      )}
                    >
                      {row.recommendation}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-[11px] text-slate-500">
                    {row.reason}
                  </td>
                  <td className="px-2 py-1">
                    <Link
                      href={row.href}
                      className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      <Eye size={11} />
                      View
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-6 text-center text-[11px] text-slate-500"
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
