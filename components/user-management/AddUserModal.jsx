"use client";

import { useEffect, useState } from "react";

function makeEmployeeId() {
  const year = new Date().getFullYear();
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `EMP-${year}-${digits}`;
}

function makeTempPassword() {
  return `CNHS-Tmp-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export default function AddUserModal({ open, options, onClose, onSubmit }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [employeeId, setEmployeeId] = useState(makeEmployeeId);
  const [temporaryPassword, setTemporaryPassword] = useState(makeTempPassword);

  useEffect(() => {
    if (!open) return;
    setEmployeeId(makeEmployeeId());
    setTemporaryPassword(makeTempPassword());
    setError("");
    setSaving(false);
  }, [open]);

  if (!open) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    // Capture before await — currentTarget is null after the async gap.
    const formElement = event.currentTarget;
    setSaving(true);
    setError("");

    const form = new FormData(formElement);
    const result = await onSubmit?.({
      firstName: form.get("firstName"),
      lastName: form.get("lastName"),
      employeeId: employeeId || form.get("employeeId"),
      email: form.get("email"),
      role: form.get("role"),
      learningArea: form.get("learningArea"),
      temporaryPassword: temporaryPassword || form.get("temporaryPassword"),
      status: form.get("status"),
    });

    setSaving(false);
    if (result?.error) {
      setError(result.error.message || "Unable to create user.");
      return;
    }
    formElement?.reset();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-user-title"
        className="relative z-10 w-full max-w-[560px] overflow-hidden rounded-lg bg-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]"
      >
        <div className="border-b border-slate-100 px-4 py-3.5">
          <h2 id="add-user-title" className="text-lg font-semibold tracking-[-0.02em] text-slate-900">
            Add User
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Create a teacher or Head Teacher account. Students are not managed here.
          </p>
        </div>

        <form
          className="max-h-[70vh] space-y-3 overflow-y-auto px-4 py-3.5"
          onSubmit={handleSubmit}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="First Name" name="firstName" placeholder="Maria" required />
            <Field label="Last Name" name="lastName" placeholder="Santos" required />
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
              Employee ID
            </span>
            <input
              name="employeeId"
              value={employeeId}
              readOnly
              required
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-xs text-slate-700 outline-none"
            />
          </label>
          <Field
            label="Email"
            name="email"
            type="email"
            placeholder="name@cnhs.edu.ph"
            required
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectField label="Role" name="role" options={options.roles} />
            <SelectField label="Learning Area" name="learningArea" options={options.learningAreas} />
          </div>
          <p className="text-[11px] leading-4 text-slate-400">
            Assign sections and class offerings from Class Assignments after
            creating the teacher account.
          </p>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
              Temporary Password
            </span>
            <input
              name="temporaryPassword"
              value={temporaryPassword}
              readOnly
              required
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-xs text-slate-700 outline-none"
            />
          </label>
          <SelectField label="Status" name="status" options={options.statuses} />

          {error ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 cursor-pointer rounded-xl bg-cnhs-green-dark px-4 text-xs font-semibold text-white transition-colors hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Creating…" : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  readOnly,
  required = false,
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        readOnly={readOnly}
        required={required}
        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-cnhs-green focus:bg-white read-only:bg-slate-100"
      />
    </label>
  );
}

function SelectField({ label, name, options, multiple = false }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">{label}</span>
      <select
        name={name}
        multiple={multiple}
        defaultValue={multiple ? [] : options[0]}
        className={
          multiple
            ? "min-h-[96px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none transition-colors focus:border-cnhs-green focus:bg-white"
            : "h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none transition-colors focus:border-cnhs-green focus:bg-white"
        }
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
