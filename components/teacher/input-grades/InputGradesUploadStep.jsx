"use client";

import { useRef, useState } from "react";
import { ArrowRight, CloudUpload, Loader2 } from "lucide-react";
import FileCard from "@/components/teacher/lesson-plans/FileCard";
import { parseEClassRecord } from "@/lib/eclass/parseEClassRecord";
import {
  ACCEPTED_EXTENSIONS,
  validateEClassFile,
} from "@/lib/eclass/validateEClassFile";
import { confirmDelete } from "@/lib/ui/confirmAction";
import { cn } from "@/lib/utils";

function buildFileMeta(file) {
  const parts = file.name.split(".");
  const extension = parts.length > 1 ? parts.pop().toLowerCase() : "xlsx";
  return {
    name: file.name,
    size: file.size,
    extension,
    type: file.type || extension,
    uploadedAt: new Date().toLocaleString("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
  };
}

export default function InputGradesUploadStep({
  file,
  fileMeta,
  onParsed,
  onClear,
  onContinue,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [statusLabel, setStatusLabel] = useState("");
  const [parsing, setParsing] = useState(false);

  async function handleSelected(selected) {
    const validation = validateEClassFile(selected);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setError("");
    setParsing(true);
    setStatusLabel("Opening workbook...");

    try {
      const parsed = await parseEClassRecord(selected, {
        includeGrades: false,
        onProgress: ({ label }) => {
          setStatusLabel(label || "Reading INPUT DATA...");
        },
      });

      if (!parsed.ok || !parsed.metadata) {
        setError(parsed.error || "Could not read E-Class Record metadata.");
        onClear?.();
        return;
      }

      onParsed?.({
        file: selected,
        fileMeta: buildFileMeta(selected),
        metadata: parsed.metadata,
        learnerCount: parsed.learners?.length ?? 0,
      });
      setStatusLabel("");
    } catch (err) {
      setError(err?.message ?? "Unable to read the E-Class Record.");
      onClear?.();
    } finally {
      setParsing(false);
    }
  }

  function handleContinue() {
    if (!file || !fileMeta) {
      setError("Please upload an E-Class Record before continuing.");
      return;
    }
    onContinue?.();
  }

  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
      <h2 className="text-sm font-semibold text-slate-900">Upload ECR</h2>
      <p className="mt-1 text-[11px] text-slate-400">
        Official DepEd Excel (.xlsx), including Class-Record-v1 (INPUT + TERM
        sheets). The system reads grade, section, subject, and Term Grades from
        the matching quarter sheet. Visual student numbers (104793 + 6 digits)
        are generated when the file has learner names only.
      </p>

      {!fileMeta ? (
        <button
          type="button"
          disabled={parsing}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleSelected(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "mt-4 flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-12 transition-colors disabled:cursor-not-allowed",
            dragging
              ? "border-cnhs-green-dark bg-green-50/60"
              : "border-slate-200 bg-slate-50/40 hover:border-cnhs-green-dark/40"
          )}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-cnhs-green-dark shadow-sm">
            {parsing ? (
              <Loader2 size={22} className="animate-spin" />
            ) : (
              <CloudUpload size={22} />
            )}
          </span>
          <p className="mt-3 text-[13px] font-semibold text-slate-700">
            {parsing
              ? statusLabel || "Reading workbook..."
              : "Drag & drop your .xlsx file here or click to browse"}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Accepted: {ACCEPTED_EXTENSIONS.join(", ")} · Max 10 MB
          </p>
        </button>
      ) : (
        <div className="mt-4">
          <FileCard
            file={fileMeta}
            progress={parsing ? 60 : 100}
            onReplace={() => {
              onClear?.();
              setError("");
              inputRef.current?.click();
            }}
            onRemove={() => {
              if (!confirmDelete(fileMeta?.name || "this file")) return;
              onClear?.();
              setError("");
            }}
          />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => {
          const selected = e.target.files?.[0];
          e.target.value = "";
          if (selected) handleSelected(selected);
        }}
      />

      {error ? (
        <div className="mt-3 whitespace-pre-line rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[11px] font-medium leading-5 text-red-600">
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          disabled={!file || parsing}
          onClick={handleContinue}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-semibold text-white hover:bg-[#246f54] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Next
          <ArrowRight size={13} />
        </button>
      </div>
    </section>
  );
}
