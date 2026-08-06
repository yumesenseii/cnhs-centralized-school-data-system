import ActionButtons from "@/components/user-management/ActionButtons";
import ClassBadge from "@/components/user-management/ClassBadge";
import StatusBadge, { RoleBadge } from "@/components/user-management/StatusBadge";
import SubmissionProgress from "@/components/user-management/SubmissionProgress";
import { cn } from "@/lib/utils";

const avatarTones = {
  green: "bg-green-100 text-cnhs-green-dark",
  blue: "bg-sky-100 text-sky-700",
  pink: "bg-rose-100 text-rose-600",
  orange: "bg-orange-100 text-cnhs-orange",
  teal: "bg-teal-100 text-teal-700",
  red: "bg-red-100 text-red-600",
  violet: "bg-amber-100 text-amber-700",
  purple: "bg-amber-100 text-amber-700",
};

export default function UserRow({
  user,
  onView,
  onEdit,
  onResetPassword,
  onToggleStatus,
}) {
  return (
    <tr className="border-t border-slate-100 transition-colors hover:bg-slate-50/70">
      <td className="px-4 py-3 align-middle">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
              avatarTones[user.avatarTone] ?? avatarTones.green
            )}
          >
            {user.initials}
          </span>
          <span className="min-w-0">
            <span className="block whitespace-nowrap text-xs font-semibold text-slate-800">
              {user.fullName}
            </span>
            <span className="mt-0.5 block text-[10px] text-slate-500">
              @{user.username}
            </span>
            <span className="block max-w-[210px] truncate text-[10px] text-slate-400">
              {user.email || "No email"}
            </span>
          </span>
        </div>
      </td>
      <td className="px-3 py-3 align-middle">
        <RoleBadge value={user.role} />
        <span className="mt-1.5 block max-w-[150px] text-[10px] leading-4 text-slate-500">
          {user.learningArea}
        </span>
      </td>
      <td className="px-3 py-3 align-middle">
        {user.assignedClasses.length ? (
          <div className="flex max-w-[210px] flex-wrap gap-1">
            {user.assignedClasses.slice(0, 2).map((cls) => (
              <ClassBadge key={cls} label={cls} />
            ))}
            {user.assignedClasses.length > 2 ? (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-semibold text-slate-500">
                +{user.assignedClasses.length - 2} more
              </span>
            ) : null}
          </div>
        ) : (
          <span className="text-[11px] text-slate-300">—</span>
        )}
      </td>
      <td className="px-3 py-3 align-middle">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[9px] font-medium uppercase tracking-[0.06em] text-slate-400">
              E-Class
            </span>
            <SubmissionProgress
              compact
              label={user.eClassSubmission.label}
              tone={user.eClassSubmission.tone}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[9px] font-medium uppercase tracking-[0.06em] text-slate-400">
              Lesson Plan
            </span>
            <SubmissionProgress
              compact
              label={user.lessonPlanSubmission.label}
              tone={user.lessonPlanSubmission.tone}
            />
          </div>
        </div>
      </td>
      <td className="px-3 py-3 align-middle">
        <StatusBadge value={user.status} />
      </td>
      <td className="px-4 py-3 align-middle">
        <ActionButtons
          user={user}
          onView={onView}
          onEdit={onEdit}
          onResetPassword={onResetPassword}
          onToggleStatus={onToggleStatus}
        />
      </td>
    </tr>
  );
}
