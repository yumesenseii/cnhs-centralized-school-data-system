"use client";

import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  HelpCircle,
  Info,
  Loader2,
  RefreshCw,
  School,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const statusBadges = {
  MATCHED: {
    label: "Matched",
    classes: "bg-emerald-50 text-emerald-800 border-emerald-200",
    icon: CheckCircle2,
    iconClass: "text-cnhs-green",
  },
  NEEDS_VERIFICATION: {
    label: "Needs Verification",
    classes: "bg-amber-50 text-amber-800 border-amber-200",
    icon: AlertCircle,
    iconClass: "text-amber-600",
  },
  WRONG_SECTION: {
    label: "Wrong Section",
    classes: "bg-rose-50 text-rose-800 border-rose-200",
    icon: XCircle,
    iconClass: "text-rose-600",
  },
  UNMATCHED: {
    label: "Unmatched",
    classes: "bg-slate-100 text-slate-700 border-slate-200",
    icon: HelpCircle,
    iconClass: "text-slate-500",
  },
  DUPLICATE: {
    label: "Duplicate Grade",
    classes: "bg-blue-50 text-blue-800 border-blue-200",
    icon: RefreshCw,
    iconClass: "text-blue-600",
  },
};

export default function EClassValidationWorkspace({
  validationResult,
  classItem,
  onConfirmImport,
  onBack,
  importing = false,
}) {
  const { sectionInfo, targetQuarter, summary, validatedLearners: initialLearners } =
    validationResult;

  const [learners, setLearners] = useState(initialLearners);
  const [activeFilter, setActiveFilter] = useState("ALL"); // 'ALL' | 'MATCHED' | 'NEEDS_VERIFICATION' | 'WRONG_SECTION' | 'UNMATCHED' | 'DUPLICATE'

  // Toggle selection for a single learner
  const handleToggleInclude = (index) => {
    setLearners((prev) =>
      prev.map((l) => {
        if (l.index === index) {
          // Do not allow checking WRONG_SECTION or UNMATCHED (upholding rule 6 & 7)
          if (!l.matchedStudent?.id && (l.status === "WRONG_SECTION" || l.status === "UNMATCHED")) {
            return l;
          }
          return { ...l, included: !l.included };
        }
        return l;
      })
    );
  };

  // Toggle select all valid learners
  const handleToggleSelectAll = (selectAll) => {
    setLearners((prev) =>
      prev.map((l) => {
        if (l.status === "WRONG_SECTION" || l.status === "UNMATCHED" || !l.matchedStudent?.id) {
          return { ...l, included: false };
        }
        return { ...l, included: selectAll };
      })
    );
  };

  const filteredLearners = useMemo(() => {
    if (activeFilter === "ALL") return learners;
    return learners.filter((l) => l.status === activeFilter);
  }, [learners, activeFilter]);

  const selectedCount = learners.filter((l) => l.included).length;
  const canImport = selectedCount > 0 && !importing;

  const allEligibleCount = learners.filter(
    (l) => l.matchedStudent?.id && l.status !== "WRONG_SECTION" && l.status !== "UNMATCHED"
  ).length;
  const isAllSelected = allEligibleCount > 0 && selectedCount === allEligibleCount;

  return (
    <div className="flex flex-col h-full max-h-[85vh] text-slate-800">
      {/* 1. Header Information Bar */}
      <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-cnhs-green dark:text-emerald-400">
                Centralized Roster Validation
              </span>
              <span>&bull;</span>
              <span>SY {classItem.schoolYear || sectionInfo.schoolYear || "2026-2027"}</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-0.5">
              {classItem.subject} &mdash; Grade {sectionInfo.gradeLevel}, {sectionInfo.sectionName}
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
              <School size={12} className="text-slate-400" />
              <span>
                Official Class Adviser: <strong>{sectionInfo.adviserName}</strong> ({sectionInfo.officialRosterSize} learners on file)
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-slate-600 font-semibold shadow-2xs">
              Target Term: Quarter {targetQuarter}
            </span>
          </div>
        </div>

        {/* 2. Filter Tab Pills */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200/80">
          {[
            { id: "ALL", label: "All Rows", count: summary.total },
            {
              id: "MATCHED",
              label: "Matched",
              count: summary.matchedCount,
              tone: "text-emerald-700 bg-emerald-50 border-emerald-200",
            },
            {
              id: "NEEDS_VERIFICATION",
              label: "Needs Verification",
              count: summary.needsVerificationCount,
              tone: "text-amber-700 bg-amber-50 border-amber-200",
            },
            {
              id: "WRONG_SECTION",
              label: "Wrong Section",
              count: summary.wrongSectionCount,
              tone: "text-rose-700 bg-rose-50 border-rose-200",
            },
            {
              id: "UNMATCHED",
              label: "Unmatched",
              count: summary.unmatchedCount,
              tone: "text-slate-700 bg-slate-100 border-slate-200",
            },
            {
              id: "DUPLICATE",
              label: "Duplicate Grade",
              count: summary.duplicateCount,
              tone: "text-blue-700 bg-blue-50 border-blue-200",
            },
          ].map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer",
                  isActive
                    ? "border-cnhs-green bg-cnhs-green text-white shadow-2xs"
                    : tab.tone || "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-white text-slate-700 shadow-2xs"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Discrepancy Notice Banner if wrong section or unverified rows exist */}
      {(summary.wrongSectionCount > 0 || summary.unmatchedCount > 0) && (
        <div className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-xs text-amber-900 flex items-start gap-2">
          <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold">Section Membership Notice:</span>{" "}
            {summary.wrongSectionCount > 0
              ? `${summary.wrongSectionCount} learner(s) belong to another section in CNHS Learn. `
              : ""}
            {summary.unmatchedCount > 0
              ? `${summary.unmatchedCount} learner(s) have no enrollment record in the centralized student master. `
              : ""}
            These rows are excluded by default to preserve official section integrity.
          </div>
        </div>
      )}

      {/* 3. Validation Review Table */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600 text-[11px] font-semibold border-b border-slate-200">
            <tr>
              <th className="py-2 px-2 w-8 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={(e) => handleToggleSelectAll(e.target.checked)}
                  aria-label="Select all eligible rows"
                  className="rounded border-slate-300 text-cnhs-green focus:ring-cnhs-green cursor-pointer"
                />
              </th>
              <th className="py-2 px-2 w-10 text-center">#</th>
              <th className="py-2 px-2.5">LRN</th>
              <th className="py-2 px-2.5">Learner Name (E-Record)</th>
              <th className="py-2 px-2.5">Centralized Roster Match</th>
              <th className="py-2 px-2 text-center">Grade</th>
              <th className="py-2 px-2.5 text-center">Validation Status</th>
              <th className="py-2 px-3">Remarks / Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[11.5px]">
            {filteredLearners.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                  No learners found in this category.
                </td>
              </tr>
            ) : (
              filteredLearners.map((item) => {
                const badge = statusBadges[item.status] || statusBadges.UNMATCHED;
                const BadgeIcon = badge.icon;
                const canCheck =
                  Boolean(item.matchedStudent?.id) &&
                  item.status !== "WRONG_SECTION" &&
                  item.status !== "UNMATCHED";

                return (
                  <tr
                    key={item.index}
                    className={cn(
                      "transition-colors",
                      item.included
                        ? "bg-white hover:bg-slate-50"
                        : "bg-slate-50/40 text-slate-400 hover:bg-slate-50"
                    )}
                  >
                    <td className="py-2 px-2 text-center">
                      <input
                        type="checkbox"
                        checked={item.included}
                        disabled={!canCheck}
                        onChange={() => handleToggleInclude(item.index)}
                        className="rounded border-slate-300 text-cnhs-green focus:ring-cnhs-green cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                      />
                    </td>
                    <td className="py-2 px-2 text-center font-mono text-[11px] text-slate-400">
                      {item.index}
                    </td>
                    <td className="py-2 px-2.5 font-mono text-[11px] text-slate-700">
                      {item.student_number || "—"}
                    </td>
                    <td className="py-2 px-2.5 font-semibold text-slate-900">
                      {item.full_name}
                      {item.gender ? (
                        <span className="ml-1.5 text-[10px] text-slate-400 font-normal">
                          ({item.gender})
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 px-2.5">
                      {item.matchedStudent ? (
                        <div>
                          <span className="font-semibold text-slate-800">
                            {item.matchedStudent.last_name}, {item.matchedStudent.first_name}
                          </span>
                          <div className="text-[10px] text-slate-500">
                            {item.status === "WRONG_SECTION" ? (
                              <span className="text-rose-700 font-medium">
                                Enrolled in: Grade {item.matchedStudent.grade_level} &mdash; {item.matchedStudent.section_name}
                              </span>
                            ) : (
                              <span>
                                Grade {sectionInfo.gradeLevel} &mdash; {sectionInfo.sectionName} (Official)
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Not found in system</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center font-bold text-slate-900">
                      {item.quarterly_grade !== null ? item.quarterly_grade : "—"}
                    </td>
                    <td className="py-2 px-2.5 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap",
                          badge.classes
                        )}
                      >
                        <BadgeIcon size={11} className={badge.iconClass} />
                        <span>{badge.label}</span>
                      </span>
                    </td>
                    <td className="py-2 px-3 text-[11px] text-slate-600 leading-snug">
                      {item.validationMessage}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Action Bar Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 shadow-xs">
        <button
          type="button"
          onClick={onBack}
          disabled={importing}
          className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowLeft size={13} />
          <span>Upload Another File</span>
        </button>

        <div className="flex items-center justify-end gap-3">
          <div className="text-right text-xs">
            <span className="font-semibold text-slate-800">
              {selectedCount} of {summary.total} learners selected
            </span>
            <p className="text-[10px] text-slate-400">
              Only checked, verified learners will be persisted.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onConfirmImport(learners.filter((l) => l.included))}
            disabled={!canImport}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-cnhs-green px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-[#115a3e] active:bg-[#0c432e] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {importing ? <Loader2 size={14} className="animate-spin" /> : null}
            <span>{importing ? "Importing Records..." : `Confirm & Import (${selectedCount} Learners)`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
