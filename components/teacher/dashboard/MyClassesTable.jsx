import Link from "next/link";
import { ArrowRight, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

const statusStyles = {
  Approved: "bg-green-50 text-cnhs-green-dark",
  "Pending Review": "bg-amber-50 text-amber-800",
  "Under Review": "bg-sky-50 text-sky-700",
  "Needs Revision": "bg-red-50 text-red-600",
  "Not Submitted": "bg-slate-100 text-slate-500",
  Pending: "bg-amber-50 text-amber-800",
};

function StatusPill({ value }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold leading-4",
        statusStyles[value] ?? "bg-slate-100 text-slate-500"
      )}
    >
      {value}
    </span>
  );
}

export default function MyClassesTable({ classes = [], embedded = false }) {
  const table = (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] border-collapse text-left">
        <thead>
          <tr className="bg-slate-50/80">
            {[
              "Subject",
              "Grade & Section",
              "Learners",
              "Attendance",
              "Needs Attention",
              "Lesson Plan",
              "Action",
            ].map((column) => (
              <th
                key={column}
                className="px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {classes.length ? (
            classes.map((row) => (
              <tr
                key={row.id}
                className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
              >
                <td className="px-3 py-2 text-[12px] font-semibold text-slate-800">
                  {row.subject}
                </td>
                <td className="px-3 py-2 text-[12px] text-slate-600">
                  {row.gradeSection}
                </td>
                <td className="px-3 py-2 text-[12px] text-slate-600">
                  <span className="font-medium text-slate-700">{row.students}</span>{" "}
                  <span className="text-[11px] text-slate-400">learners</span>
                </td>
                <td className="px-3 py-2 text-[12px] font-medium text-slate-700">
                  {row.attendance ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {row.needsAttention > 0 ? (
                    <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                      {row.needsAttention} {row.needsAttention === 1 ? "learner" : "learners"}
                    </span>
                  ) : (
                    <span className="inline-flex rounded-md bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-cnhs-green-dark">
                      None
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <StatusPill value={row.lessonPlan} />
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/teacher/my-classes/${row.id}`}
                    className="inline-flex h-7 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                  >
                    <Eye size={11} />
                    View Class
                  </Link>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={7}
                className="px-3 py-6 text-center text-[11px] text-slate-500"
              >
                No assigned classes for the selected school year and quarter.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  if (embedded) return table;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-900">
          My Classes Overview
        </h2>
        <Link
          href="/teacher/my-classes"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-cnhs-green-dark transition-colors hover:text-[#246f54]"
        >
          View All
          <ArrowRight size={12} />
        </Link>
      </div>
      {table}
    </section>
  );
}
