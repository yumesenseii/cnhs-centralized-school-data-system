import { createClient } from "@/lib/supabase/client";
import { requireAdmin } from "@/lib/supabase/queries/adminAuth";
import { normalizeAcademicTerm } from "@/lib/academic/academicTermPolicy";

const SCHOOL_SETTING_KEY = "school_info";

/**
 * Fetch canonical school settings from the database (multi-device source of truth).
 */
export async function getCanonicalSchoolSettings() {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("system_settings")
      .select("value, updated_at")
      .eq("key", SCHOOL_SETTING_KEY)
      .maybeSingle();

    if (error || !data?.value) {
      return { data: null, updatedAt: null, error: null };
    }
    return { data: data.value, updatedAt: data.updated_at, error: null };
  } catch (err) {
    return { data: null, updatedAt: null, error: err };
  }
}

/**
 * Save canonical school settings to the database. Requires admin privileges.
 */
export async function setCanonicalSchoolSettings(payload) {
  const auth = await requireAdmin("update school branding and settings");
  if (!auth.ok) {
    return { data: null, error: auth.error };
  }

  try {
    const supabase = createClient();
    const existing = await getCanonicalSchoolSettings();
    const currentTerm = normalizeAcademicTerm(
      payload.currentTerm ?? existing.data?.currentTerm ?? null
    );

    const { data, error } = await supabase
      .from("system_settings")
      .upsert(
        {
          key: SCHOOL_SETTING_KEY,
          value: {
            ...(existing.data ?? {}),
            schoolName: payload.schoolName ?? "Cambaog National High School",
            schoolAddress: payload.schoolAddress ?? "",
            division: payload.division ?? "Division of Bulacan",
            schoolYear: payload.schoolYear ?? existing.data?.schoolYear ?? "2026-2027",
            schoolId: payload.schoolId ?? "300987",
            district: payload.district ?? "Bustos District",
            logoSrc: payload.logoSrc || "/cnhs-logo.png",
            currentTerm,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" }
      )
      .select("value, updated_at")
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data: data.value, updatedAt: data.updated_at, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}
