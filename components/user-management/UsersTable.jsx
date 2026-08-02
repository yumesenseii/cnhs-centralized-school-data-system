import FilterDropdown from "@/components/user-management/FilterDropdown";
import SearchBar from "@/components/user-management/SearchBar";
import UserRow from "@/components/user-management/UserRow";

const columns = [
  "Name",
  "Role",
  "Learning Area",
  "Assigned Classes",
  "E-Class Record",
  "Lesson Plan",
  "Email",
  "Account Status",
  "Actions",
];

export default function UsersTable({
  users,
  filters,
  onView,
  onEdit,
  onResetPassword,
  onToggleStatus,
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center">
        <SearchBar />
        <div className="flex shrink-0 flex-wrap gap-2 md:ml-auto">
          <FilterDropdown label="Role" options={filters.roles} />
          <FilterDropdown label="Learning Area" options={filters.learningAreas} />
          <FilterDropdown label="Account Status" options={filters.statuses} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1180px] w-full border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/80">
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 first:pl-4 last:pr-4"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.length ? (
              users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  onView={onView}
                  onEdit={onEdit}
                  onResetPassword={onResetPassword}
                  onToggleStatus={onToggleStatus}
                />
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-xs text-slate-500"
                >
                  No teacher or Head Teacher accounts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
