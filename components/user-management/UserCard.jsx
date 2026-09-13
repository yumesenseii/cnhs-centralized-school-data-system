import ActionButtons from "@/components/user-management/ActionButtons";
import ClassBadge from "@/components/user-management/ClassBadge";
import StatusBadge, {
  RoleBadge,
} from "@/components/user-management/StatusBadge";
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

export default function UserCard({
  user,
  onView,
  onEdit,
  onResetPassword,
  onToggleStatus,
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-[0_4px_12px_rgba(15,23,42,0.035)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
              avatarTones[user.avatarTone] ?? avatarTones.green
            )}
          >
            {user.initials}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-xs font-semibold text-slate-900">
              {user.fullName}
            </h3>
            <p className="mt-0.5 truncate text-[10px] text-slate-500">
              @{user.username} · {user.email || "No email"}
            </p>
          </div>
        </div>
        <StatusBadge value={user.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <RoleBadge value={user.role} />
        <span className="text-[10px] text-slate-500">{user.learningArea}</span>
      </div>

      <div className="mt-3">
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          Assigned Classes
        </p>
        {user.assignedClasses.length ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {user.assignedClasses.slice(0, 2).map((cls) => (
              <ClassBadge key={cls} label={cls} />
            ))}
            {user.assignedClasses.length > 2 ? (
              <span className="inline-flex items-center rounded-full border border-slate-200 px-2 py-0.5 text-[9px] font-semibold text-slate-500">
                +{user.assignedClasses.length - 2} more
              </span>
            ) : null}
          </div>
        ) : (
          <p className="mt-1 text-[10px] text-slate-400">No assigned classes</p>
        )}
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3">
        <ActionButtons
          user={user}
          onView={onView}
          onEdit={onEdit}
          onResetPassword={onResetPassword}
          onToggleStatus={onToggleStatus}
        />
      </div>
    </article>
  );
}
