import Link from "next/link";
import { ArrowRight, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

const statusStyles = {
  Submitted: "bg-green-50 text-cnhs-green-dark",
  Approved: "bg-green-50 text-cnhs-green-dark",
  Pending: "bg-orange-50 text-cnhs-orange",
  "Pending Review": "bg-orange-50 text-cnhs-orange",
  "Under Review": "bg-sky-50 text-sky-700",
  "Needs Revision": "bg-red-50 text-red-600",
  Recommended: "bg-orange-50 text-cnhs-orange",
  "Not Needed": "bg-green-50 text-cnhs-green-dark",
};

function StatusPill({ value }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold",
        statusStyles[value] ?? "bg-slate-100 text-slate-500"
      )}
    >
      {value}
    </span>
  );
}

export default function MyClassesTable({ classes }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-1.5 sm:px-4">
        <h2 className="text-sm font-semibold text-slate-900">My Classes Overview</h2>
        <Link
          href="/teacher/my-classes"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-cnhs-green-dark transition-colors hover:text-[#246f54]"
        >
          View All
          <ArrowRight size={12} />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/80">
              {[
                "Subject",
                "Grade & Section",
                "Students",
                "ARAL Learners",
                "Classroom Remedial",
                "Academic Record",
                "Lesson Plan",
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
            {classes.length ? (
              classes.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-slate-100 transition-colors hover:bg-slate-50/70"
                >
                <td className="px-3 py-1.5 text-[12px] font-semibold text-slate-800">{row.subject}</td>
                <td className="px-3 py-1.5 text-[12px] text-slate-600">{row.gradeSection}</td>
                <td className="px-3 py-1.5">
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    {row.students}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-[12px] font-semibold text-slate-700">{row.aralLearners}</td>
                <td className="px-3 py-1.5">
                  <StatusPill value={row.classroomRemedial} />
                </td>
                <td className="px-3 py-1.5">
                  <StatusPill value={row.academicRecord} />
                </td>
                <td className="px-3 py-1.5">
                  <StatusPill value={row.lessonPlan} />
                </td>
                <td className="px-3 py-1.5">
                  <Link
                    href={`/teacher/my-classes/${row.id}`}
                    className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-cnhs-green-dark/35 bg-white px-2.5 text-[10px] font-semibold text-cnhs-green-dark transition-colors hover:bg-green-50"
                  >
                    <Eye size={12} />
                    View Class
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
                  No assigned classes for the selected school year and quarter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
