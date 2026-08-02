"use client";

import { KeyRound, Loader2 } from "lucide-react";

export default function PersonalAccountCard({
  account,
  loading = false,
  error = "",
  onGoToSecurity,
}) {
  const fields = account
    ? [
        { label: "Full Name", value: account.fullName },
        { label: "Employee ID", value: account.employeeId },
        { label: "Email Address", value: account.email },
        { label: "Phone Number", value: account.phone },
        { label: "Username", value: account.username },
        { label: "Role", value: account.role },
        { label: "Status", value: account.status },
      ]
    : [];

  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-4">
      <div className="mb-3">
        <h2 className="text-base font-semibold tracking-[-0.02em] text-slate-900">
          Personal Account
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Read-only profile from your signed-in account. Use Security to change
          your password.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-[12px] text-slate-500">
          <Loader2 size={14} className="animate-spin" />
          Loading profile…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-2 text-[11px] text-red-600">
          {error}
        </div>
      ) : account ? (
        <>
          <div className="mb-3 flex items-center gap-3.5">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-base font-semibold text-cnhs-green-dark">
              {account.initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {account.fullName}
              </p>
              <p className="text-xs text-slate-400">@{account.username}</p>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.label} className="rounded-xl bg-slate-50 px-3.5 py-3">
                <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                  {field.label}
                </dt>
                <dd className="mt-1 break-words text-xs font-medium text-slate-700">
                  {field.value}
                </dd>
              </div>
            ))}
          </dl>

          {typeof onGoToSecurity === "function" ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={onGoToSecurity}
                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
              >
                <KeyRound size={13} />
                Change Password
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
