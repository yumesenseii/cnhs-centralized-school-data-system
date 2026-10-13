import { useEffect, useMemo, useState } from "react";
import FilterDropdown from "@/components/user-management/FilterDropdown";
import SearchBar from "@/components/user-management/SearchBar";
import UserCard from "@/components/user-management/UserCard";
import UserRow from "@/components/user-management/UserRow";
import AdminTablePagination from "@/components/shared/AdminTablePagination";

const PAGE_SIZE = 10;

const columns = [
  "User",
  "Role / Learning Area",
  "Assigned Classes",
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
  const [search, setSearch] = useState("");
  const [role, setRole] = useState(filters.roles[0]);
  const [learningArea, setLearningArea] = useState(filters.learningAreas[0]);
  const [status, setStatus] = useState(filters.statuses[0]);
  const [page, setPage] = useState(1);

  // Reset to page 1 on filter or search change
  useEffect(() => {
    setPage(1);
  }, [search, role, learningArea, status]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const searchable = [
        user.fullName,
        user.username,
        user.email,
        user.learningArea,
        ...(user.assignedClasses ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);
      const matchesRole = role === filters.roles[0] || user.role === role;
      const matchesLearningArea =
        learningArea === filters.learningAreas[0] ||
        user.learningArea === learningArea;
      const matchesStatus =
        status === filters.statuses[0] || user.status === status;

      return (
        matchesSearch &&
        matchesRole &&
        matchesLearningArea &&
        matchesStatus
      );
    });
  }, [filters, learningArea, role, search, status, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);

  const pagedUsers = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, safePage]);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-[13px] font-semibold text-slate-900">
            Users Directory
          </h2>
        </div>
        <span className="shrink-0 rounded-full bg-cnhs-green-soft px-2.5 py-1 text-[11px] font-semibold text-cnhs-green-dark">
          {filteredUsers.length === users.length
            ? `${users.length} users`
            : `${filteredUsers.length} of ${users.length}`}
        </span>
      </div>

      <div className="flex flex-col gap-2.5 border-b border-slate-100 bg-slate-50/50 p-3 md:flex-row md:items-center sm:px-4">
        <SearchBar value={search} onChange={setSearch} />
        <div className="flex shrink-0 flex-wrap gap-2 md:ml-auto">
          <FilterDropdown
            label="Role"
            options={filters.roles}
            value={role}
            onChange={setRole}
          />
          <FilterDropdown
            label="Learning Area"
            options={filters.learningAreas}
            value={learningArea}
            onChange={setLearningArea}
          />
          <FilterDropdown
            label="Account Status"
            options={filters.statuses}
            value={status}
            onChange={setStatus}
          />
        </div>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[800px] border-collapse text-left">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[20%]" />
            <col className="w-[28%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
          </colgroup>
          <thead className="bg-slate-50/80">
            <tr>
              {columns.map((column) => (
                <th
                  key={column}
                  className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 last:text-right"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length ? (
              pagedUsers.map((user) => (
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
                  className="px-4 py-10 text-center text-sm text-slate-400"
                >
                  No users match the current search and filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2.5 p-3 lg:hidden">
        {filteredUsers.length ? (
          pagedUsers.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              onView={onView}
              onEdit={onEdit}
              onResetPassword={onResetPassword}
              onToggleStatus={onToggleStatus}
            />
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">
            No users match the current search and filters.
          </p>
        )}
      </div>

      <AdminTablePagination
        page={safePage}
        pageSize={PAGE_SIZE}
        total={filteredUsers.length}
        onPageChange={setPage}
        itemLabel="users"
      />
    </section>
  );
}
