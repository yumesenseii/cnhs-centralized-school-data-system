"use client";

import AppSelect from "@/components/shared/AppSelect";

export default function FilterDropdown({ label, options, value, onChange }) {
  return (
    <AppSelect
      label={label}
      value={value ?? options?.[0]}
      onChange={onChange}
      options={options}
      size="field"
      className="min-w-[120px] shrink-0"
      triggerClassName="h-9 min-w-[120px] text-[11px]"
    />
  );
}
