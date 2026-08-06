"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import Header from "@/components/layout/Header";
import AssignmentFormModal from "@/components/class-assignments/AssignmentFormModal";
import AssignmentSummaryCards from "@/components/class-assignments/AssignmentSummaryCards";
import AssignmentsTable from "@/components/class-assignments/AssignmentsTable";
import { useClassAssignments } from "@/hooks/admin/useClassAssignments";
import { suggestCurrentSchoolYear } from "@/lib/admin/sectionMappers";
import { confirmDelete } from "@/lib/ui/confirmAction";

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
  } = useClassAssignments();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState("");

  const defaultSchoolYear = schoolYears[0] || suggestCurrentSchoolYear();

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

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

  async function onDelete(assignment) {
    const label = `${assignment.teacherName} — ${assignment.subjectName} (${assignment.gradeLabel} ${assignment.sectionName}, ${assignment.schoolYear}, ${assignment.quarterLabel})`;
    if (!confirmDelete(label)) return;
    const result = await handleDelete(assignment.id);
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
          {assignButton}
        </div>
      ) : (
        <Header
          breadcrumb="Home / Classes & Sections / Class Assignments"
          title="Class Assignments"
          description="Assign teachers to subjects and sections by school year and quarter. Teachers only see classes assigned to them."
          controls={assignButton}
        />
      )}

      {error ? (
        <p className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-600">
          {error}
        </p>
      ) : null}

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

      {toast ? (
        <div className="fixed bottom-5 right-5 z-[70] rounded-xl bg-slate-900 px-4 py-2.5 text-[11px] font-medium text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </motion.div>
  );
}
