"use client";

import { CalendarDays, Download, Loader2, X } from "lucide-react";
import {
  AttendanceKpi,
  AttendanceMfTable,
  fmtAttendance,
} from "@/components/attendance/attendanceUiShared";

function InfoCard({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-[12px] font-semibold text-slate-800">{value}</p>
    </div>
  );
}

/**
 * Preview before PDF / Excel / print.
 * `row` = SF2 class monthly. `preview` = daily / school working report.
 */
export default function Sf2ExportPreviewModal({
  open,
  row = null,
  preview = null,
  format = "pdf",
  exporting = false,
  onClose,
  onDownload,
}) {
  if (!open || (!row && !preview)) return null;

  const isPdf = format === "pdf";
  const isDaily = Boolean(preview);
  const sectionLabel = isDaily
    ? preview.sectionLabel || "—"
    : `Grade ${row.gradeLevel ?? "—"} · ${row.sectionName || "—"}`;
  const downloadLabel = isPdf ? "Print / PDF" : "Download Excel";
  const title = isDaily
    ? preview.title || "Attendance working report"
    : "SF2 class monthly summary";
  const monthLabel = isDaily
    ? preview.monthName || "—"
    : row.monthName || "—";

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5">
      <button
        type="button"
        aria-label="Close export preview"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        onClick={exporting ? undefined : onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sf2-export-preview-title"
        className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-slate-100 bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-2.5 sm:px-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-cnhs-green-dark">
              <CalendarDays size={16} />
            </span>
            <div>
              <h2
                id="sf2-export-preview-title"
                className="text-sm font-semibold tracking-[-0.02em] text-slate-900 sm:text-base"
              >
                {title}
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Preview · {isPdf ? "PDF" : "Excel"} · {sectionLabel}
                {preview?.learnerName ? ` · ${preview.learnerName}` : ""} ·{" "}
                {monthLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-3 sm:px-5">
          {isDaily ? (
            <>
              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Report details
                </h3>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <InfoCard label="School year" value={preview.schoolYear || "—"} />
                  <InfoCard label="Section" value={sectionLabel} />
                  {preview.learnerName ? (
                    <InfoCard label="Learner" value={preview.learnerName} />
                  ) : (
                    <InfoCard
                      label="Enrolled"
                      value={fmtAttendance(preview.enrolled)}
                    />
                  )}
                  <InfoCard label="Month" value={monthLabel} />
                </div>
              </section>
              <section className="mt-4">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Saved sessions
                </h3>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <AttendanceKpi
                    label="Present"
                    value={fmtAttendance(preview.present)}
                    tone="bg-green-50"
                  />
                  <AttendanceKpi
                    label="Absent"
                    value={fmtAttendance(preview.absent)}
                    tone="bg-orange-50"
                  />
                  <AttendanceKpi
                    label="Session rate"
                    value={preview.sessionRate || "—"}
                    tone="bg-sky-50"
                  />
                </div>
              </section>
              {preview.closed ? (
                <section className="mt-4">
                  <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    After month close
                  </h3>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-2">
                    <AttendanceKpi
                      label="ADA"
                      value={fmtAttendance(preview.ada)}
                      tone="bg-green-50"
                    />
                    <AttendanceKpi
                      label="% attendance"
                      value={
                        preview.attendancePercent != null
                          ? `${preview.attendancePercent}%`
                          : "—"
                      }
                      tone="bg-sky-50"
                    />
                  </div>
                </section>
              ) : null}
              <p className="mt-4 text-[11px] leading-5 text-slate-500">
                {preview.note ||
                  "Working report from saved AM/PM records. Not official DepEd SF2."}
              </p>
            </>
          ) : (
            <>
              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Report details
                </h3>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <InfoCard label="School year" value={row.school_year || "—"} />
                  <InfoCard label="Section" value={sectionLabel} />
                  <InfoCard label="Month" value={row.monthName || "—"} />
                  <InfoCard
                    label="School days"
                    value={fmtAttendance(row.schoolDays)}
                  />
                </div>
              </section>

              <section className="mt-4">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Summary
                </h3>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <AttendanceKpi
                    label="ADA"
                    value={fmtAttendance(row.ada)}
                    tone="bg-green-50"
                  />
                  <AttendanceKpi
                    label="PA"
                    value={fmtAttendance(row.pa, "%")}
                    tone="bg-sky-50"
                  />
                  <AttendanceKpi
                    label="Absences"
                    value={fmtAttendance(row.absences)}
                    tone="bg-orange-50"
                  />
                  <AttendanceKpi
                    label="Late"
                    value={fmtAttendance(row.late)}
                    tone="bg-amber-50"
                  />
                  <AttendanceKpi
                    label="First Friday"
                    value={fmtAttendance(row.firstFriday)}
                    tone="bg-violet-50"
                  />
                  <AttendanceKpi
                    label="End of month"
                    value={fmtAttendance(row.endOfMonth)}
                    tone="bg-slate-100"
                  />
                </div>
              </section>

              <section className="mt-4">
                <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  M / F / Total
                </h3>
                <AttendanceMfTable breakdown={row.breakdown} />
              </section>
              <p className="mt-4 text-[11px] leading-5 text-slate-500">
                Preview from archived SF2-COMP. Confirm to download or print.
              </p>
            </>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-white px-4 py-2.5 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="inline-flex h-8 cursor-pointer items-center rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDownload}
            disabled={exporting}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white transition-colors hover:bg-[#246f54] disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Download size={13} />
            )}
            {downloadLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
