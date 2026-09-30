"use client";

import { AlertCircle, Award, CheckCircle2, CornerDownRight, Lightbulb, MessageSquare, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { REMARK_SEVERITY_CONFIG } from "@/components/lesson-plan/LessonSectionRemarksPanel";
import { cn } from "@/lib/utils";

export default function LessonRemarksDrawer({
  open,
  onClose,
  remarks = [],
  timeline = [],
  onAddNewRemark = null,
  onDeleteRemark = null,
  onToggleResolve = null,
  readOnly = false,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl dark:bg-[var(--card)] dark:border-l dark:border-white/10 animate-in slide-in-from-right">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-white/5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cnhs-green/10 text-cnhs-green-dark dark:text-cnhs-green">
              <MessageSquare size={16} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Remarks & Revision History
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {remarks.length} section remark{remarks.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {!readOnly && onAddNewRemark ? (
              <button
                type="button"
                onClick={onAddNewRemark}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-cnhs-green-dark px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-[#246f54]"
              >
                <Plus size={12} />
                Add Remark
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {/* Remarks List */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Section Remarks ({remarks.length})
            </span>

            {remarks.length === 0 ? (
              <div className="my-3 rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400 dark:border-white/10">
                No section remarks yet. Highlight text in the document or click "Add Remark" above.
              </div>
            ) : (
              <div className="mt-2 space-y-2.5">
                {remarks.map((rem) => {
                  const conf =
                    REMARK_SEVERITY_CONFIG[rem.severity] ||
                    REMARK_SEVERITY_CONFIG["Needs Revision"];
                  const SeverityIcon = conf.icon || AlertCircle;
                  const isResolved = rem.status === "resolved";

                  return (
                    <div
                      key={rem.id}
                      className={cn(
                        "rounded-xl border p-3 text-xs shadow-xs transition",
                        isResolved
                          ? "border-slate-200 bg-slate-50/70 opacity-60 dark:border-white/5 dark:bg-white/[0.01]"
                          : rem.severity === "Needs Revision"
                          ? "border-red-200 bg-red-50/20 dark:border-red-900/40 dark:bg-red-950/20"
                          : "border-slate-200 bg-white dark:border-white/5 dark:bg-white/[0.02]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold",
                              conf.badgeClass
                            )}
                          >
                            <SeverityIcon size={9} />
                            {conf.label}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {rem.sectionTitle}
                          </span>
                        </div>

                        {!readOnly && onDeleteRemark ? (
                          <button
                            type="button"
                            onClick={() => onDeleteRemark(rem.id)}
                            className="text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                            title="Delete remark"
                          >
                            <Trash2 size={12} />
                          </button>
                        ) : null}
                      </div>

                      {rem.highlightedText ? (
                        <div className="mt-2 rounded border-l-2 border-amber-400 bg-amber-50/70 p-2 text-[11px] italic text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                          "{rem.highlightedText}"
                        </div>
                      ) : null}

                      <p className="mt-2 font-medium text-slate-800 dark:text-slate-200">
                        {rem.comment}
                      </p>

                      <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-400 dark:border-white/5">
                        <span>By {rem.reviewerName || "Principal"}</span>
                        {!readOnly && onToggleResolve ? (
                          <button
                            type="button"
                            onClick={() => onToggleResolve(rem.id)}
                            className={cn(
                              "cursor-pointer font-semibold underline transition",
                              isResolved
                                ? "text-slate-500 hover:text-slate-700"
                                : "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                            )}
                          >
                            {isResolved ? "Mark Unresolved" : "Mark Resolved"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Edit & Revision History Timeline */}
          {Array.isArray(timeline) && timeline.length > 0 ? (
            <div className="border-t border-slate-100 pt-3 dark:border-white/5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Workflow & Edit History
              </span>
              <div className="mt-2 space-y-2">
                {timeline.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs dark:border-white/5 dark:bg-white/[0.02]"
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cnhs-green/20 text-[9px] font-bold text-cnhs-green-dark dark:text-cnhs-green">
                      ✓
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {item.label}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {item.date || item.timestamp || ""}
                        </span>
                      </div>
                      {item.note || item.remarks ? (
                        <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                          {item.note || item.remarks}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
