export default function SubjectBandTable({ data = [], unassignedCount = 0 }) {
  if (!data.length && !unassignedCount) {
    return (
      <p className="py-6 text-center text-xs text-slate-400">
        No learners need subject support right now.
      </p>
    );
  }

  const maxTotal = Math.max(...data.map((item) => item.total), 1);

  return (
    <div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-left">
        <thead>
          <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <th className="py-2 pr-2 font-bold">Subject</th>
            <th className="px-2 py-2 text-right font-bold">Needing Support</th>
            <th className="px-2 py-2 text-right font-bold">Immediate Review</th>
            <th className="py-2 pl-2 text-right font-bold">Monitoring</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((item) => (
            <tr key={item.subject} className="text-xs">
              <td className="py-2 pr-2">
                <p className="truncate text-xs font-medium text-slate-700">
                  {item.subject}
                </p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-cnhs-green-dark"
                    style={{ width: `${(item.total / maxTotal) * 100}%` }}
                    role="progressbar"
                    aria-label={`${item.subject} learners needing support`}
                    aria-valuenow={item.total}
                    aria-valuemin={0}
                    aria-valuemax={maxTotal}
                  />
                </div>
              </td>
              <td className="px-2 py-2 text-right text-xs font-bold tabular-nums text-slate-900">
                {item.total}
              </td>
              <td className="px-2 py-2 text-right text-xs font-bold tabular-nums text-red-700">
                {item.immediate}
              </td>
              <td className="py-2 pl-2 text-right text-xs font-bold tabular-nums text-amber-700">
                {item.monitoring}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {unassignedCount > 0 ? (
      <p className="mt-2 rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-1.5 text-[11px] text-slate-500">
        {unassignedCount} record{unassignedCount === 1 ? "" : "s"} need subject information.
      </p>
    ) : null}
    </div>
  );
}
