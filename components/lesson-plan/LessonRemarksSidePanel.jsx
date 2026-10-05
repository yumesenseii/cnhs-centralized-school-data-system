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
  onToggleApply = null,
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

  const totalComments = remarks.length;
  const unresolvedCount = remarks.filter(
    (r) =>
      (r.severity === "Needs Revision" || !r.severity) &&
      r.status !== "applied" &&
      r.status !== "resolved"
  ).length;

  return (
    <aside
      aria-label="Remarks and revision history"
      className="flex h-full w-[320px] shrink-0 flex-col rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 shadow-xs transition-all duration-200 dark:border-white/10 dark:bg-[var(--card)]"
    >
      {/* Header with dynamic counters */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5 dark:border-white/5">
        <div className="flex flex-wrap items-center gap-1.5">
          <MessageSquare size={14} className="text-cnhs-green" />
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
            Comments
          </h3>
          <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] font-bold text-slate-700 dark:bg-white/10 dark:text-slate-300">
            {totalComments}
          </span>
          {totalComments > 0 ? (
            unresolvedCount > 0 ? (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.2 text-[9.5px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                {unresolvedCount} pending
              </span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9.5px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                ✓ All addressed
              </span>
            )
          ) : null}
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
              Reviewer feedback and comments will appear here.
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
              const isApplied = rem.status === "applied";
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
                      ? isApplied
                        ? "border-emerald-400 ring-2 ring-emerald-300/60 bg-emerald-50/50 dark:border-emerald-700 dark:bg-emerald-950/30"
                        : rem.severity === "Needs Revision"
                        ? "border-red-500 ring-2 ring-red-400/60 bg-red-50/90 dark:border-red-500 dark:bg-red-950/40 shadow-sm"
                        : "border-cnhs-green ring-2 ring-cnhs-green/50 bg-emerald-50/80 dark:border-cnhs-green dark:bg-emerald-950/40 shadow-sm"
                      : isApplied
                      ? "border-slate-200/80 bg-white/70 opacity-90 dark:border-white/5 dark:bg-white/[0.015]"
                      : isResolved
                      ? "border-slate-200 bg-white/60 opacity-60 dark:border-white/5 dark:bg-white/[0.01]"
                      : rem.severity === "Needs Revision"
                      ? "border-red-200 bg-white ring-1 ring-red-100 dark:border-red-900/50 dark:bg-red-950/20 dark:ring-0"
                      : "border-slate-200 bg-white dark:border-white/5 dark:bg-white/[0.02]"
                  )}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1">
                      {isApplied ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <CheckCircle2 size={10} className="text-emerald-600 dark:text-emerald-400" />
                          Applied
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.2 text-[9px] font-bold",
                            conf.badgeClass
                          )}
                        >
                          <SeverityIcon size={8} />
                          {conf.label}
                        </span>
                      )}
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

                  {/* Comment instruction text: strikethrough if marked Applied */}
                  <p
                    className={cn(
                      "mt-1.5 text-[11.5px] leading-snug transition-colors",
                      isApplied
                        ? "line-through text-slate-400 dark:text-slate-500"
                        : "text-slate-700 dark:text-slate-200"
                    )}
                  >
                    {rem.comment}
                  </p>

                  <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1 text-[9.5px] text-slate-400 dark:border-white/5">
                    <span>
                      {rem.reviewerName === "School Principal"
                        ? "Principal"
                        : rem.reviewerName || "Principal"}
                    </span>

                    {/* Teacher Action: Mark as Applied */}
                    {onToggleApply ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleApply(rem.id);
                        }}
                        className={cn(
                          "inline-flex cursor-pointer items-center gap-1 font-semibold transition",
                          isApplied
                            ? "text-emerald-700 hover:underline dark:text-emerald-400 text-[10px]"
                            : "rounded bg-cnhs-green/10 px-2 py-0.5 text-[10.5px] text-cnhs-green-dark hover:bg-cnhs-green/20 dark:bg-cnhs-green/20 dark:text-cnhs-green"
                        )}
                        title={isApplied ? "Click to revert to pending" : "Confirm comment has been addressed"}
                      >
                        {isApplied ? (
                          <>
                            <CheckCircle2 size={11} className="text-emerald-600 dark:text-emerald-400" />
                            <span>Applied ✓</span>
                            <span className="text-[9px] text-slate-400 font-normal hover:text-slate-600">(Undo)</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={11} />
                            <span>Mark as Applied</span>
                          </>
                        )}
                      </button>
                    ) : !readOnly && onToggleResolve ? (
                      /* Admin/Principal Action: Resolve/Unresolve */
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

        {/* Workflow / Revision History */}
        {Array.isArray(timeline) && timeline.length > 0 ? (
          <div className="border-t border-slate-200/70 pt-2.5 dark:border-white/5">
            <div className="flex items-center justify-between pb-1">
              <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Workflow History
              </span>
              <span className="text-[9px] text-slate-400">
                {timeline.length} {timeline.length === 1 ? "step" : "steps"}
              </span>
            </div>
            <div className="mt-1 space-y-1.5">
              {timeline.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="rounded-lg border border-slate-200/80 bg-white p-2 text-[10.5px] shadow-2xs dark:border-white/5 dark:bg-white/[0.02]"
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5">
                      {item.revision ? (
                        <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] font-bold text-slate-700 dark:bg-white/10 dark:text-slate-300">
                          {item.revision}
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          "font-bold text-[11px]",
                          item.label === "Approved"
                            ? "text-emerald-700 dark:text-emerald-400"
                            : item.label === "Needs Revision"
                            ? "text-red-700 dark:text-red-400"
                            : item.label === "Resubmitted"
                            ? "text-cnhs-green-dark dark:text-cnhs-green"
                            : "text-slate-800 dark:text-slate-200"
                        )}
                      >
                        {item.label}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-400">
                      {item.date || ""}
                    </span>
                  </div>

                  {item.actor ? (
                    <div className="mt-0.5 text-[9.5px] text-slate-500 dark:text-slate-400">
                      <span>By: <span className="font-semibold text-slate-700 dark:text-slate-300">{item.actor}</span></span>
                    </div>
                  ) : null}

                  {item.note || item.remarks ? (
                    <p className="mt-1 rounded bg-slate-50 p-1.5 text-[10px] leading-snug text-slate-600 dark:bg-white/5 dark:text-slate-300">
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
