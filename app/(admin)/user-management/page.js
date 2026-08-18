"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Download, Loader2, UserPlus } from "lucide-react";
import Header from "@/components/layout/Header";
import AddUserModal from "@/components/user-management/AddUserModal";
import EditUserModal from "@/components/user-management/EditUserModal";
import ResetPasswordModal from "@/components/user-management/ResetPasswordModal";
import SummaryCards from "@/components/user-management/SummaryCards";
import UserDrawer from "@/components/user-management/UserDrawer";
import UsersTable from "@/components/user-management/UsersTable";
import { exportManagedUsersExcel } from "@/lib/admin/userExport";
import { createClient } from "@/lib/supabase/client";
import {
  createManagedUser,
  deleteManagedUser,
  getManagedUsers,
  resetManagedUserPassword,
  toggleManagedUserStatus,
  updateManagedUser,
} from "@/lib/supabase/queries/userManagement";
import DeleteConfirmModal from "@/components/shared/DeleteConfirmModal";

const EMPTY_DATA = {
  users: [],
  summaryCards: [
    { id: "total", label: "Total Users", count: 0, icon: "users", tone: "teal" },
    { id: "teachers", label: "Teachers", count: 0, icon: "teacher", tone: "green" },
    { id: "head-teachers", label: "Head Teachers", count: 0, icon: "shield", tone: "purple" },
    { id: "active", label: "Active Accounts", count: 0, icon: "check", tone: "green" },
  ],
  filters: {
    roles: ["All Roles", "Teacher", "Head Teacher"],
    learningAreas: ["All Learning Areas"],
    statuses: ["All Status", "Active", "Inactive"],
  },
  formOptions: {
    roles: ["Teacher", "Head Teacher"],
    learningAreas: [
      "English",
      "Filipino",
      "Mathematics",
      "Science",
      "Araling Panlipunan",
      "MAPEH",
      "TLE",
      "Values Education",
      "Administration",
    ],
    statuses: ["Active", "Inactive"],
  },
};

function HeaderControls({ onAddUser, onExportUsers, exporting, exportDisabled }) {
  return (
    <>
      <button
        type="button"
        onClick={onExportUsers}
        disabled={exportDisabled || exporting}
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-cnhs-green-dark/50 bg-white px-3 text-[11px] font-semibold text-cnhs-green-dark shadow-sm transition-colors duration-200 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {exporting ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Download size={13} />
        )}
        {exporting ? "Exporting…" : "Export Users"}
      </button>
      <button
        type="button"
        onClick={onAddUser}
        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#246f54]"
      >
        <UserPlus size={13} />
        Add User
      </button>
    </>
  );
}

async function resolveGeneratedBy() {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return "Head Teacher / Admin";
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    return profile?.full_name?.trim() || user.email || "Head Teacher / Admin";
  } catch {
    return "Head Teacher / Admin";
  }
}

export default function UserManagementPage() {
  const [data, setData] = useState(EMPTY_DATA);
  const [selectedUser, setSelectedUser] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [currentAuthUserId, setCurrentAuthUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    const result = await getManagedUsers();
    if (result.error) {
      setError(result.error.message || "Unable to load users.");
      setData(EMPTY_DATA);
    } else {
      setData(result.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!cancelled) setCurrentAuthUserId(data?.user?.id ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function openView(user) {
    setSelectedUser(user);
    setDrawerOpen(true);
  }

  function openEdit(user) {
    setSelectedUser(user);
    setDrawerOpen(false);
    setEditOpen(true);
  }

  function openReset(user) {
    setSelectedUser(user);
    setDrawerOpen(false);
    setResetOpen(true);
  }

  async function handleToggleStatus(user) {
    if (!user) return;
    const nextLabel = user.status === "Active" ? "deactivate" : "activate";
    const confirmed = window.confirm(
      `Are you sure you want to ${nextLabel} ${user.fullName}? This cannot be undone.`
    );
    if (!confirmed) return;

    const result = await toggleManagedUserStatus(user);
    if (result.error) {
      setError(result.error.message || `Unable to ${nextLabel} user.`);
      return;
    }
    await refresh();
  }

  async function handleDeleteUser() {
    if (!deleteUser) return;
    setDeleting(true);
    setError("");
    const result = await deleteManagedUser(deleteUser);
    setDeleting(false);
    if (result.error) {
      setError(result.error.message || "Unable to delete user.");
      return;
    }
    setDeleteUser(null);
    setDrawerOpen(false);
    setToast("User deleted.");
    await refresh();
  }

  async function handleCreateUser(payload) {
    const result = await createManagedUser(payload);
    if (!result.error) await refresh();
    return result;
  }

  async function handleUpdateUser(payload) {
    const result = await updateManagedUser(payload);
    if (!result.error) await refresh();
    return result;
  }

  async function handleResetPassword(payload) {
    return resetManagedUserPassword(payload);
  }

  async function handleExportUsers() {
    if (loading || exporting) return;
    if (!data.users?.length) {
      setError("No users available to export.");
      return;
    }

    setExporting(true);
    setError("");
    try {
      const generatedBy = await resolveGeneratedBy();
      await exportManagedUsersExcel({
        users: data.users,
        summaryCards: data.summaryCards,
        generatedBy,
      });
      setToast("User directory exported successfully.");
    } catch (err) {
      setError(err?.message || "Unable to export users.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="pb-5"
    >
      <Header
        breadcrumb="Home / User Management"
        title="User Management"
        description="Manage teacher and administrator accounts, class assignments, and user access."
        controls={
          <HeaderControls
            onAddUser={() => setAddOpen(true)}
            onExportUsers={handleExportUsers}
            exporting={exporting}
            exportDisabled={loading || !data.users.length}
          />
        }
      />

      {toast ? (
        <div className="mb-3 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-[12px] font-medium text-cnhs-green-dark">
          {toast}
        </div>
      ) : null}

      <SummaryCards cards={data.summaryCards} />

      <div className="mt-3">
        {error ? (
          <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        ) : null}
        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-10 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            Loading users…
          </div>
        ) : (
          <UsersTable
            users={data.users}
            filters={data.filters}
            onView={openView}
            onEdit={openEdit}
            onResetPassword={openReset}
            onToggleStatus={handleToggleStatus}
            onDelete={setDeleteUser}
            currentAuthUserId={currentAuthUserId}
          />
        )}
      </div>

      <UserDrawer
        open={drawerOpen}
        user={selectedUser}
        onClose={() => setDrawerOpen(false)}
        onEdit={openEdit}
        onResetPassword={openReset}
        onToggleStatus={handleToggleStatus}
      />

      <AddUserModal
        open={addOpen}
        options={data.formOptions}
        onClose={() => setAddOpen(false)}
        onSubmit={handleCreateUser}
      />

      <EditUserModal
        open={editOpen}
        user={selectedUser}
        options={data.formOptions}
        onClose={() => setEditOpen(false)}
        onSubmit={handleUpdateUser}
      />

      <ResetPasswordModal
        open={resetOpen}
        user={selectedUser}
        onClose={() => setResetOpen(false)}
        onReset={handleResetPassword}
      />

      <DeleteConfirmModal
        open={Boolean(deleteUser)}
        title="Delete user"
        itemLabel={deleteUser?.fullName ?? ""}
        consequence="This removes their login and profile. Teachers with assigned classes cannot be deleted until those classes are reassigned."
        confirmLabel="Delete user"
        confirming={deleting}
        confirmingLabel="Deleting…"
        onCancel={() => {
          if (!deleting) setDeleteUser(null);
        }}
        onConfirm={handleDeleteUser}
      />
    </motion.div>
  );
}
