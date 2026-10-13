import { ClipboardCheck, Eye } from "lucide-react";
import StatusBadge from "@/components/lesson-plan/StatusBadge";

export default function LessonRow({ lesson, onReview }) {
  const isApproved = lesson.status === "Approved";

  return (
    <tr className="group border-t border-slate-100 transition-colors hover:bg-slate-50/60 dark:border-white/10 dark:hover:bg-white/[0.04]">
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cnhs-green-dark text-[10px] font-semibold text-white">
            {lesson.initials}
          </span>
          <span className="min-w-0">
            <span className="block whitespace-nowrap text-[13px] font-semibold text-slate-800 dark:text-slate-100">
              {lesson.teacher}
            </span>
            <span className="block text-[12px] text-slate-400">
              {lesson.department}
            </span>
          </span>
        </div>
      </td>
      <td className="px-4 py-3 align-middle text-[13px] text-slate-600 dark:text-slate-300">
        {lesson.learningArea}
      </td>
      <td className="px-4 py-3 align-middle text-[13px] text-slate-600 dark:text-slate-300">
        {lesson.gradeSection}
      </td>
      <td className="max-w-[260px] px-4 py-3 align-middle text-[13px] font-medium leading-snug text-slate-900 dark:text-slate-100">
        {lesson.lessonTitle}
      </td>
      <td className="px-4 py-3 align-middle text-[12px] text-slate-500 dark:text-slate-400">
        {lesson.weekCovered}
      </td>
      <td className="px-4 py-3 align-middle text-[12px] text-slate-400">
        {lesson.submissionDate}
      </td>
      <td className="px-4 py-3 align-middle">
        <StatusBadge value={lesson.status} />
      </td>
      <td className="sticky right-0 z-[1] bg-white px-4 py-3 text-right align-middle shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)] group-hover:bg-slate-50/60 dark:bg-[var(--card)] dark:shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.45)] dark:group-hover:bg-[#222]">
        <button
          type="button"
          onClick={() => onReview(lesson)}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 active:scale-95"
        >
          {isApproved ? (
            <Eye size={13} aria-hidden="true" />
          ) : (
            <ClipboardCheck size={13} aria-hidden="true" />
          )}
          {isApproved ? "View" : "Review"}
        </button>
      </td>
    </tr>
  );
}
