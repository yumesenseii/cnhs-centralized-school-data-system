import {
  getCanonicalSchoolSettings,
  setCanonicalSchoolSettings,
} from "@/lib/supabase/queries/systemSettings";
import {
  areSameSchoolYear,
  normalizeAcademicTerm,
  readConfiguredSchoolYear,
  readConfiguredTerm,
} from "@/lib/academic/academicTermPolicy";

/**
 * Authoritative academic current-term setting (school-level).
 *
 * Stored in the existing admin-managed `system_settings` row `school_info` as
 * `currentTerm`. It is never inferred from the calendar, the most recent
 * published grade, or a class quarter.
 *
 * Fail-safe: a missing row, missing field, or read error returns an
 * unconfigured term. All academic term writes are then locked by policy while
 * reads, exports, and historical views continue to work.
 */
export async function getCurrentAcademicTerm({ schoolYear = null } = {}) {
  const settings = await getCanonicalSchoolSettings();
  const value = settings.data ?? {};
  const configuredTerm = readConfiguredTerm(value);
  const configuredSchoolYear = readConfiguredSchoolYear(value);

  const matchesRequestedSchoolYear =
    !schoolYear ||
    !configuredSchoolYear ||
    areSameSchoolYear(schoolYear, configuredSchoolYear);

  return {
    data: {
      term: matchesRequestedSchoolYear ? configuredTerm : null,
      configured: configuredTerm !== null,
      configuredTerm,
      schoolYear: configuredSchoolYear,
      matchesRequestedSchoolYear,
    },
    updatedAt: settings.updatedAt ?? null,
    error: null,
  };
}

/**
 * Admin-only setter. Uses the existing school settings writer so the current
 * term stays alongside the school year/branding rather than introducing a new
 * setting table or policy.
 */
export async function setCurrentAcademicTerm(
  term,
  { schoolYear = null } = {}
) {
  const normalized = normalizeAcademicTerm(term);
  if (normalized === null) {
    return {
      data: null,
      error: new Error("The current term must be Term 1, Term 2, or Term 3."),
    };
  }

  const current = await getCanonicalSchoolSettings();
  const result = await setCanonicalSchoolSettings({
    ...(current.data ?? {}),
    currentTerm: normalized,
    ...(schoolYear ? { schoolYear } : {}),
  });

  if (result.error) return { data: null, error: result.error };

  return {
    data: {
      term: normalized,
      schoolYear: readConfiguredSchoolYear(result.data ?? {}),
    },
    error: null,
  };
}
