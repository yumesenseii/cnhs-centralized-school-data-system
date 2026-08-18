"use client";

import { useMemo, useState } from "react";
import FilterDropdown from "@/components/user-management/FilterDropdown";
import SearchBar from "@/components/user-management/SearchBar";
import UserCard from "@/components/user-management/UserCard";
import UserRow from "@/components/user-management/UserRow";

const columns = [
  "User",
  "Role / Learning Area",
  "Assigned Classes",
  "Submissions",
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
  onDelete,
  currentAuthUserId,
}) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState(filters.roles[0]);
  const [learningArea, setLearningArea] = useState(filters.learningAreas[0]);
  const [status, setStatus] = useState(filters.statuses[0]);

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

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Users Directory
          </h2>
        </div>
        <span className="shrink-0 rounded-full bg-cnhs-green-soft px-2.5 py-1 text-[10px] font-semibold text-cnhs-green-dark">
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
        <table className="w-full min-w-[920px] border-collapse text-left">
          <colgroup>
            <col className="w-[24%]" />
            <col className="w-[16%]" />
            <col className="w-[22%]" />
            <col className="w-[18%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
          </colgroup>
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
            {filteredUsers.length ? (
              filteredUsers.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  onView={onView}
                  onEdit={onEdit}
                  onResetPassword={onResetPassword}
                  onToggleStatus={onToggleStatus}
                  onDelete={onDelete}
                  currentAuthUserId={currentAuthUserId}
                />
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-xs text-slate-500"
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
          filteredUsers.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              onView={onView}
              onEdit={onEdit}
              onResetPassword={onResetPassword}
              onToggleStatus={onToggleStatus}
              onDelete={onDelete}
              currentAuthUserId={currentAuthUserId}
            />
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-xs text-slate-500">
            No users match the current search and filters.
          </p>
        )}
      </div>
    </section>
  );
}
