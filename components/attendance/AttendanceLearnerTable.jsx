"use client";

import { Fragment } from "react";
import { CheckCircle2 } from "lucide-react";
import TablePagination, {
  ACADEMIC_RECORDS_PAGE_SIZE,
} from "@/components/academic-records/TablePagination";
import { ATTENDANCE_STATUS } from "@/lib/attendance/constants";
import { formatGradeSection } from "@/lib/attendance/groupAttendanceByGrade";
import { cn } from "@/lib/utils";

const PAGE_SIZE = ACADEMIC_RECORDS_PAGE_SIZE;

const statusStyles = {
  [ATTENDANCE_STATUS.NORMAL]:
    "bg-green-50 text-cnhs-green-dark ring-1 ring-green-100",
  [ATTENDANCE_STATUS.WARNING]:
    "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
  [ATTENDANCE_STATUS.CRITICAL]: "bg-red-50 text-red-600 ring-1 ring-red-100",
  [ATTENDANCE_STATUS.UNKNOWN]:
    "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
};

function initialsFromName(name = "") {
  const parts = String(name).replace(/,/g, " ").split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?"
  );
}

export default function AttendanceLearnerTable({
  learners = [],
  page = 1,
  onPageChange,
  emptyMessage = "No learners in this list.",
  showPresentAbsent = false,
}) {
  const pagedStart = (page - 1) * PAGE_SIZE;
  const pagedLearners = learners.slice(pagedStart, pagedStart + PAGE_SIZE);

  let lastSectionId = null;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead className="bg-slate-50/80">
              <tr className="text-[10px] uppercase tracking-[0.08em] text-slate-400">
                {[
                  "Learner",
                  "Section",
                  "Absent %",
                  "Attendance %",
                  ...(showPresentAbsent ? ["Present", "Absent"] : []),
                  "Status",
                ].map((heading) => (
                  <th key={heading} className="px-3 py-2 font-semibold">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedLearners.length ? (
                pagedLearners.map((row) => {
                  const sectionId = row.section_id || "unknown";
                  const showSectionHeader = sectionId !== lastSectionId;
                  lastSectionId = sectionId;
                  const colSpan = showPresentAbsent ? 7 : 5;

                  return (
                    <Fragment key={row.id}>
                      {showSectionHeader ? (
                        <tr className="bg-slate-50/90">
                          <td
                            colSpan={colSpan}
                            className="px-3 py-2 text-[11px] font-semibold text-slate-700"
                          >
                            {formatGradeSection(row.section)}
                          </td>
                        </tr>
                      ) : null}
                      <tr className="border-t border-slate-100 transition-colors hover:bg-slate-50/70">
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-50 text-[10px] font-semibold text-sky-700">
                              {initialsFromName(row.learnerName)}
                            </span>
                            <div>
                              <p className="text-[12px] font-semibold text-slate-800">
                                {row.learnerName}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {row.student?.student_number ?? "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-[11px] text-slate-600">
                          {formatGradeSection(row.section)}
                        </td>
                        <td className="px-3 py-2 text-[12px] font-medium text-slate-700">
                          {row.absencePercent != null
                            ? `${row.absencePercent}%`
                            : "—"}
                        </td>
                        <td className="px-3 py-2 text-[12px] font-medium text-slate-700">
                          {row.attendanceRate != null
                            ? `${row.attendanceRate}%`
                            : "—"}
                        </td>
                        {showPresentAbsent ? (
                          <>
                            <td className="px-3 py-2 text-[12px] text-slate-700">
                              {row.present ?? "—"}
                            </td>
                            <td className="px-3 py-2 text-[12px] text-slate-700">
                              {row.absent ?? "—"}
                            </td>
                          </>
                        ) : null}
                        <td className="px-3 py-2">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold",
                              statusStyles[row.status] ??
                                statusStyles[ATTENDANCE_STATUS.UNKNOWN]
                            )}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={showPresentAbsent ? 7 : 5}>
                    <div className="px-4 py-10 text-center">
                      <CheckCircle2
                        size={22}
                        className="mx-auto text-cnhs-green"
                      />
                      <p className="mt-2 text-sm text-slate-600">
                        {emptyMessage}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {learners.length > PAGE_SIZE ? (
        <TablePagination
          page={page}
          pageSize={PAGE_SIZE}
          total={learners.length}
          onPageChange={onPageChange}
        />
      ) : null}
    </div>
  );
}
