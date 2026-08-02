import { Eye, KeyRound, Pencil, UserCheck, UserX } from "lucide-react";

export default function ActionButtons({
  user,
  onView,
  onEdit,
  onResetPassword,
  onToggleStatus,
}) {
  const isActive = user.status === "Active";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => onView?.(user)}
        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-cnhs-green-dark/35 bg-white px-2.5 text-[10px] font-semibold text-cnhs-green-dark transition-colors hover:bg-green-50"
      >
        <Eye size={11} />
        View
      </button>
      <button
        type="button"
        onClick={() => onEdit?.(user)}
        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
      >
        <Pencil size={11} />
        Edit
      </button>
      <button
        type="button"
        onClick={() => onResetPassword?.(user)}
        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
      >
        <KeyRound size={11} />
        Reset
      </button>
      <button
        type="button"
        onClick={() => onToggleStatus?.(user)}
        className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
      >
        {isActive ? <UserX size={11} /> : <UserCheck size={11} />}
        {isActive ? "Deactivate" : "Activate"}
      </button>
    </div>
  );
}
