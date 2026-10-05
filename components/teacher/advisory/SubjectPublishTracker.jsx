"use client";

import React from "react";

// Standard canonical 8 subjects in DepEd Junior High School
const ORDERED_SUBJECTS = [
  { key: "english", label: "English" },
  { key: "filipino", label: "Filipino" },
  { key: "mathematics", label: "Mathematics" },
  { key: "science", label: "Science" },
  { key: "araling_panlipunan", label: "AP" },
  { key: "mapeh", label: "MAPEH" },
  { key: "tle", label: "TLE" },
  { key: "values_education", label: "ESP" },
];

export default function SubjectPublishTracker({
  subjectPublishStatus = [],
  publishedCount = 0,
  totalCount = 8,
}) {
  // Map incoming subjects into our canonical 8 list
  const subjectsMap = new Map();
  subjectPublishStatus.forEach((s) => {
    subjectsMap.set(s.key, s);
  });

  const displayList = ORDERED_SUBJECTS.map((canon) => {
    const found = subjectsMap.get(canon.key);
    return {
      key: canon.key,
      label: canon.label,
      isPublished: Boolean(found?.isPublished),
      teacherName: found?.teacherName || "",
    };
  });

  return (
    <div
      id="subject-publishing-status"
      className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Subject Publishing Status
        </h3>
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {publishedCount} of {totalCount} Published
        </span>
      </div>

      {/* Horizontal Compact Subject Tracker */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8 overflow-x-auto pb-0.5">
        {displayList.map((subj) => {
          const isPublished = subj.isPublished;
          return (
            <div
              key={subj.key}
              title={subj.teacherName ? `Teacher: ${subj.teacherName}` : ""}
              className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-800/40"
            >
              <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                {subj.label}
              </span>
              <span className="inline-flex shrink-0 items-center gap-1.5 pl-1.5 text-[11px] font-medium">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isPublished ? "bg-cnhs-green" : "bg-amber-500"
                  }`}
                  aria-hidden="true"
                />
                <span
                  className={
                    isPublished
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-amber-700 dark:text-amber-400"
                  }
                >
                  {isPublished ? "Published" : "Pending"}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
