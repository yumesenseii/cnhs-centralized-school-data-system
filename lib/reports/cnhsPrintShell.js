/**
 * Shared CNHS branded printable HTML shell for Reports / SF2 / ARAL / grades PDFs.
 * Target layout: light letterhead, slim meta, KPI row (≤4), tables, side-by-side signature.
 */

export const CNHS_BRAND_GREEN = "#246f54";

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function absolutePublicUrl(path) {
  const clean = String(path || "").startsWith("/")
    ? path
    : `/${path || ""}`;
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${clean}`;
  }
  return clean;
}

export const CNHS_PRINT_CSS = `
  @page { size: letter; margin: 14mm; }
  @page landscape { size: letter landscape; margin: 12mm; }
  body { font-family: "Segoe UI", system-ui, sans-serif; color: #1e293b; margin: 20px; }
  body.page-landscape { }
  .toolbar { margin-bottom: 14px; }
  .toolbar button { padding: 8px 14px; cursor: pointer; background: #246f54; color: #fff; border: 0; border-radius: 6px; font-weight: 600; }
  .letterhead { display: flex; align-items: center; justify-content: space-between; gap: 12px; border-top: 2.5px solid #246f54; border-bottom: 2.5px solid #246f54; padding: 10px 0; background: #fff; }
  .letterhead img { height: 56px; width: auto; object-fit: contain; }
  .letterhead .center { text-align: center; flex: 1; }
  .letterhead h1 { margin: 0; font-size: 16px; color: #246f54; letter-spacing: 0.04em; }
  .letterhead p { margin: 2px 0 0; font-size: 11px; color: #64748b; }
  .report-title { text-align: center; margin: 14px 0 4px; }
  .report-title h2 { margin: 0; font-size: 18px; color: #246f54; letter-spacing: 0.03em; }
  .report-title .sub { margin: 4px 0 0; font-size: 12px; color: #475569; }
  .meta-box { border: 1px solid #cfe8dc; border-radius: 6px; padding: 10px 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; font-size: 11px; margin: 12px 0 14px; background: #fff; }
  .meta-box div span { color: #64748b; display: inline-block; min-width: 110px; }
  .note { font-size: 10px; color: #64748b; margin: 0 0 12px; }
  .section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #246f54; margin: 16px 0 8px; }
  .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
  .kpi-row.cols-3 { grid-template-columns: repeat(3, 1fr); }
  .kpi-row.cols-2 { grid-template-columns: repeat(2, 1fr); }
  .kpi { border: 1px solid #cfe8dc; border-radius: 6px; padding: 10px 12px; background: #f8fafc; text-align: center; break-inside: avoid; }
  .kpi span { display: block; font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; }
  .kpi strong { display: block; margin-top: 4px; font-size: 18px; color: #1e293b; }
  .metric-groups { display: grid; gap: 12px; margin-bottom: 8px; }
  .metric-group h3 { margin: 0 0 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
  .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; }
  .metric { border: 1px solid #cfe8dc; border-radius: 8px; padding: 10px 12px; background: #fff; break-inside: avoid; }
  .metric span { display: block; font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; }
  .metric strong { font-size: 16px; color: #1e293b; }
  .detail-list { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; font-size: 11px; margin-bottom: 12px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; }
  .detail-list .item { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; border-bottom: 1px solid #f1f5f9; }
  .detail-list .item:last-child { border-bottom: 0; }
  .detail-list .item span { color: #64748b; }
  .detail-list .item strong { color: #1e293b; font-weight: 600; }
  .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
  .chart-card { border: 1px solid #cfe8dc; border-radius: 8px; padding: 12px; background: #fff; break-inside: avoid; page-break-inside: avoid; }
  .chart-card h3 { margin: 0 0 10px; font-size: 12px; color: #246f54; }
  .bar-row { display: grid; grid-template-columns: 100px 1fr 40px; gap: 8px; align-items: center; margin-bottom: 6px; font-size: 11px; }
  .bar-track { height: 10px; background: #e8f5ef; border-radius: 999px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 999px; background: #246f54; }
  .bar-val { text-align: right; }
  table.data { width: 100%; border-collapse: collapse; font-size: 11px; }
  table.data th { background: #246f54; color: #fff; text-align: left; padding: 7px 9px; }
  table.data td { border-bottom: 1px solid #e2e8f0; padding: 6px 9px; }
  table.data tr:nth-child(even) td { background: #f0faf5; }
  table.data.compact { font-size: 10px; }
  table.data.compact th, table.data.compact td { padding: 5px 7px; }
  .summary-right { margin-top: 12px; text-align: right; font-size: 12px; color: #1e293b; }
  .summary-right div { margin: 2px 0; }
  .sign { margin-top: 28px; font-size: 11px; break-inside: avoid; page-break-inside: avoid; }
  .sign .intro { margin: 0 0 14px; color: #475569; }
  .sign-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
  .sign-col .line { margin-top: 28px; border-bottom: 1px solid #246f54; height: 16px; }
  .sign-col .cap { margin-top: 4px; color: #64748b; font-size: 10px; }
  .sign-dual { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 8px; }
  .sign-dual .line { margin-top: 36px; border-bottom: 1px solid #246f54; height: 16px; }
  .sign-dual .name { margin-top: 6px; font-weight: 600; font-size: 11px; }
  .sign-dual .role { margin-top: 2px; color: #64748b; font-size: 10px; }
  .sign-dual .date-line { margin-top: 14px; color: #64748b; font-size: 10px; }
  .footer-brand { margin-top: 20px; text-align: center; font-size: 10px; color: #64748b; }
  @media print {
    .toolbar { display: none !important; }
    body { margin: 0; }
    .letterhead, table.data th, .bar-fill, .kpi { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  @media (max-width: 700px) {
    .charts, .meta-box, .kpi-row, .detail-list, .sign-row, .sign-dual { grid-template-columns: 1fr; }
  }
`;

/**
 * Primary KPI strip (max 4 recommended).
 * @param {Array<[string, string|number]>} metrics
 */
export function renderKpiRowHtml(metrics = []) {
  const items = (metrics || []).slice(0, 4);
  if (!items.length) return "";
  const cols =
    items.length === 4 ? "" : items.length === 3 ? " cols-3" : " cols-2";
  const cells = items
    .map(
      ([label, value]) =>
        `<div class="kpi"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
    )
    .join("");
  return `<div class="kpi-row${cols}">${cells}</div>`;
}

/**
 * Secondary 2-column detail list (label · value).
 * @param {Array<[string, string|number]>} items
 */
export function renderDetailListHtml(items = []) {
  if (!items?.length) return "";
  const rows = items
    .map(
      ([label, value]) =>
        `<div class="item"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
    )
    .join("");
  return `<div class="detail-list">${rows}</div>`;
}

/**
 * Compact horizontal bar chart card. Returns "" if no rows (skip empty charts).
 * @param {string} title
 * @param {Array<{ name: string, value: number|string, fill?: string, display?: string }>} rows
 * @param {{ showEmpty?: boolean }} [opts]
 */
export function renderBarChartHtml(title, rows = [], { showEmpty = false } = {}) {
  if (!rows?.length) {
    if (!showEmpty) return "";
    return `<div class="chart-card"><h3>${escapeHtml(title)}</h3><p style="margin:0;font-size:12px;color:#64748b;">No data</p></div>`;
  }
  const max = Math.max(
    1,
    ...rows.map((r) => {
      const n = Number(r.value);
      return Number.isFinite(n) ? n : 0;
    })
  );
  const bars = rows
    .map((r) => {
      const v = Number(r.value);
      const num = Number.isFinite(v) ? v : 0;
      const pct = Math.round((num / max) * 100);
      const fill =
        r.fill ||
        (r.name === "Ungraded"
          ? "#94a3b8"
          : r.name === "Below 75"
            ? "#c2410c"
            : "#246f54");
      const display =
        r.display != null
          ? r.display
          : Number.isFinite(v)
            ? v
            : r.value ?? "—";
      return `<div class="bar-row">
          <span class="bar-label">${escapeHtml(r.name)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${fill}"></div></div>
          <strong class="bar-val">${escapeHtml(display)}</strong>
        </div>`;
    })
    .join("");
  return `<div class="chart-card"><h3>${escapeHtml(title)}</h3>${bars}</div>`;
}

/**
 * @param {Array<{ label: string, metrics: Array<[string, string|number]> }>} groups
 */
export function renderMetricGroupsHtml(groups = []) {
  const blocks = groups
    .map((group) => {
      const cells = (group.metrics || [])
        .map(
          ([label, value]) =>
            `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`
        )
        .join("");
      return `<div class="metric-group">
        <h3>${escapeHtml(group.label)}</h3>
        <div class="metrics">${cells}</div>
      </div>`;
    })
    .join("");
  return `<div class="metric-groups">${blocks}</div>`;
}

/**
 * @param {{ headers: string[], rowsHtml: string, emptyColspan?: number, emptyText?: string, compact?: boolean }} opts
 */
export function renderDataTableHtml({
  headers = [],
  rowsHtml = "",
  emptyColspan,
  emptyText = "No data for the selected filters.",
  compact = false,
} = {}) {
  const th = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const body =
    rowsHtml ||
    `<tr><td colspan="${emptyColspan ?? headers.length}">${escapeHtml(emptyText)}</td></tr>`;
  const cls = compact ? "data compact" : "data";
  return `<table class="${cls}"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
}

/**
 * Side-by-side Name / Signature / Date.
 * @param {{ preparedByLabel?: string }} [opts]
 */
export function renderSignatureBlockHtml({
  preparedByLabel = "Prepared and certified by:",
} = {}) {
  return `<div class="sign">
    <p class="intro">${escapeHtml(preparedByLabel)}</p>
    <div class="sign-row">
      <div class="sign-col"><div class="line"></div><p class="cap">Name</p></div>
      <div class="sign-col"><div class="line"></div><p class="cap">Signature</p></div>
      <div class="sign-col"><div class="line"></div><p class="cap">Date</p></div>
    </div>
  </div>`;
}

/**
 * Dual signatory block (Prepared by / Noted by) for formal ARAL-style docs.
 */
export function renderDualSignatureHtml({
  preparedBy = "",
  preparedRole = "Head Teacher / Administrator",
  notedBy = "",
  notedRole = "Principal / OIC",
} = {}) {
  return `<div class="sign">
    <div class="sign-dual">
      <div>
        <p class="intro">Prepared by:</p>
        <div class="line"></div>
        <p class="name">${escapeHtml(preparedBy || "________________________")}</p>
        <p class="role">${escapeHtml(preparedRole)}</p>
        <p class="date-line">Date: _________________________</p>
      </div>
      <div>
        <p class="intro">Noted by:</p>
        <div class="line"></div>
        <p class="name">${escapeHtml(notedBy || "________________________")}</p>
        <p class="role">${escapeHtml(notedRole)}</p>
        <p class="date-line">Date: _________________________</p>
      </div>
    </div>
  </div>`;
}

/**
 * Full printable document with CNHS letterhead (target layout).
 * @param {{
 *   documentTitle: string,
 *   letterheadSub?: string,
 *   title: string,
 *   subtitle?: string,
 *   metaRows?: Array<[string, string]>,
 *   noteHtml?: string,
 *   bodyHtml: string,
 *   showSignature?: boolean,
 *   signatureLabel?: string,
 *   signatureHtml?: string,
 *   orientation?: "portrait" | "landscape",
 * }} opts
 */
export function wrapCnhsPrintDocument({
  documentTitle,
  letterheadSub = "CNHS Learn · Reports",
  title,
  subtitle = "",
  metaRows = [],
  noteHtml = "",
  bodyHtml,
  showSignature = true,
  signatureLabel,
  signatureHtml,
  orientation = "portrait",
} = {}) {
  const logoUrl = absolutePublicUrl("/cnhs-logo.png");
  const metaHtml = metaRows
    .map(
      ([label, value]) =>
        `<div><span>${escapeHtml(label)}</span> <strong>${escapeHtml(value)}</strong></div>`
    )
    .join("");

  const pageRule =
    orientation === "landscape"
      ? "@page { size: letter landscape; margin: 12mm; }"
      : "";

  const signBlock =
    signatureHtml ||
    (showSignature
      ? renderSignatureBlockHtml({ preparedByLabel: signatureLabel })
      : "");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(documentTitle)}</title>
  <style>${pageRule}${CNHS_PRINT_CSS}</style>
</head>
<body class="${orientation === "landscape" ? "page-landscape" : ""}">
  <div class="toolbar">
    <button type="button" onclick="window.print()">Print / Save PDF</button>
  </div>

  <header class="letterhead">
    <img src="${escapeHtml(logoUrl)}" alt="CNHS logo" />
    <div class="center">
      <h1>CAMBAOG NATIONAL HIGH SCHOOL</h1>
      <p>${escapeHtml(letterheadSub)}</p>
    </div>
    <img src="${escapeHtml(logoUrl)}" alt="CNHS logo" />
  </header>

  <div class="report-title">
    <h2>${escapeHtml(title)}</h2>
    ${subtitle ? `<p class="sub">${escapeHtml(subtitle)}</p>` : ""}
  </div>

  ${metaHtml ? `<div class="meta-box">${metaHtml}</div>` : ""}
  ${noteHtml ? `<p class="note">${escapeHtml(noteHtml)}</p>` : ""}

  ${bodyHtml}

  ${signBlock}

  <p class="footer-brand">Cambaog National High School · CNHS Learn</p>
</body>
</html>`;
}

/**
 * Map chart rows from various key shapes into bar chart rows.
 */
export function chartRowsFromList(
  rows = [],
  nameKey = "name",
  valueKey = "value"
) {
  if (!rows?.length) return [];
  return rows.map((row) => {
    const value = row[valueKey];
    const percent = row.percent;
    return {
      name: String(row[nameKey] ?? "—"),
      value: Number.isFinite(Number(value)) ? Number(value) : 0,
      display:
        percent != null ? `${value} (${percent}%)` : value ?? "—",
    };
  });
}
