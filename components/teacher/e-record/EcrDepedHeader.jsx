"use client";

import { settingsData } from "@/data/settings";
import { termLabel } from "@/lib/academic/termLabels";

export default function EcrDepedHeader({ classItem, activeTerm }) {
  if (!classItem) return null;

  const school = settingsData.school;

  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="grid gap-2 text-[11px] text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <span className="font-semibold text-slate-500">School</span>
          <p className="text-[12px] font-medium text-slate-800">
            {school.schoolName}
          </p>
        </div>
        <div>
          <span className="font-semibold text-slate-500">Teacher</span>
          <p className="text-[12px] font-medium text-slate-800">
            {classItem.teacherName ?? "—"}
          </p>
        </div>
        <div>
          <span className="font-semibold text-slate-500">School Year</span>
          <p className="text-[12px] font-medium text-slate-800">
            {classItem.schoolYear ?? school.schoolYear}
          </p>
        </div>
        <div>
          <span className="font-semibold text-slate-500">Grade & Section</span>
          <p className="text-[12px] font-medium text-slate-800">
            Grade {classItem.gradeLevel} — {classItem.section}
          </p>
        </div>
        <div>
          <span className="font-semibold text-slate-500">Subject</span>
          <p className="text-[12px] font-medium text-slate-800">
            {classItem.subject}
          </p>
        </div>
        <div>
          <span className="font-semibold text-slate-500">Term</span>
          <p className="text-[12px] font-medium text-slate-800">
            {activeTerm === "summary" ? "Summary (AVE)" : termLabel(activeTerm)}
          </p>
        </div>
      </div>
    </div>
  );
}
