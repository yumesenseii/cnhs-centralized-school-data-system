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
  violet: "bg-violet-100 text-violet-700",
  purple: "bg-violet-100 text-violet-700",
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
      <td className="px-4 py-4 align-middle">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
              avatarTones[user.avatarTone] ?? avatarTones.green
            )}
          >
            {user.initials}
          </span>
          <span>
            <span className="block whitespace-nowrap text-xs font-semibold text-slate-800">
              {user.fullName}
            </span>
            <span className="block text-[10px] text-slate-400">{user.username}</span>
          </span>
        </div>
      </td>
      <td className="px-3 py-4 align-middle">
        <RoleBadge value={user.role} />
      </td>
      <td className="px-3 py-4 align-middle text-xs text-slate-600">{user.learningArea}</td>
      <td className="px-3 py-4 align-middle">
        {user.assignedClasses.length ? (
          <div className="flex max-w-[160px] flex-col gap-1">
            {user.assignedClasses.map((cls) => (
              <ClassBadge key={cls} label={cls} />
            ))}
          </div>
        ) : (
          <span className="text-[11px] text-slate-300">—</span>
        )}
      </td>
      <td className="px-3 py-4 align-middle">
        <SubmissionProgress
          compact
          label={user.eClassSubmission.label}
          tone={user.eClassSubmission.tone}
        />
      </td>
      <td className="px-3 py-4 align-middle">
        <SubmissionProgress
          compact
          label={user.lessonPlanSubmission.label}
          tone={user.lessonPlanSubmission.tone}
        />
      </td>
      <td className="px-3 py-4 align-middle text-xs text-slate-500">{user.email}</td>
      <td className="px-3 py-4 align-middle">
        <StatusBadge value={user.status} />
      </td>
      <td className="px-3 py-4 align-middle">
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
