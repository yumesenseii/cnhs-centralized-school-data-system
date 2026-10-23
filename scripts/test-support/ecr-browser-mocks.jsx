import { useSyncExternalStore } from "react";
let message = "";
const listeners = new Set();
export function useAppToast() { return { showToast: (value) => { message = String(value); listeners.forEach((listener) => listener()); } }; }
export function Toast() {
  const value = useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, () => message);
  return <div role="status">{value}</div>;
}
export default function Stub({ children, href }) { return href ? <a href={href}>{children}</a> : <>{children}</>; }
export async function downloadWorkbook(workbook, filename) {
  window.__ecrExport = { filename, term1: workbook.getWorksheet("TERM1").getCell("AA12").value,
    term2: workbook.getWorksheet("TERM2").getCell("AA12").value, items: workbook.getWorksheet("ASSESSMENT RECORDS").rowCount - 1 };
}
