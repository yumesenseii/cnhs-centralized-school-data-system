import { Search } from "lucide-react";

export default function ReportsFilters({ filters }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-2 lg:flex-row">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Search Reports</span>
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search reports..."
            className="h-9 w-full rounded-xl border border-slate-100 bg-slate-50 pl-9 pr-3 text-[11px] text-slate-600 outline-none transition-colors placeholder:text-slate-400 focus:border-cnhs-green focus:bg-white"
          />
        </label>

        {[
          { label: "Category", options: filters.categories },
          { label: "School Year", options: filters.schoolYears },
          { label: "Quarter", options: filters.quarters },
          { label: "Status", options: filters.statuses },
        ].map((filter) => (
          <label key={filter.label} className="min-w-[126px] flex-1 sm:flex-none">
            <span className="sr-only">{filter.label}</span>
            <select
              defaultValue={filter.options[0]}
              className="h-9 w-full cursor-pointer rounded-xl border border-slate-100 bg-slate-50 px-3 text-[11px] font-medium text-slate-500 outline-none transition-colors focus:border-cnhs-green focus:bg-white"
            >
              {filter.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}
