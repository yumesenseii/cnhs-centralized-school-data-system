import { useEffect, useMemo, useState } from "react";
import { Loader2, Upload, UserPlus } from "lucide-react";
import SearchBar from "@/components/user-management/SearchBar";
import FilterDropdown from "@/components/user-management/FilterDropdown";
import { StatusBadge } from "@/components/user-management/StatusBadge";
import AdminTablePagination from "@/components/shared/AdminTablePagination";
import { cn } from "@/lib/utils";
import { confirmDestructive } from "@/lib/ui/confirmAction";

const linkFilters = ["All", "Linked", "Not linked"];
const statusFilters = ["All Status", "Active", "Inactive", "—"];
const PAGE_SIZE = 10;

export default function StudentsAccountsPanel({
  students = [],
  counts = { total: 0, linked: 0, unlinked: 0 },
  loading,
  onCreateAccount,
  onBulkInvite,
  onToggleStatus,
}) {
  const [search, setSearch] = useState("");
  const [linkFilter, setLinkFilter] = useState(linkFilters[0]);
  const [statusFilter, setStatusFilter] = useState(statusFilters[0]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [search, linkFilter, statusFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (students ?? []).filter((row) => {
      const hay = `${row.fullName} ${row.studentNumber} ${row.email}`
        .toLowerCase()
        .trim();
      const matchesSearch = !q || hay.includes(q);
      const matchesLink =
        linkFilter === "All" ||
        (linkFilter === "Linked" && row.linked) ||
        (linkFilter === "Not linked" && !row.linked);
      const matchesStatus =
        statusFilter === "All Status" || row.status === statusFilter;
      return matchesSearch && matchesLink && matchesStatus;
    });
  }, [students, search, linkFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);

  const pagedStudents = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  async function handleToggle(row) {
    if (!row.linked) return;
    const isActive = row.status === "Active";
    const confirmed = confirmDestructive(
      isActive
        ? `Deactivate portal access for ${row.fullName}?\n\nTheir learner record and grades stay. They will not be able to sign in until activated again.`
        : `Activate portal access for ${row.fullName}?`
    );
    if (!confirmed) return;
    await onToggleStatus?.(row);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 className="text-[13px] font-semibold text-slate-900">
            Student portal accounts
          </h2>
          <p className="mt-0.5 max-w-xl text-[12px] leading-snug text-slate-500">
            Emails come from the school contact list (CSV or typed). ECR has no
            email. Students cannot self-register. Prefer bulk invite for many
            learners.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-cnhs-green-soft px-2.5 py-1 text-[11px] font-semibold text-cnhs-green-dark">
            Linked {counts.linked} / {counts.total}
          </span>
          <button
            type="button"
            onClick={onBulkInvite}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-cnhs-green-dark/40 bg-white px-3 text-[12px] font-semibold text-cnhs-green-dark hover:bg-green-50"
          >
            <Upload size={13} />
            Bulk invite CSV
          </button>
          <button
            type="button"
            onClick={onCreateAccount}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-cnhs-green-dark px-3 text-[12px] font-semibold text-white hover:bg-[#246f54]"
          >
            <UserPlus size={13} />
            Create account
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 border-b border-slate-100 bg-slate-50/50 p-3 md:flex-row md:items-center sm:px-4">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search name, LRN, or email…"
        />
        <div className="flex shrink-0 flex-wrap gap-2 md:ml-auto">
          <FilterDropdown
            label="Link"
            options={linkFilters}
            value={linkFilter}
            onChange={setLinkFilter}
          />
          <FilterDropdown
            label="Status"
            options={statusFilters}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading learners…
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="bg-slate-50/80">
                {[
                  "Learner",
                  "LRN",
                  "Email",
                  "Portal link",
                  "Account status",
                  "Actions",
                ].map((column) => (
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
              {pagedStudents.length ? (
                pagedStudents.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t border-slate-100 transition-colors hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-[11px] font-semibold text-sky-800">
                          {row.initials || "—"}
                        </span>
                        <span className="text-[13px] font-semibold text-slate-900">
                          {row.fullName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-slate-600">
                      {row.studentNumber}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-600">
                      {row.email || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                          row.linked
                            ? "bg-cnhs-green-soft text-cnhs-green-dark"
                            : "bg-slate-100 text-slate-500"
                        )}
                      >
                        {row.linkLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.status === "—" ? (
                        <span className="text-[12px] text-slate-400">—</span>
                      ) : (
                        <StatusBadge value={row.status} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.linked ? (
                        <button
                          type="button"
                          onClick={() => handleToggle(row)}
                          className="inline-flex h-8 cursor-pointer items-center rounded-full border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 active:scale-95"
                        >
                          {row.status === "Active" ? "Deactivate" : "Activate"}
                        </button>
                      ) : (
                        <span className="text-[12px] text-slate-400">
                          Use Create / Bulk
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-slate-400"
                  >
                    No learners match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <AdminTablePagination
        page={safePage}
        pageSize={PAGE_SIZE}
        total={filtered.length}
        onPageChange={setPage}
        itemLabel="learners"
      />
    </section>
  );
}
