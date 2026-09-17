"use client";

import { useEffect, useState } from "react";
import AnimatedModal from "@/components/shared/AnimatedModal";
import AppSelect from "@/components/shared/AppSelect";
import { AnimatedBanner } from "@/components/shared/AnimatedFeedback";

function makeEmployeeId() {
  const year = new Date().getFullYear();
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `EMP-${year}-${digits}`;
}

export default function AddUserModal({ open, options, onClose, onSubmit }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [employeeId, setEmployeeId] = useState(makeEmployeeId);

  useEffect(() => {
    if (!open) return;
    setEmployeeId(makeEmployeeId());
    setError("");
    setSaving(false);
  }, [open]);

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
    <AnimatedModal
      open={open}
      onClose={saving ? undefined : onClose}
      labelledBy="add-user-title"
      zClassName="z-[60]"
      closeOnBackdrop={!saving}
      closeOnEscape={!saving}
      className="bg-slate-900/40"
      panelClassName="w-full max-w-[560px] overflow-hidden rounded-lg bg-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]"
    >
      <div className="border-b border-slate-100 px-4 py-3.5">
        <h2
          id="add-user-title"
          className="text-lg font-semibold tracking-[-0.02em] text-slate-900"
        >
          Add User
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Create a teacher or Head Teacher account. Student portal logins are
          managed under the Students tab (link existing LRN + email / bulk CSV).
        </p>
      </div>

      <form
        className="max-h-[70vh] space-y-3 overflow-y-auto px-4 py-3.5"
        onSubmit={handleSubmit}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="First Name"
            name="firstName"
            placeholder="Maria"
            required
          />
          <Field
            label="Last Name"
            name="lastName"
            placeholder="Santos"
            required
          />
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
          <SelectField
            label="Learning Area"
            name="learningArea"
            options={options.learningAreas}
          />
        </div>
        <p className="text-[11px] leading-4 text-slate-400">
          A temporary password will be emailed to this address. They must
          change it on first login.
        </p>
        <p className="text-[11px] leading-4 text-slate-400">
          Assign sections and class offerings from Class Assignments after
          creating the teacher account.
        </p>
        <SelectField label="Status" name="status" options={options.statuses} />

        <AnimatedBanner message={error} tone="error" />

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
    </AnimatedModal>
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
      <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
        {label}
      </span>
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
    <div className="block">
      <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
        {label}
      </span>
      {multiple ? (
        <select
          name={name}
          multiple
          defaultValue={[]}
          className="min-h-[96px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none transition-colors focus:border-cnhs-green focus:bg-white"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <AppSelect
          label={label}
          name={name}
          defaultValue={options[0]}
          options={options}
          triggerClassName="bg-slate-50/80 text-xs focus:bg-white"
        />
      )}
    </div>
  );
}
