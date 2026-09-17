"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Download, Loader2, UserPlus } from "lucide-react";
import Header from "@/components/layout/Header";
import AddUserModal from "@/components/user-management/AddUserModal";
import BulkInviteStudentsModal from "@/components/user-management/BulkInviteStudentsModal";
import CreateStudentAccountModal from "@/components/user-management/CreateStudentAccountModal";
import EditUserModal from "@/components/user-management/EditUserModal";
import ResetPasswordModal from "@/components/user-management/ResetPasswordModal";
import StudentsAccountsPanel from "@/components/user-management/StudentsAccountsPanel";
import SummaryCards from "@/components/user-management/SummaryCards";
import UserDrawer from "@/components/user-management/UserDrawer";
import UsersTable from "@/components/user-management/UsersTable";
import { exportManagedUsersExcel } from "@/lib/admin/userExport";
import { createClient } from "@/lib/supabase/client";
import {
  createManagedUser,
  getManagedUsers,
  resetManagedUserPassword,
  toggleManagedUserStatus,
  updateManagedUser,
} from "@/lib/supabase/queries/userManagement";
import {
  bulkInviteStudentAccounts,
  createStudentPortalAccount,
  getManagedStudentAccounts,
  toggleStudentPortalAccountStatus,
} from "@/lib/supabase/queries/studentAccounts";
import { confirmDestructive } from "@/lib/ui/confirmAction";
import { useAppToast } from "@/components/shared/AppToast";
import { cn } from "@/lib/utils";

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

const EMPTY_STUDENTS = {
  students: [],
  counts: { total: 0, linked: 0, unlinked: 0 },
};

function HeaderControls({
  directory,
  onAddUser,
  onExportUsers,
  onCreateStudent,
  onBulkInvite,
  exporting,
  exportDisabled,
}) {
  if (directory === "students") {
    return (
      <>
        <button
          type="button"
          onClick={onBulkInvite}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-cnhs-green-dark/50 bg-white px-3 text-[11px] font-semibold text-cnhs-green-dark shadow-sm transition-colors duration-200 hover:bg-green-50"
        >
          Bulk invite CSV
        </button>
        <button
          type="button"
          onClick={onCreateStudent}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#246f54]"
        >
          <UserPlus size={13} />
          Create student account
        </button>
      </>
    );
  }

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
  const [directory, setDirectory] = useState("staff");
  const [data, setData] = useState(EMPTY_DATA);
  const [studentData, setStudentData] = useState(EMPTY_STUDENTS);
  const [selectedUser, setSelectedUser] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [createStudentOpen, setCreateStudentOpen] = useState(false);
  const [bulkInviteOpen, setBulkInviteOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const { showToast } = useAppToast();

  const refreshStaff = useCallback(async () => {
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

  const refreshStudents = useCallback(async () => {
    setStudentsLoading(true);
    setError("");
    const result = await getManagedStudentAccounts();
    if (result.error) {
      setError(result.error.message || "Unable to load student accounts.");
      setStudentData(EMPTY_STUDENTS);
    } else {
      setStudentData(result.data);
    }
    setStudentsLoading(false);
  }, []);

  useEffect(() => {
    refreshStaff();
  }, [refreshStaff]);

  useEffect(() => {
    if (directory === "students") {
      refreshStudents();
    }
  }, [directory, refreshStudents]);

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
    const isActive = user.status === "Active";
    const confirmed = confirmDestructive(
      isActive
        ? `Deactivate ${user.fullName}?\n\nThey will not be able to sign in. Their profile and academic records stay in the system so you can activate them again if they return.`
        : `Activate ${user.fullName}?\n\nThis restores access to the same account and keeps their existing records.`
    );
    if (!confirmed) return;

    const nextLabel = isActive ? "deactivate" : "activate";
    const result = await toggleManagedUserStatus(user);
    if (result.error) {
      setError(result.error.message || `Unable to ${nextLabel} user.`);
      return;
    }
    showToast(isActive ? "User deactivated." : "User activated.");
    await refreshStaff();
  }

  async function handleCreateUser(payload) {
    const result = await createManagedUser(payload);
    if (!result.error) {
      const email = String(payload.email ?? "").trim();
      showToast(
        email
          ? `Account created. Temporary password sent to ${email}.`
          : "Account created. Temporary password sent."
      );
      await refreshStaff();
    }
    return result;
  }

  async function handleUpdateUser(payload) {
    const result = await updateManagedUser(payload);
    if (!result.error) await refreshStaff();
    return result;
  }

  async function handleResetPassword(payload) {
    return resetManagedUserPassword(payload);
  }

  async function handleCreateStudent(payload) {
    const result = await createStudentPortalAccount(payload);
    if (!result.error) {
      if (result.data?.emailSent) {
        showToast(
          `Student account created. Temporary password sent to ${payload.email}.`
        );
      } else {
        showToast(
          "Student account created. Email failed — copy the temporary password shown."
        );
      }
      await refreshStudents();
    }
    return result;
  }

  async function handleBulkInvite(rows) {
    const result = await bulkInviteStudentAccounts(rows);
    if (!result.error) {
      const s = result.data?.summary;
      showToast(
        `Bulk invite finished: ${s?.created ?? 0} created, ${s?.skipped ?? 0} skipped, ${s?.failed ?? 0} failed.`
      );
      await refreshStudents();
    }
    return result;
  }

  async function handleToggleStudentStatus(student) {
    const result = await toggleStudentPortalAccountStatus(student);
    if (result.error) {
      setError(result.error.message || "Unable to update student account.");
      return;
    }
    showToast(
      student.status === "Active"
        ? "Student portal access deactivated."
        : "Student portal access activated."
    );
    await refreshStudents();
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
      showToast("User directory exported successfully.");
    } catch (err) {
      setError(err?.message || "Unable to export users.");
    } finally {
      setExporting(false);
    }
  }

  const studentSummaryCards = [
    {
      id: "learners",
      label: "Learners",
      count: studentData.counts.total,
      icon: "users",
      tone: "teal",
    },
    {
      id: "linked",
      label: "Linked accounts",
      count: studentData.counts.linked,
      icon: "check",
      tone: "green",
    },
    {
      id: "unlinked",
      label: "Not linked",
      count: studentData.counts.unlinked,
      icon: "teacher",
      tone: "purple",
    },
    {
      id: "active-students",
      label: "Active portals",
      count: studentData.students.filter((row) => row.status === "Active").length,
      icon: "shield",
      tone: "green",
    },
  ];

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
        description={
          directory === "students"
            ? "Provision student portal logins for existing learners. School-controlled — no self-registration."
            : "Manage teacher and administrator accounts, class assignments, and user access."
        }
        controls={
          <HeaderControls
            directory={directory}
            onAddUser={() => setAddOpen(true)}
            onExportUsers={handleExportUsers}
            onCreateStudent={() => setCreateStudentOpen(true)}
            onBulkInvite={() => setBulkInviteOpen(true)}
            exporting={exporting}
            exportDisabled={loading || !data.users.length}
          />
        }
      />

      <div className="mb-3 inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
        {[
          { id: "staff", label: "Staff" },
          { id: "students", label: "Students" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setDirectory(tab.id)}
            className={cn(
              "cursor-pointer rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-colors",
              directory === tab.id
                ? "bg-cnhs-green-dark text-white"
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <SummaryCards
        cards={directory === "students" ? studentSummaryCards : data.summaryCards}
      />

      <div className="mt-3">
        {error ? (
          <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        {directory === "students" ? (
          <StudentsAccountsPanel
            students={studentData.students}
            counts={studentData.counts}
            loading={studentsLoading}
            onCreateAccount={() => setCreateStudentOpen(true)}
            onBulkInvite={() => setBulkInviteOpen(true)}
            onToggleStatus={handleToggleStudentStatus}
          />
        ) : loading ? (
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

      <CreateStudentAccountModal
        open={createStudentOpen}
        students={studentData.students}
        onClose={() => setCreateStudentOpen(false)}
        onSubmit={handleCreateStudent}
      />

      <BulkInviteStudentsModal
        open={bulkInviteOpen}
        onClose={() => setBulkInviteOpen(false)}
        onSubmit={handleBulkInvite}
      />
    </motion.div>
  );
}
