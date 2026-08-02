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
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left">
          <thead className="bg-slate-50/80">
            <tr>
              {headers.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="px-4 py-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lessons.map((lesson) => (
              <LessonRow key={lesson.id} lesson={lesson} onReview={onReview} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
