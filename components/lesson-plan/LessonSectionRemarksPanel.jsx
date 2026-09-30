"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Award,
  Check,
  CheckCircle2,
  ChevronDown,
  CornerDownRight,
  Filter,
  Lightbulb,
  MessageSquare,
  MessageSquarePlus,
  Plus,
  Quote,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const DEPED_LESSON_SECTIONS = [
  {
    key: "intentions",
    title: "I. Intentions & Objectives",
    desc: "Competencies & Session 1-5 Objectives (Cognitive, Affective, Psychomotor)",
  },
  {
    key: "learner_context",
    title: "II. Learner Context & Observations",
    desc: "Learner strengths, interests, and possible barriers to learning",
  },
  {
    key: "pre_lesson",
    title: "III. Pre-Lesson Preparation",
    desc: "Prayer, attendance, classroom management, and review/activation",
  },
  {
    key: "flow",
    title: "IV. Learning Flow & Session Activities",
    desc: "Lesson purpose, discussion, reading, exercises, and synthesis",
  },
  {
    key: "resources_integration",
    title: "V. Learning Resources & Integration",
    desc: "Materials, worksheets, Values Education, AP, and ICT integration",
  },
  {
    key: "assessment",
    title: "VI. Formative Assessment",
    desc: "Assessment tasks, rubrics, questions, and feedback mechanisms",
  },
  {
    key: "ways_forward",
    title: "VII. Ways Forward & Reflections",
    desc: "Extended learning opportunities, remediation, and reflections",
  },
  {
    key: "general",
    title: "General / Document-Wide",
    desc: "Overall format, dates, AI use declaration, or administrative notes",
  },
];

export const REMARK_SEVERITY_CONFIG = {
  "Needs Revision": {
    label: "Needs Revision",
    badgeClass: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50",
    dotClass: "bg-red-500",
    icon: AlertCircle,
  },
  Suggestion: {
    label: "Suggestion",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/50",
    dotClass: "bg-sky-500",
    icon: Lightbulb,
  },
  Commendation: {
    label: "Commendation",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50",
    dotClass: "bg-emerald-500",
    icon: Award,
  },
};

export default function LessonSectionRemarksPanel({
  remarks = [],
  onAddRemark,
  onDeleteRemark,
  onToggleResolve,
  readOnly = false,
  reviewerName = "Principal",
  activeHighlight = null,
  onClearHighlight = null,
}) {
  const [composing, setComposing] = useState(Boolean(activeHighlight));
  const [selectedSectionKey, setSelectedSectionKey] = useState(
    activeHighlight?.sectionKey || "procedures"
  );
  const [highlightedText, setHighlightedText] = useState(
    activeHighlight?.text || ""
  );
  const [commentText, setCommentText] = useState("");
  const [severity, setSeverity] = useState("Needs Revision");
  const [filterSection, setFilterSection] = useState("all");

  // Keep form synced when activeHighlight changes
  useMemo(() => {
    if (activeHighlight?.text) {
      setHighlightedText(activeHighlight.text);
      if (activeHighlight.sectionKey) {
        setSelectedSectionKey(activeHighlight.sectionKey);
      }
      setComposing(true);
    }
  }, [activeHighlight]);

  const filteredRemarks = useMemo(() => {
    if (filterSection === "all") return remarks;
    return remarks.filter((r) => r.sectionKey === filterSection);
  }, [remarks, filterSection]);

  const stats = useMemo(() => {
    const total = remarks.length;
    const needsRevision = remarks.filter(
      (r) => r.severity === "Needs Revision" && r.status !== "resolved"
    ).length;
    const resolved = remarks.filter((r) => r.status === "resolved").length;
    const suggestions = remarks.filter((r) => r.severity === "Suggestion").length;
    return { total, needsRevision, resolved, suggestions };
  }, [remarks]);

  function handleSave() {
    if (!commentText.trim()) return;

    const targetSection =
      DEPED_LESSON_SECTIONS.find((s) => s.key === selectedSectionKey) ||
      DEPED_LESSON_SECTIONS[0];

    const newRemark = {
      id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      sectionKey: targetSection.key,
      sectionTitle: targetSection.title,
      highlightedText: highlightedText?.trim() || null,
      comment: commentText.trim(),
      severity,
      status: "open",
      authorName: reviewerName || "Principal",
      authorRole: "principal",
      createdAt: new Date().toISOString(),
    };

    onAddRemark?.(newRemark);
    setCommentText("");
    setHighlightedText("");
    setComposing(false);
    onClearHighlight?.();
  }

  function handleCancel() {
    setComposing(false);
    setCommentText("");
    setHighlightedText("");
    onClearHighlight?.();
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 dark:border-white/5 dark:bg-white/[0.02]">
      {/* Panel Header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3 dark:border-white/5 dark:bg-[var(--card)]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-slate-700 dark:text-slate-200">
              Section-by-Section Remarks
            </h3>
            {stats.needsRevision > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                <AlertCircle size={10} />
                {stats.needsRevision} revision required
              </span>
            ) : stats.total > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                {stats.total} remarks
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Principal review notes for specific lesson plan sections.
          </p>
        </div>

        {!readOnly && !composing ? (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-2.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#246f54]"
          >
            <Plus size={13} />
            Add Remark
          </button>
        ) : null}
      </div>

      {/* Section Quick Filter */}
      {remarks.length > 0 ? (
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-slate-200 bg-slate-100/70 px-3 py-1.5 dark:border-white/5 dark:bg-white/[0.02]">
          <Filter size={11} className="shrink-0 text-slate-400" />
          <button
            type="button"
            onClick={() => setFilterSection("all")}
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold transition",
              filterSection === "all"
                ? "bg-cnhs-green-dark text-white"
                : "bg-white text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400"
            )}
          >
            All ({remarks.length})
          </button>
          {DEPED_LESSON_SECTIONS.map((sec) => {
            const count = remarks.filter((r) => r.sectionKey === sec.key).length;
            if (count === 0) return null;
            return (
              <button
                key={sec.key}
                type="button"
                onClick={() => setFilterSection(sec.key)}
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold transition",
                  filterSection === sec.key
                    ? "bg-cnhs-green-dark text-white"
                    : "bg-white text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-400"
                )}
              >
                {sec.title.split(". ")[1] || sec.title} ({count})
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Remark Composer Form */}
      {composing && !readOnly ? (
        <div className="shrink-0 border-b border-slate-200 bg-white p-3.5 shadow-sm dark:border-white/5 dark:bg-[var(--card)]">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
              <MessageSquarePlus size={14} className="text-cnhs-green-dark dark:text-cnhs-green" />
              New Section Remark
            </span>
            <button
              type="button"
              onClick={handleCancel}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X size={14} />
            </button>
          </div>

          {/* Section Selection */}
          <div className="mb-2">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Target Section
            </label>
            <select
              value={selectedSectionKey}
              onChange={(e) => setSelectedSectionKey(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-cnhs-green dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
            >
              {DEPED_LESSON_SECTIONS.map((sec) => (
                <option key={sec.key} value={sec.key}>
                  {sec.title} — {sec.desc}
                </option>
              ))}
            </select>
          </div>

          {/* Highlighted text snippet if present */}
          {highlightedText ? (
            <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50/80 p-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="flex items-center justify-between gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                <span className="flex items-center gap-1">
                  <Quote size={10} /> Highlighted Text Excerpt:
                </span>
                <button
                  type="button"
                  onClick={() => setHighlightedText("")}
                  className="text-[10px] text-amber-600 underline hover:text-amber-800"
                >
                  Clear excerpt
                </button>
              </div>
              <p className="mt-1 line-clamp-3 italic">"{highlightedText}"</p>
            </div>
          ) : null}

          {/* Remark / Feedback textarea */}
          <div className="mb-2.5">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Principal's Remark & Guidance
            </label>
            <textarea
              rows={3}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="State clearly what needs to be improved, adjusted, or commended in this section..."
              className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-cnhs-green dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          {/* Severity selector */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Type:
            </span>
            {Object.entries(REMARK_SEVERITY_CONFIG).map(([sevKey, conf]) => {
              const Icon = conf.icon;
              const isSelected = severity === sevKey;
              return (
                <button
                  key={sevKey}
                  type="button"
                  onClick={() => setSeverity(sevKey)}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition",
                    isSelected
                      ? conf.badgeClass + " ring-1 ring-offset-1"
                      : "border-slate-200 bg-white text-slate-600 opacity-60 hover:opacity-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-400"
                  )}
                >
                  <Icon size={11} />
                  {conf.label}
                </button>
              );
            })}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!commentText.trim()}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-cnhs-green-dark px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#246f54] disabled:opacity-50"
            >
              <Check size={12} />
              Save Section Remark
            </button>
          </div>
        </div>
      ) : null}

      {/* Remarks List */}
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
        {filteredRemarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
            <MessageSquare size={24} className="mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-xs font-medium">No section remarks yet.</p>
            <p className="mt-0.5 max-w-xs text-[11px] text-slate-500">
              {readOnly
                ? "No specific section remarks were recorded by the Principal."
                : "Select text in the preview or click 'Add Remark' to attach feedback to specific sections."}
            </p>
          </div>
        ) : (
          filteredRemarks.map((remark) => {
            const conf =
              REMARK_SEVERITY_CONFIG[remark.severity] ||
              REMARK_SEVERITY_CONFIG["Needs Revision"];
            const SeverityIcon = conf.icon;
            const isResolved = remark.status === "resolved";
            const isAddressed = remark.status === "addressed";

            return (
              <div
                key={remark.id}
                className={cn(
                  "relative rounded-xl border p-3 transition-all duration-150",
                  isResolved
                    ? "border-slate-200 bg-slate-50 opacity-70 dark:border-white/5 dark:bg-white/[0.01]"
                    : remark.severity === "Needs Revision"
                      ? "border-red-200/80 bg-white shadow-sm dark:border-red-900/30 dark:bg-[var(--card)]"
                      : "border-slate-200 bg-white shadow-sm dark:border-white/5 dark:bg-[var(--card)]"
                )}
              >
                {/* Remark Header */}
                <div className="flex flex-wrap items-start justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                        conf.badgeClass
                      )}
                    >
                      <SeverityIcon size={10} />
                      {conf.label}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-300">
                      {remark.sectionTitle || "Section"}
                    </span>
                    {isAddressed ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        <CornerDownRight size={9} /> Addressed in Revision
                      </span>
                    ) : null}
                    {isResolved ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        <CheckCircle2 size={9} /> Resolved
                      </span>
                    ) : null}
                  </div>

                  {!readOnly ? (
                    <div className="flex items-center gap-1">
                      {onToggleResolve ? (
                        <button
                          type="button"
                          onClick={() => onToggleResolve(remark.id)}
                          title={isResolved ? "Mark Unresolved" : "Mark Resolved"}
                          className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-emerald-600 dark:hover:bg-white/10"
                        >
                          <CheckCircle2 size={13} className={isResolved ? "text-emerald-600" : ""} />
                        </button>
                      ) : null}
                      {onDeleteRemark ? (
                        <button
                          type="button"
                          onClick={() => onDeleteRemark(remark.id)}
                          title="Delete Remark"
                          className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
                        >
                          <Trash2 size={12} />
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {/* Highlighted text snippet */}
                {remark.highlightedText ? (
                  <div className="mt-2 rounded-md border-l-2 border-amber-400 bg-amber-50/50 py-1 pl-2.5 pr-2 text-[11px] italic text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                    "{remark.highlightedText}"
                  </div>
                ) : null}

                {/* Remark Comment */}
                <p className="mt-2 text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                  {remark.comment}
                </p>

                {/* Footer Meta */}
                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">
                    {remark.authorName || "Principal"}
                  </span>
                  <span>
                    {remark.createdAt
                      ? new Date(remark.createdAt).toLocaleString("en-PH", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "—"}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
