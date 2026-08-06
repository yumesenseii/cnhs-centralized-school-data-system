import { ClipboardCheck, Eye } from "lucide-react";
import StatusBadge from "@/components/lesson-plan/StatusBadge";

export default function LessonRow({ lesson, onReview }) {
  const isApproved = lesson.status === "Approved";

  return (
    <tr className="group border-t border-slate-100 transition-colors hover:bg-slate-50/60">
      <td className="px-2.5 py-2 align-middle">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cnhs-green-dark text-[9px] font-semibold text-white">
            {lesson.initials}
          </span>
          <span className="min-w-0">
            <span className="block whitespace-nowrap text-[12px] font-semibold text-slate-800">
              {lesson.teacher}
            </span>
            <span className="block text-[10px] text-slate-400">
              {lesson.department}
            </span>
          </span>
        </div>
      </td>
      <td className="px-2.5 py-2 align-middle text-[11px] text-slate-600">
        {lesson.learningArea}
      </td>
      <td className="px-2.5 py-2 align-middle text-[11px] text-slate-600">
        {lesson.gradeSection}
      </td>
      <td className="max-w-[230px] px-2.5 py-2 align-middle text-[11px] font-semibold leading-4 text-slate-900">
        {lesson.lessonTitle}
      </td>
      <td className="px-2.5 py-2 align-middle text-[11px] text-slate-500">
        {lesson.weekCovered}
      </td>
      <td className="px-2.5 py-2 align-middle text-[11px] text-slate-400">
        {lesson.submissionDate}
      </td>
      <td className="px-2.5 py-2 align-middle">
        <StatusBadge value={lesson.status} className="px-2 py-0.5 text-[10px]" />
      </td>
      <td className="sticky right-0 z-[1] bg-white px-2.5 py-2 align-middle shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.12)] group-hover:bg-slate-50/60">
        <button
          type="button"
          onClick={() => onReview(lesson)}
          className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full bg-cnhs-green-dark px-2.5 text-[10px] font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#246f54]"
        >
          {isApproved ? (
            <Eye size={12} aria-hidden="true" />
          ) : (
            <ClipboardCheck size={12} aria-hidden="true" />
          )}
          {isApproved ? "View" : "Review"}
        </button>
      </td>
    </tr>
  );
}
