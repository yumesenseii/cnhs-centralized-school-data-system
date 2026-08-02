import { Eye } from "lucide-react";

export default function ReportPagesPreview({ pages }) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
        Report Pages Preview
      </h3>
      <div className="space-y-2.5">
        {pages.map((page) => (
          <button
            key={page.number}
            type="button"
            className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm transition-colors duration-200 hover:bg-slate-50"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-cnhs-green-dark text-xs font-semibold text-white">
              {page.number}
            </span>
            <span className="min-w-0 flex-1 text-sm font-semibold text-slate-700">{page.title}</span>
            <Eye size={15} className="shrink-0 text-slate-300" aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}
