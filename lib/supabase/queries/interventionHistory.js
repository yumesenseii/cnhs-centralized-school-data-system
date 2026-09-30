import { createClient } from "@/lib/supabase/client";
import {
  ARAL_PLACEMENT_TIER,
  INTERVENTION_PATHWAY,
  MOVEMENT_OUTCOME,
  PRINCIPAL_REVIEW_STATUS,
} from "@/lib/monitoring/recommendations";

const INTERVENTION_HISTORY_SELECT = `
  id,
  student_id,
  class_id,
  teacher_id,
  school_year,
  term,
  learning_area,
  academic_grade,
  academic_risk_level,
  assessment_type,
  assessment_result,
  reading_level_or_placement,
  intervention_pathway,
  aral_placement_tier,
  intervention_type,
  intervention_status,
  date_started,
  beginning_assessment_score,
  middle_assessment_score,
  end_assessment_score,
  end_assessment_type,
  attendance_sessions_attended,
  attendance_sessions_total,
  attendance_rate,
  movement_outcome,
  progress_result,
  current_status,
  facilitator_or_teacher_id,
  facilitator_name,
  principal_review_status,
  principal_reviewed_by,
  principal_reviewed_at,
  principal_review_note,
  remarks,
  created_at,
  updated_at,
  students (
    id,
    student_number,
    first_name,
    middle_name,
    last_name,
    sex,
    section_id,
    status
  ),
  classes (
    id,
    school_year,
    quarter,
    sections (
      id,
      section_name,
      grade_level
    ),
    subjects (
      id,
      subject_name,
      subject_code
    )
  ),
  teachers (
    id,
    first_name,
    middle_name,
    last_name
  )
`;

export const CNHS_OFFICIAL_ARAL_BENCHMARK = {
  schoolYear: "SY 2025-2026",
  periodLabel: "Annual Intervention Cycle",
  basicBeginning: 129,
  basicEnd: 120,
  basicRetained: 19,
  basicPromoted: 101,
  basicPercentage: 78.29,
  plusBeginning: 86,
  plusEnd: 81,
  plusRetained: 7,
  plusPromoted: 74,
  plusPercentage: 86.05,
  totalBeginning: 215,
  totalEnd: 201,
  totalRetained: 26,
  totalPromoted: 175,
  totalPercentage: 81.40,
  attendance: {
    september: { basic: 65.82, plus: 65.75, average: 65.79 },
    october: { basic: 64.34, plus: 56.35, average: 60.35 },
    november: { basic: 54.67, plus: 51.11, average: 52.89 },
  },
};

async function ensureAuthSession() {
  const supabase = createClient();
  await supabase.auth.getSession();
  return supabase;
}

export async function getLearnerInterventionHistory(studentId) {
  if (!studentId) {
    return { data: [], error: new Error("Student id is required.") };
  }
  const supabase = await ensureAuthSession();
  const { data, error } = await supabase
    .from("learner_intervention_history")
    .select(INTERVENTION_HISTORY_SELECT)
    .eq("student_id", studentId)
    .order("school_year", { ascending: false })
    .order("term", { ascending: false });

  if (error) {
    const message = error.message || "";
    if (/learner_intervention_history|does not exist|schema cache/i.test(message)) {
      return { data: [], error: null };
    }
    return { data: null, error };
  }
  return { data: data ?? [], error: null };
}

export async function listInterventionHistoryByPathway({
  schoolYear = null,
  quarter = null,
  pathway = null,
  placementTier = null,
  status = null,
} = {}) {
  const supabase = await ensureAuthSession();
  let query = supabase
    .from("learner_intervention_history")
    .select(INTERVENTION_HISTORY_SELECT)
    .order("created_at", { ascending: false });

  if (schoolYear) query = query.eq("school_year", schoolYear);
  if (quarter !== null && quarter !== undefined && quarter !== "" && quarter !== "All Terms") {
    const termNum = Number(String(quarter).replace(/\D/g, "")) || null;
    if (termNum) query = query.eq("term", termNum);
  }
  if (pathway && pathway !== "All Pathways") {
    const p = pathway.toLowerCase().includes("aral") ? "aral" : "classroom_remediation";
    query = query.eq("intervention_pathway", p);
  }
  if (placementTier && placementTier !== "All Tiers") {
    query = query.eq("aral_placement_tier", placementTier.toLowerCase());
  }
  if (status && status !== "All Status") {
    query = query.eq("intervention_status", status);
  }

  const { data, error } = await query;
  if (error) {
    const message = error.message || "";
    if (/learner_intervention_history|does not exist|schema cache/i.test(message)) {
      return { data: [], error: null };
    }
    return { data: null, error };
  }
  return { data: data ?? [], error: null };
}

export async function getCnhsAralCohortSummary({ schoolYear = "SY 2025-2026" } = {}) {
  const supabase = await ensureAuthSession();
  
  // First check if official benchmark row exists in database
  const { data: benchmarkRow, error: benchErr } = await supabase
    .from("cnhs_aral_aggregate_benchmarks")
    .select("*")
    .eq("school_year", schoolYear)
    .maybeSingle();

  if (!benchErr && benchmarkRow) {
    return {
      data: {
        schoolYear,
        basicBeginning: benchmarkRow.basic_beginning,
        basicEnd: benchmarkRow.basic_end,
        basicRetained: benchmarkRow.basic_retained,
        basicPromoted: benchmarkRow.basic_promoted,
        basicPercentage: Number(benchmarkRow.basic_percentage),
        plusBeginning: benchmarkRow.plus_beginning,
        plusEnd: benchmarkRow.plus_end,
        plusRetained: benchmarkRow.plus_retained,
        plusPromoted: benchmarkRow.plus_promoted,
        plusPercentage: Number(benchmarkRow.plus_percentage),
        totalBeginning: benchmarkRow.basic_beginning + benchmarkRow.plus_beginning,
        totalEnd: benchmarkRow.basic_end + benchmarkRow.plus_end,
        totalRetained: benchmarkRow.basic_retained + benchmarkRow.plus_retained,
        totalPromoted: benchmarkRow.basic_promoted + benchmarkRow.plus_promoted,
        totalPercentage: Math.round(
          ((benchmarkRow.basic_promoted + benchmarkRow.plus_promoted) /
            (benchmarkRow.basic_beginning + benchmarkRow.plus_beginning)) *
            10000
        ) / 100,
        attendance: {
          september: {
            basic: 65.82,
            plus: 65.75,
            average: Number(benchmarkRow.attendance_september),
          },
          october: {
            basic: 64.34,
            plus: 56.35,
            average: Number(benchmarkRow.attendance_october),
          },
          november: {
            basic: 54.67,
            plus: 51.11,
            average: Number(benchmarkRow.attendance_november),
          },
        },
        source: "CNHS Official Historical Aggregate Benchmark",
      },
      error: null,
    };
  }

  // Fallback to verified constant benchmark
  return {
    data: CNHS_OFFICIAL_ARAL_BENCHMARK,
    error: null,
  };
}

export async function createInterventionHistoryEntry(payload) {
  const supabase = await ensureAuthSession();
  const row = {
    student_id: payload.student_id,
    class_id: payload.class_id || null,
    teacher_id: payload.teacher_id || null,
    school_year: payload.school_year,
    term: Number(payload.term || payload.quarter || 1),
    learning_area: payload.learning_area || payload.subject || "General",
    academic_grade: payload.academic_grade != null ? Number(payload.academic_grade) : null,
    academic_risk_level: payload.academic_risk_level || "Low Risk",
    assessment_type: payload.assessment_type || null,
    assessment_result: payload.assessment_result || null,
    reading_level_or_placement: payload.reading_level_or_placement || null,
    intervention_pathway: payload.intervention_pathway || "classroom_remediation",
    aral_placement_tier: payload.aral_placement_tier ? payload.aral_placement_tier.toLowerCase() : null,
    intervention_type: payload.intervention_type || null,
    intervention_status: payload.intervention_status || "Identified",
    date_started: payload.date_started || new Date().toISOString().slice(0, 10),
    beginning_assessment_score: payload.beginning_assessment_score != null ? Number(payload.beginning_assessment_score) : null,
    middle_assessment_score: payload.middle_assessment_score != null ? Number(payload.middle_assessment_score) : null,
    end_assessment_score: payload.end_assessment_score != null ? Number(payload.end_assessment_score) : null,
    end_assessment_type: payload.end_assessment_type || null,
    attendance_sessions_attended: Number(payload.attendance_sessions_attended || 0),
    attendance_sessions_total: Number(payload.attendance_sessions_total || 0),
    attendance_rate: payload.attendance_rate != null ? Number(payload.attendance_rate) : null,
    movement_outcome: payload.movement_outcome || null,
    progress_result: payload.progress_result || null,
    current_status: payload.current_status || "Active",
    facilitator_or_teacher_id: payload.facilitator_or_teacher_id || null,
    facilitator_name: payload.facilitator_name || null,
    principal_review_status: payload.principal_review_status || "Pending Review",
    principal_reviewed_by: payload.principal_reviewed_by || null,
    principal_reviewed_at: payload.principal_reviewed_at || null,
    principal_review_note: payload.principal_review_note || null,
    remarks: payload.remarks || null,
  };

  const { data, error } = await supabase
    .from("learner_intervention_history")
    .insert(row)
    .select(INTERVENTION_HISTORY_SELECT)
    .single();

  return { data, error };
}

export async function updateInterventionHistoryEntry(id, updates) {
  if (!id) return { data: null, error: new Error("Intervention history id is required.") };
  const supabase = await ensureAuthSession();

  const payload = {
    ...updates,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("learner_intervention_history")
    .update(payload)
    .eq("id", id)
    .select(INTERVENTION_HISTORY_SELECT)
    .single();

  return { data, error };
}

export async function updatePrincipalReviewStatus({
  id,
  status,
  reviewNote = null,
  profileId = null,
}) {
  if (!id) return { data: null, error: new Error("Intervention history id is required.") };
  const supabase = await ensureAuthSession();

  const updates = {
    principal_review_status: status,
    principal_review_note: reviewNote?.trim() || null,
    principal_reviewed_by: profileId,
    principal_reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("learner_intervention_history")
    .update(updates)
    .eq("id", id)
    .select(INTERVENTION_HISTORY_SELECT)
    .single();

  return { data, error };
}
