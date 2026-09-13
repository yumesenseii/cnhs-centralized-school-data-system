"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PasswordInput({
  id,
  name = "password",
  label,
  placeholder,
  value,
  onChange,
  autoComplete = "current-password",
  required = false,
  error = "",
  maxLength,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="field-group">
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-semibold text-[#174D37]">
        {label}
      </label>
      <div
        className={cn(
          "input-wrap flex h-11 items-center gap-2.5 rounded-xl border bg-white px-3 transition-all duration-200",
          error
            ? "border-red-300 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/15"
            : "border-slate-200 focus-within:border-[#174D37] focus-within:ring-2 focus-within:ring-[#174D37]/15"
        )}
      >
        <span className="input-icon shrink-0 text-slate-400" aria-hidden="true">
          <Lock size={16} strokeWidth={1.9} />
        </span>
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          maxLength={maxLength}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${id}Error` : undefined}
          className="h-full w-full bg-transparent text-[13px] text-slate-700 outline-none placeholder:text-slate-400"
        />
        <button
          type="button"
          className="toggle-password cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <small id={`${id}Error`} className="error-text mt-1 block min-h-[14px] text-[11px] font-medium text-red-600">
        {error}
      </small>
    </div>
  );
}
