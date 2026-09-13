/**
 * Browser-side chart PNG generator for ExcelJS embeds.
 * Uses Canvas 2D (client export path). No native deps.
 */

const BRAND = {
  greenDark: "246F54",
  green: "40916C",
  amber: "C2410C",
  red: "E76F51",
  slate: "64748B",
  slateDark: "1E293B",
  border: "CBD5E1",
  white: "FFFFFF",
};

const PALETTE = [
  `#${BRAND.greenDark}`,
  `#${BRAND.green}`,
  "#52B788",
  `#${BRAND.amber}`,
  `#${BRAND.red}`,
  "#6366F1",
  "#0EA5E9",
  "#94A3B8",
];

function paintBackground(ctx, width, height) {
  ctx.fillStyle = `#${BRAND.white}`;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = `#${BRAND.border}`;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
}

function drawTitle(ctx, title, width) {
  ctx.fillStyle = `#${BRAND.greenDark}`;
  ctx.font = "bold 15px Calibri, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(String(title || "Chart").slice(0, 48), width / 2, 12);
}

function truncate(text, max = 12) {
  const s = String(text ?? "");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function normalizeRows(rows = []) {
  return (rows || [])
    .map((row) => {
      const raw =
        row.value !== undefined && row.value !== null
          ? row.value
          : row.average !== undefined && row.average !== null
            ? row.average
            : row.count;
      return {
        category: row.category ?? row.name ?? row.label ?? "—",
        value: raw == null || raw === "" ? NaN : Number(raw),
      };
    })
    .filter((row) => Number.isFinite(row.value));
}

function inferChartType(series = {}) {
  if (series.chartType) return series.chartType;
  const title = String(series.title || "").toLowerCase();
  if (
    title.includes("risk") ||
    title.includes("distribution") ||
    title.includes("mix") ||
    title.includes("status") ||
    title.includes("progress")
  ) {
    return "donut";
  }
  if (title.includes("subject") || (series.rows?.length ?? 0) > 8) {
    return "hbar";
  }
  return "bar";
}

function drawGroupedBarChart(ctx, width, height, title, groups = []) {
  paintBackground(ctx, width, height);
  drawTitle(ctx, title, width);

  const plot = { left: 48, right: width - 16, top: 48, bottom: height - 48 };
  const plotW = plot.right - plot.left;
  const plotH = plot.bottom - plot.top;
  const cats = groups.length ? groups : [];
  let maxVal = 1;
  for (const group of cats) {
    for (const key of ["Passed", "For ARAL"]) {
      const n = Number(group[key]);
      if (Number.isFinite(n) && n > maxVal) maxVal = n;
    }
  }

  ctx.strokeStyle = `#${BRAND.border}`;
  ctx.beginPath();
  ctx.moveTo(plot.left, plot.top);
  ctx.lineTo(plot.left, plot.bottom);
  ctx.lineTo(plot.right, plot.bottom);
  ctx.stroke();

  const gap = 16;
  const clusterW = Math.max(28, (plotW - gap * (cats.length + 1)) / Math.max(cats.length, 1));
  const barW = Math.max(8, (clusterW - 6) / 2);

  cats.forEach((group, index) => {
    const x0 = plot.left + gap + index * (clusterW + gap);
    const passed = group.Passed;
    const forAral = group["For ARAL"];
    const hasBars = passed != null || forAral != null;

    if (hasBars) {
      if (passed != null) {
        const h = (Number(passed) / maxVal) * (plotH - 8);
        ctx.fillStyle = `#${BRAND.greenDark}`;
        ctx.fillRect(x0, plot.bottom - h, barW, h);
        ctx.fillStyle = `#${BRAND.slateDark}`;
        ctx.font = "10px Calibri, Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(passed), x0 + barW / 2, plot.bottom - h - 4);
      }
      if (forAral != null) {
        const h = (Number(forAral) / maxVal) * (plotH - 8);
        ctx.fillStyle = `#${BRAND.amber}`;
        ctx.fillRect(x0 + barW + 4, plot.bottom - h, barW, h);
        ctx.fillStyle = `#${BRAND.slateDark}`;
        ctx.font = "10px Calibri, Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(forAral), x0 + barW + 4 + barW / 2, plot.bottom - h - 4);
      }
    } else {
      ctx.fillStyle = `#${BRAND.slate}`;
      ctx.font = "9px Calibri, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Not started", x0 + clusterW / 2, plot.top + plotH / 2);
    }

    ctx.fillStyle = `#${BRAND.slate}`;
    ctx.font = "9px Calibri, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(truncate(group.name || group.category, 12), x0 + clusterW / 2, plot.bottom + 14);
  });

  ctx.font = "9px Calibri, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillStyle = `#${BRAND.greenDark}`;
  ctx.fillRect(plot.left, height - 22, 8, 8);
  ctx.fillStyle = `#${BRAND.slateDark}`;
  ctx.fillText("Passed", plot.left + 12, height - 14);
  ctx.fillStyle = `#${BRAND.amber}`;
  ctx.fillRect(plot.left + 64, height - 22, 8, 8);
  ctx.fillStyle = `#${BRAND.slateDark}`;
  ctx.fillText("For ARAL", plot.left + 76, height - 14);
}

function drawBarChart(ctx, width, height, title, rows) {
  paintBackground(ctx, width, height);
  drawTitle(ctx, title, width);

  const plot = { left: 48, right: width - 16, top: 40, bottom: height - 36 };
  const plotW = plot.right - plot.left;
  const plotH = plot.bottom - plot.top;
  const maxVal = Math.max(...rows.map((r) => r.value), 1);

  ctx.strokeStyle = `#${BRAND.border}`;
  ctx.beginPath();
  ctx.moveTo(plot.left, plot.top);
  ctx.lineTo(plot.left, plot.bottom);
  ctx.lineTo(plot.right, plot.bottom);
  ctx.stroke();

  const gap = 8;
  const barW = Math.max(10, (plotW - gap * (rows.length + 1)) / rows.length);

  rows.forEach((row, index) => {
    const h = (row.value / maxVal) * (plotH - 8);
    const x = plot.left + gap + index * (barW + gap);
    const y = plot.bottom - h;
    ctx.fillStyle = PALETTE[index % PALETTE.length];
    ctx.fillRect(x, y, barW, h);

    ctx.fillStyle = `#${BRAND.slateDark}`;
    ctx.font = "10px Calibri, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(Math.round(row.value * 10) / 10), x + barW / 2, y - 4);

    ctx.fillStyle = `#${BRAND.slate}`;
    ctx.font = "9px Calibri, Arial, sans-serif";
    ctx.fillText(truncate(row.category, 10), x + barW / 2, plot.bottom + 12);
  });
}

function drawHorizontalBarChart(ctx, width, height, title, rows) {
  paintBackground(ctx, width, height);
  drawTitle(ctx, title, width);

  const plot = { left: 88, right: width - 24, top: 40, bottom: height - 16 };
  const plotW = plot.right - plot.left;
  const maxVal = Math.max(...rows.map((r) => r.value), 1);
  const rowH = Math.min(22, (plot.bottom - plot.top) / Math.max(rows.length, 1));

  rows.slice(0, 10).forEach((row, index) => {
    const y = plot.top + index * rowH;
    const w = (row.value / maxVal) * plotW;
    ctx.fillStyle = PALETTE[index % PALETTE.length];
    ctx.fillRect(plot.left, y + 4, Math.max(2, w), rowH - 8);

    ctx.fillStyle = `#${BRAND.slateDark}`;
    ctx.font = "10px Calibri, Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(truncate(row.category, 14), plot.left - 6, y + rowH / 2);

    ctx.textAlign = "left";
    ctx.fillText(
      String(Math.round(row.value * 10) / 10),
      plot.left + w + 4,
      y + rowH / 2
    );
  });
}

function drawDonutChart(ctx, width, height, title, rows, { pie = false } = {}) {
  paintBackground(ctx, width, height);
  drawTitle(ctx, title, width);

  const total = rows.reduce((sum, r) => sum + r.value, 0) || 1;
  const cx = width * 0.34;
  const cy = height * 0.55;
  const radius = Math.min(width, height) * 0.28;
  const inner = pie ? 0 : radius * 0.55;

  let start = -Math.PI / 2;
  rows.forEach((row, index) => {
    const slice = (row.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, start + slice);
    ctx.closePath();
    ctx.fillStyle = PALETTE[index % PALETTE.length];
    ctx.fill();
    start += slice;
  });

  if (inner > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.fillStyle = `#${BRAND.white}`;
    ctx.fill();

    ctx.fillStyle = `#${BRAND.slateDark}`;
    ctx.font = "bold 13px Calibri, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(Math.round(total)), cx, cy);
  }

  const legendX = width * 0.58;
  let legendY = 48;
  rows.forEach((row, index) => {
    ctx.fillStyle = PALETTE[index % PALETTE.length];
    ctx.fillRect(legendX, legendY, 10, 10);
    ctx.fillStyle = `#${BRAND.slateDark}`;
    ctx.font = "11px Calibri, Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const pct = Math.round((row.value / total) * 100);
    ctx.fillText(
      `${truncate(row.category, 16)}  ${row.value} (${pct}%)`,
      legendX + 16,
      legendY - 1
    );
    legendY += 18;
  });
}

async function canvasToPngBuffer(canvas) {
  const blob = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/png");
  });
  if (!blob) return null;
  return await blob.arrayBuffer();
}

/**
 * Render chartSeries into PNG ArrayBuffers for ExcelJS addImage.
 * @returns {Promise<Array<{ title: string, buffer: ArrayBuffer, width: number, height: number, chartType: string }>>}
 */
export async function renderChartSeriesImages(chartSeries = []) {
  if (typeof document === "undefined") return [];

  const usable = (chartSeries || []).filter((s) => s?.rows?.length);
  const images = [];

  for (const series of usable.slice(0, 6)) {
    const chartType = inferChartType(series);
    const rows = normalizeRows(series.rows);
    if (chartType !== "groupedbar" && !rows.length) continue;
    const width = Number(series.width) || 520;
    const height =
      Number(series.height) || (chartType === "hbar" ? 300 : 280);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    if (chartType === "pie") {
      drawDonutChart(ctx, width, height, series.title, rows, { pie: true });
    } else if (chartType === "donut") {
      drawDonutChart(ctx, width, height, series.title, rows);
    } else if (chartType === "hbar") {
      drawHorizontalBarChart(ctx, width, height, series.title, rows);
    } else if (chartType === "groupedbar") {
      const groups = (series.chartRows || series.rows || []).map((row) => ({
        name: row.name || row.category,
        Passed: row.Passed,
        "For ARAL": row["For ARAL"],
      }));
      if (!groups.length) continue;
      drawGroupedBarChart(ctx, width, height, series.title, groups);
    } else {
      drawBarChart(ctx, width, height, series.title, rows);
    }

    const buffer = await canvasToPngBuffer(canvas);
    if (!buffer) continue;
    images.push({
      title: series.title || "Chart",
      buffer,
      width,
      height,
      chartType,
    });
  }

  return images;
}
