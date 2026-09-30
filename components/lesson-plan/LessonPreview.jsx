"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bold,
  Check,
  Download,
  Edit3,
  FileText,
  Heading1,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Loader2,
  MessageSquarePlus,
  Redo2,
  Save,
  Sparkles,
  Underline as UnderlineIcon,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  downloadFileFromUrl,
  downloadLessonPlanDocx,
  formatLessonPlanDownloadName,
} from "@/lib/lesson-plan/docxExport";
import { cn } from "@/lib/utils";

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
 * Clean Word & PDF Document Canvas with In-System Editing & Word Export.
 */
export default function LessonPreview({
  lesson,
  fileUrl,
  remarks = [],
  selectedRemarkId = null,
  onSelectRemark = null,
  onSelectText = null,
  onDocxParsed = null,
  onSaveEdits = null,
  readOnly = false,
  allowEdit = true,
}) {
  const kind = fileKind(lesson);
  const draftKey = lesson?.id ? `cnhs_lp_draft_${lesson.id}` : null;
  const savedKey = lesson?.id ? `cnhs_lp_saved_${lesson.id}` : null;

  const [rawDocxHtml, setRawDocxHtml] = useState("");
  const [editedHtml, setEditedHtml] = useState("");
  const [docxError, setDocxError] = useState("");
  const [loadingDocx, setLoadingDocx] = useState(false);
  const [selectedTextSnippet, setSelectedTextSnippet] = useState("");
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isEditing, setIsEditing] = useState(false);
  const [hasSavedEdits, setHasSavedEdits] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  const docxContainerRef = useRef(null);
  const editorRef = useRef(null);
  const draftHtmlRef = useRef("");

  // Load DOCX with draft and persistent saved state recovery
  useEffect(() => {
    let cancelled = false;

    async function loadDocx() {
      if (kind !== "docx" || !fileUrl) {
        setRawDocxHtml("");
        setEditedHtml("");
        setDocxError("");
        setLoadingDocx(false);
        return;
      }
      setLoadingDocx(true);
      setDocxError("");

      // Check if there is an active draft or saved content in storage for this lesson
      let savedContent = null;
      let storedDraft = null;
      if (typeof window !== "undefined") {
        try {
          if (savedKey) savedContent = localStorage.getItem(savedKey);
          if (draftKey) storedDraft = sessionStorage.getItem(draftKey);
        } catch (e) {
          // ignore storage error
        }
      }

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
            "No preview available for this document. Please download the file to view it."
          );
        } else {
          setRawDocxHtml(result.value);
          if (storedDraft && storedDraft.trim()) {
            // Restore draft so tab switching does not reset unsaved work
            setEditedHtml(storedDraft);
            draftHtmlRef.current = storedDraft;
            setHasSavedEdits(Boolean(savedContent));
            setHasUnsavedChanges(storedDraft !== savedContent);
            setDraftRestored(true);
            onDocxParsed?.(storedDraft);
          } else if (savedContent && savedContent.trim()) {
            // Restore authoritative saved edit (e.g. Hensley Santos)
            setEditedHtml(savedContent);
            draftHtmlRef.current = savedContent;
            setHasSavedEdits(true);
            setHasUnsavedChanges(false);
            onDocxParsed?.(savedContent);
          } else {
            setEditedHtml(result.value);
            draftHtmlRef.current = result.value;
            onDocxParsed?.(result.value);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setDocxError(
            err?.message ||
              "Unable to load document preview. Please download the file to view it."
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
  }, [kind, fileUrl, draftKey, savedKey, onDocxParsed]);

  // Robust smooth scroll and glowing pulse when selectedRemarkId changes
  useEffect(() => {
    if (!selectedRemarkId) return;

    let attempts = 0;
    function triggerScrollAndPulse() {
      const markElem =
        document.getElementById(`remark-mark-${selectedRemarkId}`) ||
        document.querySelector(`[data-remark-id="${selectedRemarkId}"]`);

      if (markElem) {
        markElem.scrollIntoView({ behavior: "smooth", block: "center" });
        markElem.classList.add("ring-4", "ring-amber-400", "bg-amber-300", "shadow-lg");
        const timer = setTimeout(() => {
          markElem?.classList.remove("shadow-lg");
        }, 3000);
        return () => clearTimeout(timer);
      } else if (attempts < 6) {
        attempts++;
        setTimeout(triggerScrollAndPulse, 50);
      }
    }

    const animId = requestAnimationFrame(triggerScrollAndPulse);
    return () => cancelAnimationFrame(animId);
  }, [selectedRemarkId, editedHtml, rawDocxHtml, isEditing]);

  // Real-time input handler on contentEditable canvas
  function handleContentInput(e) {
    if (!isEditing) return;
    const currentHtml = e.currentTarget.innerHTML;
    draftHtmlRef.current = currentHtml;
    setHasUnsavedChanges(true);
    if (draftKey && typeof window !== "undefined") {
      try {
        sessionStorage.setItem(draftKey, currentHtml);
      } catch (err) {
        // ignore quota errors
      }
    }
  }

  // Handle text selection for Principal review
  function handleMouseUp() {
    if (isEditing || readOnly || !onSelectText) return;
    const selection = window.getSelection();
    const text = selection?.toString()?.trim() || "";
    if (text.length >= 2 && text.length <= 500) {
      setSelectedTextSnippet(text);
    }
  }

  function handleAttachSelectionRemark() {
    if (!selectedTextSnippet) return;
    onSelectText?.(selectedTextSnippet);
    setSelectedTextSnippet("");
  }

  // Handle clicking on highlighted mark inside the document
  function handleDocumentClick(e) {
    if (isEditing) return;
    const markTarget = e.target.closest("mark[data-remark-id]");
    if (markTarget) {
      const remId = markTarget.getAttribute("data-remark-id");
      if (remId) {
        onSelectRemark?.(remId);
      }
    }
  }

  // Highlight remarks on the active HTML with whitespace-tolerant regex
  const displayHtml = useMemo(() => {
    const baseHtml = editedHtml || rawDocxHtml;
    if (!baseHtml) return "";

    // If currently editing, return editedHtml directly so marks don't interfere with typing
    if (isEditing) return baseHtml;

    let html = baseHtml;
    if (Array.isArray(remarks) && remarks.length > 0) {
      remarks.forEach((rem) => {
        const textToFind = String(rem.highlightedText || "").trim();
        if (textToFind && textToFind.length >= 2) {
          try {
            // Clean up regex tokens and tolerate multi-spaces / linebreaks / entities
            const words = textToFind
              .replace(/[\n\r\t]+/g, " ")
              .split(/\s+/)
              .filter(Boolean)
              .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

            if (words.length > 0) {
              const pattern = words.join("(?:\\s+|&nbsp;)+");
              const regex = new RegExp(`(${pattern})`, "gi");

              const isSelected =
                Boolean(selectedRemarkId) &&
                String(rem.id) === String(selectedRemarkId);

              const highlightClass =
                rem.severity === "Needs Revision"
                  ? "bg-[#fef08a] text-slate-900 border-b-2 border-[#eab308] font-bold"
                  : rem.severity === "Suggestion"
                  ? "bg-[#e0f2fe] text-slate-900 border-b-2 border-[#38bdf8] font-bold"
                  : "bg-[#dcfce7] text-slate-900 border-b-2 border-[#22c55e] font-bold";

              const activeClass = isSelected
                ? "ring-4 ring-amber-400 ring-offset-2 bg-amber-300 font-extrabold shadow-md scale-105 inline-block"
                : "";

              html = html.replace(
                regex,
                `<mark data-remark-id="${rem.id}" id="remark-mark-${rem.id}" class="${highlightClass} ${activeClass} px-1 py-0.5 rounded-xs transition-all duration-200 cursor-pointer" title="[${rem.severity}] ${rem.comment}">$1</mark>`
              );
            }
          } catch (e) {
            console.warn("[LessonPreview] highlight match error", e);
          }
        }
      });
    }

    return html;
  }, [editedHtml, rawDocxHtml, remarks, isEditing, selectedRemarkId]);

  // Formatting commands for the in-system editor
  function execFormat(command, value = null) {
    if (typeof document === "undefined") return;
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
      handleContentInput({ currentTarget: editorRef.current });
    }
  }

  function handleStartEditing() {
    setIsEditing(true);
    setSelectedTextSnippet("");
  }

  function handleSaveEdits() {
    if (!editorRef.current) return;
    const newHtml = editorRef.current.innerHTML;
    setEditedHtml(newHtml);
    draftHtmlRef.current = newHtml;
    setHasSavedEdits(true);
    setHasUnsavedChanges(false);
    setIsEditing(false);
    onSaveEdits?.(newHtml);

    if (typeof window !== "undefined") {
      try {
        if (savedKey) localStorage.setItem(savedKey, newHtml);
        if (draftKey) sessionStorage.setItem(draftKey, newHtml);
      } catch (err) {
        // ignore storage quota errors
      }
    }

    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 3500);
  }

  function handleCancelEdits() {
    setIsEditing(false);
    if (editorRef.current) {
      editorRef.current.innerHTML = editedHtml || rawDocxHtml;
      draftHtmlRef.current = editedHtml || rawDocxHtml;
    }
  }

  function handleDiscardDraft() {
    if (typeof window !== "undefined") {
      try {
        if (draftKey) sessionStorage.removeItem(draftKey);
        if (savedKey) localStorage.removeItem(savedKey);
      } catch (e) {
        // ignore
      }
    }
    setEditedHtml(rawDocxHtml);
    draftHtmlRef.current = rawDocxHtml;
    setHasSavedEdits(false);
    setHasUnsavedChanges(false);
    setDraftRestored(false);
    setIsEditing(false);
    if (editorRef.current) {
      editorRef.current.innerHTML = rawDocxHtml;
    }
    onSaveEdits?.(rawDocxHtml);
  }

  function handleClearHighlightMarks() {
    if (!editorRef.current) return;
    const marks = editorRef.current.querySelectorAll("mark");
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
    });
    handleContentInput({ currentTarget: editorRef.current });
  }

  async function handleDownloadDocument() {
    try {
      const fileName = formatLessonPlanDownloadName(lesson);

      // If the document has in-system edits or is actively edited, export populated native DOCX
      if (hasSavedEdits || isEditing) {
        const activeHtml = isEditing
          ? (editorRef.current?.innerHTML || editedHtml)
          : (editedHtml || rawDocxHtml);

        await downloadLessonPlanDocx(
          {
            ...lesson,
            editedHtml: activeHtml,
            teacher: lesson?.teacher || lesson?.teacherName || "Subject Teacher",
            principal: lesson?.reviewedByName || "Dulce Vilma R. Galang",
          },
          fileName
        );
        return;
      }

      // If unedited and fileUrl is available, download the original file cleanly
      if (fileUrl) {
        await downloadFileFromUrl(fileUrl, fileName);
        return;
      }

      // Fallback: master template DOCX export
      await downloadLessonPlanDocx(lesson, fileName);
    } catch (err) {
      console.error("[LessonPreview] download error", err);
      if (fileUrl) {
        const fileName = formatLessonPlanDownloadName(lesson);
        await downloadFileFromUrl(fileUrl, fileName);
      }
    }
  }

  return (
    <section className="flex flex-col">
      {/* Top Document Toolbar */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <FileText size={15} className="text-cnhs-green-dark dark:text-cnhs-green" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {lesson.fileName || "Lesson Plan Document"}
          </span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600 dark:bg-white/10 dark:text-slate-300">
            {kind.toUpperCase()}
          </span>
          {hasSavedEdits ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <Sparkles size={10} /> Edited
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Zoom controls */}
          {kind === "docx" ? (
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-800 dark:bg-[#1a202c]">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(z - 10, 80))}
                className="p-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                title="Zoom Out"
              >
                <ZoomOut size={13} />
              </button>
              <span className="px-1 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(z + 10, 130))}
                className="p-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                title="Zoom In"
              >
                <ZoomIn size={13} />
              </button>
            </div>
          ) : null}

          {/* Edit Document Toggle Button */}
          {kind === "docx" && allowEdit && !isEditing ? (
            <button
              type="button"
              onClick={handleStartEditing}
              className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-cnhs-green/40 bg-cnhs-green/10 px-2.5 text-[11px] font-bold text-cnhs-green-dark transition hover:bg-cnhs-green/20 dark:border-cnhs-green/50 dark:bg-cnhs-green/20 dark:text-cnhs-green"
            >
              <Edit3 size={12} />
              Edit Document
            </button>
          ) : null}

          {/* Download Button */}
          {(fileUrl || hasSavedEdits) && !isEditing ? (
            <button
              type="button"
              onClick={handleDownloadDocument}
              className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10"
              title="Download lesson plan document"
            >
              <Download size={12} />
              Download
            </button>
          ) : null}
        </div>
      </div>

      {/* Clean In-System Formatting Toolbar (Active when editing) */}
      {isEditing ? (
        <div className="sticky top-0 z-30 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cnhs-green/30 bg-emerald-50/95 p-2 shadow-sm backdrop-blur-sm dark:border-cnhs-green/40 dark:bg-emerald-950/90 animate-in fade-in">
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[11px] font-bold text-cnhs-green-dark dark:text-cnhs-green">
              Formatting:
            </span>

            <button
              type="button"
              onClick={() => execFormat("bold")}
              className="rounded p-1 text-slate-700 hover:bg-emerald-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-emerald-900"
              title="Bold (Ctrl+B)"
            >
              <Bold size={13} />
            </button>
            <button
              type="button"
              onClick={() => execFormat("italic")}
              className="rounded p-1 text-slate-700 hover:bg-emerald-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-emerald-900"
              title="Italic (Ctrl+I)"
            >
              <Italic size={13} />
            </button>
            <button
              type="button"
              onClick={() => execFormat("underline")}
              className="rounded p-1 text-slate-700 hover:bg-emerald-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-emerald-900"
              title="Underline (Ctrl+U)"
            >
              <UnderlineIcon size={13} />
            </button>

            <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-700" />

            <button
              type="button"
              onClick={() => execFormat("insertUnorderedList")}
              className="rounded p-1 text-slate-700 hover:bg-emerald-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-emerald-900"
              title="Bullet List"
            >
              <List size={13} />
            </button>
            <button
              type="button"
              onClick={() => execFormat("insertOrderedList")}
              className="rounded p-1 text-slate-700 hover:bg-emerald-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-emerald-900"
              title="Numbered List"
            >
              <ListOrdered size={13} />
            </button>

            <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-700" />

            <button
              type="button"
              onClick={() => execFormat("formatBlock", "<h2>")}
              className="rounded p-1 text-slate-700 hover:bg-emerald-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-emerald-900"
              title="Heading 2"
            >
              <Heading1 size={13} />
            </button>
            <button
              type="button"
              onClick={() => execFormat("formatBlock", "<h3>")}
              className="rounded p-1 text-slate-700 hover:bg-emerald-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-emerald-900"
              title="Heading 3"
            >
              <Heading2 size={13} />
            </button>

            <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-700" />

            <button
              type="button"
              onClick={() => execFormat("undo")}
              className="rounded p-1 text-slate-700 hover:bg-emerald-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-emerald-900"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={13} />
            </button>
            <button
              type="button"
              onClick={() => execFormat("redo")}
              className="rounded p-1 text-slate-700 hover:bg-emerald-100 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-emerald-900"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={13} />
            </button>

            <span className="mx-1 h-4 w-px bg-slate-300 dark:bg-slate-700" />

            <button
              type="button"
              onClick={handleClearHighlightMarks}
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-950"
              title="Remove yellow review markers from edited document"
            >
              Clear Highlights
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {hasUnsavedChanges ? (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                ● Unsaved Draft
              </span>
            ) : null}
            <button
              type="button"
              onClick={handleCancelEdits}
              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-white/10 dark:text-slate-300"
            >
              <X size={12} />
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveEdits}
              className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg bg-cnhs-green-dark px-3 text-[11px] font-bold text-white shadow-xs transition hover:bg-[#246f54]"
            >
              <Save size={12} />
              Save Edits
            </button>
          </div>
        </div>
      ) : null}

      {/* Restored Draft Banner */}
      {draftRestored && !savedToast ? (
        <div className="sticky top-2 z-30 mb-2 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 shadow-sm dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 animate-in fade-in">
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-600 dark:text-amber-400" />
            <span>Restored your unsaved edits from your session.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="rounded border border-amber-300 bg-white px-2 py-0.5 text-[10.5px] font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-200"
            >
              Discard Draft
            </button>
            <button
              type="button"
              onClick={() => setDraftRestored(false)}
              className="text-amber-700 hover:text-amber-900 dark:text-amber-300"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      ) : null}

      {/* Saved Notification Toast */}
      {savedToast ? (
        <div className="sticky top-2 z-30 mb-2 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 shadow-sm dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 animate-in fade-in">
          <div className="flex items-center gap-1.5">
            <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span>Changes saved! You can now download or resubmit your updated lesson plan.</span>
          </div>
          <button
            type="button"
            onClick={() => setSavedToast(false)}
            className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-300"
          >
            <X size={13} />
          </button>
        </div>
      ) : null}

      {/* Floating Selection Action Banner (Principal Review) */}
      {selectedTextSnippet && !readOnly && !isEditing ? (
        <div className="sticky top-2 z-30 mb-2 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/95 px-3 py-2 text-xs text-emerald-950 shadow-md dark:border-emerald-800/60 dark:bg-emerald-950/90 dark:text-emerald-100 animate-in fade-in">
          <div className="min-w-0 flex-1 truncate">
            <span className="font-bold text-emerald-800 dark:text-emerald-300">
              Selected:
            </span>{" "}
            <span className="font-semibold italic">"{selectedTextSnippet}"</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={handleAttachSelectionRemark}
              className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-cnhs-green-dark px-2.5 py-1 text-xs font-bold text-white shadow-xs transition hover:bg-[#246f54]"
            >
              <MessageSquarePlus size={12} />
              Add Comment
            </button>
            <button
              type="button"
              onClick={() => setSelectedTextSnippet("")}
              className="px-1.5 py-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {/* Document Body Area */}
      <div className="min-h-[480px] w-full overflow-y-auto rounded-xl bg-slate-100/70 p-4 sm:p-6 dark:bg-black/30">
        {!fileUrl ? (
          <div className="px-5 py-20 text-center text-sm text-slate-500">
            No file is attached to this lesson plan.
          </div>
        ) : kind === "pdf" ? (
          <div
            data-document-paper="true"
            data-keep-white="true"
            data-force-light="true"
            className="document-paper-sheet mx-auto max-w-4xl overflow-hidden rounded-xl border border-slate-300 !bg-white shadow-xl"
          >
            <iframe
              title={lesson.fileName || "Lesson plan PDF"}
              src={fileUrl}
              className="h-[min(75vh,720px)] w-full !bg-white"
            />
          </div>
        ) : kind === "docx" ? (
          loadingDocx ? (
            <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-600 dark:text-slate-400">
              <Loader2 size={18} className="animate-spin text-cnhs-green" />
              Loading lesson plan…
            </div>
          ) : docxError ? (
            <p className="py-20 text-center text-sm text-slate-500">
              {docxError}
            </p>
          ) : (
            /* DepEd Word Document A4 Canvas */
            <div
              ref={docxContainerRef}
              onClick={handleDocumentClick}
              onMouseUp={handleMouseUp}
              data-document-paper="true"
              data-keep-white="true"
              data-force-light="true"
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top center" }}
              className={cn(
                "document-paper-sheet mx-auto max-w-4xl rounded-xs !bg-white p-8 sm:p-12 shadow-2xl selection:bg-amber-200 selection:text-amber-950 !text-slate-900 transition-all",
                isEditing
                  ? "border-2 border-dashed border-cnhs-green ring-4 ring-emerald-500/10"
                  : "border border-slate-300"
              )}
            >
              <div
                ref={editorRef}
                contentEditable={isEditing}
                suppressContentEditableWarning={true}
                onInput={handleContentInput}
                onBlur={handleContentInput}
                className="lesson-plan-docx prose prose-slate max-w-none text-[13px] leading-relaxed !text-slate-900 outline-none
                  [&_h1]:text-center [&_h1]:text-base [&_h1]:font-bold [&_h1]:my-1 [&_h1]:!text-slate-900
                  [&_h2]:text-center [&_h2]:text-sm [&_h2]:font-bold [&_h2]:my-1 [&_h2]:!text-slate-900
                  [&_h3]:text-xs [&_h3]:font-bold [&_h3]:my-1 [&_h3]:!text-slate-900
                  [&_p]:my-1.5 [&_p]:!text-slate-800
                  [&_table]:w-full [&_table]:my-3 [&_table]:border-collapse [&_table]:!border [&_table]:!border-slate-500 [&_table]:!bg-white
                  [&_td]:!border [&_td]:!border-slate-500 [&_td]:p-2.5 [&_td]:align-top [&_td]:text-[12.5px] [&_td]:!text-slate-900 [&_td]:!bg-white
                  [&_th]:!border [&_th]:!border-slate-500 [&_th]:!bg-slate-100 [&_th]:p-2.5 [&_th]:font-bold [&_th]:!text-slate-900
                  [&_tr:first-child_td]:!bg-slate-50 [&_tr:first-child_td]:font-semibold"
                dangerouslySetInnerHTML={{ __html: displayHtml }}
              />
            </div>
          )
        ) : (
          <div className="px-5 py-20 text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {kind === "doc"
                ? "This file format does not support preview. Please download to view."
                : "This file format cannot be previewed directly."}
            </p>
            <p className="mt-1 text-[12px] text-slate-500">
              Please submit lesson plans as Word (.docx) or PDF.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
