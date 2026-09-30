/**
 * SF2 class monthly summary exports (PDF print + Excel).
 * Attendance Monitoring only — not Academic Prediction.
 */

import ExcelJS from "exceljs";
import { downloadWorkbook } from "@/lib/reports/excelOfficialTemplate";
import {
  escapeHtml,
  renderDataTableHtml,
  renderDetailListHtml,
  renderKpiRowHtml,
  wrapCnhsPrintDocument,
} from "@/lib/reports/cnhsPrintShell";
import { openPrintableHtml } from "@/lib/reports/openPrintableHtml";

function fmt(n, suffix = "") {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  const text = Number.isInteger(v) ? String(v) : Number(v.toFixed(1));
  return `${text}${suffix}`;
}

function statusLabel(row) {
  if (!row) return "—";
  if (row.nls > 0 || row.fiveConsecutive > 0) return "Attention";
  if (row.pa != null && row.pa < 90) return "Low PA";
  if (row.transferredOut > 0) return "Movement";
  return "OK";
}

function mfRows(breakdown = {}) {
  return [
    ["Absences", breakdown.absences],
    ["First Friday", breakdown.firstFriday],
    ["Late", breakdown.late],
    ["End of month", breakdown.endOfMonth],
    ["ADA", breakdown.ada],
    ["PA", breakdown.pa],
  ];
}

const THIN_BORDER = {
  top: { style: "thin", color: { argb: "FF000000" } },
  left: { style: "thin", color: { argb: "FF000000" } },
  bottom: { style: "thin", color: { argb: "FF000000" } },
  right: { style: "thin", color: { argb: "FF000000" } },
};

const SF2_YELLOW = "FFFFFF00";

/** Resolve M/F/Total from breakdown, with scalar fallbacks from the row. */
function tripleFrom(breakdown, key, fallbackTotal = null) {
  const t = breakdown?.[key];
  if (t && (t.m != null || t.f != null || t.total != null)) {
    return {
      m: t.m ?? 0,
      f: t.f ?? 0,
      total: t.total ?? (Number(t.m) || 0) + (Number(t.f) || 0),
    };
  }
  if (fallbackTotal != null && fallbackTotal !== "") {
    return { m: "", f: "", total: fallbackTotal };
  }
  return { m: 0, f: 0, total: 0 };
}

/**
 * DepEd SF2 month-block data keys (for cached formula results).
 */
function sf2InputTriples(row) {
  const b = row.breakdown || {};
  return {
    attendanceOfMonth: tripleFrom(b, "attendanceOfMonth", row.attendanceOfMonth),
    absences: tripleFrom(b, "absences", row.absences),
    totalAttendance: tripleFrom(b, "totalAttendance", row.totalAttendance),
    firstFriday: tripleFrom(b, "firstFriday", row.firstFriday),
    late: tripleFrom(b, "late", row.late),
    endOfMonth: tripleFrom(b, "endOfMonth", row.endOfMonth),
    percentage: tripleFrom(b, "percentage", row.percentage),
    ada: tripleFrom(b, "ada", row.ada),
    pa: tripleFrom(b, "pa", row.pa),
    fiveConsecutive: tripleFrom(b, "fiveConsecutive", row.fiveConsecutive),
    nls: tripleFrom(b, "nls", row.nls),
    transferredOut: tripleFrom(b, "transferredOut", row.transferredOut),
    transferredIn: tripleFrom(b, "transferredIn", row.transferredIn),
  };
}

function styleSf2Cell(cell, { bold = false, yellow = false, center = false } = {}) {
  cell.border = THIN_BORDER;
  cell.alignment = {
    vertical: "middle",
    horizontal: center ? "center" : "left",
    wrapText: true,
  };
  if (bold) cell.font = { bold: true, size: 11 };
  else cell.font = { size: 11 };
  if (yellow) {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: SF2_YELLOW },
    };
  }
}

/** ExcelJS formula cell with cached result (shows value before Excel recalc). */
function setFormula(cell, formula, result) {
  const cached =
    result === null || result === undefined || result === ""
      ? 0
      : Number(result);
  cell.value = {
    formula,
    result: Number.isFinite(cached) ? cached : 0,
  };
}

function numOrZero(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Printable PDF for one section + month (CNHS target layout).
 */
export function exportSectionSf2Pdf(row, { generatedAt = new Date() } = {}) {
  if (!row) throw new Error("No attendance month selected.");

  const when = generatedAt.toLocaleString("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const sectionLabel = `Grade ${row.gradeLevel ?? "—"} · ${row.sectionName}`;

  const tableBody = mfRows(row.breakdown)
    .map(([label, triple]) => {
      if (!triple) return "";
      return `<tr>
        <td>${escapeHtml(label)}</td>
        <td>${escapeHtml(fmt(triple.m))}</td>
        <td>${escapeHtml(fmt(triple.f))}</td>
        <td>${escapeHtml(fmt(triple.total))}</td>
      </tr>`;
    })
    .join("");

  const bodyHtml = `
    <p class="section-label">Summary</p>
    ${renderKpiRowHtml([
      ["ADA", fmt(row.ada)],
      ["PA", fmt(row.pa, "%")],
      ["Absences", fmt(row.absences)],
      ["School days", fmt(row.schoolDays)],
    ])}

    <p class="section-label">M / F / Total</p>
    ${renderDataTableHtml({
      headers: ["Metric", "M", "F", "Total"],
      rowsHtml: tableBody,
      emptyText: "No breakdown",
    })}

    <p class="section-label">Other fields</p>
    ${renderDetailListHtml([
      ["Late", fmt(row.late)],
      ["First Friday", fmt(row.firstFriday)],
      ["End of month", fmt(row.endOfMonth)],
      ["5 consecutive", fmt(row.fiveConsecutive)],
      ["NLS", fmt(row.nls)],
      ["Transferred out", fmt(row.transferredOut)],
      ["Transferred in", fmt(row.transferredIn)],
      ["Status", statusLabel(row)],
    ])}
  `;

  const html = wrapCnhsPrintDocument({
    documentTitle: `SF2 · ${row.sectionName} · ${row.monthName}`,
    letterheadSub: "CNHS Learn · SF2 Class Monthly Summary",
    title: "SF2 CLASS MONTHLY SUMMARY",
    subtitle: `${sectionLabel} · ${row.monthName || "—"}`,
    metaRows: [
      ["School year", row.school_year || "—"],
      ["Section", sectionLabel],
      ["Month", row.monthName || "—"],
      ["Date generated", when],
    ],
    bodyHtml,
    signatureLabel: "Prepared by Subject Teacher / Adviser:",
  });

  openPrintableHtml(html, {
    title: `SF2-${row.sectionName}-${row.monthName}`,
    autoPrint: true,
  });
}

/**
 * Excel for one section + month — DepEd SF2 month-block with live formulas.
 *
 * Layout (rows 3–17):
 *   D3 = school days
 *   5 attendance · 6 absences · 7 Total Attendance · 8 First Friday
 *   9 Late · 10 EOM · 11 Percentage · 12 ADA · 13 PA
 *   14–17 flags
 *
 * Formulas match SF2 Yakal:
 *   Total = M+F
 *   Total Attendance M/F = attendance − absences
 *   Percentage = (EOM / FirstFriday) * 100
 *   ADA = TotalAttendance / schoolDays
 *   PA = (ADA / EOM) * 100
 */
export async function exportSectionSf2Excel(row) {
  if (!row) throw new Error("No attendance month selected.");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CNHS Learn";
  const sheet = workbook.addWorksheet("SF2 Month");

  const monthTitle = String(row.monthName || "Month").toUpperCase();
  const schoolDays = numOrZero(row.schoolDays);
  const t = sf2InputTriples(row);

  // Optional metadata (outside the bordered block)
  sheet.getCell("A1").value =
    `Grade ${row.gradeLevel ?? "—"} · ${row.sectionName || "—"} · ${row.school_year || ""}`;
  sheet.getCell("A1").font = {
    size: 10,
    italic: true,
    color: { argb: "FF64748B" },
  };

  // Header: month merged over M/F, school days in Total (D3)
  sheet.mergeCells("B3:C3");
  sheet.getCell("A3").value = "";
  sheet.getCell("B3").value = monthTitle;
  sheet.getCell("D3").value = schoolDays;

  sheet.getCell("A4").value = "";
  sheet.getCell("B4").value = "M";
  sheet.getCell("C4").value = "F";
  sheet.getCell("D4").value = "Total";

  for (const col of ["A", "B", "C", "D"]) {
    styleSf2Cell(sheet.getCell(`${col}3`), {
      bold: true,
      center: col !== "A",
    });
    styleSf2Cell(sheet.getCell(`${col}4`), { bold: true, center: true });
  }

  /** Write label + style a data row. */
  function prepRow(r, label, { yellow = false } = {}) {
    const labelCell = sheet.getCell(`A${r}`);
    labelCell.value = label;
    styleSf2Cell(labelCell, { yellow });
    styleSf2Cell(sheet.getCell(`B${r}`), { yellow, center: true });
    styleSf2Cell(sheet.getCell(`C${r}`), { yellow, center: true });
    styleSf2Cell(sheet.getCell(`D${r}`), { yellow, center: true });
  }

  /** Input row: M/F values, Total = M+F */
  function writeSumTotalRow(r, label, triple, { yellow = false } = {}) {
    prepRow(r, label, { yellow });
    sheet.getCell(`B${r}`).value = numOrZero(triple.m);
    sheet.getCell(`C${r}`).value = numOrZero(triple.f);
    setFormula(
      sheet.getCell(`D${r}`),
      `B${r}+C${r}`,
      numOrZero(triple.total) || numOrZero(triple.m) + numOrZero(triple.f)
    );
  }

  // Row 5 — Total attendance of the month (input)
  writeSumTotalRow(5, "Total attendance of the month", t.attendanceOfMonth);

  // Row 6 — No. of absences (input, yellow)
  writeSumTotalRow(6, "No. of absences", t.absences, { yellow: true });

  // Row 7 — Total Attendance = attendance − absences; Total = M+F
  prepRow(7, "Total Attendance");
  setFormula(
    sheet.getCell("B7"),
    "B5-B6",
    numOrZero(t.totalAttendance.m) ||
      numOrZero(t.attendanceOfMonth.m) - numOrZero(t.absences.m)
  );
  setFormula(
    sheet.getCell("C7"),
    "C5-C6",
    numOrZero(t.totalAttendance.f) ||
      numOrZero(t.attendanceOfMonth.f) - numOrZero(t.absences.f)
  );
  setFormula(
    sheet.getCell("D7"),
    "B7+C7",
    numOrZero(t.totalAttendance.total) ||
      numOrZero(t.attendanceOfMonth.total) - numOrZero(t.absences.total)
  );

  // Row 8 — First Friday (input, yellow)
  writeSumTotalRow(8, "First Friday", t.firstFriday, { yellow: true });

  // Row 9 — Late (input, yellow)
  writeSumTotalRow(9, "Late", t.late, { yellow: true });

  // Row 10 — End of the month (input, yellow)
  writeSumTotalRow(10, "End of the month", t.endOfMonth, { yellow: true });

  // Row 11 — Percentage = (EOM / FirstFriday) * 100
  prepRow(11, "Percentage");
  setFormula(
    sheet.getCell("B11"),
    "IF(B8=0,0,(B10/B8)*100)",
    numOrZero(t.percentage.m)
  );
  setFormula(
    sheet.getCell("C11"),
    "IF(C8=0,0,(C10/C8)*100)",
    numOrZero(t.percentage.f)
  );
  setFormula(
    sheet.getCell("D11"),
    "IF(D8=0,0,(D10/D8)*100)",
    numOrZero(t.percentage.total)
  );

  // Row 12 — ADA = TotalAttendance / schoolDays (D3)
  prepRow(12, "ADA");
  setFormula(
    sheet.getCell("B12"),
    "IF($D$3=0,0,B7/$D$3)",
    numOrZero(t.ada.m)
  );
  setFormula(
    sheet.getCell("C12"),
    "IF($D$3=0,0,C7/$D$3)",
    numOrZero(t.ada.f)
  );
  setFormula(
    sheet.getCell("D12"),
    "IF($D$3=0,0,D7/$D$3)",
    numOrZero(t.ada.total)
  );

  // Row 13 — PA = (ADA / EOM) * 100  (official SF2, not ADA/FirstFriday)
  prepRow(13, "PA");
  const paM =
    numOrZero(t.endOfMonth.m) > 0 && numOrZero(t.ada.m)
      ? (numOrZero(t.ada.m) / numOrZero(t.endOfMonth.m)) * 100
      : numOrZero(t.pa.m);
  const paF =
    numOrZero(t.endOfMonth.f) > 0 && numOrZero(t.ada.f)
      ? (numOrZero(t.ada.f) / numOrZero(t.endOfMonth.f)) * 100
      : numOrZero(t.pa.f);
  const paT =
    numOrZero(t.endOfMonth.total) > 0 && numOrZero(t.ada.total)
      ? (numOrZero(t.ada.total) / numOrZero(t.endOfMonth.total)) * 100
      : numOrZero(t.pa.total);
  setFormula(sheet.getCell("B13"), "IF(B10=0,0,(B12/B10)*100)", paM);
  setFormula(sheet.getCell("C13"), "IF(C10=0,0,(C12/C10)*100)", paF);
  setFormula(sheet.getCell("D13"), "IF(D10=0,0,(D12/D10)*100)", paT);

  // Rows 14–17 — flags (input + Total = M+F)
  writeSumTotalRow(14, "5 consecutive", t.fiveConsecutive);
  writeSumTotalRow(15, "NLS", t.nls);
  writeSumTotalRow(16, "TO", t.transferredOut);
  writeSumTotalRow(17, "TI", t.transferredIn);

  sheet.getColumn(1).width = 32;
  sheet.getColumn(2).width = 10;
  sheet.getColumn(3).width = 10;
  sheet.getColumn(4).width = 10;

  const safeSection = String(row.sectionName || "section").replace(/\s+/g, "-");
  await downloadWorkbook(
    workbook,
    `SF2-${safeSection}-${row.monthName}-${row.school_year}.xlsx`
  );
}

/**
 * HT school comparison Excel for current filter rows + snapshot.
 */
export async function exportSchoolSf2Excel({
  schoolYear,
  monthLabel,
  snapshot = {},
  rows = [],
} = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CNHS Learn";
  const cover = workbook.addWorksheet("Snapshot");
  cover.addRow(["School attendance overview"]);
  cover.addRow(["School year", schoolYear || "—"]);
  cover.addRow(["Month", monthLabel || "—"]);
  cover.addRow(["Avg ADA", snapshot.avgAda ?? "—"]);
  cover.addRow(["Avg PA (%)", snapshot.avgPa ?? "—"]);
  cover.addRow(["Total absences", snapshot.totalAbsences ?? 0]);
  cover.addRow(["Flagged sections", snapshot.flaggedCount ?? 0]);
  cover.getColumn(1).width = 20;
  cover.getColumn(2).width = 18;

  const sheet = workbook.addWorksheet("Sections");
  sheet.addRow([
    "Section",
    "Grade",
    "Month",
    "Days",
    "ADA",
    "PA",
    "Absences",
    "Late",
    "FF",
    "EOM",
    "5c",
    "NLS",
    "TO",
    "TI",
    "Status",
  ]);
  for (const row of rows) {
    const status = statusLabel(row);
    sheet.addRow([
      row.sectionName,
      row.gradeLevel,
      row.monthName,
      row.schoolDays,
      row.ada,
      row.pa,
      row.absences,
      row.late,
      row.firstFriday,
      row.endOfMonth,
      row.fiveConsecutive,
      row.nls,
      row.transferredOut,
      row.transferredIn,
      status,
    ]);
  }
  sheet.columns.forEach((col) => {
    col.width = 12;
  });
  sheet.getColumn(1).width = 18;

  const monthPart = monthLabel || "all";
  await downloadWorkbook(
    workbook,
    `SF2-School-${schoolYear || "SY"}-${monthPart}.xlsx`
  );
}

/**
 * HT printable overview (CNHS target layout).
 */
export function exportSchoolSf2Pdf({
  schoolYear,
  monthLabel,
  snapshot = {},
  rows = [],
  generatedAt = new Date(),
} = {}) {
  const when = generatedAt.toLocaleString("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const tableRows = rows
    .map((row) => {
      const status = statusLabel(row);
      return `<tr>
        <td>${escapeHtml(`G${row.gradeLevel} · ${row.sectionName}`)}</td>
        <td>${escapeHtml(row.monthName)}</td>
        <td>${escapeHtml(fmt(row.ada))}</td>
        <td>${escapeHtml(fmt(row.pa, "%"))}</td>
        <td>${escapeHtml(fmt(row.absences))}</td>
        <td>${escapeHtml(fmt(row.late))}</td>
        <td>${escapeHtml(fmt(row.firstFriday))}</td>
        <td>${escapeHtml(fmt(row.endOfMonth))}</td>
        <td>${escapeHtml(status)}</td>
      </tr>`;
    })
    .join("");

  const bodyHtml = `
    <p class="section-label">Summary</p>
    ${renderKpiRowHtml([
      ["Avg ADA", fmt(snapshot.avgAda)],
      ["Avg PA", fmt(snapshot.avgPa, "%")],
      ["Absences", fmt(snapshot.totalAbsences)],
      ["Flagged", String(snapshot.flaggedCount ?? 0)],
    ])}

    <p class="section-label">Section × month</p>
    ${renderDataTableHtml({
      headers: [
        "Section",
        "Month",
        "ADA",
        "PA",
        "Absences",
        "Late",
        "FF",
        "EOM",
        "Status",
      ],
      rowsHtml: tableRows,
      emptyText: "No rows",
      compact: true,
    })}
  `;

  const html = wrapCnhsPrintDocument({
    documentTitle: `School SF2 · ${monthLabel || "overview"}`,
    letterheadSub: "CNHS Learn · School SF2 Attendance Report",
    title: "SCHOOL SF2 ATTENDANCE REPORT",
    subtitle: `${schoolYear || "—"} · ${monthLabel || "All months"}`,
    metaRows: [
      ["School", "Cambaog National High School"],
      ["Coverage", schoolYear || "—"],
      ["Month filter", monthLabel || "All months"],
      ["Date generated", when],
    ],
    bodyHtml,
    signatureLabel: "Reviewed by Principal:",
  });

  openPrintableHtml(html, {
    title: `SF2-School-${monthLabel || "overview"}`,
    autoPrint: true,
  });
}
