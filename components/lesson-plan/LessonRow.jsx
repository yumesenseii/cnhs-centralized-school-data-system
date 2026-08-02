import { ClipboardCheck } from "lucide-react";
import StatusBadge from "@/components/lesson-plan/StatusBadge";

export default function LessonRow({ lesson, onReview }) {
  const isApproved = lesson.status === "Approved";

  return (
    <tr className="border-t border-slate-100 transition-colors hover:bg-slate-50/60">
      <td className="px-4 py-5 align-top">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cnhs-green-dark text-[10px] font-semibold text-white">
            {lesson.initials}
          </span>
          <span>
            <span className="block whitespace-nowrap text-xs font-semibold text-slate-800">{lesson.teacher}</span>
            <span className="block text-[10px] text-slate-400">{lesson.department}</span>
          </span>
        </div>
      </td>
      <td className="px-4 py-5 align-top text-xs text-slate-600">{lesson.learningArea}</td>
      <td className="px-4 py-5 align-top text-xs text-slate-600">{lesson.gradeSection}</td>
      <td className="max-w-[230px] px-4 py-5 align-top text-xs font-semibold leading-5 text-slate-900">
        {lesson.lessonTitle}
      </td>
      <td className="px-4 py-5 align-top text-xs text-slate-500">{lesson.weekCovered}</td>
      <td className="px-4 py-5 align-top text-xs text-slate-400">{lesson.submissionDate}</td>
      <td className="px-4 py-5 align-top">
        <StatusBadge value={lesson.status} />
      </td>
      <td className="px-4 py-5 align-top">
        <button
          type="button"
          onClick={() => onReview(lesson)}
          className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl bg-cnhs-green-dark px-4 text-xs font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#246f54]"
        >
          <ClipboardCheck size={14} />
          {isApproved ? "View" : "Review"}
        </button>
      </td>
    </tr>
  );
}
