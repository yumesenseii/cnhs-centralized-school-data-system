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
        className="h-9 w-full cursor-pointer rounded-xl border border-slate-100 bg-slate-50 px-3 text-[11px] font-medium text-slate-500 outline-none transition-colors focus:border-cnhs-green focus:bg-white"
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
