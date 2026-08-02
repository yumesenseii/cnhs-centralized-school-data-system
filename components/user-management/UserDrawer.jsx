"use client";

import { KeyRound, Pencil, UserX, X } from "lucide-react";
import AccountInformation from "@/components/user-management/AccountInformation";
import ClassAssignments from "@/components/user-management/ClassAssignments";
import ProfileInformation from "@/components/user-management/ProfileInformation";
import RecentActivity from "@/components/user-management/RecentActivity";
import StatusBadge from "@/components/user-management/StatusBadge";
import SubmissionSummary from "@/components/user-management/SubmissionSummary";

export default function UserDrawer({
  open,
  user,
  onClose,
  onEdit,
  onResetPassword,
  onToggleStatus,
}) {
  if (!open || !user) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/35 backdrop-blur-[1px]" onClick={onClose} />
      <aside
        className="absolute right-0 top-0 flex h-full w-full max-w-[560px] flex-col bg-white shadow-[-18px_0_40px_rgba(15,23,42,0.18)]"
        aria-label="User details drawer"
      >
        <div className="border-b border-slate-100 px-7 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400">User Profile · {user.id}</p>
              <h2 className="mt-1 break-words text-xl font-semibold leading-7 tracking-[-0.03em] text-slate-900">
                {user.fullName}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {user.role} · {user.learningArea}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge value={user.status} />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close user drawer"
                className="cursor-pointer rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-7 py-7 pb-28">
          <ProfileInformation user={user} />
          <ClassAssignments classes={user.assignedClasses} />
          <SubmissionSummary summary={user.submissionSummary} />
          <RecentActivity activities={user.recentActivity} />
          <AccountInformation user={user} />
        </div>

        <div className="sticky bottom-0 grid grid-cols-2 gap-3 border-t border-slate-100 bg-white/95 px-7 py-4 backdrop-blur sm:grid-cols-4">
          <button
            type="button"
            onClick={() => onEdit?.(user)}
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-2xl bg-cnhs-green-dark text-xs font-semibold text-white transition-colors hover:bg-[#246f54]"
          >
            <Pencil size={14} />
            Edit User
          </button>
          <button
            type="button"
            onClick={() => onResetPassword?.(user)}
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <KeyRound size={14} />
            Reset Password
          </button>
          <button
            type="button"
            onClick={() => onToggleStatus?.(user)}
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <UserX size={14} />
            Deactivate
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </aside>
    </div>
  );
}
