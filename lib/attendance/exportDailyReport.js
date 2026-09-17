/**
 * Reports generated from attendance_daily session records.
 * Labeled "From daily attendance records" — not official DepEd SF2-COMP.
 */

import ExcelJS from "exceljs";
import {
  CNHS_EXCEL_BRAND,
  downloadWorkbook,
} from "@/lib/reports/excelOfficialTemplate";
import {
  escapeHtml,
  renderDataTableHtml,
  renderKpiRowHtml,
  wrapCnhsPrintDocument,
} from "@/lib/reports/cnhsPrintShell";
import { openPrintableHtml } from "@/lib/reports/openPrintableHtml";
import {
  dailyLearnerFilename,
  dailySchoolFilename,
  dailySectionFilename,
  dailySectionYearFilename,
} from "@/lib/reports/exportFilenames";
import {
  computeMonthCloseMetrics,
  formatSessionRate,
  sessionRatePercent,
  statusShort,
} from "@/lib/attendance/dailyAnalytics";

const SOURCE_NOTE =
  "From daily attendance records (Morning / Afternoon sessions). Not official DepEd SF2-COMP / Yakal ADA or PA.";

const CLOSE_NOTE =
  "From daily records + adviser month close. Check before signing official SF2.";

function fmt(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return String(n);
}

function sectionHasSavedDaily(row = {}) {
  return (
    Number(row.present || 0) > 0 ||
    Number(row.absent || 0) > 0 ||
    Number(row.learnersMarked || 0) > 0 ||
    Number(row.saved || 0) > 0
  );
}

function schoolSectionLineLabel(row = {}) {
  return `G${row.gradeLevel ?? "—"} · ${row.sectionName ?? "—"}`;
}

function formatMaybeRate(rate) {
  if (typeof rate === "string" && rate.trim()) return rate;
  return formatSessionRate(rate);
}

function schoolSectionRowsHtml(rows = []) {
  return rows
    .map((row) => {
      const submitted = sectionHasSavedDaily(row);
      return `<tr><td>${escapeHtml(schoolSectionLineLabel(row))}</td><td>${
        submitted ? fmt(row.present) : "Not submitted"
      }</td><td>${submitted ? fmt(row.absent) : "—"}</td><td>${
        submitted ? escapeHtml(formatSessionRate(row.sessionRate)) : "—"
      }</td><td>${submitted ? fmt(row.learnersMarked) : "—"}</td></tr>`;
    })
    .join("");
}

function schoolLearnerRowsHtml(learners = []) {
  return learners
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.sectionLabel || "—")}</td><td>${escapeHtml(
          row.name || "—"
        )}</td><td>${escapeHtml(
          row.studentNumber || "—"
        )}</td><td>${fmt(row.presentSessions)}</td><td>${fmt(
          row.absentSessions
        )}</td><td>${escapeHtml(formatMaybeRate(row.sessionRate))}</td></tr>`
    )
    .join("");
}

export function exportLearnerDailyPdf({ section, schoolYear, monthName, learner }) {
  const dayRows = (learner.days ?? [])
    .map(
      (day) =>
        `<tr><td>${escapeHtml(day.date)}</td><td>${escapeHtml(
          statusShort(day.morning)
        )}</td><td>${escapeHtml(statusShort(day.afternoon))}</td><td>${
          day.incomplete ? "PM or AM not saved" : "—"
        }</td></tr>`
    )
    .join("");

  const bodyHtml = [
    renderKpiRowHtml([
      ["Present sessions", fmt(learner.presentSessions)],
      ["Absent sessions", fmt(learner.absentSessions)],
      ["Session rate", formatSessionRate(learner.sessionRate)],
      ["Incomplete days", fmt(learner.incompleteDates?.length ?? 0)],
    ]),
    `<p class="section-label">Attendance by date</p>`,
    renderDataTableHtml({
      headers: ["Date", "Morning", "Afternoon", "Note"],
      rowsHtml: dayRows,
      emptyText: "No saved sessions this month.",
    }),
  ].join("");

  const html = wrapCnhsPrintDocument({
    documentTitle: `Daily attendance · ${learner.name}`,
    letterheadSub: "CNHS Learn · Attendance Monitoring",
    title: "LEARNER ATTENDANCE",
    subtitle: SOURCE_NOTE,
    metaRows: [
      ["Learner", learner.name || "—"],
      ["LRN", learner.studentNumber || "—"],
      ["Section", `Grade ${section?.grade_level ?? "—"} · ${section?.section_name ?? "—"}`],
      ["School year", schoolYear || "—"],
      ["Month", monthName || "—"],
    ],
    noteHtml: `<p class="note">${escapeHtml(SOURCE_NOTE)}</p>`,
    bodyHtml,
    showSignature: true,
    signatureLabel: "Prepared by the class adviser:",
  });

  openPrintableHtml(html, {
    title: dailyLearnerFilename({
      learnerName: learner.name,
      monthName,
      schoolYear,
      ext: "",
    }),
  });
}

export function exportSectionDailyPdf({ section, schoolYear, monthName, summary }) {
  const learnerRows = (summary.learners ?? [])
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.name)}</td><td>${escapeHtml(
          row.studentNumber || "—"
        )}</td><td>${fmt(row.presentSessions)}</td><td>${fmt(
          row.absentSessions
        )}</td><td>${escapeHtml(formatSessionRate(row.sessionRate))}</td><td>${fmt(
          row.incompleteDates?.length ?? 0
        )}</td></tr>`
    )
    .join("");

  const bodyHtml = [
    renderKpiRowHtml([
      ["Enrolled", fmt(summary.enrolled)],
      ["Present sessions", fmt(summary.presentSessions)],
      ["Absent sessions", fmt(summary.absentSessions)],
      ["Session rate", formatSessionRate(summary.sessionRate)],
    ]),
    `<p class="section-label">Learners (sorted by absent sessions)</p>`,
    renderDataTableHtml({
      headers: [
        "Learner",
        "LRN",
        "Present sessions",
        "Absent sessions",
        "Session rate",
        "Incomplete days",
      ],
      rowsHtml: learnerRows,
      emptyText: "No learners enrolled in this section yet.",
    }),
  ].join("");

  const html = wrapCnhsPrintDocument({
    documentTitle: `Section attendance · ${section?.section_name || "section"}`,
    letterheadSub: "CNHS Learn · Attendance Monitoring",
    title: "SECTION ATTENDANCE",
    subtitle: SOURCE_NOTE,
    metaRows: [
      ["Section", `Grade ${section?.grade_level ?? "—"} · ${section?.section_name ?? "—"}`],
      ["School year", schoolYear || "—"],
      ["Month", monthName || "—"],
      ["Incomplete days", fmt(summary.incompleteDates?.length ?? 0)],
    ],
    noteHtml: `<p class="note">${escapeHtml(SOURCE_NOTE)}</p>`,
    bodyHtml,
    showSignature: true,
    signatureLabel: "Prepared by the class adviser:",
  });

  openPrintableHtml(html, {
    title: dailySectionFilename({
      section,
      monthName,
      schoolYear,
      ext: "",
    }),
  });
}

export function exportSchoolDailyPdf({ schoolYear, monthName, summary }) {
  const bodyHtml = [
    renderKpiRowHtml([
      ["Sections", fmt(summary.sectionCount)],
      ["Present sessions", fmt(summary.presentSessions)],
      ["Absent sessions", fmt(summary.absentSessions)],
      ["Session rate", formatSessionRate(summary.sessionRate)],
    ]),
    `<p class="section-label">By section</p>`,
    renderDataTableHtml({
      headers: [
        "Section",
        "Present sessions",
        "Absent sessions",
        "Session rate",
        "Learners marked",
      ],
      rowsHtml: schoolSectionRowsHtml(summary.rows ?? []),
      emptyText: "No daily attendance saved this month.",
    }),
    `<p class="section-label">Learners (sorted by absent sessions)</p>`,
    renderDataTableHtml({
      headers: [
        "Section",
        "Learner",
        "LRN",
        "Present sessions",
        "Absent sessions",
        "Session rate",
      ],
      rowsHtml: schoolLearnerRowsHtml(summary.learners ?? []),
      emptyText: "No daily attendance saved this month.",
    }),
  ].join("");

  const html = wrapCnhsPrintDocument({
    documentTitle: `School attendance · ${monthName || "month"}`,
    letterheadSub: "CNHS Learn · Attendance Monitoring",
    title: "SCHOOL ATTENDANCE",
    metaRows: [
      ["School year", schoolYear || "—"],
      ["Month", monthName || "—"],
      ["Scope", summary.scopeLabel || "All sections"],
      ["Sections with data", fmt(summary.sectionsWithData)],
    ],
    bodyHtml,
    showSignature: true,
    signatureLabel: "Prepared by:",
  });

  openPrintableHtml(html, {
    title: dailySchoolFilename({ monthName, schoolYear, ext: "" }),
  });
}

const BRAND_BORDER = {
  top: { style: "thin", color: { argb: `FF${CNHS_EXCEL_BRAND.border}` } },
  left: { style: "thin", color: { argb: `FF${CNHS_EXCEL_BRAND.border}` } },
  bottom: { style: "thin", color: { argb: `FF${CNHS_EXCEL_BRAND.border}` } },
  right: { style: "thin", color: { argb: `FF${CNHS_EXCEL_BRAND.border}` } },
};

function brandFill(hex) {
  return {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: `FF${hex}` },
  };
}

function brandFont({
  bold = false,
  size = 11,
  color = CNHS_EXCEL_BRAND.slateDark,
  italic = false,
} = {}) {
  return {
    name: "Calibri",
    bold,
    italic,
    size,
    color: { argb: `FF${color}` },
  };
}

function styleBlockCell(
  cell,
  {
    bold = false,
    center = false,
    fill,
    color,
    italic = false,
    size = 11,
    wrapText = false,
  } = {}
) {
  cell.border = BRAND_BORDER;
  cell.alignment = {
    vertical: "middle",
    horizontal: center ? "center" : "left",
    wrapText,
  };
  cell.font = brandFont({ bold, size, color, italic });
  if (fill) cell.fill = brandFill(fill);
}

function applyLearnerColumnWidths(sheet) {
  sheet.getColumn(1).width = 36;
  sheet.getColumn(2).width = 16;
  sheet.getColumn(3).width = 8;
  sheet.getColumn(4).width = 12;
  sheet.getColumn(5).width = 12;
  sheet.getColumn(6).width = 14;
  sheet.getColumn(7).width = 12;
}

async function loadCnhsLogoBuffer() {
  try {
    if (typeof fetch === "undefined") return null;
    const response = await fetch(CNHS_EXCEL_BRAND.logoPath);
    if (!response.ok) return null;
    return await response.arrayBuffer();
  } catch {
    return null;
  }
}

function applySheetPrint(sheet) {
  sheet.pageSetup = {
    paperSize: 5,
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
  };
  sheet.headerFooter = {
    oddHeader: `&L${CNHS_EXCEL_BRAND.schoolName}&R${CNHS_EXCEL_BRAND.systemName}`,
  };
}

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
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeSheetName(name) {
  const cleaned = String(name || "Month")
    .replace(/[\\/?*[\]:]/g, "")
    .trim();
  return (cleaned || "Month").slice(0, 31);
}

function sortLearnersByName(learners = []) {
  return [...learners].sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""), "en")
  );
}

/** Official SF2 list order: Male, then Female, then unspecified. Alphabetical inside each group. */
function sf2LearnerGroups(learners = []) {
  return [
    {
      label: "MALE",
      rows: sortLearnersByName(
        (learners ?? []).filter((row) => row.sex === "M")
      ),
    },
    {
      label: "FEMALE",
      rows: sortLearnersByName(
        (learners ?? []).filter((row) => row.sex === "F")
      ),
    },
    {
      label: "UNSPECIFIED",
      rows: sortLearnersByName(
        (learners ?? []).filter((row) => row.sex !== "M" && row.sex !== "F")
      ),
    },
  ].filter((group) => group.rows.length);
}

function writeSf2LearnerTable(sheet, headerRow, learners = []) {
  const headers = [
    "Learner",
    "LRN",
    "Sex",
    "Present",
    "Absent",
    "Session rate",
    "Incomplete",
  ];
  headers.forEach((label, i) => {
    const cell = sheet.getCell(headerRow, i + 1);
    cell.value = label;
    styleBlockCell(cell, {
      bold: true,
      center: i > 0,
      fill: CNHS_EXCEL_BRAND.greenDark,
      color: CNHS_EXCEL_BRAND.white,
      size: 10,
    });
  });

  let rowIndex = headerRow + 1;
  for (const group of sf2LearnerGroups(learners)) {
    sheet.mergeCells(rowIndex, 1, rowIndex, 7);
    const groupCell = sheet.getCell(rowIndex, 1);
    groupCell.value = group.label;
    styleBlockCell(groupCell, {
      bold: true,
      fill: CNHS_EXCEL_BRAND.greenSoft,
      color: CNHS_EXCEL_BRAND.greenDark,
      size: 10,
    });
    for (let col = 2; col <= 7; col += 1) {
      styleBlockCell(sheet.getCell(rowIndex, col), {
        fill: CNHS_EXCEL_BRAND.greenSoft,
        color: CNHS_EXCEL_BRAND.greenDark,
      });
    }
    sheet.getRow(rowIndex).height = 18;
    rowIndex += 1;

    group.rows.forEach((row, index) => {
      const zebra =
        index % 2 === 1 ? CNHS_EXCEL_BRAND.zebra : CNHS_EXCEL_BRAND.white;
      const values = [
        `${index + 1}. ${row.name || ""}`,
        row.studentNumber || "",
        row.sex || "",
        numOrZero(row.presentSessions),
        numOrZero(row.absentSessions),
        formatSessionRate(row.sessionRate),
        row.incompleteDates?.length ?? 0,
      ];
      values.forEach((value, i) => {
        const cell = sheet.getCell(rowIndex, i + 1);
        cell.value = value;
        styleBlockCell(cell, {
          center: i > 0,
          fill: zebra,
          color: CNHS_EXCEL_BRAND.slateDark,
        });
      });
      sheet.getRow(rowIndex).height = 18;
      rowIndex += 1;
    });
  }
}

function uniqueIncompleteDates(learners = []) {
  const set = new Set();
  for (const row of learners) {
    for (const date of row.incompleteDates ?? []) {
      if (date) set.add(String(date));
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function dailySexBuckets(summary) {
  const empty = () => ({
    enrolled: 0,
    present: 0,
    absent: 0,
    incompleteDates: [],
  });
  const m = empty();
  const f = empty();
  const other = empty();

  for (const row of summary?.learners ?? []) {
    const bucket =
      row.sex === "M" ? m : row.sex === "F" ? f : other;
    bucket.enrolled += 1;
    bucket.present += Number(row.presentSessions) || 0;
    bucket.absent += Number(row.absentSessions) || 0;
  }
  m.incompleteDates = uniqueIncompleteDates(
    (summary?.learners ?? []).filter((row) => row.sex === "M")
  );
  f.incompleteDates = uniqueIncompleteDates(
    (summary?.learners ?? []).filter((row) => row.sex === "F")
  );
  other.incompleteDates = uniqueIncompleteDates(
    (summary?.learners ?? []).filter((row) => row.sex !== "M" && row.sex !== "F")
  );

  return {
    m,
    f,
    other,
    enrolled: Number(summary?.enrolled) || m.enrolled + f.enrolled + other.enrolled,
    present: Number(summary?.presentSessions) || m.present + f.present + other.present,
    absent: Number(summary?.absentSessions) || m.absent + f.absent + other.absent,
    sessionRate: summary?.sessionRate ?? sessionRatePercent({
      present: Number(summary?.presentSessions) || 0,
      absent: Number(summary?.absentSessions) || 0,
    }),
    incompleteDates: [...(summary?.incompleteDates ?? [])].sort((a, b) =>
      String(a).localeCompare(String(b))
    ),
  };
}

function writeDailyMonthBlock(
  sheet,
  { section, schoolYear, monthName, summary, logoId = null }
) {
  const buckets = dailySexBuckets(summary);
  const rateM = sessionRatePercent({
    present: buckets.m.present,
    absent: buckets.m.absent,
  });
  const rateF = sessionRatePercent({
    present: buckets.f.present,
    absent: buckets.f.absent,
  });
  const monthClose = summary?.monthClose;
  applySheetPrint(sheet);
  applyLearnerColumnWidths(sheet);
  sheet.getRow(1).height = 28;
  sheet.getRow(2).height = 18;

  styleBlockCell(sheet.getCell("A1"), {
    fill: CNHS_EXCEL_BRAND.greenDark,
    color: CNHS_EXCEL_BRAND.white,
  });
  sheet.mergeCells("B1:G1");
  const schoolCell = sheet.getCell("B1");
  schoolCell.value = CNHS_EXCEL_BRAND.schoolName;
  styleBlockCell(schoolCell, {
    bold: true,
    center: true,
    fill: CNHS_EXCEL_BRAND.greenDark,
    color: CNHS_EXCEL_BRAND.white,
    size: 14,
  });
  for (const col of ["C", "D", "E", "F", "G"]) {
    styleBlockCell(sheet.getCell(`${col}1`), {
      fill: CNHS_EXCEL_BRAND.greenDark,
      color: CNHS_EXCEL_BRAND.white,
    });
  }

  if (logoId != null) {
    sheet.addImage(logoId, {
      tl: { col: 0.2, row: 0.2 },
      ext: { width: 22, height: 22 },
    });
  }

  sheet.mergeCells("A2:G2");
  const systemCell = sheet.getCell("A2");
  systemCell.value = `${CNHS_EXCEL_BRAND.systemName} · Daily attendance working report`;
  styleBlockCell(systemCell, {
    center: true,
    fill: CNHS_EXCEL_BRAND.greenSoft,
    color: CNHS_EXCEL_BRAND.greenDark,
    size: 11,
  });

  sheet.mergeCells("A3:G3");
  const noteCell = sheet.getCell("A3");
  noteCell.value = monthClose ? CLOSE_NOTE : SOURCE_NOTE;
  noteCell.font = brandFont({
    size: 9,
    italic: true,
    color: CNHS_EXCEL_BRAND.slate,
  });
  noteCell.alignment = { wrapText: true, vertical: "middle" };
  sheet.getRow(3).height = 28;

  sheet.mergeCells("A4:G4");
  sheet.getCell("A4").value =
    `Grade ${section?.grade_level ?? "—"} · ${section?.section_name || "—"} · ${
      schoolYear || ""
    }`;
  sheet.getCell("A4").font = brandFont({
    bold: true,
    size: 11,
    color: CNHS_EXCEL_BRAND.slateDark,
  });

  sheet.getRow(6).height = 18;
  sheet.getRow(7).height = 18;
  sheet.mergeCells("A6:D6");
  const monthCell = sheet.getCell("A6");
  monthCell.value = String(monthName || "Month").toUpperCase();
  styleBlockCell(monthCell, {
    bold: true,
    center: true,
    fill: CNHS_EXCEL_BRAND.greenDark,
    color: CNHS_EXCEL_BRAND.white,
  });
  for (const col of ["B", "C", "D"]) {
    styleBlockCell(sheet.getCell(`${col}6`), {
      fill: CNHS_EXCEL_BRAND.greenDark,
      color: CNHS_EXCEL_BRAND.white,
    });
  }

  sheet.getCell("A7").value = "";
  sheet.getCell("B7").value = "M";
  sheet.getCell("C7").value = "F";
  sheet.getCell("D7").value = "Total";
  for (const col of ["A", "B", "C", "D"]) {
    styleBlockCell(sheet.getCell(`${col}7`), {
      bold: true,
      center: true,
      fill: CNHS_EXCEL_BRAND.greenSoft,
      color: CNHS_EXCEL_BRAND.greenDark,
    });
  }

  function writeCountRow(r, label, m, f, total) {
    styleBlockCell(sheet.getCell(`A${r}`), { color: CNHS_EXCEL_BRAND.slateDark });
    sheet.getCell(`A${r}`).value = label;
    styleBlockCell(sheet.getCell(`B${r}`), { center: true });
    styleBlockCell(sheet.getCell(`C${r}`), { center: true });
    styleBlockCell(sheet.getCell(`D${r}`), { center: true });
    sheet.getCell(`B${r}`).value = numOrZero(m);
    sheet.getCell(`C${r}`).value = numOrZero(f);
    sheet.getCell(`D${r}`).value = numOrZero(total);
    sheet.getRow(r).height = 18;
  }

  writeCountRow(8, "Enrolled", buckets.m.enrolled, buckets.f.enrolled, buckets.enrolled);
  writeCountRow(
    9,
    "Present sessions",
    buckets.m.present,
    buckets.f.present,
    buckets.present
  );
  writeCountRow(
    10,
    "Absent sessions",
    buckets.m.absent,
    buckets.f.absent,
    buckets.absent
  );

  sheet.getRow(11).height = 18;
  styleBlockCell(sheet.getCell("A11"), { color: CNHS_EXCEL_BRAND.slateDark });
  sheet.getCell("A11").value = "Session rate";
  for (const col of ["B", "C", "D"]) {
    styleBlockCell(sheet.getCell(`${col}11`), { center: true });
    sheet.getCell(`${col}11`).numFmt = "0.0";
  }
  setFormula(
    sheet.getCell("B11"),
    "IF((B9+B10)=0,0,B9/(B9+B10)*100)",
    rateM ?? 0
  );
  setFormula(
    sheet.getCell("C11"),
    "IF((C9+C10)=0,0,C9/(C9+C10)*100)",
    rateF ?? 0
  );
  setFormula(
    sheet.getCell("D11"),
    "IF((D9+D10)=0,0,D9/(D9+D10)*100)",
    buckets.sessionRate ?? 0
  );

  writeCountRow(
    12,
    "Incomplete days",
    buckets.m.incompleteDates.length,
    buckets.f.incompleteDates.length,
    buckets.incompleteDates.length
  );

  sheet.mergeCells("A14:G14");
  const incompleteHint = sheet.getCell("A14");
  incompleteHint.value =
    "Incomplete dates (AM or PM not saved — not counted as absent)";
  incompleteHint.font = brandFont({
    size: 9,
    italic: true,
    color: CNHS_EXCEL_BRAND.amber,
  });
  sheet.mergeCells("A15:G15");
  const incompleteDates = sheet.getCell("A15");
  incompleteDates.value = buckets.incompleteDates.length
    ? buckets.incompleteDates.join(", ")
    : "None";
  incompleteDates.font = brandFont({
    size: 10,
    color: CNHS_EXCEL_BRAND.slateDark,
  });

  let learnerStart = 17;
  if (monthClose) {
    const present = summary?.presentDays || { m: 0, f: 0, total: 0 };
    const absent = summary?.absentDays || { m: 0, f: 0, total: 0 };
    const metrics = computeMonthCloseMetrics({
      presentDays: present.total,
      schoolDays: monthClose.schoolDays,
      eomM: monthClose.eomM,
      eomF: monthClose.eomF,
    });
    const ffTotal = numOrZero(monthClose.ffM) + numOrZero(monthClose.ffF);
    const eomTotal = numOrZero(monthClose.eomM) + numOrZero(monthClose.eomF);

    sheet.mergeCells("A17:G17");
    const closeNote = sheet.getCell("A17");
    closeNote.value = CLOSE_NOTE;
    closeNote.font = brandFont({
      size: 9,
      italic: true,
      color: CNHS_EXCEL_BRAND.slate,
    });

    writeCountRow(18, "Days of classes", "", "", monthClose.schoolDays);
    writeCountRow(19, "1st Friday enrolment", monthClose.ffM, monthClose.ffF, ffTotal);
    writeCountRow(20, "End of month enrolment", monthClose.eomM, monthClose.eomF, eomTotal);
    writeCountRow(21, "Present days", present.m, present.f, present.total);
    writeCountRow(22, "Absent days", absent.m, absent.f, absent.total);

    styleBlockCell(sheet.getCell("A23"), {
      bold: true,
      color: CNHS_EXCEL_BRAND.greenDark,
    });
    sheet.getCell("A23").value = "ADA";
    styleBlockCell(sheet.getCell("B23"), { center: true });
    styleBlockCell(sheet.getCell("C23"), { center: true });
    styleBlockCell(sheet.getCell("D23"), {
      center: true,
      bold: true,
      color: CNHS_EXCEL_BRAND.greenDark,
    });
    sheet.getCell("D23").value = metrics.ada ?? "";
    sheet.getCell("D23").numFmt = "0.0";

    styleBlockCell(sheet.getCell("A24"), {
      bold: true,
      color: CNHS_EXCEL_BRAND.greenDark,
    });
    sheet.getCell("A24").value = "% attendance";
    styleBlockCell(sheet.getCell("B24"), { center: true });
    styleBlockCell(sheet.getCell("C24"), { center: true });
    styleBlockCell(sheet.getCell("D24"), {
      center: true,
      bold: true,
      color: CNHS_EXCEL_BRAND.greenDark,
    });
    sheet.getCell("D24").value = metrics.attendancePercent ?? "";
    sheet.getCell("D24").numFmt = "0.0";

    learnerStart = 26;
  }

  sheet.mergeCells(`A${learnerStart}:G${learnerStart}`);
  const learnersTitle = sheet.getCell(`A${learnerStart}`);
  learnersTitle.value = "Learners";
  learnersTitle.font = brandFont({
    bold: true,
    size: 12,
    color: CNHS_EXCEL_BRAND.greenDark,
  });
  writeSf2LearnerTable(sheet, learnerStart + 1, summary?.learners ?? []);
}

function writeLearnersSheet(sheet, summary) {
  applySheetPrint(sheet);
  applyLearnerColumnWidths(sheet);
  sheet.mergeCells("A1:G1");
  const schoolCell = sheet.getCell("A1");
  schoolCell.value = CNHS_EXCEL_BRAND.schoolName;
  styleBlockCell(schoolCell, {
    bold: true,
    center: true,
    fill: CNHS_EXCEL_BRAND.greenDark,
    color: CNHS_EXCEL_BRAND.white,
    size: 14,
  });
  sheet.mergeCells("A2:G2");
  sheet.getCell("A2").value = SOURCE_NOTE;
  sheet.getCell("A2").font = brandFont({
    size: 9,
    italic: true,
    color: CNHS_EXCEL_BRAND.slate,
  });
  writeSf2LearnerTable(sheet, 4, summary?.learners ?? []);
}

/**
 * Yakal-looking month block from attendance_daily.
 * ADA / enrolment rows only when the adviser has closed the month.
 */
export async function exportSectionDailyYakalExcel({
  section,
  schoolYear,
  months = [],
} = {}) {
  const entries = (months ?? []).filter(Boolean);
  if (!entries.length) {
    throw new Error("No saved daily attendance to export.");
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = CNHS_EXCEL_BRAND.systemName;
  workbook.company = CNHS_EXCEL_BRAND.schoolName;

  let logoId = null;
  const logo = await loadCnhsLogoBuffer();
  if (logo) {
    logoId = workbook.addImage({ buffer: logo, extension: "png" });
  }

  const usedNames = new Set();
  for (const entry of entries) {
    const monthName = entry.monthName || entry.summary?.monthName || "Month";
    let sheetName = safeSheetName(monthName);
    if (usedNames.has(sheetName)) {
      sheetName = safeSheetName(`${sheetName}-${entry.month || usedNames.size}`);
    }
    usedNames.add(sheetName);
    const sheet = workbook.addWorksheet(sheetName);
    writeDailyMonthBlock(sheet, {
      section: entry.section || section,
      schoolYear: entry.schoolYear || schoolYear,
      monthName,
      summary: entry.summary,
      logoId,
    });
  }

  if (entries.length === 1) {
    const learners = workbook.addWorksheet("Learners");
    writeLearnersSheet(learners, entries[0].summary);
  }

  const filename =
    entries.length === 1
      ? dailySectionFilename({
          section,
          monthName: entries[0].monthName || entries[0].summary?.monthName,
          schoolYear,
          ext: "xlsx",
        })
      : dailySectionYearFilename({ section, schoolYear, ext: "xlsx" });

  await downloadWorkbook(workbook, filename);
}

export async function exportSectionDailyExcel({
  section,
  schoolYear,
  monthName,
  summary,
}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Daily sessions");
  sheet.addRow(["From daily attendance records — not official DepEd SF2-COMP"]);
  sheet.addRow([
    `Grade ${section?.grade_level ?? "—"} · ${section?.section_name ?? "—"}`,
    schoolYear,
    monthName,
  ]);
  sheet.addRow([]);
  sheet.addRow([
    "Learner",
    "LRN",
    "Present sessions",
    "Absent sessions",
    "Session rate",
    "Incomplete days",
  ]);
  for (const row of summary.learners ?? []) {
    sheet.addRow([
      row.name,
      row.studentNumber || "",
      row.presentSessions,
      row.absentSessions,
      formatSessionRate(row.sessionRate),
      row.incompleteDates?.length ?? 0,
    ]);
  }
  await downloadWorkbook(
    workbook,
    dailySectionFilename({
      section,
      monthName,
      schoolYear,
      ext: "xlsx",
    })
  );
}

export async function exportLearnerDailyExcel({
  section,
  schoolYear,
  monthName,
  learner,
}) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Learner");
  sheet.addRow(["From daily attendance records — not official DepEd SF2-COMP"]);
  sheet.addRow([learner.name, learner.studentNumber || "", schoolYear, monthName]);
  sheet.addRow([]);
  sheet.addRow(["Date", "Morning", "Afternoon", "Incomplete"]);
  for (const day of learner.days ?? []) {
    sheet.addRow([
      day.date,
      statusShort(day.morning),
      statusShort(day.afternoon),
      day.incomplete ? "Yes" : "",
    ]);
  }
  await downloadWorkbook(
    workbook,
    dailyLearnerFilename({
      learnerName: learner.name,
      monthName,
      schoolYear,
      ext: "xlsx",
    })
  );
}

export async function exportSchoolDailyExcel({ schoolYear, monthName, summary }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("School");
  sheet.addRow([
    schoolYear,
    monthName,
    summary.scopeLabel || "All sections",
  ]);
  sheet.addRow([]);
  sheet.addRow([
    "Section",
    "Present sessions",
    "Absent sessions",
    "Session rate",
    "Learners marked",
  ]);
  for (const row of summary.rows ?? []) {
    const submitted = sectionHasSavedDaily(row);
    sheet.addRow([
      schoolSectionLineLabel(row),
      submitted ? row.present : "Not submitted",
      submitted ? row.absent : "—",
      submitted ? formatSessionRate(row.sessionRate) : "—",
      submitted ? row.learnersMarked : "—",
    ]);
  }
  sheet.addRow([]);
  sheet.addRow([
    "Section",
    "Learner",
    "LRN",
    "Present sessions",
    "Absent sessions",
    "Session rate",
  ]);
  const learners = summary.learners ?? [];
  if (!learners.length) {
    sheet.addRow(["No daily attendance saved this month."]);
  } else {
    for (const row of learners) {
      sheet.addRow([
        row.sectionLabel || "—",
        row.name || "—",
        row.studentNumber || "—",
        row.presentSessions,
        row.absentSessions,
        formatMaybeRate(row.sessionRate),
      ]);
    }
  }
  await downloadWorkbook(
    workbook,
    dailySchoolFilename({ monthName, schoolYear, ext: "xlsx" })
  );
}
