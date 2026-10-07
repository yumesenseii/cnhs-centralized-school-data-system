"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import AnimatedModal from "@/components/shared/AnimatedModal";
import AppSelect from "@/components/shared/AppSelect";
import LearnerName from "@/components/shared/LearnerName";
import { RiskPill } from "@/components/teacher/monitoring/shared";
import {
  READING_CONCERN_OPTIONS,
  buildReadingReviewSummary,
  reviewReasonLabel,
} from "@/lib/monitoring/readingReviewSummary";
import { cn } from "@/lib/utils";

const DECISION_OPTIONS = [
  { id: "confirmed", label: "Reading concern confirmed" },
  { id: "not_reading", label: "Not related to reading" },
  { id: "needs_review", label: "Review learner individually" },
];

function rowInitials(row) {
  const parts = [row.firstName, row.lastName].filter(Boolean);
  if (parts.length) {
    return parts
      .map((w) => String(w).trim()[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return String(row.name || "?")
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/**
 * Centered wide teacher-review modal for system-recommended learners.
 * Review only — never submits ARAL referrals.
 */
export default function ReviewRecommendedModal({
  open,
  onClose,
  recommended = [],
  termLabel = "",
  onApply,
}) {
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [query, setQuery] = useState("");
  const [decision, setDecision] = useState("confirmed");
  const [concern, setConcern] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelectedKeys(new Set(recommended.map((item) => item.key)));
    setQuery("");
    setDecision("confirmed");
    setConcern("");
    setNote("");
  }, [open, recommended]);

  const rowsByKey = useMemo(() => {
    const map = new Map();
    for (const item of recommended) map.set(item.key, item);
    return map;
  }, [recommended]);

  const selectedItems = useMemo(
    () =>
      [...selectedKeys]
        .map((key) => rowsByKey.get(key))
        .filter(Boolean),
    [selectedKeys, rowsByKey]
  );

  const summary = useMemo(
    () =>
      buildReadingReviewSummary(
        selectedItems.map((item) => item.row),
        { termLabel }
      ),
    [selectedItems, termLabel]
  );

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return selectedItems;
    return selectedItems.filter((item) => {
      const row = item.row;
      return (
        row.name?.toLowerCase().includes(q) ||
        row.studentNumber?.toLowerCase().includes(q) ||
        row.section?.toLowerCase().includes(q)
      );
    });
  }, [selectedItems, query]);

  function removeLearner(key) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  const selectedCount = selectedItems.length;
  const canApply =
    selectedCount > 0 && (decision !== "confirmed" || concern !== "");

  function handleApply() {
    if (!canApply) return;
    onApply?.({
      keys: [...selectedKeys],
      decision,
      concern: decision === "confirmed" ? concern : "",
      note: decision === "confirmed" ? note.trim() : "",
    });
  }

  // Reason grid always fills the modal width — columns match card count.
  const reasonGridCols =
    summary.reasonCounts.length <= 1
      ? "grid-cols-1"
      : summary.reasonCounts.length === 3
        ? "grid-cols-2 sm:grid-cols-3"
        : summary.reasonCounts.length >= 4
          ? "grid-cols-2 sm:grid-cols-4"
          : "grid-cols-2";

  const chips = [
    { label: "English", count: summary.englishCount, tone: "bg-sky-50 text-sky-700 ring-sky-200/60" },
    { label: "Filipino", count: summary.filipinoCount, tone: "bg-violet-50 text-violet-700 ring-violet-200/60" },
    { label: "Performance Declined", count: summary.decliningCount, tone: "bg-amber-50 text-amber-800 ring-amber-200/60" },
  ].filter((chip) => chip.count > 0);

  return (
    <AnimatedModal
      open={open}
      onClose={onClose}
      labelledBy="review-recommended-title"
      zClassName="z-[70]"
      className="bg-slate-900/50"
      panelClassName="flex max-h-[80vh] w-[calc(100vw-64px)] max-w-[1250px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_64px_-12px_rgba(15,23,42,0.35)]"
    >
      {/* HEADER */}
      <div className="shrink-0 border-b border-slate-200 px-5 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2
              id="review-recommended-title"
              className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap"
            >
              Review Recommended Learners
            </h2>
            <p className="mt-0.5 truncate text-[12px] text-slate-500">
              These learners may need closer reading support. Review the group
              before choosing what to do next.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {chips.length ? (
              <div className="flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5">
                {chips.map((chip) => (
                  <span
                    key={chip.label}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 whitespace-nowrap",
                      chip.tone
                    )}
                  >
                    {chip.label}
                    <span className="font-bold tabular-nums">{chip.count}</span>
                  </span>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close review"
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 cursor-pointer shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* WHY THEY NEED REVIEW */}
      {summary.reasonCounts.length ? (
        <div className="shrink-0 border-b border-slate-100 bg-slate-50/60 px-5 sm:px-6 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Why they need review
          </p>
          <div className={cn("mt-1.5 grid gap-2", reasonGridCols)}>
            {summary.reasonCounts.map((item) => (
              <div
                key={item.code}
                title={item.label}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-xs"
              >
                <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {item.label}
                </p>
                <p className="mt-0.5 text-lg font-bold leading-none tabular-nums tracking-tight text-slate-900">
                  {item.count}
                  <span className="ml-1.5 text-[10px] font-medium text-slate-400">
                    learner{item.count === 1 ? "" : "s"}
                  </span>
                </p>
              </div>
            ))}
          </div>
          <p className="mt-1.5 truncate text-[11px] text-slate-400" title="These learners are for teacher review only. They are not automatically placed in ARAL.">
            These learners are for teacher review only. They are not
            automatically placed in ARAL.
          </p>
        </div>
      ) : null}

      {/* MAIN TWO-COLUMN AREA */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden p-5 sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* LEFT: Teacher Decision */}
        <div className="min-h-0 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Teacher Decision
          </p>
          <div className="mt-2.5 space-y-1.5" role="radiogroup" aria-label="Teacher decision">
            {DECISION_OPTIONS.map((option) => {
              const active = decision === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setDecision(option.id)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[12px] font-semibold transition",
                    active
                      ? "border-cnhs-green-dark/60 bg-cnhs-green-soft/30 text-cnhs-green-dark"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                      active ? "border-cnhs-green-dark" : "border-slate-300"
                    )}
                  >
                    {active ? (
                      <span className="h-2 w-2 rounded-full bg-cnhs-green-dark" />
                    ) : null}
                  </span>
                  {option.label}
                </button>
              );
            })}
          </div>

          {decision === "confirmed" ? (
            <div className="mt-3 space-y-2.5 border-t border-slate-100 pt-3">
              <div className="block">
                <span className="mb-1 block text-[11px] font-semibold text-slate-600">
                  Main concern
                </span>
                <AppSelect
                  label="Main concern"
                  value={concern}
                  onChange={setConcern}
                  placeholder="Select concern"
                  options={[
                    { value: "", label: "Select concern" },
                    ...READING_CONCERN_OPTIONS.map((item) => ({
                      value: item,
                      label: item,
                    })),
                  ]}
                  triggerClassName="h-9 text-[12px]"
                />
              </div>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-slate-600">
                  Teacher note <span className="font-normal text-slate-400">(optional)</span>
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Optional note saved with the referral…"
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-cnhs-green"
                />
              </label>
            </div>
          ) : (
            <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] leading-4 text-slate-400">
              {decision === "not_reading"
                ? "These learners stay in Academic Monitoring for class remedial or continued support."
                : "The first learner opens in the detailed learner profile after applying."}
            </p>
          )}
        </div>

        {/* RIGHT: Selected Learners */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="shrink-0 border-b border-slate-100 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Selected Learners{" "}
              <span className="font-bold tabular-nums text-slate-800">
                ({selectedCount})
              </span>
            </p>
            <div className="relative mt-2">
              <Search
                size={13}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search selected learners…"
                className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-8 pr-2.5 text-[12px] outline-none placeholder:text-slate-400 focus:border-cnhs-green focus:bg-white"
              />
            </div>
          </div>
          <ul className="grid min-h-0 flex-1 content-start gap-2 overflow-y-auto bg-slate-50/50 p-2.5 xl:grid-cols-2">
            {visibleItems.length ? (
              visibleItems.map((item) => {
                const row = item.row;
                const grade = row.classSubjectGrade ?? row.currentGrade ?? "—";
                return (
                  <li
                    key={item.key}
                    className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-xs"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
                      {String(row.name || "?")
                        .split(/[\s,]+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold text-slate-900">
                        <LearnerName
                          firstName={row.firstName}
                          middleName={row.middleName}
                          lastName={row.lastName}
                          name={row.name}
                        />
                      </p>
                      <p className="truncate text-[10.5px] text-slate-500">
                        {row.grade} · {row.section} · {row.subject} · {grade}
                      </p>
                      <p className="mt-0.5 truncate text-[10.5px] text-amber-700">
                        {item.reasons.map(reviewReasonLabel).slice(0, 2).join(" • ")}
                        {item.reasons.length > 2 ? ` • +${item.reasons.length - 2} more` : ""}
                      </p>
                    </div>
                    <span className="shrink-0">
                      <RiskPill value={row.riskLevel || row.academicRisk || "—"} />
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLearner(item.key)}
                      aria-label={`Remove ${row.name || "learner"} from review`}
                      title="Remove from review"
                      className="shrink-0 rounded-lg p-1.5 text-slate-300 transition hover:bg-red-50 hover:text-red-600 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </li>
                );
              })
            ) : (
              <li className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-[12px] text-slate-400 xl:col-span-2">
                {selectedCount === 0
                  ? "All learners removed. Close and reopen to start over."
                  : "No learners match your search."}
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white px-5 sm:px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-[12px] text-slate-500">
          <strong className="font-bold text-slate-900">{selectedCount}</strong>{" "}
          learner{selectedCount === 1 ? "" : "s"} selected
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!canApply}
            className="h-10 cursor-pointer rounded-xl bg-cnhs-green-dark px-4 text-xs font-semibold text-white transition hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply to {selectedCount} Learner{selectedCount === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
}
