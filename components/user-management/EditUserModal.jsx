"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import AnimatedModal from "@/components/shared/AnimatedModal";
import AppSelect from "@/components/shared/AppSelect";
import { AnimatedBanner } from "@/components/shared/AnimatedFeedback";

export default function EditUserModal({ open, user, options, onClose, onSubmit }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isTeacher = user?.role === "Teacher" || Boolean(user?.teacherId);
  const learningAreas = options?.learningAreas?.length
    ? options.learningAreas
    : ["English", "Filipino", "Mathematics", "Science", "Administration"];
  const statuses = options?.statuses?.length
    ? options.statuses
    : ["Active", "Inactive"];

  async function handleSubmit(event) {
    event.preventDefault();
    if (!user) return;
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
    <AnimatedModal
      open={open && Boolean(user)}
      onClose={saving ? undefined : onClose}
      labelledBy="edit-user-title"
      zClassName="z-[60]"
      closeOnBackdrop={!saving}
      closeOnEscape={!saving}
      className="bg-slate-900/40"
      panelClassName="w-full max-w-[520px] overflow-hidden rounded-lg bg-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]"
    >
      {user ? (
        <>
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
                <div className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
                    Learning Area
                  </span>
                  <AppSelect
                    label="Learning Area"
                    name="learningArea"
                    defaultValue={user.learningArea}
                    options={learningAreas}
                    triggerClassName="bg-slate-50/80 text-xs focus:bg-white"
                  />
                </div>
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

            <div className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">
                Status
              </span>
              <AppSelect
                label="Status"
                name="status"
                defaultValue={user.status}
                options={statuses}
                triggerClassName="bg-slate-50/80 text-xs focus:bg-white"
              />
            </div>

            <AnimatedBanner message={error} tone="error" />

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
        </>
      ) : null}
    </AnimatedModal>
  );
}
