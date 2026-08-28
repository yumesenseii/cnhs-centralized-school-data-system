"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Folder } from "lucide-react";
import AttendanceLearnerTable from "@/components/attendance/AttendanceLearnerTable";
import {
  buildGradeFolders,
  getGradeAtRiskLearners,
  getGradeNormalLearners,
  sortLearnersForDisplay,
} from "@/lib/attendance/groupAttendanceByGrade";
import { cn } from "@/lib/utils";

const SUBVIEWS = [
  { id: "atRisk", label: "Critical & Warning" },
  { id: "normal", label: "Non-Critical (Normal)" },
];

export default function AttendanceGradeBrowse({
  records = [],
  sectionId = "",
}) {
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [subview, setSubview] = useState("atRisk");
  const [atRiskPage, setAtRiskPage] = useState(1);
  const [normalPage, setNormalPage] = useState(1);

  const gradeFolders = useMemo(
    () => buildGradeFolders(records),
    [records]
  );

  const activeFolder = useMemo(
    () => gradeFolders.find((folder) => folder.grade === selectedGrade) ?? null,
    [gradeFolders, selectedGrade]
  );

  const atRiskLearners = useMemo(
    () =>
      sortLearnersForDisplay(getGradeAtRiskLearners(activeFolder), {
        normal: false,
      }),
    [activeFolder]
  );

  const normalLearners = useMemo(
    () =>
      sortLearnersForDisplay(getGradeNormalLearners(activeFolder), {
        normal: true,
      }),
    [activeFolder]
  );

  const activeLearners = subview === "atRisk" ? atRiskLearners : normalLearners;
  const activePage = subview === "atRisk" ? atRiskPage : normalPage;
  const setActivePage = subview === "atRisk" ? setAtRiskPage : setNormalPage;

  useEffect(() => {
    if (selectedGrade && !gradeFolders.some((f) => f.grade === selectedGrade)) {
      setSelectedGrade(null);
    }
  }, [gradeFolders, selectedGrade]);

  useEffect(() => {
    if (!sectionId || !gradeFolders.length) return;
    const match = gradeFolders.find((folder) =>
      folder.sections.some((section) => section.sectionId === sectionId)
    );
    if (match) setSelectedGrade(match.grade);
  }, [sectionId, gradeFolders]);

  useEffect(() => {
    setAtRiskPage(1);
    setNormalPage(1);
  }, [selectedGrade, subview, records.length, sectionId]);

  if (!gradeFolders.length) {
    return (
      <section className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
        <Folder size={24} className="mx-auto text-slate-300" />
        <p className="mt-2 text-sm font-medium text-slate-700">
          No attendance records yet
        </p>
        <p className="mt-1 text-[12px] text-slate-500">
          Upload an SF2 file to populate learner attendance by grade.
        </p>
      </section>
    );
  }

  if (!selectedGrade) {
    return (
      <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-100 px-3 py-2.5 sm:px-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Learners by Grade
          </h3>
          <p className="text-[11px] text-slate-500">
            Open a grade folder to view Critical, Warning, and Normal lists.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-4">
          {gradeFolders.map((folder) => (
            <button
              key={folder.grade}
              type="button"
              onClick={() => setSelectedGrade(folder.grade)}
              className="group relative flex cursor-pointer flex-col rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-[0_6px_16px_rgba(15,23,42,0.04)] transition-colors hover:border-sky-200 hover:bg-sky-50/30"
            >
              {folder.critical > 0 ? (
                <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-red-500" />
              ) : null}
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
                <Folder size={18} strokeWidth={1.75} />
              </span>
              <p className="mt-4 text-[13px] font-semibold text-slate-900">
                {folder.grade}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {folder.critical} critical · {folder.warning} warning ·{" "}
                {folder.normal} normal
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {folder.total} learners · {folder.sections.length} sections
              </p>
              <span className="mt-4 text-[11px] font-semibold text-sky-700 opacity-0 transition-opacity group-hover:opacity-100">
                Open →
              </span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          onClick={() => setSelectedGrade(null)}
          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
        >
          <ChevronLeft size={13} />
          All grades
        </button>
        <p className="text-[13px] font-semibold text-slate-800">
          {selectedGrade}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-100 px-3 py-2.5 sm:px-4">
        <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-red-600">
          Critical: {activeFolder?.critical ?? 0}
        </span>
        <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
          Warning: {activeFolder?.warning ?? 0}
        </span>
        <span className="inline-flex rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-semibold text-cnhs-green-dark">
          Normal: {activeFolder?.normal ?? 0}
        </span>
        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
          Total: {activeFolder?.total ?? 0}
        </span>
      </div>

      <div
        className="flex flex-wrap gap-1.5 border-b border-slate-100 px-3 py-2.5 sm:px-4"
        role="tablist"
        aria-label="Attendance learner status views"
      >
        {SUBVIEWS.map((item) => {
          const selected = subview === item.id;
          const count =
            item.id === "atRisk" ? atRiskLearners.length : normalLearners.length;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setSubview(item.id)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors",
                selected
                  ? "bg-cnhs-green-dark text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
              )}
            >
              {item.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  selected ? "bg-white/20 text-white" : "bg-white text-slate-500"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="p-3 sm:p-4">
        <AttendanceLearnerTable
          learners={activeLearners}
          page={activePage}
          onPageChange={setActivePage}
          showPresentAbsent={subview === "normal"}
          emptyMessage={
            subview === "atRisk"
              ? "No Critical or Warning learners in this grade for the current filters."
              : "No Normal (non-critical) learners in this grade for the current filters."
          }
        />
      </div>
    </section>
  );
}
