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
  hint = "",
}) {
  const [visible, setVisible] = useState(false);
  const hintId = hint ? `${id}Hint` : undefined;
  const errorId = error ? `${id}Error` : undefined;

  return (
    <div className="field-group mb-3">
      <label
        htmlFor={id}
        className="mb-1.5 block text-[12px] font-semibold text-[#174D37]"
      >
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
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          className={cn(
            "h-full w-full bg-transparent text-[13px] text-slate-700 outline-none placeholder:text-slate-400",
            /* Hide browser native password reveal so only our one eye control shows */
            "[&::-ms-reveal]:hidden [&::-ms-clear]:hidden",
            "[&::-webkit-credentials-auto-fill-button]:hidden",
            "[&::-webkit-strong-password-auto-fill-button]:hidden"
          )}
        />
        <button
          type="button"
          tabIndex={0}
          className="toggle-password shrink-0 cursor-pointer rounded-md p-1 text-slate-400 transition-colors duration-200 hover:bg-slate-50 hover:text-slate-600"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {hint ? (
        <p id={hintId} className="mt-1.5 text-[11px] leading-4 text-slate-400">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          className="error-text mt-1 block text-[11px] font-medium leading-4 text-red-600"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
