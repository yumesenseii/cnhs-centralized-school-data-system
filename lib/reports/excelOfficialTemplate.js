/**
 * Official CNHS Excel report template (ExcelJS).
 * Exactly two worksheets: Report Cover + Detailed Report.
 * Legal paper, centered content, print-ready.
 */

import ExcelJS from "exceljs";
import { renderChartSeriesImages } from "@/lib/reports/excelChartImages";

export const CNHS_EXCEL_BRAND = {
  schoolName: "CAMBAOG NATIONAL HIGH SCHOOL",
  systemName: "CNHS Centralized School Data System",
  greenDark: "246F54",
  green: "40916C",
  greenSoft: "E8F5EF",
  amber: "C2410C",
  valueAccent: "B45309",
  red: "E76F51",
  slate: "64748B",
  slateDark: "1E293B",
  border: "CBD5E1",
  zebra: "F8FAFC",
  zebraAlt: "FFFBF5",
  white: "FFFFFF",
  logoPath: "/cnhs-logo.png",
};

/** Legal paper size code used by Excel / ExcelJS. */
const PAPER_LEGAL = 5;

/** Cover content band: columns C–H (1-based). */
const COVER = {
  startCol: 3,
  endCol: 8,
  midLeft: 3,
  midRight: 6,
};

/** Thin border helper. */
function thinBorder() {
  const edge = { style: "thin", color: { argb: `FF${CNHS_EXCEL_BRAND.border}` } };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

function asText(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function asNumber(value) {
  if (value === null || value === undefined || value === "" || value === "—") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatDateParts(date = new Date()) {
  return {
    dateGenerated: date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    timeGenerated: date.toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

async function loadLogoBuffer() {
  try {
    if (typeof fetch === "undefined") return null;
    const response = await fetch(CNHS_EXCEL_BRAND.logoPath);
    if (!response.ok) return null;
    return await response.arrayBuffer();
  } catch {
    return null;
  }
}

function mergeBand(sheet, row, startCol = COVER.startCol, endCol = COVER.endCol) {
  sheet.mergeCells(row, startCol, row, endCol);
  return sheet.getCell(row, startCol);
}

function centerText(cell, {
  size = 11,
  bold = false,
  color = CNHS_EXCEL_BRAND.slateDark,
  italic = false,
} = {}) {
  cell.font = {
    name: "Calibri",
    size,
    bold,
    italic,
    color: { argb: `FF${color}` },
  };
  cell.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
}

function setColumnBandWidths(sheet, { landscape = false } = {}) {
  // Side gutters keep content visually centered on Legal.
  sheet.getColumn(1).width = landscape ? 3 : 4;
  sheet.getColumn(2).width = landscape ? 3 : 4;
  for (let c = COVER.startCol; c <= COVER.endCol; c += 1) {
    sheet.getColumn(c).width = landscape ? 14 : 12;
  }
  sheet.getColumn(COVER.endCol + 1).width = landscape ? 3 : 4;
  sheet.getColumn(COVER.endCol + 2).width = landscape ? 3 : 4;
}

/**
 * Create a branded workbook shell.
 */
export function createWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = CNHS_EXCEL_BRAND.systemName;
  workbook.company = CNHS_EXCEL_BRAND.schoolName;
  workbook.created = new Date();
  workbook.modified = new Date();
  return workbook;
}

/**
 * Legal paper print defaults.
 */
export function applyPrintSettings(
  worksheet,
  { landscape = true, title = "", printTitlesRow } = {}
) {
  worksheet.pageSetup = {
    orientation: landscape ? "landscape" : "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: PAPER_LEGAL,
    horizontalCentered: true,
    verticalCentered: false,
    margins: {
      left: 0.5,
      right: 0.5,
      top: 0.55,
      bottom: 0.55,
      header: 0.25,
      footer: 0.25,
    },
    printTitlesRow: printTitlesRow || worksheet._cnhsHeaderRow || undefined,
  };
  worksheet.headerFooter = {
    oddHeader: `&L${CNHS_EXCEL_BRAND.schoolName}&R${CNHS_EXCEL_BRAND.systemName}`,
    oddFooter: `&L${title || "Official Report"}&CPage &P of &N&RConfidential — School Use`,
  };
}

/**
 * Short cover narrative matching school report mockups.
 */
export function buildCoverNarrative({
  totalClasses = 0,
  totalStudents = 0,
  atRisk = 0,
  aralLearners = 0,
  classroomRemedial = 0,
  averageGrade = null,
  attendanceRate = null,
} = {}) {
  const avgText =
    averageGrade === null || averageGrade === undefined || averageGrade === "—"
      ? "not yet available"
      : String(averageGrade);
  const attendanceText =
    attendanceRate === null || attendanceRate === undefined
      ? ""
      : ` with an attendance rate of ${attendanceRate}%`;

  return `The school currently manages ${totalClasses} class${
    totalClasses === 1 ? "" : "es"
  } with ${totalStudents} learner${totalStudents === 1 ? "" : "s"}. ${
    Number(atRisk) || 0
  } learners are identified as at risk, while ${
    Number(aralLearners) || 0
  } are flagged for the ARAL Program. ${
    Number(classroomRemedial) || 0
  } classroom remedial class${
    Number(classroomRemedial) === 1 ? " is" : "es are"
  } active. The overall class average is ${avgText}${attendanceText}.`;
}

/**
 * Detailed report narrative paragraphs.
 */
export function buildReportNarrative({
  reportTitle = "report",
  schoolYear = "—",
  quarter = "—",
  totalClasses = 0,
  totalStudents = 0,
  averageGrade = null,
  highestAverage = null,
  lowestAverage = null,
  atRisk = 0,
  aralLearners = 0,
  classroomRemedial = 0,
  monitoringRate = null,
  attendanceRate = null,
} = {}) {
  const avgText =
    averageGrade === null || averageGrade === undefined || averageGrade === "—"
      ? "not yet available"
      : String(averageGrade);
  const monitorText =
    monitoringRate === null || monitoringRate === undefined
      ? "Monitoring completion is still being updated."
      : `Monitoring completion is currently at ${monitoringRate}%.`;
  const attendanceText =
    attendanceRate === null || attendanceRate === undefined
      ? ""
      : ` Separate SF2 attendance monitoring shows a monthly attendance rate of ${attendanceRate}%.`;

  return [
    `This ${reportTitle} covers ${totalClasses} class${
      totalClasses === 1 ? "" : "es"
    } and ${totalStudents} learner${
      totalStudents === 1 ? "" : "s"
    } for ${quarter} of School Year ${schoolYear}.`,
    `${classroomRemedial} class${
      classroomRemedial === 1 ? "" : "es"
    } ${
      classroomRemedial === 1 ? "requires" : "require"
    } Classroom Remediation based on subject grade patterns.`,
    `${aralLearners} learner${aralLearners === 1 ? "" : "s"} ${
      aralLearners === 1 ? "was" : "were"
    } identified for ARAL Learners intervention (English / Filipino context).`,
    `${atRisk} learner${atRisk === 1 ? "" : "s"} ${
      atRisk === 1 ? "is" : "are"
    } currently classified as at-risk (High or Moderate) from ECR grades only.`,
    `The overall class average is ${avgText}.${
      highestAverage != null && lowestAverage != null
        ? ` Highest subject average: ${highestAverage}. Lowest subject average: ${lowestAverage}.`
        : ""
    }`,
    `${monitorText}${attendanceText}`,
    "This document is generated for school administration and academic monitoring. It is not a replacement for official DepEd forms.",
  ].join("\n\n");
}

function paintMetricTable(sheet, startRow, metrics = []) {
  const metricCol = COVER.startCol;
  const valueCol = COVER.startCol + 3;
  const endCol = COVER.endCol;

  sheet.mergeCells(startRow, metricCol, startRow, valueCol - 1);
  sheet.mergeCells(startRow, valueCol, startRow, endCol);

  const metricHeader = sheet.getCell(startRow, metricCol);
  const valueHeader = sheet.getCell(startRow, valueCol);
  for (const cell of [metricHeader, valueHeader]) {
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: `FF${CNHS_EXCEL_BRAND.white}` },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${CNHS_EXCEL_BRAND.greenDark}` },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder();
  }
  metricHeader.value = "Metric";
  valueHeader.value = "Value";
  // Fill merged header cells with border
  for (let c = metricCol; c <= endCol; c += 1) {
    const cell = sheet.getCell(startRow, c);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${CNHS_EXCEL_BRAND.greenDark}` },
    };
    cell.border = thinBorder();
  }
  sheet.getRow(startRow).height = 20;

  let row = startRow + 1;
  metrics.forEach((metric, index) => {
    sheet.mergeCells(row, metricCol, row, valueCol - 1);
    sheet.mergeCells(row, valueCol, row, endCol);

    const zebra = index % 2 === 1 ? CNHS_EXCEL_BRAND.zebraAlt : CNHS_EXCEL_BRAND.white;
    for (let c = metricCol; c <= endCol; c += 1) {
      const cell = sheet.getCell(row, c);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: `FF${zebra}` },
      };
      cell.border = thinBorder();
    }

    const labelCell = sheet.getCell(row, metricCol);
    labelCell.value = metric.label;
    labelCell.font = {
      name: "Calibri",
      size: 11,
      color: { argb: `FF${CNHS_EXCEL_BRAND.slateDark}` },
    };
    labelCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };

    const valueCell = sheet.getCell(row, valueCol);
    valueCell.value = asText(metric.value);
    valueCell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: `FF${CNHS_EXCEL_BRAND.valueAccent}` },
    };
    valueCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(row).height = 18;
    row += 1;
  });

  return row;
}

function paintMiniSeriesTable(sheet, startRow, startCol, series) {
  if (!series?.rows?.length) return 0;

  const width = 2;
  sheet.mergeCells(startRow, startCol, startRow, startCol + width - 1);
  const titleCell = sheet.getCell(startRow, startCol);
  titleCell.value = series.title;
  titleCell.font = {
    name: "Calibri",
    size: 10,
    bold: true,
    color: { argb: `FF${CNHS_EXCEL_BRAND.greenDark}` },
  };
  titleCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };

  const headerRow = startRow + 1;
  const h1 = sheet.getCell(headerRow, startCol);
  const h2 = sheet.getCell(headerRow, startCol + 1);
  h1.value = series.categoryHeader || "Category";
  h2.value = series.valueHeader || "Value";
  for (const cell of [h1, h2]) {
    cell.font = {
      name: "Calibri",
      size: 9,
      bold: true,
      color: { argb: `FF${CNHS_EXCEL_BRAND.white}` },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${CNHS_EXCEL_BRAND.greenDark}` },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = thinBorder();
  }

  let row = headerRow + 1;
  for (const item of series.rows) {
    const c1 = sheet.getCell(row, startCol);
    const c2 = sheet.getCell(row, startCol + 1);
    c1.value = asText(item.category);
    c2.value = asNumber(item.value) ?? asText(item.value);
    for (const cell of [c1, c2]) {
      cell.font = {
        name: "Calibri",
        size: 9,
        color: { argb: `FF${CNHS_EXCEL_BRAND.slateDark}` },
      };
      cell.border = thinBorder();
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }
    c1.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    row += 1;
  }

  return row - startRow;
}

/**
 * Embed chart PNGs in a 2-column grid on the cover sheet.
 * Returns the next free row after reserved image space.
 */
function embedPerformanceCharts(workbook, sheet, startRow, chartImages = []) {
  if (!chartImages.length) return startRow;

  const displayWidth = 280;
  const displayHeight = 152;
  const rowsPerImage = 12;
  const leftCol = 2.15; // ~column C
  const rightCol = 5.15; // ~column F

  let row = startRow;
  chartImages.forEach((image, index) => {
    const isLeft = index % 2 === 0;
    if (isLeft && index > 0) row += rowsPerImage + 1;

    const imageId = workbook.addImage({
      buffer: image.buffer,
      extension: "png",
    });
    sheet.addImage(imageId, {
      tl: {
        col: isLeft ? leftCol : rightCol,
        row: row - 1,
      },
      ext: { width: displayWidth, height: displayHeight },
    });
  });

  const pairCount = Math.ceil(chartImages.length / 2);
  return startRow + pairCount * (rowsPerImage + 1);
}

/**
 * Sheet 1 — Report Cover (branding + metrics + narrative + charts + data).
 */
export async function createReportCover(
  workbook,
  {
    meta = {},
    metrics = [],
    chartSeries = [],
    coverNarrative = "",
  } = {}
) {
  const sheet = workbook.addWorksheet("Report Cover", {
    views: [{ showGridLines: false }],
  });

  const {
    reportTitle = "School Report",
    schoolYear = "—",
    quarter = "—",
    generatedBy = "System",
    totalRecords = 0,
    generatedAt = new Date(),
  } = meta;
  const { dateGenerated, timeGenerated } = formatDateParts(generatedAt);

  setColumnBandWidths(sheet, { landscape: false });

  let row = 1;

  const logo = await loadLogoBuffer();
  if (logo) {
    const imageId = workbook.addImage({
      buffer: logo,
      extension: "png",
    });
    // Center-ish above title band (col index is 0-based).
    sheet.addImage(imageId, {
      tl: { col: 4.55, row: 0.15 },
      ext: { width: 64, height: 64 },
    });
    row = 4;
  } else {
    row = 2;
  }

  const schoolCell = mergeBand(sheet, row);
  schoolCell.value = CNHS_EXCEL_BRAND.schoolName;
  centerText(schoolCell, { size: 18, bold: true, color: CNHS_EXCEL_BRAND.greenDark });
  sheet.getRow(row).height = 26;
  row += 1;

  const systemCell = mergeBand(sheet, row);
  systemCell.value = CNHS_EXCEL_BRAND.systemName;
  centerText(systemCell, { size: 11, bold: false, color: CNHS_EXCEL_BRAND.slate });
  row += 2;

  const titleCell = mergeBand(sheet, row);
  titleCell.value = reportTitle;
  centerText(titleCell, { size: 16, bold: true, color: CNHS_EXCEL_BRAND.greenDark });
  sheet.getRow(row).height = 24;
  row += 2;

  // Meta block — two centered columns
  const metaLeft = [
    ["School Year", schoolYear],
    ["Term / Period", quarter],
    ["Total Records", totalRecords],
  ];
  const metaRight = [
    ["Date Generated", dateGenerated],
    ["Time Generated", timeGenerated],
    ["Generated By", generatedBy],
  ];

  for (let i = 0; i < Math.max(metaLeft.length, metaRight.length); i += 1) {
    const left = metaLeft[i];
    const right = metaRight[i];
    if (left) {
      sheet.mergeCells(row, COVER.startCol, row, COVER.startCol + 2);
      const cell = sheet.getCell(row, COVER.startCol);
      cell.value = `${left[0]}: ${asText(left[1])}`;
      centerText(cell, { size: 11, bold: false });
    }
    if (right) {
      sheet.mergeCells(row, COVER.midRight, row, COVER.endCol);
      const cell = sheet.getCell(row, COVER.midRight);
      cell.value = `${right[0]}: ${asText(right[1])}`;
      centerText(cell, { size: 11, bold: false });
    }
    row += 1;
  }

  row += 1;
  const noteCell = mergeBand(sheet, row);
  noteCell.value =
    "Academic Prediction uses ECR grades only. Attendance (SF2) is a separate monitoring module.";
  centerText(noteCell, { size: 9, bold: false, color: CNHS_EXCEL_BRAND.slate, italic: true });
  row += 2;

  // Executive Summary metric table
  const metricsHeader = mergeBand(sheet, row);
  metricsHeader.value = "Executive Summary";
  centerText(metricsHeader, { size: 14, bold: true, color: CNHS_EXCEL_BRAND.greenDark });
  row += 1;

  row = paintMetricTable(sheet, row, metrics);
  row += 2;

  // Narrative
  const narrativeTitle = mergeBand(sheet, row);
  narrativeTitle.value = "Executive Summary Narrative";
  centerText(narrativeTitle, { size: 13, bold: true, color: CNHS_EXCEL_BRAND.greenDark });
  row += 1;

  const narrativeCell = mergeBand(sheet, row);
  narrativeCell.value = coverNarrative || "No summary available for the selected filters.";
  centerText(narrativeCell, { size: 11, bold: false, color: CNHS_EXCEL_BRAND.slateDark });
  sheet.getRow(row).height = 56;
  row += 2;

  // Performance Analysis — embedded chart images (same filtered series as the UI)
  const perfTitle = mergeBand(sheet, row);
  perfTitle.value = "Performance Analysis";
  centerText(perfTitle, { size: 13, bold: true, color: CNHS_EXCEL_BRAND.greenDark });
  row += 1;

  const perfHint = mergeBand(sheet, row);
  perfHint.value =
    "Charts below mirror the filtered report data shown in the portal (CNHS branding).";
  centerText(perfHint, { size: 9, bold: false, color: CNHS_EXCEL_BRAND.slate });
  row += 1;

  const chartImages = await renderChartSeriesImages(chartSeries);
  if (chartImages.length) {
    row = embedPerformanceCharts(workbook, sheet, row, chartImages);
  } else {
    const emptyCharts = mergeBand(sheet, row);
    emptyCharts.value =
      typeof document === "undefined"
        ? "Chart images render when exporting from the browser."
        : "No chart series available for the selected filters.";
    centerText(emptyCharts, { size: 10, bold: false, color: CNHS_EXCEL_BRAND.slate });
    row += 2;
  }

  // Supporting data tables (audit / optional native Excel charts)
  const chartsTitle = mergeBand(sheet, row);
  chartsTitle.value = "Charts & Visual Analytics — Supporting Data";
  centerText(chartsTitle, { size: 13, bold: true, color: CNHS_EXCEL_BRAND.greenDark });
  row += 1;

  const chartsHint = mergeBand(sheet, row);
  chartsHint.value =
    "Source values for the graphs above. Optional: Insert → Charts for editable Excel charts.";
  centerText(chartsHint, { size: 9, bold: false, color: CNHS_EXCEL_BRAND.slate });
  row += 2;

  const usableSeries = (chartSeries || []).filter((s) => s?.rows?.length);
  if (!usableSeries.length) {
    const empty = mergeBand(sheet, row);
    empty.value = "No chart series available for the selected filters.";
    centerText(empty, { size: 10, bold: false, color: CNHS_EXCEL_BRAND.slate });
  } else {
    // 2-column grid of mini tables within the center band
    const leftCol = COVER.startCol;
    const rightCol = COVER.startCol + 3;
    let leftRow = row;
    let rightRow = row;

    usableSeries.forEach((series, index) => {
      const isLeft = index % 2 === 0;
      const startCol = isLeft ? leftCol : rightCol;
      const startAt = isLeft ? leftRow : rightRow;
      const height = paintMiniSeriesTable(sheet, startAt, startCol, series);
      const next = startAt + height + 2;
      if (isLeft) leftRow = next;
      else rightRow = next;
    });
  }

  applyPrintSettings(sheet, {
    landscape: false,
    title: reportTitle,
  });
  return sheet;
}

function applyGradeOrStatusStyle(cell, col, raw, numeric) {
  if (col.gradeRule && numeric !== null) {
    let fill = "FEE2E2";
    let font = CNHS_EXCEL_BRAND.red;
    if (numeric >= 75) {
      fill = "DCFCE7";
      font = CNHS_EXCEL_BRAND.greenDark;
    } else if (numeric >= 70) {
      fill = "FEF3C7";
      font = "B45309";
    }
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${fill}` },
    };
    cell.font = {
      name: "Calibri",
      size: 10,
      bold: true,
      color: { argb: `FF${font}` },
    };
    return;
  }

  if (!col.statusRule || raw == null) return;
  const text = String(raw).toLowerCase();
  let fill = CNHS_EXCEL_BRAND.zebra;
  let font = CNHS_EXCEL_BRAND.slateDark;
  if (
    text.includes("available") ||
    text.includes("approved") ||
    text.includes("completed") ||
    text.includes("pass") ||
    text.includes("validated")
  ) {
    fill = "DCFCE7";
    font = CNHS_EXCEL_BRAND.greenDark;
  } else if (
    text.includes("pending") ||
    text.includes("needs") ||
    text.includes("ongoing") ||
    text.includes("warning")
  ) {
    fill = "FEF3C7";
    font = "B45309";
  } else if (
    text.includes("not generated") ||
    text.includes("critical") ||
    text.includes("fail") ||
    text.includes("inactive") ||
    text.includes("high risk")
  ) {
    fill = "FEE2E2";
    font = CNHS_EXCEL_BRAND.red;
  }
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: `FF${fill}` },
  };
  cell.font = {
    name: "Calibri",
    size: 10,
    bold: true,
    color: { argb: `FF${font}` },
  };
}

/**
 * Sheet 2 — Detailed Report table + centered narrative.
 */
export function createDetailedReportSheet(
  workbook,
  {
    title = "Detailed Report",
    columns = [],
    rows = [],
    narrative = "",
  } = {}
) {
  const sheet = workbook.addWorksheet("Detailed Report", {
    views: [{ showGridLines: false }],
  });

  const colCount = Math.max(columns.length, 1);

  // Wider columns for landscape Legal class table
  columns.forEach((col, index) => {
    sheet.getColumn(index + 1).width = col.width || 14;
  });

  sheet.mergeCells(1, 1, 1, colCount);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = {
    name: "Calibri",
    size: 14,
    bold: true,
    color: { argb: `FF${CNHS_EXCEL_BRAND.greenDark}` },
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 24;

  const headerRowIndex = 3;
  sheet._cnhsHeaderRow = `${headerRowIndex}:${headerRowIndex}`;
  const headerRow = sheet.getRow(headerRowIndex);
  columns.forEach((col, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = col.header;
    cell.font = {
      name: "Calibri",
      size: 10,
      bold: true,
      color: { argb: `FF${CNHS_EXCEL_BRAND.white}` },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${CNHS_EXCEL_BRAND.greenDark}` },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = thinBorder();
  });
  headerRow.height = 22;

  rows.forEach((dataRow, rowIndex) => {
    const excelRow = sheet.getRow(headerRowIndex + 1 + rowIndex);
    columns.forEach((col, colIndex) => {
      const cell = excelRow.getCell(colIndex + 1);
      const raw = dataRow[col.key];
      const numeric = asNumber(raw);
      cell.value = col.numeric && numeric !== null ? numeric : asText(raw);
      cell.font = {
        name: "Calibri",
        size: 10,
        color: { argb: `FF${CNHS_EXCEL_BRAND.slateDark}` },
      };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      cell.border = thinBorder();

      if (rowIndex % 2 === 1 && !col.gradeRule && !col.statusRule) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: `FF${CNHS_EXCEL_BRAND.zebra}` },
        };
      }

      applyGradeOrStatusStyle(cell, col, raw, numeric);
    });
  });

  if (columns.length) {
    sheet.autoFilter = {
      from: { row: headerRowIndex, column: 1 },
      to: { row: headerRowIndex, column: colCount },
    };
    sheet.views = [{ state: "frozen", ySplit: headerRowIndex, showGridLines: false }];
  }

  // Centered narrative under the table
  let narrativeRow = headerRowIndex + Math.max(rows.length, 1) + 3;
  const paragraphs = String(narrative || "No summary available.")
    .split(/\n\n+/)
    .filter(Boolean);

  for (const paragraph of paragraphs) {
    sheet.mergeCells(narrativeRow, 1, narrativeRow, colCount);
    const cell = sheet.getCell(narrativeRow, 1);
    cell.value = paragraph;
    cell.font = {
      name: "Calibri",
      size: 11,
      color: { argb: `FF${CNHS_EXCEL_BRAND.slateDark}` },
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    sheet.getRow(narrativeRow).height = 36;
    narrativeRow += 2;
  }

  applyPrintSettings(sheet, {
    landscape: true,
    title,
    printTitlesRow: `${headerRowIndex}:${headerRowIndex}`,
  });
  return sheet;
}

/**
 * Download workbook in the browser.
 */
export async function downloadWorkbook(workbook, filename) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Build the official 2-tab workbook.
 *
 * payload: {
 *   meta, metrics, chartSeries, table, narrative?, narrativeContext?, coverNarrative?
 * }
 */
export async function buildOfficialExcelReport(payload = {}) {
  const workbook = createWorkbook();
  const meta = payload.meta || {};
  const metrics = payload.metrics || [];
  const chartSeries = payload.chartSeries || [];
  const table = payload.table || { columns: [], rows: [] };
  const narrativeContext = {
    reportTitle: meta.reportTitle,
    schoolYear: meta.schoolYear,
    quarter: meta.quarter,
    ...(payload.narrativeContext || {}),
  };

  const coverNarrative =
    payload.coverNarrative || buildCoverNarrative(narrativeContext);
  const detailNarrative =
    payload.narrative || buildReportNarrative(narrativeContext);

  await createReportCover(workbook, {
    meta,
    metrics,
    chartSeries,
    coverNarrative,
  });

  createDetailedReportSheet(workbook, {
    title: table.title || "Detailed Report",
    columns: table.columns || [],
    rows: table.rows || [],
    narrative: detailNarrative,
  });

  return workbook;
}
