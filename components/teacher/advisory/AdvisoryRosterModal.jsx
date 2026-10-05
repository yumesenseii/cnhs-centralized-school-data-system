"use client";

import React, { useRef, useState } from "react";
import {
  CloudUpload,
  Download,
  FileSpreadsheet,
  Loader2,
  School,
  Users,
  X,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { parseEClassRecord } from "@/lib/eclass/parseEClassRecord";
import {
  importOfficialSectionRoster,
  clearOfficialSectionRoster,
} from "@/lib/supabase/queries/advisoryRoster";
import { useAppToast } from "@/components/shared/AppToast";
import { cn } from "@/lib/utils";

export default function AdvisoryRosterModal({
  isOpen,
  onClose,
  section,
  learners = [],
  onSuccess,
}) {
  const [activeTab, setActiveTab] = useState("roster"); // 'roster' | 'upload'
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");
  const [parsedLearners, setParsedLearners] = useState([]);
  const inputRef = useRef(null);
  const { showToast } = useAppToast();

  const handleClearRoster = async () => {
    if (!section?.id) return;
    const confirmText = `Clear all enrolled learners from Grade ${section?.gradeLevel} — ${section?.sectionName}? This will reset the section roster to 0 learners for testing.`;
    if (!window.confirm(confirmText)) return;

    setClearing(true);
    setError("");
    try {
      const res = await clearOfficialSectionRoster(section.id);
      showToast(`Roster cleared: ${res.clearedCount} learner(s) removed from Grade ${section?.gradeLevel} — ${section?.sectionName}.`);
      await onSuccess?.();
    } catch (err) {
      setError(err?.message || "Failed to clear section roster.");
    } finally {
      setClearing(false);
    }
  };

  if (!isOpen) return null;

  const handleFileSelected = async (selected) => {
    if (!selected) return;
    setFile(selected);
    setError("");
    setParsing(true);
    setParsedLearners([]);

    try {
      const buffer = await selected.arrayBuffer();
      const parsed = await parseEClassRecord(selected, {
        arrayBuffer: buffer,
        includeGrades: false,
      });

      if (!parsed.ok && (!parsed.learners || parsed.learners.length === 0)) {
        throw new Error(parsed.error || "Unable to read learners from this file. Ensure it is a valid DepEd Class List or E-Record.");
      }

      setParsedLearners(parsed.learners || []);
    } catch (err) {
      setError(err?.message || "Failed to parse section roster file.");
      setParsedLearners([]);
    } finally {
      setParsing(false);
    }
  };

  const handleSaveRoster = async () => {
    if (!parsedLearners.length || !section?.id) return;
    setSaving(true);
    setError("");

    try {
      const result = await importOfficialSectionRoster(section.id, parsedLearners);
      showToast(
        `Official roster updated: ${result.totalRoster} learners established for Grade ${section.gradeLevel} — ${section.sectionName}.`
      );
      await onSuccess?.();
      onClose();
    } catch (err) {
      setError(err?.message || "Failed to save official section roster.");
    } finally {
      setSaving(false);
    }
  };

  const maleCount = learners.filter((l) => (l.sex || l.gender || "").toLowerCase().startsWith("m")).length;
  const femaleCount = learners.filter((l) => (l.sex || l.gender || "").toLowerCase().startsWith("f")).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-2xs">
      <div className="flex flex-col w-full max-w-2xl max-h-[85vh] rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-cnhs-green dark:text-emerald-400">
                Official Advisory Roster
              </span>
              <span>&bull;</span>
              <span>SY {section?.schoolYear || "2026-2027"}</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              Grade {section?.gradeLevel} &mdash; {section?.sectionName}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Adviser: <strong>{section?.adviserName || "Class Adviser"}</strong> &bull; {learners.length} Enrolled ({maleCount} Male, {femaleCount} Female)
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-4 border-b border-slate-200 px-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("roster")}
            className={cn(
              "py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer",
              activeTab === "roster"
                ? "border-cnhs-green text-cnhs-green dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <span>Current Section Roster ({learners.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={cn(
              "py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer",
              activeTab === "upload"
                ? "border-cnhs-green text-cnhs-green dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <span>Upload Official Roster (.xlsx)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "roster" ? (
            <div>
              <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
                <span>
                  Official authority: This roster determines learner membership for all subject E-Records.
                </span>
                <div className="flex items-center gap-3">
                  {learners.length > 0 && (
                    <button
                      type="button"
                      disabled={clearing}
                      onClick={handleClearRoster}
                      className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700 font-semibold cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 size={12} />
                      <span>{clearing ? "Clearing..." : "Clear Roster"}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTab("upload")}
                    className="font-semibold text-cnhs-green hover:underline cursor-pointer"
                  >
                    + Upload / Update Roster
                  </button>
                </div>
              </div>

              {learners.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  <Users size={28} className="mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">No learners enrolled in this section yet.</p>
                  <p className="text-[11px] mt-1">Upload an official DepEd class list or E-Record to establish the section roster.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-slate-600 text-[11px] font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-2.5 w-10 text-center">#</th>
                      <th className="py-2 px-2.5">LRN</th>
                      <th className="py-2 px-2.5">Learner Name</th>
                      <th className="py-2 px-2.5 text-center">Sex</th>
                      <th className="py-2 px-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11.5px]">
                    {learners.map((learner, idx) => (
                      <tr key={learner.id || idx} className="hover:bg-slate-50">
                        <td className="py-2 px-2.5 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-2.5 font-mono text-[11px] text-slate-700">
                          {learner.lrn || learner.student_number || "—"}
                        </td>
                        <td className="py-2 px-2.5 font-semibold text-slate-900">
                          {learner.name || `${learner.last_name || ""}, ${learner.first_name || ""}`}
                        </td>
                        <td className="py-2 px-2.5 text-center text-slate-600">
                          {learner.gender || learner.sex || "—"}
                        </td>
                        <td className="py-2 px-2.5 text-center">
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-cnhs-green border border-emerald-200">
                            Enrolled
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-600 leading-relaxed">
                <strong>Adviser Authority:</strong> Upload your official DepEd Class List or E-Record (.xlsx) to enroll or update learners in <strong>Grade {section?.gradeLevel} &mdash; {section?.sectionName}</strong>. This establishes the official section reference used by all subject teachers when validating grades.
              </div>

              {/* Dropzone */}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={parsing || saving}
                className="flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/40 px-4 py-8 hover:border-cnhs-green transition-colors disabled:cursor-not-allowed"
              >
                <CloudUpload size={24} className="text-cnhs-green mb-2" />
                <p className="text-xs font-semibold text-slate-700">
                  {file ? file.name : "Select or drag DepEd Class List / E-Record (.xlsx)"}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">Official section roster source</p>
              </button>

              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => handleFileSelected(e.target.files?.[0])}
              />

              {parsing && (
                <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-500">
                  <Loader2 size={14} className="animate-spin text-cnhs-green" />
                  <span>Reading official roster from file...</span>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {parsedLearners.length > 0 && !parsing && (
                <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">
                      Found {parsedLearners.length} learners in file
                    </span>
                    <span className="text-[11px] text-cnhs-green font-semibold">
                      Ready to establish section membership
                    </span>
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-slate-100 rounded">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] text-slate-500">
                        <tr>
                          <th className="p-1.5">#</th>
                          <th className="p-1.5">LRN</th>
                          <th className="p-1.5">Full Name</th>
                          <th className="p-1.5 text-center">Gender</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        {parsedLearners.slice(0, 15).map((l, i) => (
                          <tr key={i}>
                            <td className="p-1.5 text-slate-400">{i + 1}</td>
                            <td className="p-1.5 font-mono">{l.student_number}</td>
                            <td className="p-1.5 font-medium">{l.full_name}</td>
                            <td className="p-1.5 text-center">{l.gender || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parsedLearners.length > 15 && (
                      <div className="p-1.5 text-center text-[10px] text-slate-400 bg-slate-50">
                        ...and {parsedLearners.length - 15} more learners
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
          {activeTab === "upload" && parsedLearners.length > 0 && (
            <button
              type="button"
              onClick={handleSaveRoster}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cnhs-green px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#115a3e] disabled:opacity-50"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : null}
              <span>{saving ? "Saving Official Roster..." : `Establish Roster (${parsedLearners.length} Learners)`}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
