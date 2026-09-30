"use client";

import { useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  CheckSquare,
  Clock,
  FileCheck,
  HelpCircle,
  Layers,
  MessageSquare,
  MessageSquarePlus,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  Target,
  Users,
  Clock,
  BookOpen,
  Layers,
  CheckSquare,
  Sparkles,
  FileCheck,
};

export default function LessonHeadingsAutoReview({
  sections = [],
  remarks = [],
  onAddRemarkForSection = null,
  reviewerName = "Principal",
}) {
  const [selectedSectionKey, setSelectedSectionKey] = useState("intentions");
  const [quickRemarkText, setQuickRemarkText] = useState("");
  const [quickRemarkSeverity, setQuickRemarkSeverity] = useState("Needs Revision");
  const [activeRemarkSection, setActiveRemarkSection] = useState(null);

  const activeSection = sections.find((s) => s.key === selectedSectionKey) || sections[0];

  function getRemarksForSection(sectionKey) {
    return remarks.filter((r) => r.sectionKey === sectionKey || (sectionKey === "flow" && r.sectionKey === "procedures"));
  }

  function handleSaveQuickRemark(e) {
    e.preventDefault();
    if (!quickRemarkText.trim() || !activeRemarkSection) return;

    onAddRemarkForSection?.({
      id: `remark-${Date.now()}`,
      sectionKey: activeRemarkSection.key,
      sectionTitle: activeRemarkSection.title,
      comment: quickRemarkText.trim(),
      severity: quickRemarkSeverity,
      reviewerName,
      createdAt: new Date().toISOString(),
      status: "open",
    });

    setQuickRemarkText("");
    setActiveRemarkSection(null);
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Left Sidebar: DepEd DLP Section Navigation */}
      <div className="space-y-1.5 lg:col-span-4">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            DepEd DLP Modules
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
            {sections.length} Sections
          </span>
        </div>

        <div className="space-y-1">
          {sections.map((sec) => {
            const IconComponent = ICONS[sec.icon] || BookOpen;
            const secRemarks = getRemarksForSection(sec.key);
            const isSelected = selectedSectionKey === sec.key;
            const hasNeedsRevision = secRemarks.some(
              (r) => r.severity === "Needs Revision" && r.status !== "resolved"
            );

            return (
              <button
                key={sec.key}
                type="button"
                onClick={() => setSelectedSectionKey(sec.key)}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between rounded-xl border p-2.5 text-left transition-all",
                  isSelected
                    ? "border-cnhs-green/40 bg-cnhs-green/5 shadow-sm ring-1 ring-cnhs-green/20 dark:bg-cnhs-green/10"
                    : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50 dark:border-white/5 dark:bg-[var(--card)] dark:hover:bg-white/5"
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
                      isSelected
                        ? "bg-cnhs-green text-white"
                        : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                    )}
                  >
                    <IconComponent size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "truncate text-xs font-semibold",
                        isSelected
                          ? "text-cnhs-green-dark dark:text-cnhs-green"
                          : "text-slate-700 dark:text-slate-200"
                      )}
                    >
                      {sec.title}
                    </p>
                    <p className="truncate text-[10px] text-slate-400">
                      {sec.subtitle}
                    </p>
                  </div>
                </div>

                <div className="ml-2 flex shrink-0 items-center gap-1.5">
                  {hasNeedsRevision ? (
                    <span className="flex h-5 items-center rounded bg-red-100 px-1.5 text-[10px] font-bold text-red-700 dark:bg-red-950/60 dark:text-red-300">
                      {secRemarks.length}
                    </span>
                  ) : secRemarks.length > 0 ? (
                    <span className="flex h-5 items-center rounded bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                      {secRemarks.length}
                    </span>
                  ) : (
                    <CheckCircle2 size={13} className="text-emerald-500 opacity-60" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Content: Detailed Section Viewer & Quick Remarking */}
      <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-[var(--card)] lg:col-span-8">
        {activeSection ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3 dark:border-white/5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-cnhs-green/10 px-2 py-0.5 text-[10px] font-bold text-cnhs-green-dark dark:text-cnhs-green">
                    {activeSection.badge || "DepEd DLP"}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {activeSection.title}
                  </h3>
                </div>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {activeSection.subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveRemarkSection(activeSection)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#246f54]"
              >
                <MessageSquarePlus size={13} />
                Add Remark
              </button>
            </div>

            {/* Inline Quick Remark Composer Modal/Card if active */}
            {activeRemarkSection?.key === activeSection.key ? (
              <form
                onSubmit={handleSaveQuickRemark}
                className="my-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/20"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Remark on: {activeSection.title}
                  </span>
                  <div className="flex gap-1">
                    {["Needs Revision", "Suggestion", "Commendation"].map((sev) => (
                      <button
                        key={sev}
                        type="button"
                        onClick={() => setQuickRemarkSeverity(sev)}
                        className={cn(
                          "cursor-pointer rounded-md px-2 py-0.5 text-[10px] font-bold transition",
                          quickRemarkSeverity === sev
                            ? sev === "Needs Revision"
                              ? "bg-red-600 text-white"
                              : sev === "Suggestion"
                              ? "bg-amber-600 text-white"
                              : "bg-emerald-600 text-white"
                            : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-white/10 dark:text-slate-300"
                        )}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  rows={2}
                  value={quickRemarkText}
                  onChange={(e) => setQuickRemarkText(e.target.value)}
                  placeholder={`Specify what needs revision or feedback in ${activeSection.title}...`}
                  className="w-full resize-none rounded-lg border border-amber-200 bg-white p-2 text-xs text-slate-800 outline-none focus:border-amber-500 dark:border-amber-900/50 dark:bg-black/30 dark:text-slate-100"
                  autoFocus
                />

                <div className="mt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveRemarkSection(null)}
                    className="rounded-lg px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!quickRemarkText.trim()}
                    className="cursor-pointer rounded-lg bg-cnhs-green-dark px-3 py-1 text-xs font-bold text-white shadow-sm disabled:opacity-50"
                  >
                    Save Section Remark
                  </button>
                </div>
              </form>
            ) : null}

            {/* Parsed Section Content */}
            <div className="my-3 min-h-[160px] flex-1 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 text-xs text-slate-700 dark:border-white/5 dark:bg-white/[0.02] dark:text-slate-300">
              <div
                className="prose prose-sm prose-slate max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: activeSection.content }}
              />
            </div>

            {/* Remarks Attached to this Section */}
            {getRemarksForSection(activeSection.key).length > 0 ? (
              <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-2.5 dark:border-white/5">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  Principal Remarks for this Section:
                </span>
                {getRemarksForSection(activeSection.key).map((rem) => (
                  <div
                    key={rem.id}
                    className="flex items-start gap-2 rounded-lg border border-slate-100 bg-white p-2 text-xs shadow-xs dark:border-white/5 dark:bg-white/5"
                  >
                    <MessageSquare size={13} className="mt-0.5 shrink-0 text-amber-600" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {rem.reviewerName || "Principal"}
                        </span>
                        <span
                          className={cn(
                            "rounded px-1 text-[9px] font-bold",
                            rem.severity === "Needs Revision"
                              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          )}
                        >
                          {rem.severity}
                        </span>
                      </div>
                      <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                        {rem.comment}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
