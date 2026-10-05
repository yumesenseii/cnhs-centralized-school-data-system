"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Loader2,
  MessageSquarePlus,
  ZoomIn,
  ZoomOut,
  X,
} from "lucide-react";
import {
  downloadFileFromUrl,
  downloadLessonPlanDocx,
  formatLessonPlanDownloadName,
} from "@/lib/lesson-plan/docxExport";
import LessonPlanScrollspy, {
  annotateLessonPlanHtml,
} from "@/components/lesson-plan/LessonPlanScrollspy";
import LessonInformation from "@/components/lesson-plan/LessonInformation";
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
 * Official School Document Viewer with Scrollspy Navigation, DepEd Layout & Review Comments.
 * Displays official lesson plan documents without altering their prescribed structure.
 */
export default function LessonPreview({
  lesson,
  fileUrl,
  remarks = [],
  selectedRemarkId = null,
  onSelectRemark = null,
  onSelectText = null,
  onDocxParsed = null,
  readOnly = true,
  className = "",
}) {
  const kind = fileKind(lesson);

  const [rawDocxHtml, setRawDocxHtml] = useState("");
  const [docxError, setDocxError] = useState("");
  const [loadingDocx, setLoadingDocx] = useState(false);
  const [selectedTextSnippet, setSelectedTextSnippet] = useState("");
  const [zoomLevel, setZoomLevel] = useState(100);
  const [activeSectionId, setActiveSectionId] = useState("");

  const docxContainerRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Load official DOCX through Mammoth
  useEffect(() => {
    let cancelled = false;

    async function loadDocx() {
      if (kind !== "docx" || !fileUrl) {
        setRawDocxHtml("");
        setDocxError("");
        setLoadingDocx(false);
        return;
      }
      setLoadingDocx(true);
      setDocxError("");

      try {
        const mammoth = await import("mammoth");
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error("Unable to load the lesson plan file.");
        }
        const buffer = await response.arrayBuffer();
        const convertToHtml = mammoth.convertToHtml ?? mammoth.default?.convertToHtml;

        const result = await convertToHtml(
          { arrayBuffer: buffer },
          {
            styleMap: [
              "p[style-name='Heading 1'] => h1:fresh",
              "p[style-name='Heading 2'] => h2:fresh",
              "p[style-name='Heading 3'] => h3:fresh",
              "p[style-name='Title'] => h1.title:fresh",
              "p[style-name='Subtitle'] => h2.subtitle:fresh",
              "table => table.table.table-bordered:fresh",
              "r[style-name='Strong'] => strong",
              "r[style-name='Emphasis'] => em",
            ],
            includeDefaultStyleMap: true,
          }
        );

        if (!cancelled) {
          const cleanHtml = result.value || "";
          setRawDocxHtml(cleanHtml);
          onDocxParsed?.(cleanHtml);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("DOCX parsing error:", err);
          setDocxError("Could not render the Word document preview.");
        }
      } finally {
        if (!cancelled) {
          setLoadingDocx(false);
        }
      }
    }

    loadDocx();

    return () => {
      cancelled = true;
    };
  }, [kind, fileUrl]);

  // Handle reviewer text selection
  function handleMouseUp() {
    if (!onSelectText) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (text.length >= 3 && text.length <= 160) {
      setSelectedTextSnippet(text);
    }
  }

  function handleAttachSelectionRemark() {
    if (selectedTextSnippet && onSelectText) {
      onSelectText(selectedTextSnippet);
      setSelectedTextSnippet("");
    }
  }

  // Handle clicking on remarked text
  function handleDocumentClick(e) {
    const mark = e.target.closest("mark[data-remark-id]");
    if (mark) {
      const remarkId = mark.getAttribute("data-remark-id");
      if (remarkId && onSelectRemark) {
        onSelectRemark(remarkId);
      }
    }
  }

  // Annotate remarks onto official document HTML
  const displayHtml = useMemo(() => {
    let html = rawDocxHtml;
    if (!html) return "";

    const activeRemarks = remarks.filter(
      (r) => r.quotedText && r.status !== "resolved"
    );

    if (activeRemarks.length === 0) return html;

    activeRemarks.forEach((rem) => {
      const target = rem.quotedText.trim();
      if (!target || target.length < 3) return;

      const isSelected =
        Boolean(selectedRemarkId) && String(rem.id) === String(selectedRemarkId);
      const markClass = isSelected
        ? "bg-amber-300 text-amber-950 font-medium px-0.5 rounded-xs ring-2 ring-amber-500 cursor-pointer transition-all"
        : "bg-amber-100/90 text-amber-950 px-0.5 rounded-xs border-b-2 border-amber-500 cursor-pointer hover:bg-amber-200 transition-colors";

      const escapedTarget = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      try {
        const regex = new RegExp(`(${escapedTarget})`, "i");
        html = html.replace(regex, `<mark data-remark-id="${rem.id}" class="${markClass}">$1</mark>`);
      } catch (e) {
        console.warn("[LessonPreview] highlight match error", e);
      }
    });

    return html;
  }, [rawDocxHtml, remarks, selectedRemarkId]);

  // Inject official CNHS section anchors for Scrollspy navigation
  const { annotatedHtml, availableSections } = useMemo(() => {
    return annotateLessonPlanHtml(displayHtml);
  }, [displayHtml]);

  // Scroll smoothly to section accounting for sticky header offset
  function handleNavigateToSection(section) {
    if (!section?.id) return;
    const targetEl = document.getElementById(section.id);
    const scrollContainer = scrollContainerRef.current;

    setActiveSectionId(section.id);

    if (targetEl && scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const stickyHeaderOffset = 30;
      const scrollPos =
        scrollContainer.scrollTop + (targetRect.top - containerRect.top) - stickyHeaderOffset;

      scrollContainer.scrollTo({
        top: Math.max(0, scrollPos),
        behavior: "smooth",
      });

      if (typeof window !== "undefined" && window.history?.replaceState) {
        window.history.replaceState(null, "", `#${section.id}`);
      }
    } else if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // IntersectionObserver to detect which lesson plan section is currently in view
  useEffect(() => {
    if (!availableSections.length) return;

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    if (!activeSectionId && availableSections[0]?.id) {
      setActiveSectionId(availableSections[0].id);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.filter((e) => e.isIntersecting);
        if (intersecting.length > 0) {
          const topMost = intersecting.reduce((prev, curr) => {
            return prev.boundingClientRect.top < curr.boundingClientRect.top ? prev : curr;
          });
          if (topMost?.target?.id) {
            setActiveSectionId(topMost.target.id);
          }
        }
      },
      {
        root: scrollContainer,
        rootMargin: "-20px 0px -55% 0px",
        threshold: [0, 0.1, 0.5],
      }
    );

    availableSections.forEach((sec) => {
      const el = document.getElementById(sec.id);
      if (el) observer.observe(el);
    });

    const handleScroll = () => {
      const containerRect = scrollContainer.getBoundingClientRect();
      const topThreshold = containerRect.top + 60;

      let currentActive = availableSections[0]?.id || "";
      for (const sec of availableSections) {
        const el = document.getElementById(sec.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= topThreshold) {
            currentActive = sec.id;
          }
        }
      }
      if (currentActive) {
        setActiveSectionId(currentActive);
      }
    };

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      scrollContainer.removeEventListener("scroll", handleScroll);
    };
  }, [availableSections, loadingDocx]);

  // Download official lesson plan document
  async function handleDownloadDocument() {
    const filename = formatLessonPlanDownloadName(lesson, kind === "pdf" ? "pdf" : "docx");
    if (kind === "pdf" && fileUrl) {
      downloadFileFromUrl(fileUrl, filename);
      return;
    }

    try {
      if (fileUrl) {
        downloadFileFromUrl(fileUrl, filename);
      }
    } catch (err) {
      console.error("[LessonPreview] download error", err);
    }
  }

  return (
    <section className={cn("flex h-full min-h-0 w-full overflow-hidden bg-slate-100/60 dark:bg-black/25", className)}>
      {/* =========================================================================
          LEFT: Sticky "On This Page" Navigation (Desktop lg+)
          Remains fixed/sticky while only the center document area scrolls.
          ========================================================================= */}
      {availableSections.length > 0 ? (
        <aside
          className="hidden lg:flex w-52 xl:w-60 shrink-0 flex-col border-r border-slate-200/80 bg-white p-4 dark:border-white/5 dark:bg-[var(--card)]"
        >
          <LessonPlanScrollspy
            sections={availableSections}
            activeId={activeSectionId}
            onSelectSection={handleNavigateToSection}
            variant="desktop"
          />
        </aside>
      ) : null}

      {/* =========================================================================
          CENTER: Scrollable Official Lesson Plan Document
          This is the ONLY area that scrolls vertically.
          ========================================================================= */}
      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 scroll-smooth"
      >
        {/* Mobile: Compact Sticky 'Sections' Control (< lg) */}
        {availableSections.length > 0 ? (
          <div className="lg:hidden sticky top-0 z-30 mb-3">
            <LessonPlanScrollspy
              sections={availableSections}
              activeId={activeSectionId}
              onSelectSection={handleNavigateToSection}
              variant="mobile"
            />
          </div>
        ) : null}

        {/* Collapsible Lesson Information Header inside document container */}
        {lesson ? (
          <div className="mx-auto max-w-4xl mb-3">
            <LessonInformation lesson={lesson} />
          </div>
        ) : null}

        {/* Floating Selection Action Banner (Principal Review) */}
        {selectedTextSnippet && onSelectText ? (
          <div className="sticky top-2 z-30 mx-auto max-w-4xl mb-3 flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/95 px-3 py-2 text-xs text-emerald-950 shadow-md dark:border-emerald-800/60 dark:bg-emerald-950/90 dark:text-emerald-100 animate-in fade-in">
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

        {/* Document Action Bar (Zoom + Download) */}
        <div className="mx-auto max-w-4xl mb-2 flex items-center justify-between px-1 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Official Document
            </span>
            {lesson?.fileName ? (
              <span className="truncate max-w-[260px] text-[11px] text-slate-500" title={lesson.fileName}>
                · {lesson.fileName}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {kind === "docx" ? (
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-600 shadow-2xs dark:border-slate-800 dark:bg-white/5 dark:text-slate-300">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(z - 10, 70))}
                  className="p-1 hover:text-slate-900 dark:hover:text-white"
                  title="Zoom Out"
                  aria-label="Zoom Out"
                >
                  <ZoomOut size={13} />
                </button>
                <span className="w-8 text-center text-[10.5px] font-semibold tabular-nums">
                  {zoomLevel}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(z + 10, 130))}
                  className="p-1 hover:text-slate-900 dark:hover:text-white"
                  title="Zoom In"
                  aria-label="Zoom In"
                >
                  <ZoomIn size={13} />
                </button>
              </div>
            ) : null}

            {fileUrl ? (
              <button
                type="button"
                onClick={handleDownloadDocument}
                className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border border-cnhs-green/30 bg-white px-2.5 text-[11px] font-semibold text-cnhs-green-dark hover:bg-emerald-50/50 shadow-2xs transition dark:border-cnhs-green/40 dark:bg-white/5 dark:text-cnhs-green"
                title="Download official lesson plan document"
              >
                <Download size={12} />
                <span>Download</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Document Body Sheet */}
        {!fileUrl ? (
          <div className="mx-auto max-w-4xl rounded-sm border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-xs">
            No file is attached to this lesson plan.
          </div>
        ) : kind === "pdf" ? (
          <div
            data-document-paper="true"
            data-keep-white="true"
            data-force-light="true"
            className="document-paper-sheet mx-auto max-w-4xl overflow-hidden rounded-sm border border-slate-300/80 !bg-white shadow-xs"
          >
            <iframe
              title={lesson.fileName || "Lesson plan PDF"}
              src={fileUrl}
              className="h-[min(75vh,760px)] w-full !bg-white"
            />
          </div>
        ) : kind === "docx" ? (
          loadingDocx ? (
            <div className="mx-auto max-w-4xl rounded-sm border border-slate-200 bg-white py-24 text-center text-sm text-slate-600 shadow-xs dark:text-slate-400">
              <div className="flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin text-cnhs-green" />
                <span>Loading official lesson plan…</span>
              </div>
            </div>
          ) : docxError ? (
            <div className="mx-auto max-w-4xl rounded-sm border border-slate-200 bg-white py-20 text-center text-sm text-slate-500 shadow-xs">
              {docxError}
            </div>
          ) : (
            /* DepEd Word Document A4 Paper Sheet */
            <div
              ref={docxContainerRef}
              onClick={handleDocumentClick}
              onMouseUp={handleMouseUp}
              data-document-paper="true"
              data-keep-white="true"
              data-force-light="true"
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top center" }}
              className="document-paper-sheet mx-auto max-w-4xl rounded-xs border border-slate-300/80 !bg-white p-6 sm:p-10 lg:p-12 shadow-xs selection:bg-amber-200 selection:text-amber-950 !text-slate-900 transition-all"
            >
              <div
                className="lesson-plan-docx prose prose-slate max-w-none text-[13px] leading-relaxed !text-slate-900 outline-none
                  [&_h1]:text-center [&_h1]:text-base [&_h1]:font-bold [&_h1]:my-1 [&_h1]:!text-slate-900
                  [&_h2]:text-center [&_h2]:text-sm [&_h2]:font-bold [&_h2]:my-1 [&_h2]:!text-slate-900
                  [&_h3]:text-xs [&_h3]:font-bold [&_h3]:my-1 [&_h3]:!text-slate-900
                  [&_p]:my-1.5 [&_p]:!text-slate-800
                  [&_table]:w-full [&_table]:my-3 [&_table]:border-collapse [&_table]:!border [&_table]:!border-slate-500 [&_table]:!bg-white
                  [&_td]:!border [&_td]:!border-slate-500 [&_td]:p-2.5 [&_td]:align-top [&_td]:text-[12.5px] [&_td]:!text-slate-900 [&_td]:!bg-white
                  [&_th]:!border [&_th]:!border-slate-500 [&_th]:!bg-slate-100 [&_th]:p-2.5 [&_th]:font-bold [&_th]:!text-slate-900
                  [&_tr:first-child_td]:!bg-slate-50 [&_tr:first-child_td]:font-semibold"
                dangerouslySetInnerHTML={{ __html: annotatedHtml || displayHtml }}
              />
            </div>
          )
        ) : (
          <div className="mx-auto max-w-4xl rounded-sm border border-slate-200 bg-white p-12 text-center shadow-xs">
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
