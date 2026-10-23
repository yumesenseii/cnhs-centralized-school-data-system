import React, { useMemo, useSyncExternalStore } from "react";
import { saveBatchClassGstScores as saveBatch, saveSinglePhilIriResult as saveSingle } from "../../lib/supabase/queries/monitoring.js";
import { philIriMemoryClient } from "./phil-iri-memory-client.mjs";

const store = philIriMemoryClient({ seed: JSON.parse(localStorage.getItem("aral-test-results") || "[]") });
let version = 0;
const listeners = new Set();
function notify() {
  localStorage.setItem("aral-test-results", JSON.stringify(store.rows));
  version++;
  listeners.forEach((fn) => fn());
}
window.__aralTest = store;
const roster = { id: "s1", studentId: "s1", classId: "c1", teacherId: "t1", subjectTeacherId: "t1", subject: "English",
  name: "Ana Cruz", firstName: "Ana", lastName: "Cruz", studentNumber: "123456789012", grade: "7", section: "Rizal", schoolYear: "SY 2026-2027" };
function useRoster() {
  useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, () => version);
  const students = useMemo(() => [{ ...roster, philIriRecords: structuredClone(store.rows) }], [version]);
  return { students, controls: { schoolYear: roster.schoolYear, quarter: "Term 1" }, teacherId: "t1",
    loading: false, refreshing: false, error: "", refresh: async () => notify(), filterOptions: { schoolYears: [roster.schoolYear] } };
}
export const useTeacherMonitoring = useRoster;
export const useAdminMonitoring = useRoster;
export async function saveBatchClassGstScores(input) { const result = await saveBatch({ ...input, supabaseClient: store.client }); notify(); return result; }
export async function saveSinglePhilIriResult(input) { const result = await saveSingle({ ...input, supabaseClient: store.client }); notify(); return result; }
export const listMonitoringRecordsForStudents = async () => ({ data: [], error: null });
export const createMonitoringRecord = async () => { throw new Error("Unexpected progress write"); };
export const updateMonitoringRecord = createMonitoringRecord;
export const useAppToast = () => ({ showToast(message) { window.__lastToast = message; document.getElementById("test-toast").textContent = message; } });
export const useSearchParams = () => useMemo(() => new URLSearchParams(window.location.search), []);
export const usePathname = () => window.location.pathname;
export const useRouter = () => ({ push() {} });
export function createClient() {
  return { from() { throw new Error("Unexpected live database access in browser test"); }, auth: {} };
}
export const exportAralRecommendedExcel = async () => {};
export const downloadAralWeeklyTemplateExcel = async () => {};
export const parseAralWeeklyWorkbook = () => ({ rows: [], errors: [] });
export default function Stub({ children, href }) { return href ? <a href={href}>{children}</a> : null; }
