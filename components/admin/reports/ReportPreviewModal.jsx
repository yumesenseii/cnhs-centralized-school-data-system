"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Download, X } from "lucide-react";
import { cn } from "@/lib/utils";

function ContextRow({ label, value }) {
  if (value == null || value === "" || value === "—") return null;
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-1.5 last:border-b-0">
      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </span>
      <span className="text-right text-[11px] font-semibold text-slate-800">
        {value}
      </span>
    </div>
  );
}

function MetricCard({ label, value, hint, tone = "default" }) {
  const tones = {
    default: "text-slate-900",
    green: "text-cnhs-green-dark",
    orange: "text-cnhs-orange",
    red: "text-red-600",
  };
  return (
    <div className="rounded-lg border border-slate-100 bg-white px-2 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-lg font-semibold tracking-[-0.03em] sm:text-xl",
          tones[tone] ?? tones.default
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-[9px] leading-tight text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

function StatLine({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-100 py-1.5 last:border-b-0">
      <span className="text-[11px] text-slate-600">{label}</span>
      <span
        className={cn(
          "text-[12px] font-semibold tabular-nums text-slate-800",
          tone
        )}
      >
        {value}
      </span>
    </div>
  );
}

const riskTones = {
  red: "border-red-100 bg-red-50/70 text-red-600",
  orange: "border-orange-100 bg-orange-50/70 text-cnhs-orange",
  green: "border-green-100 bg-green-50/70 text-cnhs-green-dark",
};

function riskTextTone(level) {
  if (level === "High Risk") return "text-red-600";
  if (level === "Moderate Risk") return "text-cnhs-orange";
  return "text-cnhs-green-dark";
}

/**
 * Admin class-folder snapshot — wide formal report with priority learners.
 */
export default function ReportPreviewModal({
  open,
  preview,
  onClose,
  onExport,
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

  const info = preview?.classInformation ?? {};
  const academic = preview?.academic ?? {};
  const intervention = preview?.intervention ?? {};
  const gradeBands = preview?.gradeBands ?? {};
  const risk = Array.isArray(preview?.risk) ? preview.risk : [];
  const priorityLearners = Array.isArray(preview?.priorityLearners)
    ? preview.priorityLearners
    : [];

  const atRiskCount = useMemo(() => {
    return risk
      .filter(
        (item) =>
          item.level === "High Risk" || item.level === "Moderate Risk"
      )
      .reduce((sum, item) => sum + Number(item.learners ?? 0), 0);
  }, [risk]);

  const aralCount = Number(intervention.aralScreening ?? 0);
  const remediationCount = Number(intervention.classroomRemediation ?? 0);
  const showAral = preview?.aralEligible === true;

  if (!open || !preview) return null;

  const learnerCount = info.students ?? "—";
  const needingIntervention = academic.requiringIntervention ?? 0;
  const bandTotal = Number(gradeBands.graded ?? 0) || 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
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
        className="relative z-10 flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-slate-100 bg-white shadow-2xl sm:max-h-[88vh] sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-2.5 sm:px-5">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cnhs-green-soft text-cnhs-green-dark ring-1 ring-green-100">
              <BookOpen size={15} />
            </span>
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Class performance summary
              </p>
              <h2
                id="report-preview-title"
                className="text-[15px] font-semibold tracking-[-0.02em] text-slate-900"
              >
                {preview.title}
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {preview.subtitle}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                  {learnerCount} learners
                </span>
                {info.graded != null ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    {info.graded} graded
                  </span>
                ) : null}
                {Number(info.ungraded) > 0 ? (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-100">
                    {info.ungraded} ungraded
                  </span>
                ) : null}
                {preview.aralEligible === true ? (
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-100">
                    ARAL-eligible subject
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
          {toast ? (
            <div className="mb-3 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-[12px] font-medium text-cnhs-green-dark">
              {toast}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(200px,0.32fr)_1fr] lg:gap-4">
            <aside className="space-y-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <h3 className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Class context
                </h3>
                <div className="mt-1">
                  <ContextRow label="Subject" value={info.subject} />
                  <ContextRow
                    label="Grade & Section"
                    value={info.gradeSection}
                  />
                  <ContextRow label="Term" value={info.quarter} />
                  <ContextRow label="Teacher" value={info.teacher} />
                  <ContextRow label="School Year" value={info.schoolYear} />
                  <ContextRow label="Last update" value={info.lastUpload} />
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-white p-3">
                <h3 className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Intervention & monitoring
                </h3>
                <div className="mt-1">
                  {showAral ? (
                    <StatLine label="ARAL Learners" value={aralCount} />
                  ) : null}
                  <StatLine
                    label="Classroom remediation"
                    value={remediationCount}
                  />
                  <StatLine
                    label="Under monitoring"
                    value={intervention.underMonitoring ?? 0}
                  />
                  <StatLine
                    label="Monitoring completed"
                    value={intervention.monitoringCompleted ?? 0}
                  />
                  <StatLine
                    label="Monitoring status"
                    value={intervention.completionRate ?? "—"}
                  />
                </div>
              </div>
            </aside>

            <div className="min-w-0 space-y-3">
              <section>
                <h3 className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Key metrics
                </h3>
                <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  <MetricCard
                    label="Average"
                    value={academic.classAverage ?? "—"}
                    hint="Class average"
                    tone="green"
                  />
                  <MetricCard
                    label="Passing"
                    value={academic.passingRate ?? "—"}
                    hint="At or above 75"
                    tone={
                      academic.passingRate && academic.passingRate !== "0%"
                        ? "green"
                        : "orange"
                    }
                  />
                  <MetricCard
                    label="At risk"
                    value={atRiskCount}
                    hint="High + moderate"
                    tone={atRiskCount > 0 ? "orange" : "green"}
                  />
                  <MetricCard
                    label="Intervention"
                    value={needingIntervention}
                    hint="Need follow-up"
                    tone={
                      Number(needingIntervention) > 0 ? "red" : "green"
                    }
                  />
                </div>
              </section>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <section>
                  <h3 className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Risk classification
                  </h3>
                  <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                    {risk.map((item) => (
                      <div
                        key={item.level}
                        className={cn(
                          "rounded-lg border px-2 py-2",
                          riskTones[item.tone] ?? riskTones.green
                        )}
                      >
                        <p className="text-[9px] font-semibold leading-tight">
                          {item.level.replace(" Risk", "")}
                        </p>
                        <p className="mt-0.5 text-lg font-semibold tracking-[-0.03em]">
                          {item.learners}
                        </p>
                        <p className="text-[9px] font-medium opacity-80">
                          {item.percent} of graded
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3 className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Grade bands
                  </h3>
                  <div className="mt-1.5 overflow-hidden rounded-lg border border-slate-100">
                    <div className="grid grid-cols-3 divide-x divide-slate-100 bg-slate-50/80 text-center">
                      <div className="px-2 py-2">
                        <p className="text-[9px] font-semibold uppercase text-red-500">
                          &lt;75
                        </p>
                        <p className="mt-0.5 text-lg font-semibold text-red-600">
                          {gradeBands.below75 ?? 0}
                        </p>
                        <p className="text-[9px] text-slate-400">
                          {Math.round(
                            ((gradeBands.below75 ?? 0) / bandTotal) * 100
                          )}
                          %
                        </p>
                      </div>
                      <div className="px-2 py-2">
                        <p className="text-[9px] font-semibold uppercase text-cnhs-orange">
                          75–80
                        </p>
                        <p className="mt-0.5 text-lg font-semibold text-cnhs-orange">
                          {gradeBands.band75to80 ?? 0}
                        </p>
                        <p className="text-[9px] text-slate-400">
                          {Math.round(
                            ((gradeBands.band75to80 ?? 0) / bandTotal) * 100
                          )}
                          %
                        </p>
                      </div>
                      <div className="px-2 py-2">
                        <p className="text-[9px] font-semibold uppercase text-cnhs-green-dark">
                          &gt;80
                        </p>
                        <p className="mt-0.5 text-lg font-semibold text-cnhs-green-dark">
                          {gradeBands.above80 ?? 0}
                        </p>
                        <p className="text-[9px] text-slate-400">
                          {Math.round(
                            ((gradeBands.above80 ?? 0) / bandTotal) * 100
                          )}
                          %
                        </p>
                      </div>
                    </div>
                    <p className="border-t border-slate-100 px-2 py-1.5 text-[9px] text-slate-400">
                      Failed · Fairly passed · Passed — {gradeBands.graded ?? 0}{" "}
                      graded
                      {Number(gradeBands.ungraded) > 0
                        ? ` · ${gradeBands.ungraded} ungraded`
                        : ""}
                    </p>
                  </div>
                </section>
              </div>

              <section>
                <div className="mb-1.5 flex items-end justify-between gap-2">
                  <h3 className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Priority learners
                  </h3>
                  <p className="text-[9px] text-slate-400">
                    High risk and/or ARAL · top {priorityLearners.length}
                  </p>
                </div>
                <div className="max-h-[220px] overflow-auto rounded-xl border border-slate-100">
                  <table className="min-w-full border-collapse text-left">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr>
                        {[
                          "#",
                          "Learner",
                          "Grade",
                          "Risk",
                          "Recommendation",
                        ].map((col) => (
                          <th
                            key={col}
                            className="px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {priorityLearners.length ? (
                        priorityLearners.map((row, index) => (
                          <tr
                            key={row.id || `${row.name}-${index}`}
                            className="border-t border-slate-100 hover:bg-slate-50/70"
                          >
                            <td className="px-2.5 py-1.5 text-[11px] tabular-nums text-slate-400">
                              {index + 1}
                            </td>
                            <td className="px-2.5 py-1.5">
                              <p className="text-[11px] font-semibold text-slate-800">
                                {row.name}
                              </p>
                              <p className="text-[9px] text-slate-400">
                                {row.studentNumber}
                              </p>
                            </td>
                            <td className="px-2.5 py-1.5 text-[11px] font-semibold tabular-nums text-slate-700">
                              {row.grade == null ? "—" : row.grade}
                            </td>
                            <td
                              className={cn(
                                "px-2.5 py-1.5 text-[11px] font-semibold",
                                riskTextTone(row.riskLevel)
                              )}
                            >
                              {row.riskLevel || "—"}
                            </td>
                            <td className="px-2.5 py-1.5 text-[11px] text-slate-600">
                              {row.recommendation || "—"}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-3 py-6 text-center text-[11px] text-slate-400"
                          >
                            No high-risk or ARAL-priority learners in this
                            class snapshot.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1.5 text-[9px] text-slate-400">
                  Full monitoring and weekly progress: Academic Monitoring.
                </p>
              </section>

              <p className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-[10px] leading-relaxed text-slate-500">
                Academic risk uses ECR grades only (&lt;75 High · 75–80 Moderate ·
                &gt;80 Low). Risk and grade bands count graded learners only;
                ungraded are not High Risk. SF2 attendance is tracked under{" "}
                <span className="font-semibold text-slate-600">
                  Attendance Monitoring
                </span>
                , separate from this prediction.
              </p>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-white px-4 py-2.5 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onExport?.();
              setToast("PDF export started.");
            }}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white transition-colors hover:bg-[#246f54]"
          >
            <Download size={13} />
            Export PDF
          </button>
        </div>
      </div>
    </div>
  );
}
