export default function FilterDropdown({
  label,
  options,
  value,
  onChange,
}) {
  const isControlled = value !== undefined;
  return (
    <label className="min-w-[126px] flex-1 sm:flex-none">
      <span className="sr-only">{label}</span>
      <select
        {...(isControlled
          ? { value, onChange: (e) => onChange?.(e.target.value) }
          : { defaultValue: options[0] })}
        className="h-8 w-full cursor-pointer rounded-full border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-600 shadow-sm outline-none transition-colors hover:bg-slate-50 focus:border-cnhs-green"
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
