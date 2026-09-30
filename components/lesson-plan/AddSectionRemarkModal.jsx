"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Award, Lightbulb, MessageSquarePlus, Quote, X } from "lucide-react";
import AnimatedModal from "@/components/shared/AnimatedModal";
import { DEPED_LESSON_SECTIONS } from "@/components/lesson-plan/LessonSectionRemarksPanel";
import { cn } from "@/lib/utils";

export default function AddSectionRemarkModal({
  open,
  onClose,
  onSave,
  initialText = "",
  initialSectionKey = "flow",
  reviewerName = "Principal",
}) {
  const [sectionKey, setSectionKey] = useState(initialSectionKey);
  const [highlightedText, setHighlightedText] = useState(initialText);
  const [comment, setComment] = useState("");
  const [severity, setSeverity] = useState("Needs Revision");

  // Synchronize state whenever modal is opened or selected text changes
  useEffect(() => {
    if (open) {
      setHighlightedText(initialText || "");
      setSectionKey(initialSectionKey || "flow");
      setComment("");
      setSeverity("Needs Revision");
    }
  }, [open, initialText, initialSectionKey]);

  const selectedSection =
    DEPED_LESSON_SECTIONS.find((s) => s.key === sectionKey) ||
    DEPED_LESSON_SECTIONS[0];

  function handleSubmit(e) {
    e.preventDefault();
    if (!comment.trim()) return;

    onSave?.({
      id: `remark-${Date.now()}`,
      sectionKey: selectedSection.key,
      sectionTitle: selectedSection.title,
      highlightedText: highlightedText.trim() || null,
      comment: comment.trim(),
      severity,
      reviewerName: reviewerName || "Principal",
      createdAt: new Date().toISOString(),
      status: "open",
    });

    setComment("");
    setHighlightedText("");
    onClose?.();
  }

  return (
    <AnimatedModal
      open={open}
      onClose={onClose}
      panelClassName="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-[#151921]"
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <MessageSquarePlus size={15} />
          </span>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Add Comment
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
        >
          <X size={16} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
        {/* Highlighted text quote */}
        {highlightedText ? (
          <div>
            <label className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Quote size={11} /> Selected Text Excerpt
            </label>
            <div className="mt-1 max-h-24 overflow-y-auto rounded-lg border-l-3 border-amber-400 bg-amber-50/80 p-2 text-xs font-medium text-amber-950 dark:bg-amber-950/40 dark:text-amber-200">
              "{highlightedText}"
            </div>
          </div>
        ) : null}

        {/* Target DepEd Section */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Target Section
          </label>
          <select
            value={sectionKey}
            onChange={(e) => setSectionKey(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs font-medium text-slate-800 outline-none focus:border-cnhs-green focus:bg-white dark:border-slate-800 dark:bg-[#1a202c] dark:text-slate-200"
          >
            {DEPED_LESSON_SECTIONS.map((sec) => (
              <option key={sec.key} value={sec.key}>
                {sec.title}
              </option>
            ))}
          </select>
        </div>

        {/* Severity choice */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Feedback Type
          </label>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {[
              { key: "Needs Revision", label: "Needs Revision", icon: AlertCircle, activeClass: "bg-red-50 text-red-700 border-red-300 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800" },
              { key: "Suggestion", label: "Suggestion", icon: Lightbulb, activeClass: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800" },
              { key: "Commendation", label: "Commendation", icon: Award, activeClass: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800" },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = severity === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSeverity(item.key)}
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition",
                    isSelected
                      ? `${item.activeClass} font-bold ring-1 ring-current`
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-[#1a202c] dark:text-slate-300"
                  )}
                >
                  <Icon size={12} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Guidance / Remark comment */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Principal's Note & Guidance *
          </label>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Specify what needs revision or adjustment in this section..."
            className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-cnhs-green dark:border-slate-800 dark:bg-[#1a202c] dark:text-slate-100 dark:placeholder:text-slate-500"
            autoFocus
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!comment.trim()}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#246f54] disabled:opacity-50"
          >
            Save Comment
          </button>
        </div>
      </form>
    </AnimatedModal>
  );
}
