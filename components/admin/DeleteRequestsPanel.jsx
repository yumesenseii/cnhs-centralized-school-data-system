"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import DeleteConfirmModal from "@/components/shared/DeleteConfirmModal";

const TYPE_LABEL = {
  class: "class assignment",
  ecr: "E-Class Record grades",
  lesson_plan: "lesson plan",
};

export default function DeleteRequestsPanel({
  requests = [],
  loading = false,
  error = "",
  onApprove,
  onReject,
}) {
  const [confirm, setConfirm] = useState(null);
  const [busyId, setBusyId] = useState("");

  if (!loading && !error && !requests.length) return null;

  return (
    <section className="mb-4 rounded-lg border border-orange-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="mb-2 flex items-center gap-2">
        <Trash2 size={14} className="text-orange-600" />
        <h2 className="text-[13px] font-semibold text-slate-800">
          Pending delete requests
        </h2>
      </div>
      {error ? (
        <p className="text-[12px] text-red-600">{error}</p>
      ) : loading ? (
        <p className="text-[12px] text-slate-400">Loading requests…</p>
      ) : (
        <ul className="space-y-2">
          {requests.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-slate-800">
                  {row.label}
                </p>
                <p className="text-[11px] text-slate-500">
                  {row.teacherName} · {TYPE_LABEL[row.targetType] || row.targetType}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={Boolean(busyId)}
                  onClick={() => onReject?.(row)}
                  className="inline-flex h-7 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={Boolean(busyId)}
                  onClick={() =>
                    setConfirm({
                      row,
                      title:
                        row.targetType === "ecr"
                          ? "Clear grades"
                          : "Delete",
                      confirmLabel:
                        row.targetType === "ecr" ? "Clear grades" : "Delete",
                      consequence:
                        row.targetType === "ecr"
                          ? "Imported grades and the class list for this term will be removed. The assignment stays."
                          : "This cannot be undone.",
                    })
                  }
                  className="inline-flex h-7 cursor-pointer items-center rounded-lg bg-red-600 px-2.5 text-[10px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Approve
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <DeleteConfirmModal
        open={Boolean(confirm)}
        title={confirm?.title}
        itemLabel={confirm?.row?.label}
        consequence={confirm?.consequence}
        confirmLabel={confirm?.confirmLabel}
        confirming={busyId === confirm?.row?.id}
        confirmingLabel="Deleting…"
        icon={confirm?.row?.targetType === "ecr" ? "clear" : "delete"}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          const row = confirm?.row;
          if (!row) return;
          setBusyId(row.id);
          await onApprove?.(row);
          setBusyId("");
          setConfirm(null);
        }}
      />
    </section>
  );
}
