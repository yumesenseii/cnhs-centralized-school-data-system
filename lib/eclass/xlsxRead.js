import * as XLSX from "xlsx";

/**
 * Shared SheetJS read options for DepEd E-Class Record imports.
 * Disables expensive cell features we never use.
 */
export const ECLASS_XLSX_OPTIONS = {
  type: "array",
  cellFormula: false,
  cellHTML: false,
  cellStyles: false,
  cellNF: false,
  cellDates: false,
  sheetStubs: false,
};

/**
 * List worksheet names without parsing sheet contents.
 */
export function readWorkbookSheetNames(buffer) {
  const stub = XLSX.read(buffer, {
    ...ECLASS_XLSX_OPTIONS,
    bookSheets: true,
    bookProps: false,
  });
  return stub.SheetNames ?? [];
}

/**
 * Parse only the named worksheets from a workbook buffer.
 */
export function readWorkbookSheets(buffer, sheetNames) {
  const names = (sheetNames ?? []).filter(Boolean);
  if (!names.length) {
    return { SheetNames: [], Sheets: {} };
  }

  return XLSX.read(buffer, {
    ...ECLASS_XLSX_OPTIONS,
    sheets: names,
  });
}

export function getSheetCell(sheet, rowIndex, colIndex) {
  if (!sheet) return "";
  const addr = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
  const cell = sheet[addr];
  if (!cell) return "";
  // Prefer cached value; fall back to formatted text (common for formula cells).
  if (cell.v !== undefined && cell.v !== null && cell.v !== "") return cell.v;
  if (cell.w !== undefined && cell.w !== null && String(cell.w).trim() !== "") {
    return cell.w;
  }
  return cell.v ?? "";
}

/**
 * Sheet used range. Unions `!ref` with addresses actually present on the sheet
 * so Male→Female blocks past a short/stale dimension are still scanned.
 */
export function getSheetRange(sheet) {
  if (!sheet) {
    return { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
  }

  let minR = Infinity;
  let minC = Infinity;
  let maxR = -1;
  let maxC = -1;

  if (sheet["!ref"]) {
    const decoded = XLSX.utils.decode_range(sheet["!ref"]);
    minR = decoded.s.r;
    minC = decoded.s.c;
    maxR = decoded.e.r;
    maxC = decoded.e.c;
  }

  for (const key of Object.keys(sheet)) {
    if (!key || key[0] === "!") continue;
    let addr;
    try {
      addr = XLSX.utils.decode_cell(key);
    } catch {
      continue;
    }
    if (addr.r < minR) minR = addr.r;
    if (addr.c < minC) minC = addr.c;
    if (addr.r > maxR) maxR = addr.r;
    if (addr.c > maxC) maxC = addr.c;
  }

  if (maxR < 0 || maxC < 0 || !Number.isFinite(minR) || !Number.isFinite(minC)) {
    return { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
  }

  return {
    s: { r: minR, c: minC },
    e: { r: maxR, c: maxC },
  };
}
