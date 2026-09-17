"use client";

import AppSelect from "@/components/shared/AppSelect";

export default function FilterDropdown({
  label,
  options,
  value,
  onChange,
}) {
  const isControlled = value !== undefined;
  return (
    <AppSelect
      label={label}
      {...(isControlled
        ? { value, onChange }
        : { defaultValue: options?.[0] })}
      options={options}
      size="pill"
      className="min-w-[126px] flex-1 sm:flex-none"
      triggerClassName="text-[11px]"
    />
  );
}
