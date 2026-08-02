"use client";

import { FileSpreadsheet, Upload } from "lucide-react";

export default function EmptyLearnersState({
  title = "No learners have been imported for this class.",
  description = "Upload an official DepEd E-Class Record to import students for this class.",
  onUpload,
}) {
  return (
    <section className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-cnhs-green-dark">
        <FileSpreadsheet size={28} />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-800">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-[12px] leading-5 text-slate-500">
        {description}
      </p>
      <p className="mt-2 text-[11px] text-slate-400">
        Supported format: Excel (.xlsx) · Maximum file size: 10 MB
      </p>
      <button
        type="button"
        onClick={onUpload}
        className="mt-3 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-4 text-[11px] font-semibold text-white transition-colors hover:bg-[#246f54]"
      >
        <Upload size={13} />
        Upload E-Class Record
      </button>
    </section>
  );
}
