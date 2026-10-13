import { useEffect, useMemo, useState } from "react";
import LessonRow from "@/components/lesson-plan/LessonRow";
import AdminTablePagination from "@/components/shared/AdminTablePagination";

const PAGE_SIZE = 10;

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

export default function LessonPlanTable({ lessons = [], onReview }) {
  const [page, setPage] = useState(1);

  // Reset to page 1 on filter/search change
  useEffect(() => {
    setPage(1);
  }, [lessons]);

  const totalPages = Math.max(1, Math.ceil(lessons.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);

  const pagedLessons = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return lessons.slice(start, start + PAGE_SIZE);
  }, [lessons, safePage]);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs dark:border-white/10 dark:bg-[var(--card)] dark:shadow-none">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left">
          <thead className="bg-slate-50/80 dark:bg-white/[0.04]">
            <tr>
              {headers.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className={
                    header === "Actions"
                      ? "sticky right-0 z-10 bg-slate-50/95 px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)] dark:bg-[#222] dark:text-slate-300 dark:shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.45)]"
                      : "px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
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
                  className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500"
                >
                  No lesson plans for the selected filters.
                </td>
              </tr>
            ) : (
              pagedLessons.map((lesson) => (
                <LessonRow key={lesson.id} lesson={lesson} onReview={onReview} />
              ))
            )}
          </tbody>
        </table>
      </div>

      <AdminTablePagination
        page={safePage}
        pageSize={PAGE_SIZE}
        total={lessons.length}
        onPageChange={setPage}
        itemLabel="lesson plans"
      />
    </section>
  );
}
