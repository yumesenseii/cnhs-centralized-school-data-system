"use client";

const th =
  "border border-slate-200 bg-slate-100 px-3 py-2 text-left text-[11px] font-semibold text-slate-600";
const td = "border border-slate-200 px-3 py-2 text-[12px] text-slate-800";

export default function EcrSummary({ rows = [] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-[720px] w-full border-collapse">
        <thead>
          <tr>
            <th className={th}>Learner</th>
            <th className={th}>Term 1</th>
            <th className={th}>Term 2</th>
            <th className={th}>Term 3</th>
            <th className={th}>Final (AVE)</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.studentId}>
                <td className={td}>{row.name}</td>
                <td className={`${td} text-center`}>{row.terms[1] ?? "—"}</td>
                <td className={`${td} text-center`}>{row.terms[2] ?? "—"}</td>
                <td className={`${td} text-center`}>{row.terms[3] ?? "—"}</td>
                <td className={`${td} text-center font-semibold text-cnhs-green-dark`}>
                  {row.finalGrade ?? "—"}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                No term grades yet. Enter scores on Term 1–3 tabs.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
