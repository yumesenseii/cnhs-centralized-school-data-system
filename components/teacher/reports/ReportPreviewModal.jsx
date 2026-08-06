"use client";

import { useEffect, useState } from "react";
import { BookOpen, Download, X } from "lucide-react";
import AcademicPerformanceSummary from "@/components/teacher/reports/AcademicPerformanceSummary";
import MonitoringSummary from "@/components/teacher/reports/MonitoringSummary";
import RecommendationSummary from "@/components/teacher/reports/RecommendationSummary";

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

export default function ReportPreviewModal({
  open,
  preview,
  onClose,
  onExport,
  onExportExcel,
  closeLabel = "Return to Reports",
}) {
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!open) setToast("");
  }, [open]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!open || !preview) return null;

  const info = preview.classInformation;
  const attendance = preview.attendance;

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
        className="relative z-10 flex max-h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-2.5 sm:px-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
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
          {toast ? (
            <div className="mb-3 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-[12px] font-medium text-cnhs-green-dark">
              {toast}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
            {/* Left column */}
            <div className="space-y-3">
              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Class Information{" "}
                  <span className="font-normal">· read-only</span>
                </h3>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <InfoCard label="Subject" value={info.subject} />
                  <InfoCard
                    label="Grade & Section"
                    value={info.gradeSection}
                  />
                  <InfoCard label="Quarter" value={info.quarter} />
                  <InfoCard label="Teacher" value={info.teacher} />
                  <InfoCard label="School Year" value={info.schoolYear} />
                </div>
              </section>

              <AcademicPerformanceSummary academic={preview.academic} />
            </div>

            {/* Right column */}
            <div className="space-y-3">
              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Attendance Summary{" "}
                  <span className="font-normal">
                    · monitoring only · not a prediction input
                  </span>
                </h3>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {[
                    {
                      label: "Average Attendance",
                      value: attendance.average,
                      tone: "text-amber-600",
                    },
                    {
                      label: "Perfect Attendance",
                      value: attendance.perfect,
                      tone: "text-cnhs-green-dark",
                    },
                    {
                      label: "Below 90%",
                      value: attendance.below90,
                      tone: "text-red-600",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl bg-slate-50 px-3 py-2"
                    >
                      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-slate-400">
                        {item.label}
                      </p>
                      <p
                        className={`mt-1 text-[12px] font-semibold ${item.tone}`}
                      >
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Weak Subject Distribution{" "}
                  <span className="font-normal">· read-only</span>
                </h3>
                <ul className="mt-2 space-y-2">
                  {preview.weakSubjects.map((item) => (
                    <li key={item.subject}>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-[12px] font-medium text-slate-700">
                          {item.subject}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-600">
                          {item.learners} learners · {item.percent}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-cnhs-green-dark"
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <MonitoringSummary monitoring={preview.monitoring} />
              <RecommendationSummary
                recommendations={preview.recommendations}
              />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-white px-4 py-2.5 sm:px-5">
          <button
            type="button"
            onClick={() => {
              onExport?.();
              setToast("PDF export started.");
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
                setToast("Excel export started.");
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
