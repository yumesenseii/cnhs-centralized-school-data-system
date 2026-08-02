"use client";

import { useEffect, useState } from "react";
import { BookOpen, Check, Download, X } from "lucide-react";
import AttendanceSummary from "@/components/admin/reports/AttendanceSummary";
import InterventionSummary from "@/components/admin/reports/InterventionSummary";
import RiskSummary from "@/components/admin/reports/RiskSummary";
import SchoolSummary from "@/components/admin/reports/SchoolSummary";
import TeacherRecommendationSummary from "@/components/admin/reports/TeacherRecommendationSummary";
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

export default function ReportPreviewModal({
  open,
  preview,
  onClose,
  onExport,
  onSaveDraft,
  onFinalize,
}) {
  const [toast, setToast] = useState("");
  const [confirmFinalize, setConfirmFinalize] = useState(false);

  useEffect(() => {
    if (!open) {
      setToast("");
      setConfirmFinalize(false);
    }
  }, [open]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!open || !preview) return null;

  const info = preview.classInformation;
  const academic = preview.academic;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close report preview"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-preview-title"
        className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-slate-100 bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <BookOpen size={18} />
            </span>
            <div>
              <h2
                id="report-preview-title"
                className="text-base font-semibold tracking-[-0.02em] text-slate-900"
              >
                {preview.title}
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-400">{preview.subtitle}</p>
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

        <div className="space-y-4 overflow-y-auto px-3 py-3">
          {toast ? (
            <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-2.5 text-[12px] font-medium text-cnhs-green-dark">
              {toast}
            </div>
          ) : null}

          {confirmFinalize ? (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2">
              <p className="text-[12px] font-semibold text-amber-800">
                Finalize this report?
              </p>
              <p className="mt-1 text-[11px] text-amber-700">
                Finalized reports are ready for official school documentation export.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onFinalize?.();
                    setConfirmFinalize(false);
                    setToast("Report finalized successfully.");
                  }}
                  className="inline-flex h-8 cursor-pointer items-center rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white"
                >
                  Confirm Finalize
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmFinalize(false)}
                  className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Class Information <span className="font-normal">· read-only</span>
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <InfoCard label="Learning Area" value={info.learningArea} />
              <InfoCard label="Grade & Section" value={info.gradeSection} />
              <InfoCard label="Quarter" value={info.quarter} />
              <InfoCard label="Teacher" value={info.teacher} />
              <InfoCard label="School Year" value={info.schoolYear} />
              <InfoCard label="School" value={info.school} />
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Academic Performance Summary <span className="font-normal">· read-only</span>
            </h3>
            <dl className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100">
              {[
                ["Class Average", academic.classAverage, "text-cnhs-green-dark"],
                ["Passing Rate", academic.passingRate, "text-cnhs-green-dark"],
                ["Highest Performing Subject", academic.highestSubject, "text-cnhs-green-dark"],
                ["Lowest Performing Subject", academic.lowestSubject, "text-red-600"],
                [
                  "Learners Requiring Intervention",
                  academic.requiringIntervention,
                  "text-red-600",
                ],
              ].map(([label, value, tone]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 bg-white px-3 py-2.5"
                >
                  <dt className="text-[12px] text-slate-600">{label}</dt>
                  <dd className={cn("text-[12px] font-semibold", tone)}>{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <AttendanceSummary attendance={preview.attendance} />

          <section>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Weak Subject Distribution <span className="font-normal">· read-only</span>
            </h3>
            <ul className="mt-3 space-y-3">
              {preview.weakSubjects.map((item) => (
                <li key={item.subject}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[12px] font-medium text-slate-700">
                      {item.subject}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-600">
                      {item.learners} learners · {item.percent}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-cnhs-green-dark"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <RiskSummary risk={preview.risk} />
          <InterventionSummary intervention={preview.intervention} />
          <TeacherRecommendationSummary recommendations={preview.teacherRecommendations} />
          <SchoolSummary summary={preview.schoolSummary} />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-white px-4 py-3">
          <button
            type="button"
            onClick={() => {
              onExport?.();
              setToast("PDF export started (demo).");
            }}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            <Download size={13} />
            Export PDF
          </button>
          <button
            type="button"
            onClick={() => {
              onSaveDraft?.();
              setToast("Draft saved successfully.");
            }}
            className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => setConfirmFinalize(true)}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white transition-colors hover:bg-[#246f54]"
          >
            <Check size={13} />
            Finalize Report
          </button>
        </div>
      </div>
    </div>
  );
}
