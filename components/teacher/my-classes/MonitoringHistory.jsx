"use client";

import { StatusPill } from "@/components/teacher/my-classes/shared";

export default function MonitoringHistory({ history }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-100 px-4 py-4">
        <h3 className="text-sm font-semibold text-slate-900">Monitoring History</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/80">
              {["Date", "Week", "Observation", "Progress", "Submitted By", "Status"].map(
                (column) => (
                  <th
                    key={column}
                    className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                  >
                    {column}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-3 py-2 text-[11px] text-slate-600">{row.date}</td>
                <td className="px-3 py-2 text-[11px] font-semibold text-slate-700">{row.week}</td>
                <td className="px-3 py-2 text-[11px] text-slate-600">{row.observation}</td>
                <td className="px-3 py-2 text-[11px] font-medium text-slate-700">{row.progress}</td>
                <td className="px-3 py-2 text-[11px] text-slate-600">{row.submittedBy}</td>
                <td className="px-3 py-2">
                  <StatusPill value={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
