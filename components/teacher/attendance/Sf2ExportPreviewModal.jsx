"use client";

import { CalendarDays, Download, Loader2, X } from "lucide-react";
import {
  AttendanceKpi,
  AttendanceMfTable,
  fmtAttendance,
} from "@/components/attendance/attendanceUiShared";
import { formatSessionRate } from "@/lib/attendance/dailyAnalytics";

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

const PREVIEW_NOTE =
  "From saved Morning and Afternoon marks. Check this copy before signing the official SF2.";

const ink = "text-[#1e293b]";
const muted = "text-[#64748b]";
const grid = "border border-[#cbd5e1]";
const sheetCell = `${grid} px-2 py-1 text-[11px] ${ink}`;
const sheetHead = `${grid} bg-[#246f54] px-2 py-1.5 text-center text-[10px] font-semibold tracking-wide text-white`;
const sheetSoft = `${grid} bg-[#e8f5ef] px-2 py-1.5 text-center text-[10px] font-semibold text-[#246f54]`;

function sectionHasSavedDaily(row = {}) {
  return (
    Number(row.present || 0) > 0 ||
    Number(row.absent || 0) > 0 ||
    Number(row.learnersMarked || 0) > 0 ||
    Number(row.saved || 0) > 0
  );
}

function schoolSectionLabel(row = {}) {
  return `G${row.gradeLevel ?? "—"} · ${row.sectionName ?? "—"}`;
}

function displayRate(rate) {
  if (typeof rate === "string" && rate.trim()) return rate;
  return formatSessionRate(rate);
}

function SchoolSectionRows({ rows = [] }) {
  if (!rows.length) {
    return (
      <tr>
        <td colSpan={5} className={`${sheetCell} py-4 text-center ${muted}`}>
          No daily attendance saved this month.
        </td>
      </tr>
    );
  }
  return rows.map((row, index) => {
    const submitted = sectionHasSavedDaily(row);
    return (
      <tr key={row.id || `${schoolSectionLabel(row)}-${index}`}>
        <td className={`${sheetCell} text-left`}>{schoolSectionLabel(row)}</td>
        <td className={`${sheetCell} text-center tabular-nums`}>
          {submitted ? row.present : "Not submitted"}
        </td>
        <td className={`${sheetCell} text-center tabular-nums`}>
          {submitted ? row.absent : "—"}
        </td>
        <td className={`${sheetCell} text-center tabular-nums`}>
          {submitted ? displayRate(row.sessionRate) : "—"}
        </td>
        <td className={`${sheetCell} text-center tabular-nums`}>
          {submitted ? row.learnersMarked : "—"}
        </td>
      </tr>
    );
  });
}

function SchoolLearnerRows({ learners = [] }) {
  if (!learners.length) {
    return (
      <tr>
        <td colSpan={6} className={`${sheetCell} py-4 text-center ${muted}`}>
          No daily attendance saved this month.
        </td>
      </tr>
    );
  }
  return learners.map((row, index) => (
    <tr key={`${row.sectionLabel}-${row.studentNumber}-${row.name}-${index}`}>
      <td className={`${sheetCell} text-left`}>{row.sectionLabel || "—"}</td>
      <td className={`${sheetCell} text-left`}>{row.name}</td>
      <td className={`${sheetCell} text-center font-mono tabular-nums`}>
        {row.studentNumber || "—"}
      </td>
      <td className={`${sheetCell} text-center tabular-nums`}>
        {row.presentSessions}
      </td>
      <td className={`${sheetCell} text-center tabular-nums`}>
        {row.absentSessions}
      </td>
      <td className={`${sheetCell} text-center tabular-nums`}>
        {displayRate(row.sessionRate)}
      </td>
    </tr>
  ));
}

function DailySchoolExcelPreview({ preview }) {
  return (
    <div data-keep-white="true" className="overflow-x-auto bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-[#246f54] px-3 py-2">
        <img src="/cnhs-logo.png" alt="" className="h-6 w-6 object-contain" />
        <p className="flex-1 text-center text-[13px] font-semibold tracking-wide text-white">
          CAMBAOG NATIONAL HIGH SCHOOL
        </p>
      </div>
      <div className="bg-[#e8f5ef] px-3 py-1.5 text-center text-[11px] font-medium text-[#246f54]">
        CNHS Learn · School attendance working report
      </div>
      <p className={`px-3 py-2 text-[11px] ${ink}`}>
        {preview.sectionLabel} · {preview.schoolYear || "—"}
      </p>
      <div className="bg-[#246f54] px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-white">
        {preview.monthName || "Month"}
      </div>

      <p className="px-3 py-2 text-[12px] font-semibold text-[#246f54]">
        By section
      </p>
      <table className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr>
            {[
              "Section",
              "Present sessions",
              "Absent sessions",
              "Session rate",
              "Learners marked",
            ].map((column) => (
              <th key={column} className={sheetHead}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <SchoolSectionRows rows={preview.rows} />
        </tbody>
      </table>

      <p className="px-3 py-2 text-[12px] font-semibold text-[#246f54]">
        Learners (sorted by absent sessions)
      </p>
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr>
            {[
              "Section",
              "Learner",
              "LRN",
              "Present sessions",
              "Absent sessions",
              "Session rate",
            ].map((column) => (
              <th key={column} className={sheetHead}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <SchoolLearnerRows learners={preview.learners} />
        </tbody>
      </table>
    </div>
  );
}

function DailySchoolPdfPreview({ preview }) {
  return (
    <div
      data-keep-white="true"
      className="mx-auto max-w-[760px] bg-white px-6 py-5 shadow-sm"
    >
      <header className="flex items-center justify-between gap-3 border-y-[2.5px] border-[#246f54] py-2.5">
        <img src="/cnhs-logo.png" alt="" className="h-12 w-12 object-contain" />
        <div className="flex-1 text-center">
          <p className="text-[15px] font-semibold tracking-[0.04em] text-[#246f54]">
            CAMBAOG NATIONAL HIGH SCHOOL
          </p>
          <p className="mt-0.5 text-[11px] text-[#64748b]">
            CNHS Learn · Attendance Monitoring
          </p>
        </div>
        <img src="/cnhs-logo.png" alt="" className="h-12 w-12 object-contain" />
      </header>

      <div className="mt-4 text-center">
        <h3 className="text-[16px] font-semibold tracking-[0.03em] text-[#246f54]">
          SCHOOL ATTENDANCE
        </h3>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-1 rounded border border-[#cfe8dc] bg-white px-3 py-2 text-[11px]">
        <p>
          <span className={muted}>Scope </span>
          <strong className={ink}>{preview.sectionLabel}</strong>
        </p>
        <p>
          <span className={muted}>School year </span>
          <strong className={ink}>{preview.schoolYear || "—"}</strong>
        </p>
        <p>
          <span className={muted}>Month </span>
          <strong className={ink}>{preview.monthName || "—"}</strong>
        </p>
        <p>
          <span className={muted}>Sections with data </span>
          <strong className={ink}>{preview.sectionsWithData ?? 0}</strong>
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <PdfKpi label="Sections" value={preview.sectionCount} />
        <PdfKpi label="Present sessions" value={preview.present} />
        <PdfKpi label="Absent sessions" value={preview.absent} />
        <PdfKpi label="Session rate" value={preview.sessionRate} />
      </div>

      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[#246f54]">
        By section
      </p>
      <table className="mt-2 w-full border-collapse text-[11px]">
        <thead>
          <tr>
            {[
              "Section",
              "Present sessions",
              "Absent sessions",
              "Session rate",
              "Learners marked",
            ].map((column) => (
              <th key={column} className={sheetHead}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <SchoolSectionRows rows={preview.rows} />
        </tbody>
      </table>

      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[#246f54]">
        Learners (sorted by absent sessions)
      </p>
      <table className="mt-2 w-full border-collapse text-[11px]">
        <thead>
          <tr>
            {[
              "Section",
              "Learner",
              "LRN",
              "Present sessions",
              "Absent sessions",
              "Session rate",
            ].map((column) => (
              <th key={column} className={sheetHead}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <SchoolLearnerRows learners={preview.learners} />
        </tbody>
      </table>

      <p className={`mt-6 text-[11px] ${muted}`}>Prepared by:</p>
      <div className="mt-6 grid grid-cols-3 gap-4 text-[10px] text-[#64748b]">
        {["Name / signature", "Date", "Noted by"].map((label) => (
          <div key={label}>
            <div className="h-4 border-b border-[#246f54]" />
            <p className="mt-1">{label}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 text-center text-[10px] text-[#94a3b8]">
        Cambaog National High School · CNHS Learn
      </p>
    </div>
  );
}

function CountRow({ label, m, f, total }) {
  return (
    <tr>
      <td className={`${sheetCell} text-left font-medium`}>{label}</td>
      <td className={`${sheetCell} text-center tabular-nums`}>{m ?? "—"}</td>
      <td className={`${sheetCell} text-center tabular-nums`}>{f ?? "—"}</td>
      <td className={`${sheetCell} text-center tabular-nums`}>{total ?? "—"}</td>
    </tr>
  );
}

function LearnerRows({ learners = [], emptyText = "No learners enrolled in this section yet." }) {
  if (!learners.length) {
    return (
      <tr>
        <td colSpan={6} className={`${sheetCell} py-4 text-center ${muted}`}>
          {emptyText}
        </td>
      </tr>
    );
  }
  return learners.map((row, index) => (
    <tr key={`${row.studentNumber}-${row.name}-${index}`}>
      <td className={`${sheetCell} text-left`}>{row.name}</td>
      <td className={`${sheetCell} text-center font-mono tabular-nums`}>
        {row.studentNumber || "—"}
      </td>
      <td className={`${sheetCell} text-center tabular-nums`}>
        {row.presentSessions}
      </td>
      <td className={`${sheetCell} text-center tabular-nums`}>
        {row.absentSessions}
      </td>
      <td className={`${sheetCell} text-center tabular-nums`}>
        {row.sessionRate}
      </td>
      <td className={`${sheetCell} text-center tabular-nums`}>
        {row.incomplete}
      </td>
    </tr>
  ));
}

function DayRows({ days = [] }) {
  if (!days.length) {
    return (
      <tr>
        <td colSpan={4} className={`${sheetCell} py-4 text-center ${muted}`}>
          No saved days this month.
        </td>
      </tr>
    );
  }
  return days.map((day) => (
    <tr key={day.date}>
      <td className={`${sheetCell} text-center`}>{day.date}</td>
      <td className={`${sheetCell} text-center`}>{day.morning || "—"}</td>
      <td className={`${sheetCell} text-center`}>{day.afternoon || "—"}</td>
      <td className={`${sheetCell} text-center`}>
        {day.incomplete ? "AM or PM not saved" : "—"}
      </td>
    </tr>
  ));
}

function DailyExcelPreview({ preview }) {
  if (preview.kind === "school") {
    return <DailySchoolExcelPreview preview={preview} />;
  }
  const counts = preview.sexCounts || { m: {}, f: {}, total: {} };
  const isLearner = preview.kind === "learner";
  const incompleteDates = preview.incompleteDates ?? [];

  return (
    <div
      data-keep-white="true"
      className="overflow-x-auto bg-white shadow-sm"
    >
      <div className="flex items-center gap-2 bg-[#246f54] px-3 py-2">
        <img src="/cnhs-logo.png" alt="" className="h-6 w-6 object-contain" />
        <p className="flex-1 text-center text-[13px] font-semibold tracking-wide text-white">
          CAMBAOG NATIONAL HIGH SCHOOL
        </p>
      </div>
      <div className="bg-[#e8f5ef] px-3 py-1.5 text-center text-[11px] font-medium text-[#246f54]">
        CNHS Learn · Daily attendance working report
      </div>
      <p className={`px-3 py-2 text-[11px] ${ink}`}>
        {preview.sectionLabel}
        {isLearner ? ` · ${preview.learnerName}` : ""} ·{" "}
        {preview.schoolYear || "—"}
      </p>
      <div className="bg-[#246f54] px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-white">
        {preview.monthName || "Month"}
      </div>

      {isLearner ? (
        <table className="mt-0 w-full min-w-[520px] border-collapse">
          <thead>
            <tr>
              {["Date", "Morning", "Afternoon", "Note"].map((column) => (
                <th key={column} className={sheetHead}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <DayRows days={preview.days} />
          </tbody>
        </table>
      ) : (
        <>
          <table className="w-full min-w-[420px] border-collapse">
            <thead>
              <tr>
                <th className={sheetSoft} />
                <th className={sheetSoft}>M</th>
                <th className={sheetSoft}>F</th>
                <th className={sheetSoft}>Total</th>
              </tr>
            </thead>
            <tbody>
              <CountRow
                label="Enrolled"
                m={counts.m.enrolled}
                f={counts.f.enrolled}
                total={counts.total.enrolled}
              />
              <CountRow
                label="Present sessions"
                m={counts.m.present}
                f={counts.f.present}
                total={counts.total.present}
              />
              <CountRow
                label="Absent sessions"
                m={counts.m.absent}
                f={counts.f.absent}
                total={counts.total.absent}
              />
              <CountRow
                label="Session rate"
                m={counts.m.rate}
                f={counts.f.rate}
                total={counts.total.rate}
              />
              <CountRow
                label="Incomplete days"
                m={counts.m.incomplete}
                f={counts.f.incomplete}
                total={counts.total.incomplete}
              />
            </tbody>
          </table>

          {incompleteDates.length ? (
            <p className="px-3 py-2 text-[10px] italic text-[#b45309]">
              Incomplete dates (AM or PM not saved — not counted as absent):{" "}
              {incompleteDates.join(", ")}
            </p>
          ) : null}

          <p className="px-3 py-2 text-[12px] font-semibold text-[#246f54]">
            Learners
          </p>
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr>
                {["Learner", "LRN", "P", "A", "Rate", "Inc."].map((column) => (
                  <th key={column} className={sheetHead}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <LearnerRows learners={preview.learners} />
            </tbody>
          </table>
        </>
      )}
      <p className={`px-3 py-3 text-[11px] ${muted}`}>
        {preview.note || PREVIEW_NOTE}
      </p>
    </div>
  );
}

function PdfKpi({ label, value }) {
  return (
    <div className="rounded border border-[#cfe8dc] bg-[#f8fafc] px-2 py-2 text-center">
      <p className="text-[10px] uppercase tracking-wide text-[#94a3b8]">{label}</p>
      <p className={`mt-0.5 text-[15px] font-semibold tabular-nums ${ink}`}>
        {value ?? "—"}
      </p>
    </div>
  );
}

function DailyPdfPreview({ preview }) {
  if (preview.kind === "school") {
    return <DailySchoolPdfPreview preview={preview} />;
  }
  const isLearner = preview.kind === "learner";

  return (
    <div
      data-keep-white="true"
      className="mx-auto max-w-[680px] bg-white px-6 py-5 shadow-sm"
    >
      <header className="flex items-center justify-between gap-3 border-y-[2.5px] border-[#246f54] py-2.5">
        <img src="/cnhs-logo.png" alt="" className="h-12 w-12 object-contain" />
        <div className="flex-1 text-center">
          <p className="text-[15px] font-semibold tracking-[0.04em] text-[#246f54]">
            CAMBAOG NATIONAL HIGH SCHOOL
          </p>
          <p className="mt-0.5 text-[11px] text-[#64748b]">
            CNHS Learn · Attendance Monitoring
          </p>
        </div>
        <img src="/cnhs-logo.png" alt="" className="h-12 w-12 object-contain" />
      </header>

      <div className="mt-4 text-center">
        <h3 className="text-[16px] font-semibold tracking-[0.03em] text-[#246f54]">
          {isLearner ? "LEARNER ATTENDANCE" : "SECTION ATTENDANCE"}
        </h3>
        <p className={`mt-1 text-[11px] ${muted}`}>{preview.note || PREVIEW_NOTE}</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-1 rounded border border-[#cfe8dc] bg-white px-3 py-2 text-[11px]">
        {isLearner ? (
          <>
            <p>
              <span className={muted}>Learner </span>
              <strong className={ink}>{preview.learnerName}</strong>
            </p>
            <p>
              <span className={muted}>LRN </span>
              <strong className={ink}>{preview.studentNumber || "—"}</strong>
            </p>
          </>
        ) : null}
        <p>
          <span className={muted}>Section </span>
          <strong className={ink}>{preview.sectionLabel}</strong>
        </p>
        <p>
          <span className={muted}>School year </span>
          <strong className={ink}>{preview.schoolYear || "—"}</strong>
        </p>
        <p>
          <span className={muted}>Month </span>
          <strong className={ink}>{preview.monthName || "—"}</strong>
        </p>
        <p>
          <span className={muted}>Incomplete days </span>
          <strong className={ink}>
            {isLearner
              ? preview.incomplete ?? 0
              : preview.incompleteDates?.length ?? 0}
          </strong>
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {isLearner ? (
          <>
            <PdfKpi label="Present sessions" value={preview.present} />
            <PdfKpi label="Absent sessions" value={preview.absent} />
            <PdfKpi label="Session rate" value={preview.sessionRate} />
            <PdfKpi label="Incomplete days" value={preview.incomplete} />
          </>
        ) : (
          <>
            <PdfKpi label="Enrolled" value={preview.enrolled} />
            <PdfKpi label="Present sessions" value={preview.present} />
            <PdfKpi label="Absent sessions" value={preview.absent} />
            <PdfKpi label="Session rate" value={preview.sessionRate} />
          </>
        )}
      </div>

      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-[#246f54]">
        {isLearner ? "Attendance by date" : "Learners (sorted by absent sessions)"}
      </p>
      <table className="mt-2 w-full border-collapse text-[11px]">
        {isLearner ? (
          <>
            <thead>
              <tr>
                {["Date", "Morning", "Afternoon", "Note"].map((column) => (
                  <th key={column} className={sheetHead}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <DayRows days={preview.days} />
            </tbody>
          </>
        ) : (
          <>
            <thead>
              <tr>
                {[
                  "Learner",
                  "LRN",
                  "Present sessions",
                  "Absent sessions",
                  "Session rate",
                  "Incomplete days",
                ].map((column) => (
                  <th key={column} className={sheetHead}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <LearnerRows learners={preview.learners} />
            </tbody>
          </>
        )}
      </table>

      <p className={`mt-6 text-[11px] ${muted}`}>Prepared by the class adviser:</p>
      <div className="mt-6 grid grid-cols-3 gap-4 text-[10px] text-[#64748b]">
        {["Name / signature", "Date", "Noted by"].map((label) => (
          <div key={label}>
            <div className="h-4 border-b border-[#246f54]" />
            <p className="mt-1">{label}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 text-center text-[10px] text-[#94a3b8]">
        Cambaog National High School · CNHS Learn
      </p>
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
  const downloadLabel = isPdf ? "Download report" : "Download Excel";
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
        className={`relative z-10 flex max-h-[85vh] w-full flex-col overflow-hidden rounded-lg border border-slate-100 bg-white shadow-2xl ${
          isDaily ? "max-w-5xl" : "max-w-3xl"
        }`}
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

        <div
          className={
            isDaily
              ? "overflow-y-auto bg-slate-200/80 p-3 dark:bg-[#2a2a2a]"
              : "overflow-y-auto px-4 py-3 sm:px-5"
          }
        >
          {isDaily ? (
            isPdf ? (
              <DailyPdfPreview preview={preview} />
            ) : (
              <DailyExcelPreview preview={preview} />
            )
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
