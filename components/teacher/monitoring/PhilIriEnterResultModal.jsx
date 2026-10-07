"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Upload,
  Download,
  Eye,
  Info,
} from "lucide-react";
import { saveSinglePhilIriResult } from "@/lib/supabase/queries/monitoring";
import { useAppToast } from "@/components/shared/AppToast";
import AppSelect from "@/components/shared/AppSelect";
import { cn } from "@/lib/utils";

export default function PhilIriEnterResultModal({
  isOpen,
  onClose,
  learner = null,
  enrolledStudents = [],
  teacherId = null,
  schoolYear = "SY 2026-2027",
  quarter = 1,
  // Authoritative ARAL period; baseline saves are BOSY-gated in the backend.
  aralPeriod = null,
  onSuccess,
}) {
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [gstScore, setGstScore] = useState("");
  const [individualAssessment, setIndividualAssessment] = useState("Required");
  const [readingLevel, setReadingLevel] = useState("Instructional");
  const [subject, setSubject] = useState("English");
  const [documents, setDocuments] = useState([
    { name: "Form 1B.xlsx", size: "38 KB", type: "DepEd Form 1B" },
  ]);
  const [saving, setSaving] = useState(false);
  const { showToast } = useAppToast();
  const fileInputRef = useRef(null);

  // If learner is provided via props, prefill
  useEffect(() => {
    if (learner) {
      setSelectedStudentId(learner.studentId || learner.id || "");
      if (learner.philIriScore != null) {
        setGstScore(String(learner.philIriScore));
      } else {
        setGstScore("");
      }
      if (learner.readingLevel && learner.readingLevel !== "N/A") {
        setReadingLevel(learner.readingLevel);
      } else {
        setReadingLevel("Instructional");
      }
      if (learner.subject) {
        setSubject(learner.subject);
      }
    } else if (enrolledStudents.length > 0 && !selectedStudentId) {
      setSelectedStudentId(enrolledStudents[0].studentId || enrolledStudents[0].id || "");
    }
  }, [learner, enrolledStudents, isOpen]);

  // Derive active student
  const activeStudent = learner || enrolledStudents.find(
    (s) => (s.studentId || s.id) === selectedStudentId
  );

  // Auto adjust individual assessment recommendation based on GST score
  useEffect(() => {
    const score = Number(gstScore);
    if (!Number.isFinite(score) || gstScore === "") return;

    if (score < 28) {
      setIndividualAssessment("Required");
      if (score >= 0 && score <= 15) {
        setReadingLevel("Frustration");
      } else if (score >= 16 && score <= 27) {
        setReadingLevel("Instructional");
      }
    } else {
      setIndividualAssessment("Not Required");
      setReadingLevel("Independent");
    }
  }, [gstScore]);

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!activeStudent) {
      showToast("error", "Please select a student.");
      return;
    }

    const numericScore = Number(gstScore);
    if (!Number.isFinite(numericScore) || numericScore < 0 || numericScore > 40) {
      showToast("error", "GST score must be between 0 and 40.");
      return;
    }

    setSaving(true);
    try {
      const studentId = activeStudent.studentId || activeStudent.id;
      const classId = activeStudent.classId || null;

      // Interpretation
      const interpretation =
        numericScore <= 15
          ? "Individualized Assessment (Starting point: 3 grade levels below)"
          : numericScore <= 27
          ? "Individualized Assessment (Starting point: 2 grade levels below)"
          : "No further individualized assessment from GST";

      const res = await saveSinglePhilIriResult({
        studentId,
        classId,
        teacherId,
        schoolYear,
        quarter,
        subject: activeStudent.subject || subject || "English",
        gstScore: numericScore,
        individualAssessmentRequired: individualAssessment === "Required",
        readingLevel,
        screeningInterpretation: interpretation,
        documents,
        assessmentPeriod: aralPeriod,
      });

      if (res.error) {
        showToast("error", res.error.message || "Failed to save Phil-IRI assessment.");
        return;
      }

      showToast(
        "success",
        `Phil-IRI assessment saved for ${activeStudent.name || "Student"}.`
      );
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      showToast("error", "Error saving Phil-IRI assessment.");
    } finally {
      setSaving(false);
    }
  };
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileSize = (file.size / 1024).toFixed(0) + " KB";
    setDocuments((prev) => [
      ...prev,
      { name: file.name, size: fileSize, type: "Individual Record" },
    ]);
    showToast("success", `Attached document: ${file.name}`);
    
    // Clear input so the same file can be selected again if removed
    e.target.value = "";
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Enter Assessment Result
              </h2>
              <p className="text-[12px] text-slate-500">
                Record Phil-IRI Group Screening Test (GST) & reading assessment results.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.pdf,.docx,.doc"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Student Selector / Info */}
          {learner ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Student
              </p>
              <p className="text-sm font-bold text-slate-900">{activeStudent?.name}</p>
              <p className="text-[11px] text-slate-500">
                LRN: {activeStudent?.studentNumber || "—"} · {activeStudent?.grade} — {activeStudent?.section} · {activeStudent?.subject}
              </p>
            </div>
          ) : (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Select Student
              </label>
              <AppSelect
                value={selectedStudentId}
                onChange={(v) => setSelectedStudentId(v)}
                options={enrolledStudents.map((s) => ({
                  value: s.studentId || s.id,
                  label: `${s.name} (${s.grade} - ${s.section} · ${s.subject})`,
                }))}
                placeholder="Select a student"
                className="mt-1 w-full"
                triggerClassName="h-9 rounded-xl border-slate-200 text-[12px]"
                contentClassName="text-[12px]"
              />
            </div>
          )}

          {/* Language Subject */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Language
              </label>
              <AppSelect
                value={activeStudent?.subject || subject}
                onChange={(v) => setSubject(v)}
                disabled={Boolean(activeStudent?.subject)}
                options={[
                  { value: "English", label: "English" },
                  { value: "Filipino", label: "Filipino" },
                ]}
                className="mt-1 w-full"
                triggerClassName="h-9 rounded-xl border-slate-200 text-[12px]"
                contentClassName="text-[12px]"
              />
            </div>

            {/* GST Score (out of 40) */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                <span>GST Result</span>
                <span className="text-[10px] text-slate-400 font-normal">Score / 40</span>
              </label>
              <input
                type="number"
                min="0"
                max="40"
                value={gstScore}
                onChange={(e) => setGstScore(e.target.value)}
                placeholder="0–40"
                required
                className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-900 outline-none focus:border-cnhs-green"
              />
            </div>
          </div>

          {/* GST Interpretation Hint */}
          <div className="flex items-center gap-2 rounded-xl bg-blue-50/70 p-2.5 text-[11px] text-blue-800 border border-blue-100">
            <Info size={14} className="shrink-0 text-blue-600" />
            <span>
              {Number(gstScore) < 28
                ? "GST Score < 28: Learner is experiencing learning difficulties and requires further Individual Reading Assessment (Form 3)."
                : "GST Score >= 28: Benchmark passed. Learner is Grade Ready / Independent."}
            </span>
          </div>

          {/* Individual Assessment status */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Individual Assessment
            </label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {["Required", "Not Required", "Completed"].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setIndividualAssessment(status)}
                  className={cn(
                    "rounded-xl border py-2 text-[11px] font-semibold transition-all",
                    individualAssessment === status
                      ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  )}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Reading Level */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Reading Level
            </label>
            <AppSelect
              value={readingLevel}
              onChange={(v) => setReadingLevel(v)}
              options={[
                { value: "Frustration", label: "Frustration (3 Levels Down)" },
                { value: "Instructional", label: "Instructional (2 Levels Down)" },
                { value: "Independent", label: "Independent (Grade Ready)" },
                { value: "Non-Reader", label: "Non-Reader" },
              ]}
              className="mt-1 w-full"
              triggerClassName="h-9 rounded-xl border-slate-200 text-[12px] font-semibold"
              contentClassName="text-[12px] font-medium"
            />
          </div>

          {/* Documents Section */}
          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Attached Documents
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700"
              >
                <Upload size={11} />
                <span>Attach Form</span>
              </button>
            </div>

            <div className="mt-2 space-y-1.5">
              {documents.map((doc, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-1.5 text-[11px]"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileText size={13} className="text-blue-600 shrink-0" />
                    <span className="font-semibold text-slate-800 truncate">
                      {doc.name}
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      ({doc.size})
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => showToast("info", `Viewing ${doc.name}`)}
                      className="rounded p-1 text-slate-500 hover:text-blue-600"
                      title="View"
                    >
                      <Eye size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => showToast("success", `Downloading ${doc.name}`)}
                      className="rounded p-1 text-slate-500 hover:text-blue-600"
                      title="Download"
                    >
                      <Download size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-cnhs-green-dark px-5 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-[#246f54] disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              <span>Save Assessment</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
