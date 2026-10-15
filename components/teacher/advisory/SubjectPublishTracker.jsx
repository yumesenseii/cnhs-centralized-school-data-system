"use client";

import React from "react";
import { X, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Simple, calm modal showing the dynamic curriculum subject assignments and publishing status.
 * Replaces the heavy 8-card grid per user request.
 */
export default function SubjectPublishTracker({
  isOpen,
  onClose,
  subjectPublishStatus = [],
  publishedCount = 0,
  totalCount = 0,
}) {
  if (!isOpen) return null;

  const dynamicSubjects = (subjectPublishStatus || []).map((subj, idx) => ({
    key: subj.key || subj.id || `subj-${idx}`,
    label: subj.label || subj.subject_name || subj.subjectName || "Subject",
    isPublished: Boolean(subj.isPublished),
    isPartiallyPublished: Boolean(subj.isPartiallyPublished),
    isComposite: Boolean(subj.isComposite),
    subAreas: subj.subAreas || null,
    teacherName: subj.teacherName || "",
  }));

  const effectiveTotal = totalCount || dynamicSubjects.length;
  const effectivePublished =
    publishedCount !== undefined
      ? publishedCount
      : dynamicSubjects.filter((s) => s.isPublished).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subject-status-modal-title"
    >
      <div className="flex flex-col w-full max-w-lg max-h-[85vh] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden dark:border-white/10 dark:bg-[var(--card)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4 dark:border-white/5 dark:bg-transparent">
          <div>
            <h3
              id="subject-status-modal-title"
              className="text-base font-bold text-slate-900 dark:text-white"
            >
              Subject Publishing Status
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {effectivePublished} of {effectiveTotal} subjects completed
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Dynamic Simple List */}
        <div className="flex-1 overflow-y-auto px-5 py-2 divide-y divide-slate-100 dark:divide-white/5">
          {dynamicSubjects.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No subjects assigned to this section yet.
            </div>
          ) : (
            dynamicSubjects.map((subj) => {
              if (subj.isComposite && subj.subAreas && subj.subAreas.length > 0) {
                return (
                  <div key={subj.key} className="py-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {subj.label}
                        </span>
                        {subj.teacherName ? (
                          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                            Instructors: {subj.teacherName}
                          </span>
                        ) : null}
                      </div>

                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          subj.isPublished
                            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : subj.isPartiallyPublished
                            ? "bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300"
                        )}
                      >
                        {subj.isPublished ? (
                          <CheckCircle2 size={12} className="shrink-0" />
                        ) : (
                          <Clock size={12} className="shrink-0" />
                        )}
                        <span>
                          {subj.isPublished
                            ? "Consolidated"
                            : subj.isPartiallyPublished
                            ? "Partial"
                            : "Pending"}
                        </span>
                      </span>
                    </div>

                    {/* Sub-areas breakdown */}
                    <div className="ml-2 pl-3 border-l-2 border-slate-100 space-y-2 dark:border-white/10">
                      {subj.subAreas.map((sub) => (
                        <div key={sub.key} className="flex items-center justify-between text-xs py-0.5 gap-2">
                          <div className="min-w-0">
                            <span className="text-slate-700 font-medium dark:text-slate-200">
                              {sub.label}
                            </span>
                            {sub.teacherName ? (
                              <span className="text-[11px] text-slate-400 block truncate">
                                Teacher: {sub.teacherName}
                              </span>
                            ) : null}
                          </div>
                          <span
                            className={cn(
                              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                              sub.isPublished
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                                : "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                            )}
                          >
                            {sub.isPublished ? "Published" : "Pending"}
                          </span>
                        </div>
                      ))}
                      {subj.isPartiallyPublished && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-300/90 italic pt-0.5">
                          * Composite MAPEH requires both Music & Arts and PE & Health to be published.
                        </p>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={subj.key}
                  className="flex items-center justify-between py-3 gap-3"
                >
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {subj.label}
                    </span>
                    {subj.teacherName ? (
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                        Teacher: {subj.teacherName}
                      </span>
                    ) : null}
                  </div>

                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      subj.isPublished
                        ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    )}
                  >
                    {subj.isPublished ? (
                      <CheckCircle2 size={12} className="shrink-0" />
                    ) : (
                      <Clock size={12} className="shrink-0" />
                    )}
                    <span>{subj.isPublished ? "Published" : "Pending"}</span>
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-3 flex justify-end dark:border-white/5 dark:bg-transparent">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
