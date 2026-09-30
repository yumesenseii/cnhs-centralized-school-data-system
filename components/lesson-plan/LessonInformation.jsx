"use client";

import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LessonInformation({ lesson }) {
  const [expanded, setExpanded] = useState(false);

  if (!lesson) return null;

  const title = lesson.lessonTitle || "Lesson Plan";
  const subject = lesson.learningArea || lesson.subject || "Subject";
  const gradeSection = lesson.gradeSection || "—";
  const teacher = lesson.teacher || lesson.teacherName || "Subject Teacher";
  const week = lesson.weekCovered || lesson.week || "—";
  const submissionDate =
    lesson.submissionDate || lesson.submittedAt || lesson.submittedDate || "—";
  const trackingNumber = lesson.trackingNumber || "—";

  const details = [
    ["Lesson Title", title],
    ["Learning Area", subject],
    ["Grade & Section", gradeSection],
    ["Teacher", teacher],
    ["Tracking No.", trackingNumber],
    ["Week Covered", week],
    ["School Year", lesson.schoolYear || "—"],
    ["Submission Date", submissionDate],
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 dark:border-white/5 dark:bg-white/[0.02]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2 text-left transition hover:bg-slate-100/60 dark:hover:bg-white/5"
      >
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-200">
            <Info size={13} className="text-cnhs-green-dark dark:text-cnhs-green" />
            Lesson Details:
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-600 dark:text-slate-400">
            {subject} ({gradeSection})
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
          <span>{expanded ? "Hide info" : "Show all info"}</span>
          <ChevronDown
            size={13}
            className={cn("transition-transform duration-200", expanded ? "rotate-180" : "")}
          />
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-slate-200/80 bg-white p-3.5 dark:border-white/5 dark:bg-[var(--card)]">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {details.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {label}
                </dt>
                <dd
                  className="mt-0.5 truncate text-xs font-semibold text-slate-800 dark:text-slate-200"
                  title={value}
                >
                  {value || "—"}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </section>
  );
}
