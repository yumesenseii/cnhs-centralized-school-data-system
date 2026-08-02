import StatusBadge, { RoleBadge } from "@/components/user-management/StatusBadge";
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

const fields = [
  { key: "employeeId", label: "Employee ID" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone Number" },
];

export default function ProfileInformation({ user }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-800">Profile Information</h3>

      <div className="mt-4 flex items-center gap-3">
        <span
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full text-base font-semibold",
            avatarTones[user.avatarTone] ?? avatarTones.green
          )}
        >
          {user.initials}
        </span>
        <div>
          <p className="text-base font-semibold text-slate-900">{user.fullName}</p>
          <p className="text-xs text-slate-400">@{user.username}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <RoleBadge value={user.role} />
            <StatusBadge value={user.status} />
          </div>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.key} className="rounded-xl bg-slate-50 px-3.5 py-3">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              {field.label}
            </dt>
            <dd className="mt-1 text-xs font-medium text-slate-700">{user[field.key]}</dd>
          </div>
        ))}
        <div className="rounded-xl bg-slate-50 px-3.5 py-3">
          <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Learning Area
          </dt>
          <dd className="mt-1 text-xs font-medium text-slate-700">{user.learningArea}</dd>
        </div>
      </dl>
    </section>
  );
}
