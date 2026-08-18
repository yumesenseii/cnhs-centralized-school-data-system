"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import ClassReportFilesTable from "@/components/teacher/monitoring/ClassReportFilesTable";
import ClassReportFileModal from "@/components/teacher/monitoring/ClassReportFileModal";
import TablePagination from "@/components/academic-records/TablePagination";
import {
  ARAL_APPROVAL_DB,
  ARAL_APPROVAL_STATUS,
  attachAralApprovals,
} from "@/lib/monitoring/aralApproval";
import { buildHtReceivedClassReportFiles } from "@/lib/monitoring/classReportFiles";
import {
  listAralApprovals,
  reviewClassReportForHt,
} from "@/lib/supabase/queries/aralApprovals";
import { getAdminSession } from "@/lib/supabase/queries/adminAuth";
import { cn } from "@/lib/utils";

const FILES_PAGE_SIZE = 10;

const HT_STATUS_FILTERS = [
  { id: "all", label: "All", match: null },
  {
    id: "submitted",
    label: "For review",
    match: ARAL_APPROVAL_STATUS.SUBMITTED,
  },
  {
    id: "approved",
    label: "Approved",
    match: ARAL_APPROVAL_STATUS.APPROVED,
  },
  {
    id: "returned",
    label: "Returned",
    match: ARAL_APPROVAL_STATUS.RETURNED,
  },
];

/**
 * HT/Admin inbox: class report files with submitted ARAL recommendations.
 * Loads approvals fresh (not roster-cache) and builds files from approval terms.
 */
export default function AdminClassReportFilesPanel({
  students = [],
  classSummaries = [],
  onChanged,
}) {
  const [modalFile, setModalFile] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [htFilter, setHtFilter] = useState("all");
  const [enrichedStudents, setEnrichedStudents] = useState(students);
  const [approvalsLoading, setApprovalsLoading] = useState(false);

  const schoolYearHint = useMemo(() => {
    return (
      classSummaries[0]?.schoolYear ||
      students[0]?.schoolYear ||
      null
    );
  }, [classSummaries, students]);

  const refreshApprovals = useCallback(async () => {
    setApprovalsLoading(true);
    try {
      // No quarter filter — Term 1 sends must appear even if page filter is All Terms.
      const approvals = await listAralApprovals({
        schoolYear: schoolYearHint,
        quarter: null,
      });
      setEnrichedStudents(
        attachAralApprovals(students, approvals.data ?? new Map())
      );
    } catch (err) {
      console.warn("[admin] approval refresh failed", err);
      setEnrichedStudents(students);
    } finally {
      setApprovalsLoading(false);
    }
  }, [students, schoolYearHint]);

  useEffect(() => {
    refreshApprovals();
  }, [refreshApprovals]);

  const files = useMemo(
    () =>
      buildHtReceivedClassReportFiles({
        students: enrichedStudents,
        classSummaries,
        teacherName: "Teacher",
      }),
    [enrichedStudents, classSummaries]
  );

  const statusCounts = useMemo(() => {
    let submitted = 0;
    let approved = 0;
    let returned = 0;
    for (const file of files) {
      if (file.htStatus === ARAL_APPROVAL_STATUS.SUBMITTED) submitted += 1;
      else if (file.htStatus === ARAL_APPROVAL_STATUS.APPROVED) approved += 1;
      else if (file.htStatus === ARAL_APPROVAL_STATUS.RETURNED) returned += 1;
    }
    return {
      all: files.length,
      submitted,
      approved,
      returned,
    };
  }, [files]);

  const filteredFiles = useMemo(() => {
    const active = HT_STATUS_FILTERS.find((f) => f.id === htFilter);
    if (!active?.match) return files;
    return files.filter((file) => file.htStatus === active.match);
  }, [files, htFilter]);

  useEffect(() => {
    setPage(1);
  }, [files, htFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredFiles.length / FILES_PAGE_SIZE) || 1
  );
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pagedFiles = useMemo(() => {
    const start = (safePage - 1) * FILES_PAGE_SIZE;
    return filteredFiles.slice(start, start + FILES_PAGE_SIZE);
  }, [filteredFiles, safePage]);

  async function runReview(file, status, note) {
    setReviewing(true);
    setError("");
    setToast("");
    const session = await getAdminSession();
    const result = await reviewClassReportForHt({
      learners: file.learners,
      status,
      reviewNote: note || null,
      profileId: session.data?.id ?? null,
    });
    setReviewing(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setToast(
      status === ARAL_APPROVAL_DB.APPROVED
        ? `Approved ARAL recommendations in “${file.fileName}”.`
        : `Returned “${file.fileName}” to the teacher.`
    );
    setModalFile(null);
    await refreshApprovals();
    onChanged?.();
  }

  const emptyFilterLabel =
    HT_STATUS_FILTERS.find((f) => f.id === htFilter)?.label?.toLowerCase() ??
    "matching";

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-cnhs-green-dark" />
            <h2 className="text-sm font-semibold text-slate-900">
              Received class report files
            </h2>
          </div>
        </div>
        {reviewing || approvalsLoading ? (
          <Loader2 size={16} className="animate-spin text-slate-400" />
        ) : null}
      </div>

      {error ? (
        <p className="mb-2 text-[12px] font-medium text-red-600">{error}</p>
      ) : null}
      {toast ? (
        <p className="mb-2 text-[12px] font-medium text-cnhs-green-dark">
          {toast}
        </p>
      ) : null}

      {files.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
          <p>No submitted class report files yet.</p>
          <p className="mt-2 text-[12px] text-slate-400">
            After a teacher clicks Send to HT on an Eng/Fil class report, it
            appears here. If you expect a file: set School Year correctly, use
            All Terms (or the term they sent), then Refresh.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className="flex flex-wrap gap-1.5"
            role="tablist"
            aria-label="Filter by HT status"
          >
            {HT_STATUS_FILTERS.map((pill) => {
              const active = htFilter === pill.id;
              const count = statusCounts[pill.id] ?? 0;
              return (
                <button
                  key={pill.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setHtFilter(pill.id)}
                  className={cn(
                    "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold transition-colors",
                    active
                      ? "bg-cnhs-green-dark text-white"
                      : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  )}
                >
                  {pill.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                      active
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-500"
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {filteredFiles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              No {emptyFilterLabel} class reports.
            </div>
          ) : (
            <div className="space-y-2">
              <ClassReportFilesTable
                files={pagedFiles}
                totalCount={filteredFiles.length}
                showHtActions={false}
                onView={(f) => setModalFile(f)}
                onEdit={(f) => setModalFile(f)}
              />
              <TablePagination
                page={safePage}
                pageSize={FILES_PAGE_SIZE}
                total={filteredFiles.length}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      )}

      {modalFile ? (
        <ClassReportFileModal
          file={modalFile}
          mode="view"
          onClose={() => setModalFile(null)}
          showHtActions={false}
          showHtReview
          reviewing={reviewing}
          onApprove={(f, note) =>
            runReview(f, ARAL_APPROVAL_DB.APPROVED, note)
          }
          onReturn={(f, note) =>
            runReview(f, ARAL_APPROVAL_DB.RETURNED, note)
          }
        />
      ) : null}
    </section>
  );
}
