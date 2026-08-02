import { UsersRound } from "lucide-react";
import StatusBadge from "@/components/academic-records/StatusBadge";

export default function TeacherSubmissionStatus({
  submissions,
  progress,
  periodLabel = "Selected period",
}) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Teacher Submission Status</h2>
          <p className="mt-1 text-[10px] text-slate-400">{periodLabel}</p>
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-50 text-cnhs-green-dark">
          <UsersRound size={14} aria-hidden="true" />
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[330px] text-left">
          <thead>
            <tr className="text-[9px] uppercase tracking-[0.08em] text-slate-400">
              <th className="py-2 font-semibold">Teacher</th>
              <th className="py-2 font-semibold">Date</th>
              <th className="py-2 font-semibold">Status</th>
              <th className="py-2 font-semibold">Valid</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((submission) => (
              <tr key={`${submission.initials}-${submission.teacher}`} className="border-t border-slate-100">
                <td className="py-2 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cnhs-green-dark text-[9px] font-semibold text-white">
                      {submission.initials}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-700">{submission.teacher}</span>
                  </div>
                </td>
                <td className="py-2 pr-2 text-[11px] text-slate-400">{submission.submissionDate}</td>
                <td className="py-2 pr-2">
                  <StatusBadge value={submission.uploadStatus} dot={false} />
                </td>
                <td className="py-2 pr-2">
                  <StatusBadge value={submission.validationStatus} dot={false} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-slate-500">{progress.label}</span>
          <span className="font-semibold text-cnhs-green-dark">{progress.percent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-cnhs-green-dark" style={{ width: `${progress.percent}%` }} />
        </div>
      </div>
    </section>
  );
}
