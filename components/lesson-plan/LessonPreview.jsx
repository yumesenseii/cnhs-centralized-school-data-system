"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";

function fileKind(lesson) {
  const type = String(lesson?.fileType || "").toLowerCase();
  const name = String(lesson?.fileName || "").toLowerCase();
  if (type.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (
    type.includes("wordprocessingml") ||
    type.includes("officedocument") ||
    name.endsWith(".docx")
  ) {
    return "docx";
  }
  if (type.includes("msword") || name.endsWith(".doc")) return "doc";
  return "other";
}

/**
 * In-system lesson plan viewer for admin/HT review.
 * PDF and DOCX render in the drawer; Download is secondary.
 */
export default function LessonPreview({ lesson, fileUrl }) {
  const kind = fileKind(lesson);
  const [docxHtml, setDocxHtml] = useState("");
  const [docxError, setDocxError] = useState("");
  const [loadingDocx, setLoadingDocx] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDocx() {
      if (kind !== "docx" || !fileUrl) {
        setDocxHtml("");
        setDocxError("");
        setLoadingDocx(false);
        return;
      }
      setLoadingDocx(true);
      setDocxError("");
      setDocxHtml("");
      try {
        const mammoth = await import("mammoth");
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error("Unable to load the lesson plan file.");
        }
        const buffer = await response.arrayBuffer();
        const convertToHtml = mammoth.convertToHtml ?? mammoth.default?.convertToHtml;
        const images = mammoth.images ?? mammoth.default?.images;
        const result = await convertToHtml(
          { arrayBuffer: buffer },
          {
            convertImage: images?.imgElement(async (image) => {
              const base64 = await image.read("base64");
              return {
                src: `data:${image.contentType};base64,${base64}`,
              };
            }),
          }
        );
        if (cancelled) return;
        if (!String(result.value || "").trim()) {
          setDocxError(
            "This Word file has no readable text in the preview. Use Download if you need the original file."
          );
        } else {
          setDocxHtml(result.value);
        }
      } catch (err) {
        if (!cancelled) {
          setDocxError(
            err?.message ||
              "Unable to preview this Word file in the system. Download remains available."
          );
        }
      } finally {
        if (!cancelled) setLoadingDocx(false);
      }
    }

    loadDocx();
    return () => {
      cancelled = true;
    };
  }, [kind, fileUrl]);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
          Review content
        </h3>
        {fileUrl ? (
          <a
            href={fileUrl}
            download={lesson.fileName || true}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Download size={13} />
            Download file
          </a>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
          <FileText size={14} className="shrink-0 text-slate-400" />
          <span className="min-w-0 truncate text-xs font-semibold text-slate-600">
            {lesson.fileName || "Lesson plan file"}
          </span>
        </div>

        {!fileUrl ? (
          <div className="px-5 py-12 text-center text-sm text-slate-500">
            No file is attached to this submission.
          </div>
        ) : kind === "pdf" ? (
          <iframe
            title={lesson.fileName || "Lesson plan PDF"}
            src={fileUrl}
            className="h-[min(68vh,760px)] w-full bg-white"
          />
        ) : kind === "docx" ? (
          <div className="h-[min(68vh,760px)] w-full overflow-auto bg-white px-4 py-4">
            {loadingDocx ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                Loading lesson plan…
              </div>
            ) : docxError ? (
              <p className="py-10 text-center text-sm text-slate-500">
                {docxError}
              </p>
            ) : (
              <div
                className="lesson-plan-docx w-full text-[13px] leading-5 text-slate-800"
                dangerouslySetInnerHTML={{ __html: docxHtml }}
              />
            )}
          </div>
        ) : (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-medium text-slate-700">
              {kind === "doc"
                ? "Legacy .doc files cannot be shown in the system."
                : "This file type cannot be previewed here."}
            </p>
            <p className="mt-1 text-[12px] text-slate-500">
              Ask the teacher to resubmit as PDF or DOCX, or use Download file.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
