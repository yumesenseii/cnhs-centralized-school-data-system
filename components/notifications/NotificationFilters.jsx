export default function NotificationFilters({ filters }) {
  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      <FilterSelect label="Notification Type" options={filters.types} />
      <FilterSelect label="Priority" options={filters.priorities} />
      <FilterSelect label="Status" options={filters.statuses} />
    </div>
  );
}

function FilterSelect({ label, options }) {
  return (
    <label className="min-w-[120px] shrink-0">
      <span className="sr-only">{label}</span>
      <select
        defaultValue={options[0]}
        className="h-9 w-full min-w-[120px] cursor-pointer rounded-xl border border-slate-100 bg-slate-50 px-3 text-[11px] font-medium text-slate-500 outline-none transition-colors focus:border-cnhs-green focus:bg-white"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
