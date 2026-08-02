"use client";

import { Download, ExternalLink, FileText } from "lucide-react";

function isPdf(lesson) {
  const type = String(lesson?.fileType || "").toLowerCase();
  const name = String(lesson?.fileName || "").toLowerCase();
  return type.includes("pdf") || name.endsWith(".pdf");
}

export default function LessonPreview({ lesson, fileUrl }) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
        Lesson Plan Preview
      </h3>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-slate-50 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-600">
            <FileText size={14} className="shrink-0 text-slate-400" />
            <span className="truncate">{lesson.fileName}</span>
          </div>
          {fileUrl ? (
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-cnhs-green-dark"
            >
              <ExternalLink size={12} />
              Open Full
            </a>
          ) : (
            <span className="text-[11px] font-semibold text-slate-400">No file URL</span>
          )}
        </div>

        {isPdf(lesson) && fileUrl ? (
          <iframe
            title={lesson.fileName}
            src={fileUrl}
            className="h-[320px] w-full bg-white"
          />
        ) : (
          <div className="h-[250px] overflow-y-auto bg-white px-7 py-6">
            <div className="mx-auto max-w-[520px] text-center">
              <h4 className="text-base font-semibold text-slate-800">
                {lesson.lessonTitle}
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                {lesson.learningArea} · {lesson.gradeSection} · {lesson.weekCovered}
              </p>
              <p className="mt-4 text-sm text-slate-600">{lesson.fileName}</p>
              <p className="mt-2 text-xs text-slate-400">
                PDF files render inline. DOC/DOCX can be opened or downloaded.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-4 border-t border-slate-100 bg-slate-50 px-3 py-2 text-xs">
          <span className="text-slate-400">
            {isPdf(lesson) ? "Scroll to read" : "Document ready"}
          </span>
          {fileUrl ? (
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex cursor-pointer items-center gap-1 font-semibold text-cnhs-green-dark"
            >
              <Download size={13} />
              Download
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
