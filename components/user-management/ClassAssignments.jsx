import ClassBadge from "@/components/user-management/ClassBadge";

export default function ClassAssignments({ classes }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-800">Class Assignments</h3>
      {classes?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {classes.map((cls) => (
            <ClassBadge key={cls} label={cls} />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-400">No class assignments for this account.</p>
      )}
    </section>
  );
}
