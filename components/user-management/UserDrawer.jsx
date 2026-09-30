"use client";

import { KeyRound, Pencil, UserCheck, UserX, X } from "lucide-react";
import AnimatedModal from "@/components/shared/AnimatedModal";
import AccountInformation from "@/components/user-management/AccountInformation";
import ClassAssignments from "@/components/user-management/ClassAssignments";
import ProfileInformation from "@/components/user-management/ProfileInformation";
import RecentActivity from "@/components/user-management/RecentActivity";
import StatusBadge from "@/components/user-management/StatusBadge";
import SubmissionSummary from "@/components/user-management/SubmissionSummary";
import { VIEW_MODAL_PANEL } from "@/lib/ui/viewModal";

export default function UserDrawer({
  open,
  user,
  onClose,
  onEdit,
  onResetPassword,
  onToggleStatus,
}) {
  const isActive = user?.status === "Active";

  return (
    <AnimatedModal
      open={open && Boolean(user)}
      onClose={onClose}
      panelClassName={VIEW_MODAL_PANEL}
    >
      {user ? (
        <>
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-3.5">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-400">
                User Profile · {user.id}
              </p>
              <h2 className="mt-1 break-words text-lg font-semibold leading-6 tracking-[-0.03em] text-slate-900">
                {user.fullName}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {user.role} · {user.learningArea}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <StatusBadge value={user.status} />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close user details"
                className="cursor-pointer rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <ProfileInformation user={user} />
            <ClassAssignments classes={user.assignedClasses} />
            <SubmissionSummary summary={user.submissionSummary} />
            <RecentActivity activities={user.recentActivity} />
            <AccountInformation user={user} />
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-100 bg-white px-5 py-3 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => onEdit?.(user)}
              className="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-cnhs-green-dark text-xs font-semibold text-white transition-colors hover:bg-[#246f54]"
            >
              <Pencil size={14} />
              Edit User
            </button>
            <button
              type="button"
              onClick={() => onResetPassword?.(user)}
              className="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <KeyRound size={14} />
              Reset Password
            </button>
            {user.isCurrentAdmin ? (
              <button
                type="button"
                disabled
                title="You cannot deactivate your own logged-in account"
                className="inline-flex h-10 cursor-not-allowed items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-400"
              >
                <UserX size={14} />
                Deactivate
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onToggleStatus?.(user)}
                className="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                {isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                {isActive ? "Deactivate" : "Activate"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </>
      ) : null}
    </AnimatedModal>
  );
}
