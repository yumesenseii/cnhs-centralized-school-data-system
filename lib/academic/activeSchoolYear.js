import { suggestCurrentSchoolYear } from "@/lib/admin/sectionMappers";

/**
 * Returns the currently active school year dynamically based on reference date.
 * (e.g. "SY 2026-2027" for the current academic calendar).
 */
export function getActiveSchoolYear(referenceDate = new Date()) {
  return suggestCurrentSchoolYear(referenceDate);
}

/**
 * Normalizes any school year input into consistent representations.
 * Handles both "SY 2026-2027" and "2026-2027".
 * Returns:
 * - standard: e.g. "SY 2026-2027"
 * - raw: e.g. "2026-2027"
 * - variants: ["SY 2026-2027", "2026-2027"]
 */
export function normalizeSchoolYear(inputYear) {
  const base = String(inputYear || "").trim() || getActiveSchoolYear();
  const raw = base.replace(/^SY\s*/i, "").trim();
  const standard = `SY ${raw}`;
  return {
    standard,
    raw,
    variants: Array.from(new Set([standard, raw, base])),
  };
}
