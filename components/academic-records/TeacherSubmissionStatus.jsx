import StatusBadge from "@/components/academic-records/StatusBadge";

export default function TeacherSubmissionStatus({
  submissions,
  progress,
  periodLabel = "Selected period",
}) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
      <div className="mb-2">
        <h2 className="text-[13px] font-semibold text-slate-800">
          Teacher Submission Status
        </h2>
        <p className="mt-0.5 text-[9px] text-slate-400">{periodLabel}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] text-left">
          <thead>
            <tr className="text-[9px] uppercase tracking-[0.06em] text-slate-400">
              <th className="py-1 font-semibold">Teacher</th>
              <th className="py-1 font-semibold">Date</th>
              <th className="py-1 font-semibold">Status</th>
              <th className="py-1 font-semibold">Valid</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((submission) => (
              <tr
                key={`${submission.initials}-${submission.teacher}`}
                className="border-t border-slate-100"
              >
                <td className="py-1.5 pr-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cnhs-green-dark text-[8px] font-semibold text-white">
                      {submission.initials}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-700">
                      {submission.teacher}
                    </span>
                  </div>
                </td>
                <td className="py-1.5 pr-1.5 text-[10px] text-slate-400">
                  {submission.submissionDate}
                </td>
                <td className="py-1.5 pr-1.5">
                  <StatusBadge value={submission.uploadStatus} dot={false} />
                </td>
                <td className="py-1.5 pr-1.5">
                  <StatusBadge value={submission.validationStatus} dot={false} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2">
        <div className="mb-1 flex items-center justify-between text-[10px]">
          <span className="text-slate-500">{progress.label}</span>
          <span className="font-semibold text-cnhs-green-dark">
            {progress.percent}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-cnhs-green-dark"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>
    </section>
  );
}
