import LessonRow from "@/components/lesson-plan/LessonRow";

const headers = [
  "Teacher",
  "Learning Area",
  "Grade & Section",
  "Lesson Title",
  "Week Covered",
  "Submission Date",
  "Status",
  "Actions",
];

export default function LessonPlanTable({ lessons, onReview }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left">
          <thead className="bg-slate-50/90">
            <tr>
              {headers.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className={
                    header === "Actions"
                      ? "sticky right-0 z-10 bg-slate-50/95 px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)]"
                      : "px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-500"
                  }
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lessons.length === 0 ? (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-3 py-8 text-center text-sm text-slate-400"
                >
                  No lesson plans for the selected filters.
                </td>
              </tr>
            ) : (
              lessons.map((lesson) => (
                <LessonRow key={lesson.id} lesson={lesson} onReview={onReview} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
