import StatusBadge from "@/components/academic-records/StatusBadge";

export default function RecentUploadActivity({ activity }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
      <div className="flex items-center justify-between px-3 py-2.5">
        <h2 className="text-[13px] font-semibold text-slate-800">
          Recent Upload Activity
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] table-fixed text-left">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[28%]" />
            <col className="w-[16%]" />
            <col className="w-[16%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead className="bg-slate-50/80">
            <tr className="text-[9px] uppercase tracking-[0.06em] text-slate-500">
              <th className="px-2 py-1.5 font-semibold">Teacher</th>
              <th className="px-2 py-1.5 font-semibold">Assigned Class</th>
              <th className="px-2 py-1.5 font-semibold">Term</th>
              <th className="px-2 py-1.5 font-semibold">Submitted</th>
              <th className="px-2 py-1.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {activity.length ? (
              activity.map((item, index) => (
                <tr
                  key={item.id || `${item.teacher}-${item.assignedClass}-${index}`}
                  className="border-t border-slate-100"
                >
                  <td className="px-2 py-1.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cnhs-green-dark text-[9px] font-semibold text-white">
                        {item.initials}
                      </span>
                      <span className="truncate text-[11px] font-semibold text-slate-700">
                        {item.teacher}
                      </span>
                    </div>
                  </td>
                  <td className="truncate px-2 py-1.5 text-[11px] text-slate-600">
                    {item.assignedClass}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-[11px] text-slate-600">
                    {item.term || "—"}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-[11px] text-slate-500">
                    {item.submissionDate}
                  </td>
                  <td className="px-2 py-1.5">
                    <StatusBadge value={item.reviewStatus} dot={false} />
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="px-2 py-6 text-center text-[11px] text-slate-400"
                >
                  No instructional-term uploads yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
