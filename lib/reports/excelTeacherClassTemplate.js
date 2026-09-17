/**
 * Teacher Class Performance Report Excel (wide CNHS cover).
 * Teacher exports only — does not replace excelOfficialTemplate.
 */

import { renderChartSeriesImages } from "@/lib/reports/excelChartImages";
import {
  CNHS_EXCEL_BRAND,
  applyPrintSettings,
  buildCoverNarrative,
  buildReportNarrative,
  createDetailedReportSheet,
  createWorkbook,
} from "@/lib/reports/excelOfficialTemplate";

const END_COL = 14;

function thinBorder() {
  const edge = {
    style: "thin",
    color: { argb: `FF${CNHS_EXCEL_BRAND.border}` },
  };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

function asText(value) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
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

function mergeRow(sheet, row, startCol = 1, endCol = END_COL) {
  sheet.mergeCells(row, startCol, row, endCol);
  return sheet.getCell(row, startCol);
}

function styleCenter(cell, { size = 11, bold = false, color, italic = false } = {}) {
  cell.font = {
    name: "Calibri",
    size,
    bold,
    italic,
    color: { argb: `FF${color || CNHS_EXCEL_BRAND.slateDark}` },
  };
  cell.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
  };
}

function paintBanner(sheet, row, title) {
  const cell = mergeRow(sheet, row);
  cell.value = String(title || "").toUpperCase();
  cell.font = {
    name: "Calibri",
    size: 12,
    bold: true,
    color: { argb: `FF${CNHS_EXCEL_BRAND.white}` },
  };
  cell.alignment = { horizontal: "center", vertical: "middle" };
  for (let c = 1; c <= END_COL; c += 1) {
    const fill = sheet.getCell(row, c);
    fill.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${CNHS_EXCEL_BRAND.greenDark}` },
    };
    fill.border = thinBorder();
  }
  sheet.getRow(row).height = 22;
  return row + 1;
}

function paintRule(sheet, row) {
  for (let c = 1; c <= END_COL; c += 1) {
    const cell = sheet.getCell(row, c);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${CNHS_EXCEL_BRAND.greenDark}` },
    };
  }
  sheet.getRow(row).height = 4;
  return row + 1;
}

function paintMetaPair(sheet, row, col, label, value) {
  const labelCell = sheet.getCell(row, col);
  labelCell.value = label;
  labelCell.font = {
    name: "Calibri",
    size: 10,
    bold: true,
    color: { argb: `FF${CNHS_EXCEL_BRAND.slate}` },
  };
  sheet.mergeCells(row, col + 1, row, col + 3);
  const valueCell = sheet.getCell(row, col + 1);
  valueCell.value = asText(value);
  valueCell.font = {
    name: "Calibri",
    size: 10,
    color: { argb: `FF${CNHS_EXCEL_BRAND.slateDark}` },
  };
}

function paintMetricTable(sheet, startRow, metrics = []) {
  const headerRow = startRow;
  sheet.mergeCells(headerRow, 1, headerRow, 8);
  sheet.mergeCells(headerRow, 9, headerRow, END_COL);
  const h1 = sheet.getCell(headerRow, 1);
  const h2 = sheet.getCell(headerRow, 9);
  for (const cell of [h1, h2]) {
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: `FF${CNHS_EXCEL_BRAND.white}` },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }
  h1.value = "METRIC";
  h2.value = "VALUE";
  for (let c = 1; c <= END_COL; c += 1) {
    const cell = sheet.getCell(headerRow, c);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${CNHS_EXCEL_BRAND.greenDark}` },
    };
    cell.border = thinBorder();
  }
  sheet.getRow(headerRow).height = 20;

  let row = headerRow + 1;
  metrics.forEach((metric, index) => {
    sheet.mergeCells(row, 1, row, 8);
    sheet.mergeCells(row, 9, row, END_COL);
    const zebra = index % 2 === 1 ? CNHS_EXCEL_BRAND.greenSoft : CNHS_EXCEL_BRAND.white;
    for (let c = 1; c <= END_COL; c += 1) {
      const cell = sheet.getCell(row, c);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: `FF${zebra}` },
      };
      cell.border = thinBorder();
    }
    const labelCell = sheet.getCell(row, 1);
    labelCell.value = metric.label;
    labelCell.font = {
      name: "Calibri",
      size: 11,
      color: { argb: `FF${CNHS_EXCEL_BRAND.slateDark}` },
    };
    labelCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    const valueCell = sheet.getCell(row, 9);
    valueCell.value = asText(metric.value);
    valueCell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: `FF${CNHS_EXCEL_BRAND.greenDark}` },
    };
    valueCell.alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(row).height = 18;
    row += 1;
  });
  return row;
}

function numericValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatTableValue(value) {
  const n = numericValue(value);
  if (n == null) return asText(value);
  return Number.isInteger(n) ? n : Math.round(n * 10) / 10;
}

/**
 * Compact 4-column supporting table. Returns rows used.
 */
function paintSupportingTable(sheet, startRow, startCol, series) {
  const endCol = startCol + 3;
  const midCol = startCol + 2;
  const title = String(series?.tableTitle || series?.title || "Data").toUpperCase();
  const col1 = series?.categoryHeader || "Category";
  const col2 = series?.valueHeader || "Value";
  const rows = Array.isArray(series?.rows) ? series.rows : [];

  sheet.mergeCells(startRow, startCol, startRow, endCol);
  const titleCell = sheet.getCell(startRow, startCol);
  titleCell.value = title;
  titleCell.font = {
    name: "Calibri",
    size: 9,
    bold: true,
    color: { argb: `FF${CNHS_EXCEL_BRAND.white}` },
  };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  for (let c = startCol; c <= endCol; c += 1) {
    const cell = sheet.getCell(startRow, c);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${CNHS_EXCEL_BRAND.greenDark}` },
    };
    cell.border = thinBorder();
  }
  sheet.getRow(startRow).height = 18;

  const headerRow = startRow + 1;
  sheet.mergeCells(headerRow, startCol, headerRow, midCol - 1);
  sheet.mergeCells(headerRow, midCol, headerRow, endCol);
  const h1 = sheet.getCell(headerRow, startCol);
  const h2 = sheet.getCell(headerRow, midCol);
  h1.value = col1;
  h2.value = col2;
  for (const cell of [h1, h2]) {
    cell.font = {
      name: "Calibri",
      size: 9,
      bold: true,
      color: { argb: `FF${CNHS_EXCEL_BRAND.greenDark}` },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }
  for (let c = startCol; c <= endCol; c += 1) {
    const cell = sheet.getCell(headerRow, c);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${CNHS_EXCEL_BRAND.greenSoft}` },
    };
    cell.border = thinBorder();
  }

  let row = headerRow + 1;
  const values = [];
  rows.forEach((item, index) => {
    sheet.mergeCells(row, startCol, row, midCol - 1);
    sheet.mergeCells(row, midCol, row, endCol);
    const zebra = index % 2 === 1 ? "F8FAFC" : CNHS_EXCEL_BRAND.white;
    for (let c = startCol; c <= endCol; c += 1) {
      const cell = sheet.getCell(row, c);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: `FF${zebra}` },
      };
      cell.border = thinBorder();
    }
    const cat = sheet.getCell(row, startCol);
    cat.value = asText(item.category);
    cat.font = {
      name: "Calibri",
      size: 9,
      color: { argb: `FF${CNHS_EXCEL_BRAND.slateDark}` },
    };
    cat.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    const val = sheet.getCell(row, midCol);
    const n = numericValue(item.value);
    if (n != null) values.push(n);
    val.value = formatTableValue(item.value);
    val.font = {
      name: "Calibri",
      size: 9,
      bold: true,
      color: { argb: `FF${CNHS_EXCEL_BRAND.slateDark}` },
    };
    val.alignment = { horizontal: "center", vertical: "middle" };
    row += 1;
  });

  const footerRow = row;
  sheet.mergeCells(footerRow, startCol, footerRow, midCol - 1);
  sheet.mergeCells(footerRow, midCol, footerRow, endCol);
  for (let c = startCol; c <= endCol; c += 1) {
    const cell = sheet.getCell(footerRow, c);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: `FF${CNHS_EXCEL_BRAND.greenSoft}` },
    };
    cell.border = thinBorder();
  }
  const isAverage = series?.footer === "average";
  const footerLabel = sheet.getCell(footerRow, startCol);
  footerLabel.value = isAverage ? "CLASS AVERAGE" : "TOTAL";
  footerLabel.font = {
    name: "Calibri",
    size: 9,
    bold: true,
    color: { argb: `FF${CNHS_EXCEL_BRAND.greenDark}` },
  };
  footerLabel.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  const footerVal = sheet.getCell(footerRow, midCol);
  const total = values.reduce((sum, n) => sum + n, 0);
  footerVal.value = isAverage
    ? values.length
      ? formatTableValue(total / values.length)
      : "—"
    : formatTableValue(total);
  footerVal.font = {
    name: "Calibri",
    size: 9,
    bold: true,
    color: { argb: `FF${CNHS_EXCEL_BRAND.greenDark}` },
  };
  footerVal.alignment = { horizontal: "center", vertical: "middle" };

  return footerRow - startRow + 1;
}

function paintSupportingDataBlock(sheet, startRow, chartSeries = []) {
  const tables = (chartSeries || []).filter((s) => s?.rows?.length).slice(0, 3);
  const starts = [1, 6, 11];
  let used = 1;
  if (!tables.length) {
    const empty = mergeRow(sheet, startRow);
    empty.value = "No supporting chart data for this report.";
    styleCenter(empty, { size: 10, color: CNHS_EXCEL_BRAND.slate });
    return startRow + 2;
  }
  tables.forEach((series, index) => {
    const height = paintSupportingTable(
      sheet,
      startRow,
      starts[index] || 1,
      series
    );
    if (height > used) used = height;
  });
  return startRow + used + 1;
}

function paintSignOff(sheet, startRow, teacherName) {
  let row = startRow + 1;
  sheet.mergeCells(row, 1, row, 6);
  const prepared = sheet.getCell(row, 1);
  prepared.value = "Prepared by:";
  prepared.font = {
    name: "Calibri",
    size: 10,
    bold: true,
    color: { argb: `FF${CNHS_EXCEL_BRAND.slate}` },
  };
  sheet.mergeCells(row, 9, row, END_COL);
  const reviewed = sheet.getCell(row, 9);
  reviewed.value = "Reviewed by:";
  reviewed.font = {
    name: "Calibri",
    size: 10,
    bold: true,
    color: { argb: `FF${CNHS_EXCEL_BRAND.slate}` },
  };
  row += 2;

  sheet.mergeCells(row, 1, row, 6);
  const nameCell = sheet.getCell(row, 1);
  nameCell.value = teacherName || "Teacher";
  nameCell.font = {
    name: "Calibri",
    size: 11,
    bold: true,
    underline: true,
    color: { argb: `FF${CNHS_EXCEL_BRAND.slateDark}` },
  };
  sheet.mergeCells(row, 9, row, END_COL);
  const htCell = sheet.getCell(row, 9);
  htCell.value = "________________________";
  htCell.font = {
    name: "Calibri",
    size: 11,
    color: { argb: `FF${CNHS_EXCEL_BRAND.slateDark}` },
  };
  row += 1;

  sheet.mergeCells(row, 1, row, 6);
  const role = sheet.getCell(row, 1);
  role.value = "Teacher";
  role.font = {
    name: "Calibri",
    size: 9,
    italic: true,
    color: { argb: `FF${CNHS_EXCEL_BRAND.slate}` },
  };
  sheet.mergeCells(row, 9, row, END_COL);
  const htRole = sheet.getCell(row, 9);
  htRole.value = "Head Teacher";
  htRole.font = {
    name: "Calibri",
    size: 9,
    italic: true,
    color: { argb: `FF${CNHS_EXCEL_BRAND.slate}` },
  };
  row += 2;

  const slogan = mergeRow(sheet, row);
  slogan.value =
    "Every learner counts, Every progress matters. — CNHS LEARN";
  styleCenter(slogan, {
    size: 10,
    italic: true,
    color: CNHS_EXCEL_BRAND.greenDark,
  });
  return row + 1;
}

async function createTeacherReportCover(
  workbook,
  { meta = {}, metrics = [], chartSeries = [], coverNarrative = "" } = {}
) {
  const sheet = workbook.addWorksheet("Report Cover", {
    views: [{ showGridLines: true }],
  });
  for (let c = 1; c <= END_COL; c += 1) {
    sheet.getColumn(c).width = 11;
  }

  const {
    reportTitle = "Teacher Class Performance Report",
    schoolYear = "—",
    quarter = "—",
    generatedBy = "Teacher",
    totalRecords = 0,
    reportScope = "—",
    generatedAt = new Date(),
  } = meta;
  const dateGenerated = generatedAt.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeGenerated = generatedAt.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });

  let row = 2;
  const logo = await loadLogoBuffer();
  if (logo) {
    const imageId = workbook.addImage({
      buffer: logo,
      extension: "png",
    });
    sheet.addImage(imageId, {
      tl: { col: 0.4, row: 1.1 },
      ext: { width: 58, height: 58 },
    });
  }

  const schoolCell = mergeRow(sheet, row);
  schoolCell.value = CNHS_EXCEL_BRAND.schoolName.toUpperCase();
  styleCenter(schoolCell, {
    size: 18,
    bold: true,
    color: CNHS_EXCEL_BRAND.greenDark,
  });
  sheet.getRow(row).height = 24;
  row += 1;

  const systemCell = mergeRow(sheet, row);
  systemCell.value = CNHS_EXCEL_BRAND.systemName.toUpperCase();
  styleCenter(systemCell, { size: 11, color: CNHS_EXCEL_BRAND.slate });
  row += 1;

  row = paintRule(sheet, row);

  const titleCell = mergeRow(sheet, row);
  titleCell.value = String(reportTitle).toUpperCase();
  styleCenter(titleCell, {
    size: 14,
    bold: true,
    color: CNHS_EXCEL_BRAND.greenDark,
  });
  sheet.getRow(row).height = 22;
  row += 1;

  row = paintRule(sheet, row);
  row += 1;

  paintMetaPair(sheet, row, 1, "School Year", schoolYear);
  paintMetaPair(sheet, row, 9, "Date Generated", dateGenerated);
  row += 1;
  paintMetaPair(sheet, row, 1, "Term / Period", quarter);
  paintMetaPair(sheet, row, 9, "Time Generated", timeGenerated);
  row += 1;
  paintMetaPair(sheet, row, 1, "Report Scope", reportScope);
  paintMetaPair(sheet, row, 9, "Generated By", generatedBy);
  row += 1;
  paintMetaPair(sheet, row, 9, "Total Records", totalRecords);
  row += 2;

  const noteCell = mergeRow(sheet, row);
  noteCell.value =
    "Note: Academic performance uses ECR grades only. Attendance (SF2) is a separate monitoring module.";
  styleCenter(noteCell, {
    size: 9,
    italic: true,
    color: CNHS_EXCEL_BRAND.slate,
  });
  row += 2;

  row = paintBanner(sheet, row, "Executive Summary");
  row = paintMetricTable(sheet, row, metrics);
  row += 1;

  row = paintBanner(sheet, row, "Executive Summary Narrative");
  const narrativeCell = mergeRow(sheet, row);
  narrativeCell.value =
    coverNarrative || "No summary available for the selected filters.";
  styleCenter(narrativeCell, { size: 11 });
  sheet.getRow(row).height = 48;
  row += 2;

  row = paintBanner(sheet, row, "Performance Analysis");
  const chartImages = await renderChartSeriesImages(chartSeries);
  if (chartImages.length) {
    const displayWidth = 220;
    const displayHeight = 132;
    chartImages.slice(0, 3).forEach((image, index) => {
      const imageId = workbook.addImage({
        buffer: image.buffer,
        extension: "png",
      });
      sheet.addImage(imageId, {
        tl: { col: 0.2 + index * 4.7, row: row - 1 },
        ext: { width: displayWidth, height: displayHeight },
      });
    });
    row += 12;
  } else {
    const empty = mergeRow(sheet, row);
    empty.value =
      typeof document === "undefined"
        ? "Chart images render when exporting from the browser."
        : "No chart series available for the selected filters.";
    styleCenter(empty, { size: 10, color: CNHS_EXCEL_BRAND.slate });
    row += 2;
  }

  row = paintBanner(sheet, row, "Charts & Visual Analytics — Supporting Data");
  row = paintSupportingDataBlock(sheet, row, chartSeries);
  paintSignOff(sheet, row, generatedBy);

  applyPrintSettings(sheet, {
    landscape: true,
    title: reportTitle,
  });
  return sheet;
}

/**
 * Teacher class workbook: wide Report Cover + Detailed Report.
 */
export async function buildTeacherClassExcelReport(payload = {}) {
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

  await createTeacherReportCover(workbook, {
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

  for (const extra of payload.extraTables || []) {
    if (!extra?.columns?.length) continue;
    createDetailedReportSheet(workbook, {
      sheetName: extra.sheetName || extra.title || "Learners",
      title: extra.title || extra.sheetName || "Learners",
      columns: extra.columns,
      rows: extra.rows || [],
      narrative: extra.narrative || "",
    });
  }

  return workbook;
}
