"use client";

import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Standard School-Branded PDF Document Viewer (SF9 Style)
 * 
 * Embeds PDF documents inside an authentic DepEd paper sheet canvas without
 * exposing the browser's native dark-gray PDF viewer toolbar, duplicate buttons,
 * or raw technical file UUIDs.
 */
export default function SchoolPdfPreview({
  fileUrl,
  fileName = "Document PDF",
  title = "",
  zoom = 100,
  onZoomChange = null,
  totalPages = null,
  showDock = true,
  className = "",
  containerClassName = "",
}) {
  const [internalZoom, setInternalZoom] = useState(zoom || 100);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const currentZoom = onZoomChange ? zoom : internalZoom;

  const handleZoomChange = (nextZoom) => {
    const clamped = Math.min(130, Math.max(70, nextZoom));
    if (onZoomChange) {
      onZoomChange(clamped);
    } else {
      setInternalZoom(clamped);
    }
  };

  const handlePageChange = (newPage) => {
    const safePage = Math.max(1, newPage);
    setCurrentPage(safePage);
  };

  // Clean URL construction with toolbar suppression hash parameters
  const pdfSrc = useMemo(() => {
    if (!fileUrl) return "";
    const [baseUrl] = fileUrl.split("#");
    const pageHash = currentPage > 1 ? `&page=${currentPage}` : "";
    return `${baseUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH${pageHash}`;
  }, [fileUrl, currentPage]);

  if (!fileUrl) {
    return (
      <div className="mx-auto max-w-4xl rounded-sm border border-slate-200 bg-white p-12 text-center text-sm text-slate-500 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        No PDF document is available for preview.
      </div>
    );
  }

  return (
    <div className={cn("relative flex flex-col items-center w-full", className)}>
      {/* Floating Navigation & Zoom Dock (SF9 School Standard) */}
      {showDock ? (
        <div className="sticky top-0 z-20 mb-3 inline-flex items-center gap-3 rounded-full border border-slate-200/90 bg-white/95 px-3.5 py-1.5 shadow-md backdrop-blur-xs dark:border-white/10 dark:bg-slate-900/95 animate-in fade-in duration-150">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed transition dark:text-slate-200 dark:hover:bg-white/10"
              title="Previous Page"
            >
              <ChevronLeft size={13} />
              <span>Previous</span>
            </button>
            <span className="px-2 text-xs font-bold text-slate-800 dark:text-slate-100 tabular-nums">
              {totalPages ? `Page ${currentPage} of ${totalPages}` : `Page ${currentPage}`}
            </span>
            <button
              type="button"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={Boolean(totalPages && currentPage >= totalPages)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed transition dark:text-slate-200 dark:hover:bg-white/10"
              title="Next Page"
            >
              <span>Next</span>
              <ChevronRight size={13} />
            </button>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-white/10" />

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleZoomChange(currentZoom - 10)}
              disabled={currentZoom <= 70}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition dark:text-slate-300 dark:hover:bg-white/10"
              title="Zoom Out"
              aria-label="Zoom out"
            >
              <Minus size={11} />
            </button>
            <span className="w-10 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
              {currentZoom}%
            </span>
            <button
              type="button"
              onClick={() => handleZoomChange(currentZoom + 10)}
              disabled={currentZoom >= 130}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition dark:text-slate-300 dark:hover:bg-white/10"
              title="Zoom In"
              aria-label="Zoom in"
            >
              <Plus size={11} />
            </button>
          </div>
        </div>
      ) : null}

      {/* Document Sheet Canvas */}
      <div
        data-document-paper="true"
        data-keep-white="true"
        data-force-light="true"
        style={{
          width: `${Math.round(680 * (currentZoom / 100))}px`,
          height: `${Math.round(920 * (currentZoom / 100))}px`,
          minHeight: "560px",
          maxWidth: "100%",
        }}
        className={cn(
          "document-paper-sheet relative mx-auto overflow-hidden rounded-xs border border-slate-200/90 !bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] shrink-0 transition-all duration-150",
          containerClassName
        )}
      >
        {/* Loading placeholder while iframe loads */}
        {loading ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/90 text-slate-500 backdrop-blur-[1px]">
            <Loader2 size={22} className="animate-spin text-cnhs-green" />
            <span className="text-xs font-semibold text-slate-600">
              Loading document…
            </span>
          </div>
        ) : null}

        {error ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 p-6 text-center text-slate-500">
            <AlertCircle size={28} className="text-rose-500 mb-1" />
            <h4 className="text-sm font-bold text-slate-800">
              Unable to load PDF preview
            </h4>
            <p className="text-xs text-slate-500 max-w-sm">
              The document could not be rendered in the browser. You can still download the file using the button above.
            </p>
          </div>
        ) : null}

        {/* Sandboxed iframe with toolbars hidden via official PDF Open Parameters */}
        <iframe
          key={pdfSrc}
          id="school-pdf-preview-frame"
          title={title || fileName || "Document PDF Preview"}
          src={pdfSrc}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
          className="w-full h-full border-0 !bg-white"
        />
      </div>
    </div>
  );
}
