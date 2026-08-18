"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export default function EditUserModal({ open, user, options, onClose, onSubmit }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open || !user) return null;

  const isTeacher = user.role === "Teacher" || Boolean(user.teacherId);
  const learningAreas = options?.learningAreas?.length
    ? options.learningAreas
    : ["English", "Filipino", "Mathematics", "Science", "Administration"];
  const statuses = options?.statuses?.length
    ? options.statuses
    : ["Active", "Inactive"];

  async function handleSubmit(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSaving(true);
    setError("");

    const form = new FormData(formElement);
    const result = await onSubmit?.({
      id: user.id,
      teacherId: user.teacherId,
      role: user.role,
      fullName: form.get("fullName"),
      email: form.get("email"),
      learningArea: form.get("learningArea"),
      phone: form.get("phone"),
      status: form.get("status"),
    });

    setSaving(false);
    if (result?.error) {
      setError(result.error.message || "Unable to update user.");
      return;
    }
    onClose?.();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-user-title"
        className="relative z-10 w-full max-w-[520px] overflow-hidden rounded-lg bg-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]"
      >
        <div className="border-b border-slate-100 px-4 py-3.5">
          <h2
            id="edit-user-title"
            className="text-lg font-semibold tracking-[-0.02em] text-slate-900"
          >
            Edit User
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Update account details for {user.fullName}. Class assignments are
            managed under Classes &amp; Sections.
          </p>
        </div>

        <form className="space-y-3 px-4 py-3.5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
              Name
            </span>
            <input
              name="fullName"
              required
              defaultValue={user.fullName}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none transition-colors focus:border-cnhs-green focus:bg-white"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
              Email (login)
            </span>
            <input
              name="email"
              type="email"
              required
              defaultValue={user.email === "—" ? "" : user.email}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none transition-colors focus:border-cnhs-green focus:bg-white"
            />
            <p className="mt-1 text-[10px] leading-4 text-slate-400">
              Changing this updates the Auth login address and related records.
              The new email is confirmed automatically for school-managed
              accounts—tell the user to sign in with the new address. If they
              are currently signed in, they may need to sign out and back in.
            </p>
          </label>

          {isTeacher ? (
            <>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
                  Learning Area
                </span>
                <select
                  name="learningArea"
                  defaultValue={user.learningArea}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none transition-colors focus:border-cnhs-green focus:bg-white"
                >
                  {learningAreas.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
                  Phone
                </span>
                <input
                  name="phone"
                  defaultValue={user.phone === "—" ? "" : user.phone}
                  placeholder="09XXXXXXXXX"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none transition-colors focus:border-cnhs-green focus:bg-white"
                />
              </label>
            </>
          ) : (
            <input type="hidden" name="learningArea" value="Administration" />
          )}

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
              Status
            </span>
            <select
              name="status"
              defaultValue={user.status}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none transition-colors focus:border-cnhs-green focus:bg-white"
            >
              {statuses.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

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
              className="h-10 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-cnhs-green-dark px-4 text-xs font-semibold text-white transition-colors hover:bg-[#246f54] disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
