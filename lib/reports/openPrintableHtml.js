/**
 * Download an HTML report file (no system print / printer dialog).
 *
 * Default: trigger a .html download with a Windows-safe filename.
 * Opt-in: openInTab opens a blob tab for on-screen preview WITHOUT print().
 */

import { windowsSafeFilename } from "@/lib/reports/exportFilenames";

function buildHtmlFilename(title) {
  const base = windowsSafeFilename(String(title || "CNHS Report").replace(/\.html$/i, ""));
  return base.toLowerCase().endsWith(".html") ? base : `${base}.html`;
}

function triggerBlobDownload(url, filename) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

/**
 * @param {string} html
 * @param {{ title?: string, filename?: string, openInTab?: boolean, autoPrint?: boolean }} [options]
 *   autoPrint is ignored (always false) — kept so old callers do not break.
 * @returns {{ mode: "download"|"tab", url: string, filename: string }}
 */
export function openPrintableHtml(
  html,
  { title = "Report", filename = null, openInTab = false, autoPrint: _autoPrint = false } = {}
) {
  if (typeof window === "undefined") {
    throw new Error("Report download is only available in the browser.");
  }

  const resolvedName = buildHtmlFilename(filename || title);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const cleanup = () => {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  if (openInTab) {
    const win = window.open(url, "_blank");
    cleanup();
    if (win) {
      try {
        win.focus();
      } catch {
        /* ignore */
      }
      return { mode: "tab", url, filename: resolvedName };
    }
    // Popup blocked — fall through to download.
  }

  triggerBlobDownload(url, resolvedName);
  cleanup();
  return { mode: "download", url, filename: resolvedName };
}

/** Explicit alias — same as openPrintableHtml download default. */
export function downloadHtmlReport(html, options = {}) {
  return openPrintableHtml(html, { ...options, openInTab: false });
}
