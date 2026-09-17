"use client";

import AppSelect from "@/components/shared/AppSelect";

export default function FilterDropdown({
  label,
  options = [],
  value,
  onChange,
}) {
  const selected = value ?? options[0] ?? "";

  return (
    <AppSelect
      label={label}
      value={selected}
      onChange={onChange}
      options={options}
      size="field"
      className="min-w-[118px] flex-1 sm:flex-none"
      triggerClassName="h-10 min-w-[120px] bg-slate-50/80 text-[11px] focus:bg-white"
    />
  );
}
