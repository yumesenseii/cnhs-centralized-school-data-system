export default function GradeLevelSummary({ rows = [] }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-4 px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-800">Grade Level Summary</h2>
        <p className="hidden text-[10px] text-slate-400 sm:block">
          Risk counts use unique learners (ECR grades only)
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left">
          <thead className="bg-slate-50/80">
            <tr className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
              <th className="px-3 py-2 font-semibold">Grade</th>
              <th className="px-3 py-2 font-semibold">Students</th>
              <th className="px-3 py-2 font-semibold">High Risk</th>
              <th className="px-3 py-2 font-semibold">Moderate</th>
              <th className="px-3 py-2 font-semibold">Low</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr
                  key={row.grade}
                  className="border-t border-slate-100 text-xs transition-colors hover:bg-slate-50/70"
                >
                  <td className="px-3 py-2 font-semibold text-slate-700">
                    {row.grade}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{row.students}</td>
                  <td className="px-3 py-2 text-red-600">
                    <span className="font-semibold">+ {row.priority}</span>
                  </td>
                  <td className="px-3 py-2 text-cnhs-orange">
                    <span className="font-semibold">+ {row.moderate}</span>
                  </td>
                  <td className="px-3 py-2 text-cnhs-green-dark">
                    <span className="font-semibold">+ {row.low}</span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-sm text-slate-400"
                >
                  No grade-level summary for this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
