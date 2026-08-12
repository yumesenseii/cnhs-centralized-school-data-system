/**
 * Open a printable HTML report without relying on blank pop-ups.
 *
 * Prefer a blob URL in a new tab; if the browser blocks it, fall back to a
 * hidden iframe print, then to downloading the HTML file.
 *
 * Note: `window.open("", "_blank", "noopener")` + `document.write` often yields
 * a blank window because noopener blocks access to the new document.
 */

export function openPrintableHtml(html, { title = "Report", autoPrint = true } = {}) {
  if (typeof window === "undefined") {
    throw new Error("PDF export is only available in the browser.");
  }

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const cleanup = () => {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const win = window.open(url, "_blank");
  if (win) {
    const tryPrint = () => {
      try {
        win.focus();
        if (autoPrint) win.print();
      } catch {
        /* user can print from the opened tab */
      }
    };
    // Blob documents may already be complete when open returns.
    if (win.document?.readyState === "complete") {
      window.setTimeout(tryPrint, 250);
    } else {
      win.addEventListener("load", () => window.setTimeout(tryPrint, 200));
      window.setTimeout(tryPrint, 800);
    }
    cleanup();
    return { mode: "tab", url };
  }

  // Popup blocked — print via hidden iframe (same tab).
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", title);
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none;";
  iframe.src = url;
  document.body.appendChild(iframe);

  const removeIframe = () => {
    try {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    } catch {
      /* ignore */
    }
    cleanup();
  };

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      if (autoPrint) iframe.contentWindow?.print();
      window.setTimeout(removeIframe, 60_000);
    } catch {
      // Last resort: download HTML the teacher can open and print.
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${String(title)
        .replace(/[^\w\s-]+/g, "")
        .trim()
        .replace(/\s+/g, "-")
        .slice(0, 48) || "report"}.html`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      removeIframe();
    }
  };

  return { mode: "iframe", url };
}
