import { Activity } from "lucide-react";
import StatusBadge from "@/components/academic-records/StatusBadge";

export default function RecentUploadActivity({ activity }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between px-4 py-4">
        <h2 className="text-sm font-semibold text-slate-800">Recent Upload Activity</h2>
        <Activity size={14} className="text-slate-300" aria-hidden="true" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left">
          <thead className="bg-slate-50/80">
            <tr className="text-[10px] uppercase tracking-[0.08em] text-slate-500">
              <th className="px-3 py-2 font-semibold">Teacher</th>
              <th className="px-3 py-2 font-semibold">Assigned Class</th>
              <th className="px-3 py-2 font-semibold">Submission Date</th>
              <th className="px-3 py-2 font-semibold">Review Status</th>
            </tr>
          </thead>
          <tbody>
            {activity.map((item, index) => (
              <tr
                key={item.id || `${item.teacher}-${item.assignedClass}-${index}`}
                className="border-t border-slate-100"
              >
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cnhs-green-dark text-[10px] font-semibold text-white">
                      {item.initials}
                    </span>
                    <span className="whitespace-nowrap text-xs font-semibold text-slate-700">{item.teacher}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">{item.assignedClass}</td>
                <td className="px-3 py-2 text-xs text-slate-500">{item.submissionDate}</td>
                <td className="px-3 py-2">
                  <StatusBadge value={item.reviewStatus} dot={false} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
