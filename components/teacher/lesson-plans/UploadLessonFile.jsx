"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CloudUpload } from "lucide-react";
import FileCard from "@/components/teacher/lesson-plans/FileCard";
import { lessonPlansData } from "@/data/teacher/lessonPlans";
import { confirmDelete } from "@/lib/ui/confirmAction";
import { cn } from "@/lib/utils";

const ACCEPTED = [".pdf", ".doc", ".docx"];
const MAX_BYTES = lessonPlansData.uploadHints.maxSizeMb * 1024 * 1024;

function getExtension(name) {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

export default function UploadLessonFile({ file, onFileChange, onBack, onPreview }) {
  const router = useRouter();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(file ? 100 : 0);

  function handleSelected(selected) {
    if (!selected) return;
    const extension = getExtension(selected.name);
    if (!ACCEPTED.includes(`.${extension}`)) {
      setError("Only PDF, DOC, and DOCX files are allowed.");
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError(`File exceeds the ${lessonPlansData.uploadHints.maxSizeMb} MB limit.`);
      return;
    }

    setError("");
    const meta = {
      name: selected.name,
      size: selected.size,
      extension,
      type: selected.type || extension,
      uploadedAt: new Date().toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    };
    simulateUpload(meta, selected);
  }

  function simulateUpload(meta, fileObject) {
    setProgress(0);
    let value = 0;
    const timer = window.setInterval(() => {
      value += 20;
      setProgress(Math.min(value, 100));
      if (value >= 100) {
        window.clearInterval(timer);
        onFileChange?.(meta, fileObject);
      }
    }, 120);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    handleSelected(dropped);
  }

  function handlePreview() {
    if (!file) {
      setError("Please upload a lesson plan file before continuing.");
      return;
    }
    onPreview?.();
    router.push("/teacher/lesson-plans/upload/preview");
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_280px]">
      <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)] sm:p-3.5">
        <h2 className="text-sm font-semibold text-slate-900">Upload File</h2>
        <p className="mt-1 text-[11px] text-slate-400">
          Accepted formats: PDF, DOCX, DOC. Maximum file size:{" "}
          {lessonPlansData.uploadHints.maxSizeMb} MB.
        </p>

        {!file ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "mt-4 flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-12 transition-colors",
              dragging
                ? "border-cnhs-green-dark bg-green-50/60"
                : "border-slate-200 bg-slate-50/40 hover:border-cnhs-green-dark/40 hover:bg-green-50/30"
            )}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-cnhs-green-dark shadow-sm">
              <CloudUpload size={24} />
            </span>
            <p className="mt-3 text-[13px] font-semibold text-slate-700">
              Drag & drop your file here or click to browse
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {lessonPlansData.uploadHints.acceptedFormats.map((format) => (
                <span
                  key={format}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500"
                >
                  {format}
                </span>
              ))}
            </div>
          </button>
        ) : (
          <div className="mt-4">
            <FileCard
              file={file}
              progress={progress}
              onReplace={() => inputRef.current?.click()}
              onRemove={() => {
                if (!confirmDelete(file?.name || "this file")) return;
                onFileChange?.(null, null);
                setProgress(0);
              }}
            />
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => handleSelected(e.target.files?.[0])}
        />

        {error ? <p className="mt-3 text-[11px] font-medium text-red-500">{error}</p> : null}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onBack?.()}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            <ArrowLeft size={14} />
            Back
          </button>
          <button
            type="button"
            onClick={handlePreview}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-[#9fc9b4] px-4 text-[12px] font-semibold text-cnhs-green-dark transition-colors hover:bg-[#8fbea6]"
          >
            Preview Submission
            <ArrowRight size={14} />
          </button>
        </div>
      </section>

      <aside className="space-y-3">
        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
          <h3 className="text-[12px] font-semibold text-slate-800">Accepted Formats</h3>
          <p className="mt-2 text-[11px] text-slate-500">
            {lessonPlansData.uploadHints.acceptedFormats.join(", ")}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_6px_16px_rgba(15,23,42,0.04)]">
          <h3 className="text-[12px] font-semibold text-slate-800">Maximum File Size</h3>
          <p className="mt-2 text-[11px] text-slate-500">
            {lessonPlansData.uploadHints.maxSizeMb} MB per upload
          </p>
        </div>
        <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4">
          <h3 className="text-[12px] font-semibold text-cnhs-orange">Submission Reminder</h3>
          <p className="mt-2 text-[11px] leading-5 text-slate-600">
            {lessonPlansData.uploadHints.reminder}
          </p>
        </div>
      </aside>
    </div>
  );
}
