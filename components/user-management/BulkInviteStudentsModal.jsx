"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import AnimatedModal from "@/components/shared/AnimatedModal";
import { AnimatedBanner } from "@/components/shared/AnimatedFeedback";
import {
  STUDENT_INVITE_BULK_MAX,
  downloadStudentInviteTemplate,
  parseStudentInviteCsv,
} from "@/lib/supabase/queries/studentAccounts";

export default function BulkInviteStudentsModal({
  open,
  onClose,
  onSubmit,
}) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [parseError, setParseError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!open) return;
    setFileName("");
    setRows([]);
    setParseError("");
    setError("");
    setSummary(null);
    setSaving(false);
  }, [open]);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setParseError("");
    setError("");
    setSummary(null);
    setFileName(file.name);

    try {
      const text = await file.text();
      const parsed = parseStudentInviteCsv(text);
      if (parsed.error) {
        setRows([]);
        setParseError(parsed.error.message);
        return;
      }
      setRows(parsed.rows);
    } catch (err) {
      setRows([]);
      setParseError(err?.message || "Unable to read CSV file.");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!rows.length) {
      setError("Upload a valid CSV first.");
      return;
    }

    setSaving(true);
    setError("");
    const result = await onSubmit?.(rows);
    setSaving(false);

    if (result?.error) {
      setError(result.error.message || "Bulk invite failed.");
      return;
    }

    setSummary(result?.data ?? null);
  }

  return (
    <AnimatedModal
      open={open}
      onClose={saving ? undefined : onClose}
      labelledBy="bulk-invite-students-title"
      zClassName="z-[60]"
      closeOnBackdrop={!saving}
      closeOnEscape={!saving}
      className="bg-slate-900/40"
      panelClassName="w-full max-w-[640px] overflow-hidden rounded-lg bg-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]"
    >
      <div className="border-b border-slate-100 px-4 py-3.5">
        <h2
          id="bulk-invite-students-title"
          className="text-lg font-semibold tracking-[-0.02em] text-slate-900"
        >
          Bulk invite students
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Upload CSV with <code className="text-[11px]">student_number</code>,{" "}
          <code className="text-[11px]">email</code>, optional{" "}
          <code className="text-[11px]">name</code>. Max {STUDENT_INVITE_BULK_MAX}{" "}
          rows per upload. Emails come from the school contact list — ECR has no
          email. Students cannot self-register.
        </p>
      </div>

      <div className="space-y-3 px-4 py-3.5">
        {error ? <AnimatedBanner message={error} tone="error" /> : null}
        {parseError ? <AnimatedBanner message={parseError} tone="error" /> : null}

        {summary ? (
          <>
            <AnimatedBanner
              message={`Created ${summary.summary?.created ?? 0} · Skipped ${summary.summary?.skipped ?? 0} · Failed ${summary.summary?.failed ?? 0}`}
              tone="success"
            />
            <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-100">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="px-2 py-1.5 font-semibold text-slate-500">LRN</th>
                    <th className="px-2 py-1.5 font-semibold text-slate-500">Email</th>
                    <th className="px-2 py-1.5 font-semibold text-slate-500">Status</th>
                    <th className="px-2 py-1.5 font-semibold text-slate-500">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary.results ?? []).map((row, index) => (
                    <tr key={`${row.studentNumber}-${index}`} className="border-t border-slate-50">
                      <td className="px-2 py-1.5 font-mono">{row.studentNumber || "—"}</td>
                      <td className="px-2 py-1.5">{row.email || "—"}</td>
                      <td className="px-2 py-1.5 font-semibold capitalize">{row.status}</td>
                      <td className="px-2 py-1.5 text-slate-500">
                        {row.reason ||
                          (row.emailSent === false && row.temporaryPassword
                            ? `Email failed · temp: ${row.temporaryPassword}`
                            : row.emailSent
                              ? "Email sent"
                              : "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 cursor-pointer items-center rounded-full bg-cnhs-green-dark px-4 text-[12px] font-semibold text-white"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadStudentInviteTemplate}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700"
              >
                <Download size={13} />
                Download template
              </button>
              <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-cnhs-green-dark/40 bg-cnhs-green-soft px-3 text-[11px] font-semibold text-cnhs-green-dark">
                <Upload size={13} />
                {fileName || "Choose CSV"}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={handleFile}
                />
              </label>
            </div>

            {rows.length ? (
              <p className="text-[12px] text-slate-600">
                Ready to invite{" "}
                <span className="font-semibold text-slate-900">{rows.length}</span>{" "}
                row{rows.length === 1 ? "" : "s"}
                {fileName ? (
                  <>
                    {" "}
                    from <span className="font-medium">{fileName}</span>
                  </>
                ) : null}
                .
              </p>
            ) : (
              <p className="text-[12px] text-slate-400">
                No rows loaded yet. Use the template, fill LRN + email, then upload.
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="inline-flex h-9 cursor-pointer items-center rounded-full border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-600 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !rows.length}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-cnhs-green-dark px-4 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                {saving ? "Inviting…" : "Run bulk invite"}
              </button>
            </div>
          </form>
        )}
      </div>
    </AnimatedModal>
  );
}
