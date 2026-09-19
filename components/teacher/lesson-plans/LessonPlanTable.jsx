"use client";

import { useRef, useState } from "react";
import { Download, Eye, Loader2, Trash2, Upload } from "lucide-react";
import StatusBadge from "@/components/teacher/lesson-plans/StatusBadge";

export default function LessonPlanTable({
  plans,
  onView,
  onDownload,
  onResubmit,
  onDelete,
}) {
  const fileInputRef = useRef(null);
  const [pendingPlan, setPendingPlan] = useState(null);
  const [busyId, setBusyId] = useState(null);

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    const plan = pendingPlan;
    event.target.value = "";
    setPendingPlan(null);
    if (!file || !plan) return;

    setBusyId(plan.id);
    await onResubmit?.(plan, file);
    setBusyId(null);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)] dark:border-white/10 dark:bg-[var(--card)] dark:shadow-none">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="overflow-x-auto">
        <table className="min-w-[1080px] w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/80 dark:bg-white/5">
              {[
                "Lesson Title",
                "Subject",
                "Grade & Section",
                "Week",
                "Term",
                "Submitted Date",
                "Status",
                "Last Updated",
                "Actions",
              ].map((column) => (
                <th
                  key={column}
                  className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => {
              const canResubmit =
                plan.canResubmit || plan.status === "Needs Revision";
              const isBusy = busyId === plan.id;

              return (
                <tr
                  key={plan.id}
                  className="border-t border-slate-100 transition-colors hover:bg-slate-50/70 dark:border-white/5 dark:hover:bg-white/5"
                >
                  <td className="px-3 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {plan.lessonTitle}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300">{plan.subject}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300">{plan.gradeSection}</td>
                  <td className="px-3 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200">{plan.week}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300">{plan.quarter}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                    {plan.submittedDate ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={plan.status} />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">{plan.lastUpdated}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onView?.(plan)}
                        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-cnhs-green-dark/35 bg-white px-2.5 text-[10px] font-semibold text-cnhs-green-dark transition-colors hover:bg-green-50 dark:border-cnhs-green/40 dark:bg-transparent dark:text-cnhs-green dark:hover:bg-cnhs-green/10"
                      >
                        <Eye size={11} />
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => onDownload?.(plan)}
                        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:bg-white/5"
                      >
                        <Download size={11} />
                        Download
                      </button>
                      {canResubmit ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            setPendingPlan(plan);
                            fileInputRef.current?.click();
                          }}
                          className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-cnhs-orange/40 bg-orange-50 px-2.5 text-[10px] font-semibold text-cnhs-orange transition-colors hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-cnhs-orange/10 dark:hover:bg-cnhs-orange/20"
                        >
                          {isBusy ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <Upload size={11} />
                          )}
                          Resubmit
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={async () => {
                          setBusyId(plan.id);
                          await onDelete?.(plan);
                          setBusyId(null);
                        }}
                        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 text-[10px] font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-red-500/30 dark:bg-transparent dark:hover:bg-red-950/30"
                      >
                        {isBusy ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Trash2 size={11} />
                        )}
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {plans.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-slate-500">
          No lesson plans match your current filters.
        </div>
      ) : null}
    </section>
  );
}
