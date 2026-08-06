"use client";

import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import ClassReportFilesTable from "@/components/teacher/monitoring/ClassReportFilesTable";
import ClassReportFileModal from "@/components/teacher/monitoring/ClassReportFileModal";
import TablePagination from "@/components/academic-records/TablePagination";
import { ARAL_APPROVAL_DB } from "@/lib/monitoring/aralApproval";
import { buildClassReportFiles } from "@/lib/monitoring/classReportFiles";
import { reviewClassReportForHt } from "@/lib/supabase/queries/aralApprovals";
import { getAdminSession } from "@/lib/supabase/queries/adminAuth";

const FILES_PAGE_SIZE = 10;

/**
 * HT/Admin inbox: class report files with submitted ARAL recommendations.
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

  const files = useMemo(() => {
    const all = buildClassReportFiles({
      students,
      classSummaries,
      teacherName: "Teacher",
    });
    return all.filter(
      (f) =>
        f.aralEligible &&
        f.htMeta?.aralCount > 0 &&
        (f.htMeta.submittedCount > 0 ||
          f.htMeta.approvedCount > 0 ||
          f.htMeta.returnedCount > 0)
    );
  }, [students, classSummaries]);

  useEffect(() => {
    setPage(1);
  }, [files]);

  const totalPages = Math.max(1, Math.ceil(files.length / FILES_PAGE_SIZE) || 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pagedFiles = useMemo(() => {
    const start = (safePage - 1) * FILES_PAGE_SIZE;
    return files.slice(start, start + FILES_PAGE_SIZE);
  }, [files, safePage]);

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
    onChanged?.();
  }

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
          <p className="mt-0.5 text-[12px] text-slate-500">
            Files teachers sent for HT review. Open Passing / Failing tabs, then
            Approve or Return.
          </p>
        </div>
        {reviewing ? (
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
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
          No submitted class report files yet.
        </p>
      ) : (
        <div className="space-y-2">
          <ClassReportFilesTable
            files={pagedFiles}
            totalCount={files.length}
            showHtActions={false}
            onView={(f) => setModalFile(f)}
            onEdit={(f) => setModalFile(f)}
          />
          <TablePagination
            page={safePage}
            pageSize={FILES_PAGE_SIZE}
            total={files.length}
            onPageChange={setPage}
          />
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
