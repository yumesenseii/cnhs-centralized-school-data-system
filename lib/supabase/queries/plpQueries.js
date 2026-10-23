/**
 * Data access and RPC orchestration client for Personalized Learning Plans (PLP).
 *
 * Security & Workflow Invariants:
 * 1. PERSISTENCE GUARD: FEATURE_PLP_PERSISTENCE = false in Stage A.
 * 2. ZERO DIRECT TABLE MUTATIONS: All writes route strictly through hardened
 *    PostgreSQL SECURITY DEFINER RPCs (`generate_and_save_draft_plp`, `save_teacher_plp_draft`,
 *    `mark_plp_reviewed_rpc`, `activate_plp_rpc`). Direct table writes are forbidden.
 * 3. IDENTITY PROTECTION: No caller-supplied profile IDs are sent over the wire;
 *    identities are derived securely on the server from authenticated sessions.
 */

import { createClient } from "@/lib/supabase/client";

/** Feature flag guarding persistent database writes in Stage A. */
export const FEATURE_PLP_PERSISTENCE = false;

async function getClient() {
  const supabase = createClient();
  await supabase.auth.getSession();
  return supabase;
}

/**
 * Retrieves existing PLPs for a given learner and scope.
 */
export async function getPlpForStudent({
  studentId,
  schoolYear,
  classId = null,
  readingPeriod = null,
  planType = null,
}) {
  if (!studentId || !schoolYear) {
    return { data: null, error: new Error("studentId and schoolYear are required.") };
  }

  try {
    const supabase = await getClient();
    let query = supabase
      .from("personalized_learning_plans")
      .select("*")
      .eq("student_id", studentId)
      .eq("school_year", schoolYear);

    if (classId) {
      query = query.eq("class_id", classId);
    }
    if (readingPeriod) {
      query = query.eq("reading_period", readingPeriod);
    }
    if (planType) {
      query = query.eq("plan_type", planType);
    }

    const { data, error } = await query;
    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Invokes the hardened RPC to generate or update an unedited draft PLP.
 * Guarded by FEATURE_PLP_PERSISTENCE in Stage A.
 */
export async function generateAndSaveDraftPlp(payload) {
  if (!FEATURE_PLP_PERSISTENCE) {
    return {
      success: false,
      status: "disabled",
      code: "PERSISTENCE_DISABLED_STAGE_A",
      message: "Persistent PLP writes are disabled in Phase 4 Stage A. Drafting is running in pure in-memory mode.",
    };
  }

  const {
    studentId,
    classId = null,
    schoolYear,
    academicTerm = null,
    readingPeriod = null,
    planType,
    overallRiskLevel = null,
    recommendedSupportLevel = null,
    learningNeeds = [],
    targetObjectives = [],
    recommendedActivities = [],
    monitoringIndicators = [],
  } = payload;

  try {
    const supabase = await getClient();
    const { data, error } = await supabase.rpc("generate_and_save_draft_plp", {
      p_student_id: studentId,
      p_class_id: classId,
      p_school_year: schoolYear,
      p_academic_term: academicTerm,
      p_reading_period: readingPeriod,
      p_plan_type: planType,
      p_overall_risk_level: overallRiskLevel,
      p_recommended_support_level: recommendedSupportLevel,
      p_learning_needs: learningNeeds,
      p_target_objectives: targetObjectives,
      p_recommended_activities: recommendedActivities,
      p_monitoring_indicators: monitoringIndicators,
    });

    if (error) throw error;
    return data;
  } catch (err) {
    return {
      success: false,
      status: "error",
      message: err.message || "Failed to generate draft PLP.",
    };
  }
}

/**
 * Authorized teacher manual draft save.
 * Routes strictly through save_teacher_plp_draft RPC.
 */
export async function saveTeacherPlpDraft({
  id,
  learningNeeds,
  targetObjectives,
  recommendedActivities,
  monitoringIndicators,
  teacherNotes = null,
  version,
}) {
  if (!FEATURE_PLP_PERSISTENCE) {
    return {
      success: false,
      status: "disabled",
      code: "PERSISTENCE_DISABLED_STAGE_A",
      message: "Persistent PLP writes are disabled in Phase 4 Stage A.",
    };
  }

  try {
    const supabase = await getClient();
    const { data, error } = await supabase.rpc("save_teacher_plp_draft", {
      p_id: id,
      p_learning_needs: learningNeeds,
      p_target_objectives: targetObjectives,
      p_recommended_activities: recommendedActivities,
      p_monitoring_indicators: monitoringIndicators,
      p_teacher_notes: teacherNotes,
      p_version: version,
    });

    if (error) throw error;
    return data;
  } catch (err) {
    return {
      success: false,
      status: "error",
      message: err.message || "Failed to save teacher draft.",
    };
  }
}

/**
 * Marks a draft PLP as teacher_reviewed.
 * Routes strictly through mark_plp_reviewed_rpc.
 */
export async function markPlpReviewed({ id, teacherNotes = null, version }) {
  if (!FEATURE_PLP_PERSISTENCE) {
    return {
      success: false,
      status: "disabled",
      code: "PERSISTENCE_DISABLED_STAGE_A",
      message: "Persistent PLP writes are disabled in Phase 4 Stage A.",
    };
  }

  try {
    const supabase = await getClient();
    const { data, error } = await supabase.rpc("mark_plp_reviewed_rpc", {
      p_id: id,
      p_teacher_notes: teacherNotes,
      p_version: version,
    });

    if (error) throw error;
    return data;
  } catch (err) {
    return {
      success: false,
      status: "error",
      message: err.message || "Failed to review PLP.",
    };
  }
}

/**
 * Activates a PLP.
 * Enforces that the plan must have been teacher_reviewed.
 * Routes strictly through activate_plp_rpc.
 */
export async function activatePlp({ id, version }) {
  if (!FEATURE_PLP_PERSISTENCE) {
    return {
      success: false,
      status: "disabled",
      code: "PERSISTENCE_DISABLED_STAGE_A",
      message: "Persistent PLP writes are disabled in Phase 4 Stage A.",
    };
  }

  try {
    const supabase = await getClient();
    const { data, error } = await supabase.rpc("activate_plp_rpc", {
      p_id: id,
      p_version: version,
    });

    if (error) throw error;
    return data;
  } catch (err) {
    return {
      success: false,
      status: "error",
      message: err.message || "Failed to activate PLP.",
    };
  }
}
