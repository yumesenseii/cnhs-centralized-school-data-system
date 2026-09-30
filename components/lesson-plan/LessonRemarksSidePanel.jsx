"use client";

import { useEffect } from "react";
import { AlertCircle, CheckCircle2, MessageSquare, Plus, Trash2, X } from "lucide-react";
import { REMARK_SEVERITY_CONFIG } from "@/components/lesson-plan/LessonSectionRemarksPanel";
import { cn } from "@/lib/utils";

/**
 * Google Docs / Microsoft Word-style side-along comments & review history panel.
 * Sits alongside the document without any dark backdrop overlay.
 */
export default function LessonRemarksSidePanel({
  open = true,
  onClose,
  remarks = [],
  timeline = [],
  selectedRemarkId = null,
  onAddNewRemark = null,
  onDeleteRemark = null,
  onToggleResolve = null,
  onSelectRemark = null,
  readOnly = false,
  reviewerName = "Principal",
}) {
  useEffect(() => {
    if (!selectedRemarkId) return;
    const elem = document.getElementById(`remark-card-${selectedRemarkId}`);
    if (elem) {
      elem.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedRemarkId]);

  if (!open) return null;

  return (
    <aside
      aria-label="Remarks and revision history"
      className="flex h-full w-[320px] shrink-0 flex-col rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 shadow-xs transition-all duration-200 dark:border-white/10 dark:bg-[var(--card)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 dark:border-white/5">
        <div className="flex items-center gap-1.5">
          <MessageSquare size={14} className="text-cnhs-green" />
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
            Comments & History
          </h3>
          <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] font-bold text-slate-700 dark:bg-white/10 dark:text-slate-300">
            {remarks.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {!readOnly && onAddNewRemark ? (
            <button
              type="button"
              onClick={onAddNewRemark}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-cnhs-green-dark px-2 py-1 text-[11px] font-semibold text-white shadow-xs transition hover:bg-[#246f54]"
            >
              <Plus size={11} />
              Add
            </button>
          ) : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
              title="Hide comments"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
      </div>

      {/* Scrollable list */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pt-2.5 pr-1">
        {remarks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-center dark:border-white/10 dark:bg-white/[0.02]">
            <MessageSquare size={20} className="mx-auto text-slate-300 dark:text-slate-600" />
            <p className="mt-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              No remarks yet
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              Select text in the document to add a comment.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {remarks.map((rem) => {
              const conf =
                REMARK_SEVERITY_CONFIG[rem.severity] ||
                REMARK_SEVERITY_CONFIG["Needs Revision"];
              const SeverityIcon = conf.icon || AlertCircle;
              const isResolved = rem.status === "resolved";
              const isSelected =
                Boolean(selectedRemarkId) &&
                String(rem.id) === String(selectedRemarkId);

              return (
                <div
                  key={rem.id}
                  id={`remark-card-${rem.id}`}
                  onClick={() => onSelectRemark?.(rem)}
                  className={cn(
                    "relative cursor-pointer rounded-xl border p-2.5 text-xs transition duration-150 shadow-2xs hover:shadow-xs",
                    isSelected
                      ? rem.severity === "Needs Revision"
                        ? "border-red-500 ring-2 ring-red-400/60 bg-red-50/90 dark:border-red-500 dark:bg-red-950/40 shadow-sm"
                        : "border-cnhs-green ring-2 ring-cnhs-green/50 bg-emerald-50/80 dark:border-cnhs-green dark:bg-emerald-950/40 shadow-sm"
                      : isResolved
                      ? "border-slate-200 bg-white/60 opacity-60 dark:border-white/5 dark:bg-white/[0.01]"
                      : rem.severity === "Needs Revision"
                      ? "border-red-200 bg-white ring-1 ring-red-100 dark:border-red-900/50 dark:bg-red-950/20 dark:ring-0"
                      : "border-slate-200 bg-white dark:border-white/5 dark:bg-white/[0.02]"
                  )}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1">
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.2 text-[9px] font-bold",
                          conf.badgeClass
                        )}
                      >
                        <SeverityIcon size={8} />
                        {conf.label}
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                        {rem.sectionTitle}
                      </span>
                    </div>

                    {!readOnly && onDeleteRemark ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteRemark(rem.id);
                        }}
                        className="text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                        title="Delete remark"
                      >
                        <Trash2 size={11} />
                      </button>
                    ) : null}
                  </div>

                  {rem.highlightedText ? (
                    <div className="mt-1.5 rounded border-l-2 border-amber-400 bg-amber-50/80 p-1.5 text-[10.5px] italic text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                      "{rem.highlightedText}"
                    </div>
                  ) : null}

                  <p className="mt-1.5 text-[11.5px] text-slate-700 dark:text-slate-200 leading-snug">
                    {rem.comment}
                  </p>

                  <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1 text-[9.5px] text-slate-400 dark:border-white/5">
                    <span>{rem.reviewerName === "Head Teacher" ? "Principal" : (rem.reviewerName || "Principal")}</span>
                    {!readOnly && onToggleResolve ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleResolve(rem.id);
                        }}
                        className={cn(
                          "font-semibold hover:underline transition",
                          isResolved
                            ? "text-slate-500"
                            : "text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {isResolved ? "Unresolve" : "Resolve"}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Workflow / Edit History accordion */}
        {Array.isArray(timeline) && timeline.length > 0 ? (
          <div className="border-t border-slate-200/70 pt-2.5 dark:border-white/5">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
              Workflow History
            </span>
            <div className="mt-1.5 space-y-1.5">
              {timeline.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="rounded-lg border border-slate-100 bg-white p-2 text-[10.5px] dark:border-white/5 dark:bg-white/[0.02]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      {item.label}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {item.date || ""}
                    </span>
                  </div>
                  {item.note || item.remarks ? (
                    <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                      {item.note || item.remarks}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
