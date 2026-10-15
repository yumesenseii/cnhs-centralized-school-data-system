"use client";

import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { enrollTransfereeStudent } from "@/lib/eclass/enrollTransferee";

// 1. Simple, teacher-friendly status configurations
const STATUS_CONFIG = {
  MATCHED: {
    label: "Ready",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
    icon: CheckCircle2,
    iconClass: "text-cnhs-green",
  },
  NEEDS_VERIFICATION: {
    label: "Needs Checking",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    icon: AlertCircle,
    iconClass: "text-amber-600",
  },
  WRONG_SECTION: {
    label: "Different Section",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    icon: AlertCircle,
    iconClass: "text-amber-600",
  },
  UNMATCHED: {
    label: "Not Found in Class List",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
    icon: AlertCircle,
    iconClass: "text-amber-600",
  },
  DUPLICATE: {
    label: "Grade Already Exists",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
    icon: RefreshCw,
    iconClass: "text-slate-500",
  },
};

const ROWS_PER_PAGE = 10;

export default function EClassValidationWorkspace({
  validationResult,
  classItem,
  onConfirmImport,
  onBack,
  importing = false,
}) {
  const { sectionInfo, targetQuarter, validatedLearners: initialLearners } =
    validationResult;

  const [learners, setLearners] = useState(initialLearners);
  const [showTable, setShowTable] = useState(false);
  const [page, setPage] = useState(1);

  // Transferee enrollment modal states
  const [transfereeModal, setTransfereeModal] = useState({
    open: false,
    learner: null,
  });
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState("");

  // Ready learners (only those matched with official class list)
  const readyLearners = useMemo(() => {
    return learners.filter((l) => l.status === "MATCHED");
  }, [learners]);

  // Issue learners (learners that require teacher checking or are unlisted)
  const issueLearners = useMemo(() => {
    return learners.filter((l) => l.status !== "MATCHED");
  }, [learners]);

  const hasIssues = issueLearners.length > 0;

  // Pagination for 10 learners per page
  const totalPages = Math.max(1, Math.ceil(learners.length / ROWS_PER_PAGE));
  const pagedLearners = useMemo(() => {
    const start = (page - 1) * ROWS_PER_PAGE;
    return learners.slice(start, start + ROWS_PER_PAGE);
  }, [learners, page]);

  // Handle confirming a student as a transferee
  async function handleConfirmTransferee() {
    if (!transfereeModal.learner) return;
    const targetLearner = transfereeModal.learner;
    setEnrolling(true);
    setEnrollError("");

    try {
      const targetSectionId = sectionInfo.id || classItem.sectionId;
      const enrolled = await enrollTransfereeStudent({
        lrn: targetLearner.student_number,
        fullName: targetLearner.full_name,
        gender: targetLearner.gender,
        sectionId: targetSectionId,
      });

      // Update local learners state so student is instantly Ready
      setLearners((prev) =>
        prev.map((l) => {
          if (l.index === targetLearner.index) {
            return {
              ...l,
              status: "MATCHED",
              included: true,
              matchedStudent: {
                id: enrolled.id,
                student_number: enrolled.student_number,
                first_name: enrolled.first_name,
                middle_name: enrolled.middle_name,
                last_name: enrolled.last_name,
                section_id: enrolled.section_id,
              },
              validationMessage: "Enrolled as transferee in this class list.",
            };
          }
          return l;
        })
      );

      setTransfereeModal({ open: false, learner: null });
    } catch (err) {
      setEnrollError(err?.message || "Failed to enroll transferee student.");
    } finally {
      setEnrolling(false);
    }
  }

  return (
    <div className="flex flex-col h-full max-h-[85vh] text-slate-800">
      {/* 1. Simplified Header */}
      <div className="border-b border-slate-200 bg-white px-5 py-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-cnhs-green">
              Review Grade File
            </p>
            <h2 className="text-base font-bold text-slate-900 mt-0.5">
              {classItem.subject} &mdash; Grade {sectionInfo.gradeLevel} {sectionInfo.sectionName}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Quarter {targetQuarter} &bull; SY {classItem.schoolYear || sectionInfo.schoolYear || "2026-2027"}
            </p>
          </div>

          {showTable ? (
            <button
              type="button"
              onClick={() => setShowTable(false)}
              className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <ArrowLeft size={13} />
              <span>Back to Summary</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* 2. Main Content Body */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* Scenario 0: Section has 0 officially enrolled students */}
        {sectionInfo.officialRosterSize === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-950 shadow-2xs">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="font-bold text-amber-900 text-sm">
                  Class List Not Yet Enrolled
                </h3>
                <p className="text-amber-800 leading-relaxed text-xs">
                  Wala pang opisyal na mag-aaral sa class list ng seksyong ito (
                  <strong>
                    Grade {sectionInfo.gradeLevel} {sectionInfo.sectionName}
                  </strong>
                  ). Mangyaring ipagbigay-alam sa Class Adviser o School Admin na
                  i-upload muna ang opisyal na class list sa Advisory Section Hub
                  bago mai-link ang quarterly grades ng subject na ito.
                </p>
              </div>
            </div>
          </div>
        ) : showTable ? (
          /* Fixed 4-Column Table View: Learner (40%) | LRN (25%) | Grade (15%) | Status (20%) */
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                Showing{" "}
                <strong>
                  {(page - 1) * ROWS_PER_PAGE + 1}&ndash;
                  {Math.min(page * ROWS_PER_PAGE, learners.length)}
                </strong>{" "}
                of <strong>{learners.length}</strong> learners
              </span>
              {hasIssues ? (
                <span className="text-amber-700 font-semibold">
                  {issueLearners.length} issue{issueLearners.length === 1 ? "" : "s"} found
                </span>
              ) : (
                <span className="text-emerald-700 font-semibold">
                  All {learners.length} ready
                </span>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
              <table className="w-full table-fixed border-collapse text-left text-xs">
                <colgroup>
                  <col className="w-[40%]" />
                  <col className="w-[25%]" />
                  <col className="w-[15%]" />
                  <col className="w-[20%]" />
                </colgroup>
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Learner</th>
                    <th className="py-2.5 px-3">LRN</th>
                    <th className="py-2.5 px-3 text-center">Grade</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11.5px]">
                  {pagedLearners.map((item) => {
                    const config =
                      STATUS_CONFIG[item.status] || STATUS_CONFIG.UNMATCHED;
                    const Icon = config.icon;
                    const canEnrollAsTransferee =
                      item.status === "UNMATCHED" || item.status === "WRONG_SECTION";

                    return (
                      <tr
                        key={item.index}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        {/* Learner: 40% */}
                        <td
                          className="py-2.5 px-3 font-semibold text-slate-900 truncate"
                          title={item.full_name}
                        >
                          {item.full_name}
                        </td>

                        {/* LRN: 25% */}
                        <td
                          className="py-2.5 px-3 font-mono text-[11px] text-slate-600 truncate"
                          title={item.student_number || "—"}
                        >
                          {item.student_number || "—"}
                        </td>

                        {/* Grade: 15% */}
                        <td className="py-2.5 px-3 text-center font-bold text-slate-900 truncate">
                          {item.quarterly_grade !== null
                            ? item.quarterly_grade
                            : "—"}
                        </td>

                        {/* Status: 20% */}
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-semibold truncate max-w-full",
                                config.badgeClass
                              )}
                              title={config.label}
                            >
                              <Icon size={11} className={cn("shrink-0", config.iconClass)} />
                              <span className="truncate">{config.label}</span>
                            </span>

                            {canEnrollAsTransferee ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setEnrollError("");
                                  setTransfereeModal({ open: true, learner: item });
                                }}
                                className="inline-flex cursor-pointer items-center gap-1 text-[10.5px] font-semibold text-cnhs-green hover:underline"
                              >
                                <UserPlus size={11} />
                                <span>+ Isama Transferee</span>
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls (10 rows per page) */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft size={13} />
                  <span>Previous</span>
                </button>

                <span className="text-slate-500 font-medium">
                  Page {page} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                >
                  <span>Next</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>
        ) : hasIssues ? (
          /* Issue-First View: Only highlight problem learners first */
          <div className="space-y-4">
            {/* Warning Summary Banner */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-950 shadow-2xs">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-amber-900 text-sm">
                    {issueLearners.length}{" "}
                    {issueLearners.length === 1
                      ? "learner needs"
                      : "learners need"}{" "}
                    checking
                  </h3>
                  <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                    <strong>{readyLearners.length}</strong>{" "}
                    {readyLearners.length === 1 ? "learner is" : "learners are"}{" "}
                    ready. <strong>{issueLearners.length}</strong>{" "}
                    {issueLearners.length === 1
                      ? "learner was"
                      : "learners were"}{" "}
                    not matched with the class list.
                  </p>
                </div>
              </div>
            </div>

            {/* List of Issue Learners */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {issueLearners.length === 1
                    ? "Learner to Check"
                    : "Learners to Check"}
                </h4>
                <span className="text-xs text-slate-400">
                  {issueLearners.length} of {learners.length} total
                </span>
              </div>

              <div className="space-y-2">
                {issueLearners.map((item) => {
                  const config =
                    STATUS_CONFIG[item.status] || STATUS_CONFIG.UNMATCHED;
                  const Icon = config.icon;
                  const canEnrollAsTransferee =
                    item.status === "UNMATCHED" || item.status === "WRONG_SECTION";

                  return (
                    <div
                      key={item.index}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs"
                    >
                      <div className="min-w-0">
                        <p
                          className="font-bold text-slate-900 text-sm truncate"
                          title={item.full_name}
                        >
                          {item.full_name}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                          <span>
                            LRN:{" "}
                            <strong className="font-mono text-slate-700">
                              {item.student_number || "—"}
                            </strong>
                          </span>
                          {item.quarterly_grade !== null && (
                            <span>
                              Grade:{" "}
                              <strong className="text-slate-800">
                                {item.quarterly_grade}
                              </strong>
                            </span>
                          )}
                          {item.gender && (
                            <span className="text-slate-400">
                              ({item.gender})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="self-start sm:self-auto shrink-0 flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold",
                            config.badgeClass
                          )}
                        >
                          <Icon size={13} className={config.iconClass} />
                          <span>{config.label}</span>
                        </span>

                        {canEnrollAsTransferee ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEnrollError("");
                              setTransfereeModal({ open: true, learner: item });
                            }}
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors shadow-2xs"
                          >
                            <UserPlus size={12} className="text-cnhs-green" />
                            <span>Isama bilang Transferee</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Toggle to View All Learners */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  setShowTable(true);
                }}
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
              >
                <Eye size={14} className="text-slate-500" />
                <span>View All Learners ({learners.length})</span>
              </button>
            </div>
          </div>
        ) : (
          /* Calm Success State: When all learners are ready */
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-cnhs-green shadow-xs">
              <CheckCircle2 size={32} />
            </span>

            <h3 className="mt-4 text-base font-bold text-slate-900">
              File is ready
            </h3>

            <div className="mt-3 space-y-1 text-xs text-slate-600">
              <p>
                <strong>{learners.length}</strong> learners found
              </p>
              <p className="text-emerald-700 font-medium">
                <strong>{readyLearners.length}</strong> learners matched with the class list
              </p>
              <p className="text-slate-500">No issues found</p>
            </div>

            <button
              type="button"
              onClick={() => {
                setPage(1);
                setShowTable(true);
              }}
              className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <Eye size={14} className="text-slate-500" />
              <span>View Learners ({learners.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Fixed Stable Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3.5 shadow-xs">
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
              {readyLearners.length}{" "}
              {readyLearners.length === 1 ? "learner" : "learners"} ready to save
            </span>
            {issueLearners.length > 0 ? (
              <p className="text-[10px] text-amber-700">
                {issueLearners.length} unverified learner
                {issueLearners.length === 1 ? " is" : "s are"} excluded
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => onConfirmImport(readyLearners)}
            disabled={readyLearners.length === 0 || importing}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-cnhs-green-dark px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-[#1b5842] active:bg-[#144332] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {importing ? <Loader2 size={14} className="animate-spin" /> : null}
            <span>
              {importing
                ? "Saving Grades..."
                : `Confirm ${readyLearners.length} Grades`}
            </span>
          </button>
        </div>
      </div>

      {/* 4. Transferee Confirmation Modal */}
      {transfereeModal.open && transfereeModal.learner ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]"
            onClick={() => {
              if (!enrolling) setTransfereeModal({ open: false, learner: null });
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-2xl transition-all"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-cnhs-green shadow-xs">
                <UserPlus size={20} />
              </span>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Isama bilang Transferee
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Idagdag ang mag-aaral na ito sa opisyal na class list ng klase.
                </p>
              </div>
            </div>

            {/* Details Card */}
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs space-y-1.5">
              <div>
                <span className="text-slate-400">Pangalan ng Mag-aaral:</span>
                <p className="font-bold text-slate-900 text-[13px]">
                  {transfereeModal.learner.full_name}
                </p>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                <span className="text-slate-500">LRN:</span>
                <strong className="font-mono text-slate-800">
                  {transfereeModal.learner.student_number || "Walang LRN"}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Target na Seksyon:</span>
                <strong className="text-slate-800">
                  Grade {sectionInfo.gradeLevel} &mdash; {sectionInfo.sectionName}
                </strong>
              </div>
              {transfereeModal.learner.quarterly_grade !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Marka sa E-Record:</span>
                  <strong className="text-cnhs-green font-bold">
                    {transfereeModal.learner.quarterly_grade}
                  </strong>
                </div>
              )}
            </div>

            <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
              Awtomatikong irerehistro ang mag-aaral sa database upang mai-link at
              mai-save ang kanyang mga marka kasabay ng buong klase.
            </p>

            {enrollError ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-600">
                {enrollError}
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={enrolling}
                onClick={() => setTransfereeModal({ open: false, learner: null })}
                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={enrolling}
                onClick={handleConfirmTransferee}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-[#1b5842] active:bg-[#144332] disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
              >
                {enrolling ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <UserPlus size={13} />
                )}
                <span>{enrolling ? "Nirerehistro..." : "Kumpirmahin at Isama"}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
