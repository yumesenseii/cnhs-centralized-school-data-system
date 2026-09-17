"use client";

import Link from "next/link";
import { BookOpen, Download, X } from "lucide-react";
import AcademicPerformanceSummary from "@/components/teacher/reports/AcademicPerformanceSummary";
import MonitoringSummary from "@/components/teacher/reports/MonitoringSummary";
import { useAppToast } from "@/components/shared/AppToast";
import { cn } from "@/lib/utils";

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

const BUCKET_BAR = {
  red: "bg-red-500",
  amber: "bg-amber-400",
  green: "bg-cnhs-green-dark",
  slate: "bg-slate-400",
};

function LearnerActionTable({ title, emptyText, rows }) {
  return (
    <section>
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[12px] text-slate-500">
          {emptyText}
        </p>
      ) : (
        <div className="mt-2 overflow-hidden rounded-xl border border-slate-100">
          <table className="min-w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Learner
                </th>
                <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Grade
                </th>
                <th className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Risk
                </th>
                <th className="px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Open
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.classId}:${row.studentId}`}
                  className="border-t border-slate-100"
                >
                  <td className="px-3 py-1.5 text-[12px] font-medium text-slate-800">
                    {row.name}
                  </td>
                  <td className="px-3 py-1.5 text-[12px] font-semibold text-slate-700">
                    {row.gradeLabel}
                  </td>
                  <td className="px-3 py-1.5 text-[12px] text-slate-600">
                    {row.risk}
                  </td>
                  <td className="px-3 py-1.5 text-right text-[11px]">
                    <span className="inline-flex flex-wrap justify-end gap-2">
                      {row.hrefClass ? (
                        <Link
                          href={row.hrefClass}
                          className="font-semibold text-cnhs-green-dark hover:underline"
                        >
                          Class
                        </Link>
                      ) : null}
                      {row.hrefERecord ? (
                        <Link
                          href={row.hrefERecord}
                          className="font-semibold text-cnhs-green-dark hover:underline"
                        >
                          E-Record
                        </Link>
                      ) : null}
                      {row.hrefMonitoring ? (
                        <Link
                          href={row.hrefMonitoring}
                          className="font-semibold text-cnhs-green-dark hover:underline"
                        >
                          Monitoring
                        </Link>
                      ) : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function ReportPreviewModal({
  open,
  preview,
  onClose,
  onExport,
  onExportExcel,
  closeLabel = "Return to Reports",
}) {
  const { showToast } = useAppToast();

  if (!open || !preview) return null;

  const info = preview.classInformation || {};
  const attendance = preview.attendance;
  const buckets = preview.performanceBuckets ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
      <button
        type="button"
        aria-label="Close report preview"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="teacher-report-preview-title"
        className="relative z-10 flex max-h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-100 bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-2.5 sm:px-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-cnhs-green-dark">
              <BookOpen size={16} />
            </span>
            <div>
              <h2
                id="teacher-report-preview-title"
                className="text-sm font-semibold tracking-[-0.02em] text-slate-900 sm:text-base"
              >
                {preview.title}
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {preview.subtitle}
                {preview.generatedAtLabel
                  ? ` · ${preview.generatedAtLabel}`
                  : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-3 sm:px-5">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
            <div className="space-y-3">
              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Class Information
                </h3>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <InfoCard label="Subject" value={info.subject} />
                  <InfoCard
                    label="Grade & Section"
                    value={info.gradeSection}
                  />
                  <InfoCard label="Term" value={info.term ?? info.quarter} />
                  <InfoCard label="Teacher" value={info.teacher} />
                  <InfoCard label="School Year" value={info.schoolYear} />
                </div>
              </section>

              <AcademicPerformanceSummary academic={preview.academic} />

              <LearnerActionTable
                title={`FAILING (${preview.failingLearners?.length ?? 0})`}
                emptyText="No failing learners this term."
                rows={preview.failingLearners ?? []}
              />
              <LearnerActionTable
                title={`UNGRADED (${preview.ungradedLearners?.length ?? 0})`}
                emptyText="No ungraded learners this term."
                rows={preview.ungradedLearners ?? []}
              />
            </div>

            <div className="space-y-3">
              {attendance?.available ? (
                <section>
                  <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Attendance{" "}
                    <span className="font-normal">
                      · monitoring only · not a prediction input
                    </span>
                  </h3>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {[
                      {
                        label: "Average Attendance",
                        value: attendance.average,
                      },
                      {
                        label: "Perfect Attendance",
                        value: attendance.perfect,
                      },
                      {
                        label: "Below 90%",
                        value: attendance.below90,
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-xl bg-slate-50 px-3 py-2"
                      >
                        <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                          {item.label}
                        </p>
                        <p className="mt-1 text-[12px] font-semibold text-slate-800">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Performance in this class
                </h3>
                <ul className="mt-2 space-y-2">
                  {buckets.map((item) => (
                    <li key={item.id}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-[12px] font-medium text-slate-700">
                          {item.label}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-600">
                          {item.learners} learners · {item.percent}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            BUCKET_BAR[item.tone] || "bg-slate-400"
                          )}
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <MonitoringSummary interventions={preview.interventions} />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-white px-4 py-2.5 sm:px-5">
          <button
            type="button"
            onClick={() => {
              onExport?.();
              showToast("Report downloaded.");
            }}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            <Download size={13} />
            Export PDF
          </button>
          {onExportExcel ? (
            <button
              type="button"
              onClick={() => {
                onExportExcel();
                showToast("Excel export started.");
              }}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              <Download size={13} />
              Export Excel
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 cursor-pointer items-center rounded-full bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white transition-colors hover:bg-[#246f54]"
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
