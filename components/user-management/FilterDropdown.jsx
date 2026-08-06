export default function FilterDropdown({ label, options, value, onChange }) {
  return (
    <label className="min-w-[120px] shrink-0">
      <span className="sr-only">{label}</span>
      <select
        value={value ?? options[0]}
        onChange={(event) => onChange?.(event.target.value)}
        className="h-9 w-full min-w-[120px] cursor-pointer rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 outline-none transition-colors focus:border-cnhs-green focus:ring-2 focus:ring-cnhs-green/10"
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
