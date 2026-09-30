"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import Header from "@/components/layout/Header";
import AssignmentFormModal from "@/components/class-assignments/AssignmentFormModal";
import AssignmentSummaryCards from "@/components/class-assignments/AssignmentSummaryCards";
import AssignmentsTable from "@/components/class-assignments/AssignmentsTable";
import DeleteConfirmModal from "@/components/shared/DeleteConfirmModal";
import { useAppToast } from "@/components/shared/AppToast";
import DeleteRequestsPanel from "@/components/admin/DeleteRequestsPanel";
import { useClassAssignments } from "@/hooks/admin/useClassAssignments";
import { suggestCurrentSchoolYear } from "@/lib/admin/sectionMappers";
import {
  approveDeleteRequest,
  listPendingDeleteRequests,
  rejectDeleteRequest,
} from "@/lib/supabase/queries/deleteRequests";

export default function ClassAssignmentManagement({ embedded = false }) {
  const {
    assignments,
    teachers,
    subjects,
    sections,
    schoolYears,
    summary,
    loading,
    refreshing,
    saving,
    error,
    filters,
    setFilters,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleClearGrades,
    handleClearAllGrades,
  } = useClassAssignments();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selected, setSelected] = useState(null);
  const { showToast } = useAppToast();
  const [confirm, setConfirm] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [requestsError, setRequestsError] = useState("");

  async function refreshRequests() {
    const result = await listPendingDeleteRequests();
    if (result.error) {
      setRequestsError(result.error.message);
      setPendingRequests([]);
      return;
    }
    setRequestsError("");
    setPendingRequests(result.data ?? []);
  }

  useEffect(() => {
    refreshRequests();
  }, []);

  const defaultSchoolYear = schoolYears[0] || suggestCurrentSchoolYear();

  function openCreate() {
    setSelected(null);
    setModalMode("create");
    setModalOpen(true);
  }

  function openEdit(assignment) {
    setSelected(assignment);
    setModalMode("edit");
    setModalOpen(true);
  }

  async function submitForm(payload) {
    if (modalMode === "edit" && selected) {
      const result = await handleUpdate(selected.id, payload);
      if (result.ok) {
        setModalOpen(false);
        showToast(
          payload?.allQuarters
            ? result.message || "Missing term assignments created."
            : "Class assignment updated."
        );
      }
      return result;
    }

    const result = await handleCreate(payload);
    if (result.ok) {
      setModalOpen(false);
      showToast(result.message || "Teacher assigned to class.");
    }
    return result;
  }

  async function onClearGrades(assignment) {
    const label = `${assignment.subjectName} · ${assignment.gradeLabel} ${assignment.sectionName} · ${assignment.quarterLabel} · ${assignment.schoolYear}`;
    setConfirm({
      kind: "clear",
      assignment,
      title: "Clear grades",
      itemLabel: label,
      consequence:
        "Imported grades and the class list for this term will be removed. The assignment stays. The teacher can re-upload the E-Class Record.",
      confirmLabel: "Clear grades",
      icon: "clear",
    });
  }

  async function onDelete(assignment) {
    const label = `${assignment.teacherName} — ${assignment.subjectName} (${assignment.gradeLabel} ${assignment.sectionName}, ${assignment.schoolYear}, ${assignment.quarterLabel})`;
    setConfirm({
      kind: "delete",
      assignment,
      title: "Delete class",
      itemLabel: label,
      consequence: "This class assignment will be removed. This cannot be undone.",
      confirmLabel: "Delete",
      icon: "delete",
    });
  }

  async function onClearAll() {
    const yearLabel = filters.schoolYear || "All School Years";
    const scope =
      yearLabel === "All School Years"
        ? "all school years"
        : yearLabel;
    setConfirm({
      kind: "clear-all",
      title: "Clear all",
      itemLabel: scope,
      consequence:
        "Imported grades and class lists will be removed. Class assignments, teachers, sections, and lesson plans stay. Teachers can re-upload E-Class Records afterward.",
      confirmLabel: "Clear all",
      icon: "clear",
    });
  }

  async function runConfirm() {
    if (confirm?.kind === "clear-all") {
      setConfirming(true);
      const result = await handleClearAllGrades(filters.schoolYear);
      setConfirming(false);
      setConfirm(null);
      if (result.ok) {
        const grades = result.gradesDeleted ?? 0;
        const enrollments = result.enrollmentsDeleted ?? 0;
        showToast(
          grades || enrollments
            ? `Cleared ${grades} grade row(s) and ${enrollments} enrollment(s). Assignments kept.`
            : "No imported grades to clear."
        );
      }
      return;
    }
    if (!confirm?.assignment) return;
    setConfirming(true);
    if (confirm.kind === "clear") {
      const result = await handleClearGrades(confirm.assignment.id);
      setConfirming(false);
      setConfirm(null);
      if (result.ok) {
        const grades = result.gradesDeleted ?? 0;
        const enrollments = result.enrollmentsDeleted ?? 0;
        showToast(
          grades || enrollments
            ? `Cleared ${grades} grade row(s) and ${enrollments} enrollment(s). Class assignment kept.`
            : "No grades found for this class. Assignment unchanged."
        );
      }
      return;
    }
    const result = await handleDelete(confirm.assignment.id);
    setConfirming(false);
    setConfirm(null);
    if (result.ok) showToast("Class assignment removed.");
  }

  if (loading && !assignments.length && !refreshing) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white px-4 py-10 text-center text-sm text-slate-400">
        Loading class assignments...
      </div>
    );
  }

  if (error && error.toLowerCase().includes("admin") && !assignments.length) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-10 text-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  const assignButton = (
    <button
      type="button"
      onClick={openCreate}
      className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#246f54]"
    >
      <Plus size={13} />
      Assign Class
    </button>
  );

  const headerControls = (
    <div className="flex flex-wrap items-center gap-2">
      {assignButton}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={embedded ? "pb-2" : "pb-5"}
    >
      {embedded ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-slate-500">
            Assign teachers to subjects and sections by school year and quarter. Teachers only see classes assigned to them.
          </p>
          {headerControls}
        </div>
      ) : (
        <Header
          breadcrumb="Home / Classes & Sections / Class Assignments"
          title="Class Assignments"
          description="Assign teachers to subjects and sections by school year and quarter. Teachers only see classes assigned to them."
          controls={headerControls}
        />
      )}

      {error ? (
        <p className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-600">
          {error}
        </p>
      ) : null}

      <DeleteRequestsPanel
        requests={pendingRequests}
        error={requestsError}
        onApprove={async (row) => {
          const result = await approveDeleteRequest(row.id);
          if (result.error) showToast(result.error.message);
          else showToast("Request approved.");
          await refreshRequests();
        }}
        onReject={async (row) => {
          const result = await rejectDeleteRequest(row.id);
          if (result.error) showToast(result.error.message);
          else showToast("Request declined.");
          await refreshRequests();
        }}
      />

      <AssignmentSummaryCards cards={summary} />

      <div className="mt-4">
        <AssignmentsTable
          assignments={assignments}
          filters={filters}
          schoolYears={schoolYears}
          teachers={teachers}
          onFiltersChange={setFilters}
          onEdit={openEdit}
          onDelete={onDelete}
          busy={saving}
        />
      </div>

      <AssignmentFormModal
        open={modalOpen}
        mode={modalMode}
        assignment={selected}
        teachers={teachers}
        subjects={subjects}
        sections={sections}
        schoolYears={schoolYears}
        defaultSchoolYear={defaultSchoolYear}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSubmit={submitForm}
      />

      <DeleteConfirmModal
        open={Boolean(confirm)}
        title={confirm?.title}
        itemLabel={confirm?.itemLabel}
        consequence={confirm?.consequence}
        confirmLabel={confirm?.confirmLabel}
        confirming={confirming}
        confirmingLabel={
          confirm?.kind === "clear" || confirm?.kind === "clear-all"
            ? "Clearing…"
            : "Deleting…"
        }
        icon={confirm?.icon}
        onCancel={() => !confirming && setConfirm(null)}
        onConfirm={runConfirm}
      />
    </motion.div>
  );
}
