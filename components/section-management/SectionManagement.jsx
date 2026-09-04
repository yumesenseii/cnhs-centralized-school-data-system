"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import Header from "@/components/layout/Header";
import SectionFormModal from "@/components/section-management/SectionFormModal";
import SectionSummaryCards from "@/components/section-management/SectionSummaryCards";
import SectionsTable from "@/components/section-management/SectionsTable";
import DeleteConfirmModal from "@/components/shared/DeleteConfirmModal";
import { useSectionManagement } from "@/hooks/admin/useSections";
import { suggestCurrentSchoolYear } from "@/lib/admin/sectionMappers";

function sectionLabel(section) {
  if (!section) return "";
  return `${section.gradeLabel} — ${section.sectionName} (${section.schoolYear})`;
}

export default function SectionManagement({ embedded = false }) {
  const {
    sections,
    teachers,
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
    handleArchive,
    handleRestore,
  } = useSectionManagement();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);

  const defaultSchoolYear =
    schoolYears[0] || suggestCurrentSchoolYear();

  function showToast(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  function openCreate() {
    setSelected(null);
    setModalMode("create");
    setModalOpen(true);
  }

  function openEdit(section) {
    setSelected(section);
    setModalMode("edit");
    setModalOpen(true);
  }

  async function submitForm(payload) {
    if (modalMode === "edit" && selected) {
      const result = await handleUpdate(selected.id, payload);
      if (result.ok) {
        setModalOpen(false);
        showToast("Section updated.");
      }
      return result;
    }

    const result = await handleCreate(payload);
    if (result.ok) {
      setModalOpen(false);
      showToast("Section created.");
    }
    return result;
  }

  function onArchive(section) {
    setConfirmAction({ type: "archive", section });
  }

  function onRestore(section) {
    setConfirmAction({ type: "restore", section });
  }

  async function confirmPendingAction() {
    if (!confirmAction?.section) return;
    const { type, section } = confirmAction;

    if (type === "archive") {
      const result = await handleArchive(section.id);
      if (result.ok) {
        setConfirmAction(null);
        showToast("Section archived.");
      }
      return;
    }

    if (type === "restore") {
      const result = await handleRestore(section.id);
      if (result.ok) {
        setConfirmAction(null);
        showToast("Section restored to Active.");
      }
    }
  }

  if (loading && !sections.length && !refreshing) {
    return (
      <div className="rounded-xl border border-slate-100 bg-white px-4 py-10 text-center text-sm text-slate-400">
        Loading sections...
      </div>
    );
  }

  if (error && !sections.length && error.toLowerCase().includes("admin")) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-10 text-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  const createButton = (
    <button
      type="button"
      onClick={openCreate}
      className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-[#246f54]"
    >
      <Plus size={13} />
      Create Section
    </button>
  );

  const isArchive = confirmAction?.type === "archive";
  const pendingSection = confirmAction?.section;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={embedded ? "pb-2" : "pb-5"}
    >
      {embedded ? (
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          {createButton}
        </div>
      ) : (
        <Header
          breadcrumb="Home / Classes & Sections / Sections"
          title="Sections"
          controls={createButton}
        />
      )}

      {error ? (
        <p className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-600">
          {error}
        </p>
      ) : null}

      <SectionSummaryCards cards={summary} />

      <div className="mt-4">
        <SectionsTable
          sections={sections}
          filters={filters}
          schoolYears={schoolYears}
          onFiltersChange={setFilters}
          onEdit={openEdit}
          onArchive={onArchive}
          onRestore={onRestore}
          busy={saving}
        />
      </div>

      <SectionFormModal
        open={modalOpen}
        mode={modalMode}
        section={selected}
        teachers={teachers}
        schoolYears={schoolYears}
        defaultSchoolYear={defaultSchoolYear}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSubmit={submitForm}
      />

      <DeleteConfirmModal
        open={Boolean(confirmAction)}
        title={isArchive ? "Archive section" : "Restore section"}
        itemLabel={sectionLabel(pendingSection)}
        consequence={
          isArchive
            ? "Historical records will be kept."
            : "This section will be set back to Active."
        }
        confirmLabel={isArchive ? "Archive" : "Restore"}
        confirming={saving}
        confirmingLabel={isArchive ? "Archiving…" : "Restoring…"}
        tone={isArchive ? "danger" : "request"}
        onCancel={() => {
          if (!saving) setConfirmAction(null);
        }}
        onConfirm={confirmPendingAction}
      />

      {toast ? (
        <div className="fixed bottom-5 right-5 z-[70] rounded-xl bg-slate-900 px-4 py-2.5 text-[11px] font-medium text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </motion.div>
  );
}
