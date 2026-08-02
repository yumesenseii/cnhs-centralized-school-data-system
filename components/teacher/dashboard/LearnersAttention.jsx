import Link from "next/link";
import RiskBadge from "@/components/dashboard/RiskBadge";
import { cn } from "@/lib/utils";

const avatarTones = {
  red: "bg-red-100 text-red-600",
  orange: "bg-orange-100 text-cnhs-orange",
  blue: "bg-sky-100 text-sky-700",
  green: "bg-green-100 text-cnhs-green-dark",
  violet: "bg-violet-100 text-violet-700",
};

const progressStyles = {
  "Needs Attention": "bg-red-50 text-red-600",
  Improving: "bg-green-50 text-cnhs-green-dark",
  "Observation Needed": "bg-orange-50 text-cnhs-orange",
  Stable: "bg-slate-100 text-slate-600",
};

const interventionStyles = {
  "ARAL Learners": "bg-sky-50 text-sky-700 ring-sky-100",
  "ARAL Screening": "bg-sky-50 text-sky-700 ring-sky-100",
  "Recommended for ARAL Learners": "bg-sky-50 text-sky-700 ring-sky-100",
  "Recommended for ARAL Screening": "bg-sky-50 text-sky-700 ring-sky-100",
  "No Recommendation": "bg-slate-100 text-slate-600 ring-slate-100",
  "Classroom Remediation": "bg-green-50 text-cnhs-green-dark ring-green-100",
  "Potential ARAL Learners": "bg-sky-50 text-sky-700 ring-sky-100",
  "Potential ARAL Screening": "bg-sky-50 text-sky-700 ring-sky-100",
  "Teacher-Based Intervention": "bg-green-50 text-cnhs-green-dark ring-green-100",
  "Classroom Remedial (Class-Level)":
    "bg-green-50 text-cnhs-green-dark ring-green-100",
};

export default function LearnersAttention({ learners }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-1.5 sm:px-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Learners Requiring Attention</h2>
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
            {learners.length}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[920px] w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/80">
              {[
                "Student",
                "Grade & Section",
                "Weak Subject",
                "Current Grade",
                "Risk Level",
                "Intervention",
                "Progress",
                "Action",
              ].map((column) => (
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
            {learners.length ? (
              learners.map((learner) => (
                <tr
                  key={learner.id}
                  className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
                >
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold",
                        avatarTones[learner.avatarTone] ?? avatarTones.green
                      )}
                    >
                      {learner.initials}
                    </span>
                    <span className="text-xs font-semibold text-slate-800">{learner.name}</span>
                  </div>
                </td>
                <td className="px-3 py-1.5 text-xs text-slate-600">{learner.gradeSection}</td>
                <td className="px-3 py-1.5 text-xs text-slate-600">{learner.weakSubject}</td>
                <td className="px-3 py-1.5 text-xs font-semibold text-slate-800">
                  {learner.currentGrade}
                </td>
                <td className="px-3 py-1.5">
                  <RiskBadge value={learner.riskLevel} />
                </td>
                <td className="px-3 py-1.5">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1",
                      interventionStyles[learner.intervention] ??
                        "bg-slate-100 text-slate-600 ring-slate-100"
                    )}
                  >
                    {learner.intervention}
                  </span>
                </td>
                <td className="px-3 py-1.5">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold",
                      progressStyles[learner.progress] ?? "bg-slate-100 text-slate-500"
                    )}
                  >
                    {learner.progress}
                  </span>
                </td>
                <td className="px-3 py-1.5">
                  <Link
                    href={`/teacher/monitoring/${learner.classId}/students/${learner.studentId}`}
                    className="inline-flex h-7 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                  >
                    View Monitoring
                  </Link>
                </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-xs text-slate-500"
                >
                  No learners currently require attention.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
