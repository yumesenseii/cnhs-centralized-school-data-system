import { createClient } from "@/lib/supabase/client";
import { notifyMonitoringRecord } from "@/lib/notifications/monitoringNotifications";
import { buildFlaggedReadingConcernNotification } from "@/lib/notifications/notificationEvents";
import {
  createNotificationsSafely,
  getCurrentProfile,
  resolveProfileIdForTeacher,
} from "@/lib/supabase/queries/notifications";
import { normalizeAralPeriod } from "@/lib/monitoring/assessmentTimeline";
import { buildPhilIriPayload, philIriSaveError } from "@/lib/monitoring/philIriPersistence";
import {
  getCurrentTeacherSession,
  getTeacherClasses,
} from "@/lib/supabase/queries/myClasses";
import { invalidateTtlCache } from "@/lib/cache/ttlCache";
import { parseTermNumber } from "@/lib/academic/termLabels";

const MONITORING_RECORD_SELECT = `
  id,
  student_id,
  class_id,
  teacher_id,
  observation_date,
  intervention_given,
  teacher_remarks,
  student_progress,
  follow_up_needed,
  monitoring_status,
  week_number,
  session_status,
  session_days,
  skill_focus,
  topic,
  activity,
  progress_evaluation,
  next_action,
  evaluated_by,
  evaluated_at,
  school_year,
  quarter,
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
    subject_id,
    section_id,
    teacher_id,
    subjects (
      id,
      subject_name,
      subject_code
    ),
    sections (
      id,
      section_name,
      grade_level,
      school_year,
      adviser_id,
      adviser:teachers!adviser_id (
        id,
        first_name,
        middle_name,
        last_name
      )
    ),
    teachers (
      id,
      first_name,
      middle_name,
      last_name
    )
  ),
  teachers:teachers!monitoring_records_teacher_id_fkey (
    id,
    first_name,
    middle_name,
    last_name
  )
`;

async function ensureAuthSession() {
  const supabase = createClient();
  await supabase.auth.getSession();
  return supabase;
}

function unwrap(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** Split large `.in()` filters to avoid PostgREST URL length failures. */
async function selectInChunks(buildQuery, ids = [], chunkSize = 80) {
  if (!ids.length) return { data: [], error: null };
  const unique = [...new Set(ids.filter(Boolean))];
  const rows = [];
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await buildQuery(chunk);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
  }
  return { data: rows, error: null };
}

/**
 * Students enrolled in any of the teacher's assigned classes,
 * plus their grades for the class school year / quarter.
 */
export async function getTeacherMonitoringRoster({
  teacherId,
  schoolYear = null,
  quarter = null,
} = {}) {
  if (!teacherId) {
    return { data: null, error: new Error("Teacher id is required.") };
  }

  const supabase = await ensureAuthSession();
  const classesResult = await getTeacherClasses(teacherId);
  if (classesResult.error) {
    return { data: null, error: classesResult.error };
  }

  let classes = classesResult.data ?? [];
  if (schoolYear) {
    classes = classes.filter((row) => row.school_year === schoolYear);
  }
  if (quarter !== null && quarter !== undefined && quarter !== "") {
    classes = classes.filter((row) => Number(row.quarter) === Number(quarter));
  }

  if (!classes.length) {
    return {
      data: { classes: [], students: [], grades: [], monitoringRecords: [] },
      error: null,
    };
  }

  const classIds = classes.map((row) => row.id);
  const years = [...new Set(classes.map((row) => row.school_year).filter(Boolean))];
  const quarters = [
    ...new Set(classes.map((row) => Number(row.quarter)).filter(Boolean)),
  ];

  const { data: enrollments, error: enrollmentError } = await supabase
    .from("class_students")
    .select(
      `
      id,
      class_id,
      student_id,
      created_at,
      students (
        id,
        student_number,
        first_name,
        middle_name,
        last_name,
        sex,
        section_id,
        status
      )
    `
    )
    .in("class_id", classIds);

  if (enrollmentError) {
    return { data: null, error: enrollmentError };
  }

  const studentIds = [
    ...new Set((enrollments ?? []).map((row) => row.student_id).filter(Boolean)),
  ];

  let grades = [];
  if (studentIds.length) {
    let gradesQuery = supabase
      .from("grades")
      .select(
        `
        id,
        student_id,
        class_id,
        subject_id,
        quarter,
        final_grade,
        school_year,
        subjects (
          id,
          subject_name,
          subject_code
        )
      `
      )
      .in("student_id", studentIds);

    if (years.length === 1) gradesQuery = gradesQuery.eq("school_year", years[0]);
    else if (years.length > 1) gradesQuery = gradesQuery.in("school_year", years);

    if (quarters.length === 1) gradesQuery = gradesQuery.eq("quarter", quarters[0]);
    else if (quarters.length > 1) gradesQuery = gradesQuery.in("quarter", quarters);

    const gradesResult = await gradesQuery;
    if (gradesResult.error) {
      return { data: null, error: gradesResult.error };
    }
    grades = gradesResult.data ?? [];
  }

  let monitoringRecords = [];
  if (studentIds.length) {
    let monitoringQuery = supabase
      .from("monitoring_records")
      .select(MONITORING_RECORD_SELECT)
      .in("student_id", studentIds)
      .in("class_id", classIds)
      .order("observation_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (years.length === 1) {
      monitoringQuery = monitoringQuery.eq("school_year", years[0]);
    } else if (years.length > 1) {
      monitoringQuery = monitoringQuery.in("school_year", years);
    }

    const monitoringResult = await monitoringQuery;
    // Table may not exist yet during first deploy; surface clearly.
    if (monitoringResult.error) {
      const message = monitoringResult.error.message || "";
      if (!/monitoring_records|does not exist|schema cache/i.test(message)) {
        return { data: null, error: monitoringResult.error };
      }
      monitoringRecords = [];
    } else {
      monitoringRecords = monitoringResult.data ?? [];
    }
  }

  let philIriRecords = [];
  if (studentIds.length) {
    try {
      let philIriQuery = supabase
        .from("phil_iri_baseline_records")
        .select("*")
        .in("student_id", studentIds);

      if (years.length === 1) philIriQuery = philIriQuery.eq("school_year", years[0]);
      else if (years.length > 1) philIriQuery = philIriQuery.in("school_year", years);

      const philIriRes = await philIriQuery;
      if (!philIriRes.error) {
        philIriRecords = philIriRes.data ?? [];
      }
    } catch {
      philIriRecords = [];
    }
  }

  let attendanceRecords = [];
  if (studentIds.length) {
    try {
      let attQuery = supabase
        .from("attendance_records")
        .select("student_id, present_days, school_days, absent_days, school_year")
        .in("student_id", studentIds);

      if (years.length === 1) attQuery = attQuery.eq("school_year", years[0]);

      const attRes = await attQuery;
      if (!attRes.error) {
        attendanceRecords = attRes.data ?? [];
      }
    } catch {
      attendanceRecords = [];
    }
  }

  let sectionClasses = [];
  const sectionIds = [
    ...new Set(
      (enrollments ?? [])
        .map((row) => row.students?.section_id)
        .filter(Boolean)
    ),
  ];
  if (sectionIds.length) {
    try {
      let secClsQuery = supabase
        .from("classes")
        .select(`
          id,
          section_id,
          school_year,
          quarter,
          subject_id,
          subjects (
            id,
            subject_name,
            subject_code
          )
        `)
        .in("section_id", sectionIds);

      if (years.length === 1) secClsQuery = secClsQuery.eq("school_year", years[0]);
      else if (years.length > 1) secClsQuery = secClsQuery.in("school_year", years);

      const secClsRes = await secClsQuery;
      if (!secClsRes.error) {
        sectionClasses = secClsRes.data ?? [];
      }
    } catch {
      sectionClasses = [];
    }
  }

  return {
    data: {
      classes,
      enrollments: enrollments ?? [],
      grades,
      monitoringRecords,
      philIriRecords,
      attendanceRecords,
      sectionClasses,
    },
    error: null,
  };
}

export async function getStudentMonitoringDetail({
  classId,
  studentId,
  teacherId = null,
}) {
  if (!classId || !studentId) {
    return {
      data: null,
      error: new Error("Class id and student id are required."),
    };
  }

  const supabase = await ensureAuthSession();

  let classQuery = supabase
    .from("classes")
    .select(
      `
      id,
      school_year,
      quarter,
      subject_id,
      section_id,
      teacher_id,
      subjects (
        id,
        subject_name,
        subject_code
      ),
      sections (
        id,
        section_name,
        grade_level,
        school_year,
        adviser_id,
        adviser:teachers!adviser_id (
          id,
          first_name,
          middle_name,
          last_name
        )
      ),
      teachers (
        id,
        first_name,
        middle_name,
        last_name
      )
    `
    )
    .eq("id", classId);

  if (teacherId) classQuery = classQuery.eq("teacher_id", teacherId);

  const { data: classRow, error: classError } = await classQuery.maybeSingle();
  if (classError) return { data: null, error: classError };
  if (!classRow) {
    return {
      data: null,
      error: new Error(
        teacherId
          ? "Class not found or not assigned to you."
          : "Class not found."
      ),
    };
  }

  const { data: enrollment, error: enrollmentError } = await supabase
    .from("class_students")
    .select(
      `
      id,
      class_id,
      student_id,
      students (
        id,
        student_number,
        first_name,
        middle_name,
        last_name,
        sex,
        section_id,
        status
      )
    `
    )
    .eq("class_id", classId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (enrollmentError) return { data: null, error: enrollmentError };
  if (!enrollment?.students) {
    return {
      data: null,
      error: new Error("Student is not enrolled in this class."),
    };
  }

  const { data: grades, error: gradesError } = await supabase
    .from("grades")
    .select(
      `
      id,
      student_id,
      class_id,
      subject_id,
      quarter,
      final_grade,
      school_year,
      subjects (
        id,
        subject_name,
        subject_code
      )
    `
    )
    .eq("student_id", studentId)
    .eq("school_year", classRow.school_year)
    .eq("quarter", classRow.quarter);

  if (gradesError) return { data: null, error: gradesError };

  const { data: records, error: recordsError } = await supabase
    .from("monitoring_records")
    .select(MONITORING_RECORD_SELECT)
    .eq("student_id", studentId)
    .eq("class_id", classId)
    .order("observation_date", { ascending: false })
    .order("created_at", { ascending: false });

  let monitoringRecords = [];
  if (recordsError) {
    const message = recordsError.message || "";
    if (!/monitoring_records|does not exist|schema cache/i.test(message)) {
      return { data: null, error: recordsError };
    }
  } else {
    monitoringRecords = records ?? [];
  }

  let philIriRecords = [];
  try {
    const { data: pData } = await supabase
      .from("phil_iri_baseline_records")
      .select("*")
      .eq("student_id", studentId);
    philIriRecords = pData ?? [];
  } catch {
    philIriRecords = [];
  }
  const philIriRecord = philIriRecords[0] ?? null;

  let attendanceRecords = [];
  try {
    const { data: aData } = await supabase
      .from("attendance_records")
      .select("*")
      .eq("student_id", studentId)
      .order("school_year", { ascending: false });
    attendanceRecords = aData ?? [];
  } catch {
    attendanceRecords = [];
  }

  return {
    data: {
      classRow,
      student: unwrap(enrollment.students),
      grades: grades ?? [],
      monitoringRecords,
      philIriRecord,
      philIriRecords,
      attendanceRecords,
    },
    error: null,
  };
}

export async function getMonitoringRecordsForStudent({
  studentId,
  classId = null,
} = {}) {
  if (!studentId) {
    return { data: [], error: new Error("Student id is required.") };
  }

  const supabase = await ensureAuthSession();
  let query = supabase
    .from("monitoring_records")
    .select(MONITORING_RECORD_SELECT)
    .eq("student_id", studentId)
    .order("observation_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (classId) query = query.eq("class_id", classId);

  const { data, error } = await query;
  if (error) {
    const message = error.message || "";
    if (/monitoring_records|does not exist|schema cache/i.test(message)) {
      return { data: [], error: null };
    }
  }
  return { data: data ?? [], error };
}

/**
 * Batch-fetch monitoring records for facilitator ARAL weekly exports.
 * @param {{ studentIds?: string[], classIds?: string[] }} options
 */
export async function listMonitoringRecordsForStudents({
  studentIds = [],
  classIds = [],
  includeAssessmentPeriod = false,
} = {}) {
  const ids = [...new Set((studentIds ?? []).filter(Boolean))];
  const classes = [...new Set((classIds ?? []).filter(Boolean))];
  if (!ids.length) return { data: [], error: null };

  const supabase = await ensureAuthSession();
  let query = supabase
    .from("monitoring_records")
    .select(includeAssessmentPeriod ? `${MONITORING_RECORD_SELECT}, assessment_period` : MONITORING_RECORD_SELECT)
    .in("student_id", ids)
    .order("observation_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (classes.length) query = query.in("class_id", classes);

  const { data, error } = await query;
  if (error) {
    if (includeAssessmentPeriod) return { data: [], error: philIriSaveError(error) };
    const message = error.message || "";
    if (/monitoring_records|does not exist|schema cache/i.test(message)) {
      return { data: [], error: null };
    }
    return { data: [], error };
  }
  return { data: data ?? [], error: null };
}

export async function createMonitoringRecord(payload) {
  if (payload.assessment_period !== undefined && !normalizeAralPeriod(payload.assessment_period)) {
    return { data: null, error: new Error("Choose BOSY, MOSY, or EOSY for reading progress.") };
  }
  const supabase = await ensureAuthSession();

  let teacherId = payload.teacher_id;
  if (!teacherId) {
    const sessionRes = await getCurrentTeacherSession();
    teacherId =
      sessionRes?.data?.teacherId ||
      sessionRes?.data?.teacher?.id ||
      sessionRes?.teacherId ||
      sessionRes?.teacher?.id ||
      null;
  }

  if (!teacherId) {
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user?.id) {
      const { data: t } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (t?.id) teacherId = t.id;
    }
  }

  let classId = payload.class_id;
  if (!teacherId && classId) {
    const { data: cls } = await supabase
      .from("classes")
      .select("teacher_id")
      .eq("id", classId)
      .maybeSingle();
    if (cls?.teacher_id) teacherId = cls.teacher_id;
  }

  let studentId = payload.student_id;
  if (studentId && typeof studentId === "string" && studentId.startsWith("agg:")) {
    const parts = studentId.split(":");
    const uuidPart = parts.find((p) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p)
    );
    if (uuidPart) studentId = uuidPart;
  }

  if (!classId && studentId && teacherId) {
    const { data: cs } = await supabase
      .from("class_students")
      .select("class_id, classes!inner(teacher_id)")
      .eq("student_id", studentId)
      .eq("classes.teacher_id", teacherId)
      .limit(1)
      .maybeSingle();
    if (cs?.class_id) classId = cs.class_id;
  }

  if (!teacherId) {
    const err = new Error("Teacher identification is required to save monitoring observations.");
    console.error("createMonitoringRecord error: teacher_id could not be resolved.");
    return { data: null, error: err };
  }

  if (!studentId) {
    const err = new Error("Student identification is required to save monitoring observations.");
    console.error("createMonitoringRecord error: student_id could not be resolved.");
    return { data: null, error: err };
  }

  if (!classId) {
    const err = new Error("Class assignment is required to save monitoring observations.");
    console.error("createMonitoringRecord error: class_id could not be resolved.");
    return { data: null, error: err };
  }

  // Ensure DB check constraint compliance:
  // Allowed statuses: 'Ongoing', 'Improved', 'Needs Follow-up', 'Completed', 'Needs Further Support', 'For Further Monitoring'
  let dbMonitoringStatus = payload.monitoring_status || "Ongoing";
  if (dbMonitoringStatus === "Active") {
    dbMonitoringStatus = "Ongoing";
  }

  const rawQuarter = payload.quarter;
  const quarterNum =
    parseTermNumber(rawQuarter) ??
    (Number.isFinite(Number(rawQuarter)) ? Number(rawQuarter) : 1);

  const row = {
    ...(payload.assessment_period ? { assessment_period: normalizeAralPeriod(payload.assessment_period) } : {}),
    student_id: studentId,
    class_id: classId,
    teacher_id: teacherId,
    observation_date: payload.observation_date,
    intervention_given: payload.intervention_given?.trim() || null,
    teacher_remarks: payload.teacher_remarks?.trim() || null,
    student_progress: payload.student_progress?.trim() || null,
    follow_up_needed: Boolean(payload.follow_up_needed),
    monitoring_status: dbMonitoringStatus,
    school_year: payload.school_year,
    quarter: quarterNum,
    ...(payload.week_number != null
      ? { week_number: Number(payload.week_number) }
      : {}),
    ...(payload.session_status !== undefined
      ? { session_status: payload.session_status || null }
      : {}),
    ...(payload.session_days !== undefined
      ? { session_days: payload.session_days || null }
      : {}),
    ...(payload.skill_focus !== undefined
      ? { skill_focus: payload.skill_focus || null }
      : {}),
    ...(payload.topic !== undefined ? { topic: payload.topic?.trim() || null } : {}),
    ...(payload.activity !== undefined
      ? { activity: payload.activity?.trim() || null }
      : {}),
    ...(payload.progress_evaluation !== undefined
      ? { progress_evaluation: payload.progress_evaluation || null }
      : {}),
    ...(payload.next_action !== undefined
      ? { next_action: payload.next_action || null }
      : {}),
    ...(payload.evaluated_by !== undefined
      ? { evaluated_by: payload.evaluated_by || null }
      : {}),
    ...(payload.evaluated_at !== undefined
      ? { evaluated_at: payload.evaluated_at || null }
      : {}),
  };

  const { data, error } = await supabase
    .from("monitoring_records")
    .insert(row)
    .select(MONITORING_RECORD_SELECT)
    .single();

  if (error) {
    console.error("createMonitoringRecord error:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
  } else {
    invalidateTtlCache("teacher:");
    if (data?.id) await notifyMonitoringRecord(data);
  }

  return { data, error };
}

export async function updateMonitoringRecord(id, updates) {
  if (!id) {
    return { data: null, error: new Error("Monitoring record id is required.") };
  }

  const supabase = await ensureAuthSession();
  let dbMonitoringStatus = updates.monitoring_status;
  if (dbMonitoringStatus === "Active") {
    dbMonitoringStatus = "Ongoing";
  }

  const payload = {
    ...(updates.observation_date
      ? { observation_date: updates.observation_date }
      : {}),
    ...(updates.intervention_given !== undefined
      ? { intervention_given: updates.intervention_given?.trim() || null }
      : {}),
    ...(updates.teacher_remarks !== undefined
      ? { teacher_remarks: updates.teacher_remarks?.trim() || null }
      : {}),
    ...(updates.student_progress !== undefined
      ? { student_progress: updates.student_progress?.trim() || null }
      : {}),
    ...(updates.follow_up_needed !== undefined
      ? { follow_up_needed: Boolean(updates.follow_up_needed) }
      : {}),
    ...(dbMonitoringStatus
      ? { monitoring_status: dbMonitoringStatus }
      : {}),
    ...(updates.week_number !== undefined
      ? { week_number: updates.week_number == null ? null : Number(updates.week_number) }
      : {}),
    ...(updates.session_status !== undefined
      ? { session_status: updates.session_status || null }
      : {}),
    ...(updates.session_days !== undefined
      ? { session_days: updates.session_days || null }
      : {}),
    ...(updates.skill_focus !== undefined
      ? { skill_focus: updates.skill_focus || null }
      : {}),
    ...(updates.topic !== undefined ? { topic: updates.topic?.trim() || null } : {}),
    ...(updates.activity !== undefined
      ? { activity: updates.activity?.trim() || null }
      : {}),
    ...(updates.progress_evaluation !== undefined
      ? { progress_evaluation: updates.progress_evaluation || null }
      : {}),
    ...(updates.next_action !== undefined
      ? { next_action: updates.next_action || null }
      : {}),
    ...(updates.evaluated_by !== undefined
      ? { evaluated_by: updates.evaluated_by || null }
      : {}),
    ...(updates.evaluated_at !== undefined
      ? { evaluated_at: updates.evaluated_at || null }
      : {}),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("monitoring_records")
    .update(payload)
    .eq("id", id)
    .select(MONITORING_RECORD_SELECT)
    .single();

  if (!error) {
    invalidateTtlCache("teacher:");
    if (data?.id) await notifyMonitoringRecord(data);
  }

  return { data, error };
}

/**
 * Canonical updater/inserter that reuses existing monitoring record for the learner,
 * subject class, school year, and quarter to avoid duplicate records.
 */
export async function saveOrUpdateCanonicalMonitoringRecord(rawPayload = {}) {
  const supabase = await ensureAuthSession();

  let studentId = rawPayload.student_id || rawPayload.studentId;
  if (studentId && typeof studentId === "string" && studentId.startsWith("agg:")) {
    const parts = studentId.split(":");
    const uuidPart = parts.find((p) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p)
    );
    if (uuidPart) studentId = uuidPart;
  }

  const classId = rawPayload.class_id || rawPayload.classId;
  const teacherId = rawPayload.teacher_id || rawPayload.teacherId;
  const schoolYear = rawPayload.school_year || rawPayload.schoolYear;
  const rawQuarter = rawPayload.quarter ?? rawPayload.quarterNumber;
  const quarterNum =
    parseTermNumber(rawQuarter) ??
    (Number.isFinite(Number(rawQuarter)) ? Number(rawQuarter) : 1);

  const observationDate =
    rawPayload.observation_date ||
    rawPayload.observationDate ||
    new Date().toISOString().split("T")[0];

  const interventionGiven =
    rawPayload.intervention_given || rawPayload.interventionGiven || null;

  const teacherRemarks =
    rawPayload.teacher_remarks || rawPayload.teacherRemarks || null;

  const studentProgress =
    rawPayload.student_progress || rawPayload.studentProgress || "Ongoing";

  const monitoringStatus =
    rawPayload.monitoring_status || rawPayload.monitoringStatus || "Ongoing";

  const followUpNeeded = Boolean(
    rawPayload.follow_up_needed ?? rawPayload.followUpNeeded ?? false
  );

  const normalized = {
    ...rawPayload,
    student_id: studentId,
    class_id: classId,
    teacher_id: teacherId,
    school_year: schoolYear,
    quarter: quarterNum,
    observation_date: observationDate,
    intervention_given: interventionGiven?.trim() || null,
    teacher_remarks: teacherRemarks?.trim() || null,
    student_progress: studentProgress?.trim() || null,
    monitoring_status: monitoringStatus,
    follow_up_needed: followUpNeeded,
  };

  let existingId = rawPayload.id || rawPayload.monitoring_record_id || null;

  if (!existingId && studentId && classId) {
    let query = supabase
      .from("monitoring_records")
      .select("id")
      .eq("student_id", studentId)
      .eq("class_id", classId);

    if (schoolYear) {
      query = query.eq("school_year", schoolYear);
    }
    if (quarterNum) {
      query = query.eq("quarter", quarterNum);
    }

    const { data: existing } = await query
      .order("observation_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      existingId = existing.id;
    }
  }

  if (existingId) {
    return updateMonitoringRecord(existingId, normalized);
  }

  return createMonitoringRecord(normalized);
}

export async function submitInitialScreeningValidation({
  monitoringRecordId,
  philIriScore,
  crlaScore,
  hasParentalConsent
}) {
  if (!monitoringRecordId) {
    return { data: null, error: new Error("Monitoring record id is required.") };
  }

  const supabase = await ensureAuthSession();
  const payload = {
    phil_iri_score: philIriScore != null ? Number(philIriScore) : null,
    crla_score: crlaScore != null ? Number(crlaScore) : null,
    has_parental_consent: Boolean(hasParentalConsent),
    monitoring_status: "Ongoing",
    updated_at: new Date().toISOString(),
  };

  let { data, error } = await supabase
    .from("monitoring_records")
    .update(payload)
    .eq("id", monitoringRecordId)
    .select(MONITORING_RECORD_SELECT)
    .single();

  if (
    error &&
    /column.*does not exist|phil_iri_score|crla_score|has_parental_consent/i.test(
      error.message || ""
    )
  ) {
    const fallbackPayload = {
      monitoring_status: "Ongoing",
      teacher_remarks: `[Screening] Phil-IRI: ${philIriScore ?? "N/A"}, CRLA: ${
        crlaScore ?? "N/A"
      }, Consent: ${hasParentalConsent ? "Yes" : "No"}`,
      updated_at: new Date().toISOString(),
    };
    const retry = await supabase
      .from("monitoring_records")
      .update(fallbackPayload)
      .eq("id", monitoringRecordId)
      .select(MONITORING_RECORD_SELECT)
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (!error && data?.id) await notifyMonitoringRecord(data);

  return { data, error };
}

export async function resolveClassRemedial({
  monitoringRecordId,
  studentId,
  classId,
  strategy = "Targeted Remedial Tasks",
  notes = "",
}) {
  const supabase = await ensureAuthSession();
  const session = await resolveTeacherSessionForMonitoring();
  const teacherId = session.data?.teacherId ?? null;

  const payload = {
    monitoring_status: "Completed",
    intervention_given: strategy,
    next_action: "Complete Intervention",
    progress_evaluation: "Improving",
    teacher_remarks: notes || `Resolved via ${strategy}`,
    evaluated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (monitoringRecordId) {
    const { data, error } = await supabase
      .from("monitoring_records")
      .update(payload)
      .eq("id", monitoringRecordId)
      .select(MONITORING_RECORD_SELECT)
      .single();
    if (!error && data?.id) await notifyMonitoringRecord(data);
    return { data, error };
  } else if (studentId && classId && teacherId) {
    const { data, error } = await supabase
      .from("monitoring_records")
      .insert({
        student_id: studentId,
        class_id: classId,
        teacher_id: teacherId,
        school_year: "SY 2026-2027",
        quarter: 1,
        ...payload,
      })
      .select(MONITORING_RECORD_SELECT)
      .single();
    if (!error && data?.id) await notifyMonitoringRecord(data);
    return { data, error };
  }

  return { data: null, error: new Error("Monitoring record or student/class context required.") };
}

export async function routeEosyPostAssessment({
  monitoringRecordId,
  studentId,
  outcome,
  score = null,
}) {
  const supabase = await ensureAuthSession();
  const isProficient = outcome === "proficient";

  const payload = {
    monitoring_status: isProficient ? "Completed" : "Needs Further Support",
    next_action: isProficient ? "Complete Intervention" : "Summer Remedial Referral",
    progress_evaluation: isProficient ? "Improving" : "Requires Further Support",
    student_progress: isProficient
      ? "Proficient — Passed EOSY Post-Assessment"
      : "Deficient — Referred to Summer Program",
    updated_at: new Date().toISOString(),
  };

  let recordData = null;
  if (monitoringRecordId) {
    const { data, error } = await supabase
      .from("monitoring_records")
      .update(payload)
      .eq("id", monitoringRecordId)
      .select(MONITORING_RECORD_SELECT)
      .single();
    if (error) return { data: null, error };
    recordData = data;
    if (data?.id) await notifyMonitoringRecord(data);
  }

  try {
    if (studentId) {
      await supabase
        .from("learner_intervention_history")
        .update({
          intervention_status: isProficient ? "Completed" : "Needs Further Support",
          current_status: isProficient ? "Completed / Exited" : "Escalated",
          movement_outcome: isProficient ? "Promoted" : "Needs Further Intervention",
          end_assessment_score: score != null ? Number(score) : (isProficient ? 80 : 65),
          updated_at: new Date().toISOString(),
        })
        .eq("student_id", studentId);
    }
  } catch {}

  return { data: recordData, error: null };
}

/**
 * Admin roster: all classes / students with grades + latest monitoring.
 */
export async function getAdminMonitoringRoster({
  schoolYear = null,
  quarter = null,
  gradeLevel = null,
  sectionName = null,
} = {}) {
  const supabase = await ensureAuthSession();

  let classesQuery = supabase.from("classes").select(
    `
    id,
    school_year,
    quarter,
    subject_id,
    section_id,
    teacher_id,
    subjects (
      id,
      subject_name,
      subject_code
    ),
    sections (
      id,
      section_name,
      grade_level,
      school_year,
      adviser_id,
      adviser:teachers!adviser_id (
        id,
        first_name,
        middle_name,
        last_name
      )
    ),
    teachers (
      id,
      first_name,
      middle_name,
      last_name
    )
  `
  );

  if (schoolYear) classesQuery = classesQuery.eq("school_year", schoolYear);
  if (quarter !== null && quarter !== undefined && quarter !== "") {
    classesQuery = classesQuery.eq("quarter", Number(quarter));
  }

  const { data: classes, error: classesError } = await classesQuery;
  if (classesError) return { data: null, error: classesError };

  let filteredClasses = classes ?? [];
  if (gradeLevel !== null && gradeLevel !== undefined && gradeLevel !== "") {
    filteredClasses = filteredClasses.filter(
      (row) => Number(unwrap(row.sections)?.grade_level) === Number(gradeLevel)
    );
  }
  if (sectionName) {
    filteredClasses = filteredClasses.filter(
      (row) => unwrap(row.sections)?.section_name === sectionName
    );
  }

  if (!filteredClasses.length) {
    return {
      data: { classes: [], enrollments: [], grades: [], monitoringRecords: [] },
      error: null,
    };
  }

  const classIds = filteredClasses.map((row) => row.id);

  const { data: enrollments, error: enrollmentError } = await selectInChunks(
    (chunk) =>
      supabase
        .from("class_students")
        .select(
          `
      id,
      class_id,
      student_id,
      created_at,
      students (
        id,
        student_number,
        first_name,
        middle_name,
        last_name,
        sex,
        section_id,
        status
      )
    `
        )
        .in("class_id", chunk),
    classIds
  );

  if (enrollmentError) return { data: null, error: enrollmentError };

  // Scope grades + monitoring to these class offerings (not every grade the
  // student ever earned). Cuts payload size and avoids huge student_id filters.
  let grades = [];
  if (classIds.length) {
    const gradesResult = await selectInChunks(
      (chunk) => {
        let gradesQuery = supabase
          .from("grades")
          .select(
            `
        id,
        student_id,
        class_id,
        subject_id,
        quarter,
        final_grade,
        school_year,
        updated_at,
        created_at,
        subjects (
          id,
          subject_name,
          subject_code
        )
      `
          )
          .in("class_id", chunk);

        if (schoolYear) gradesQuery = gradesQuery.eq("school_year", schoolYear);
        if (quarter !== null && quarter !== undefined && quarter !== "") {
          gradesQuery = gradesQuery.eq("quarter", Number(quarter));
        }
        return gradesQuery;
      },
      classIds
    );
    if (gradesResult.error) return { data: null, error: gradesResult.error };
    grades = gradesResult.data ?? [];
  }

  let monitoringRecords = [];
  if (classIds.length) {
    const monitoringResult = await selectInChunks(
      (chunk) => {
        let monitoringQuery = supabase
          .from("monitoring_records")
          .select(MONITORING_RECORD_SELECT)
          .in("class_id", chunk)
          .order("observation_date", { ascending: false });

        if (schoolYear) {
          monitoringQuery = monitoringQuery.eq("school_year", schoolYear);
        }
        if (quarter !== null && quarter !== undefined && quarter !== "") {
          monitoringQuery = monitoringQuery.eq("quarter", Number(quarter));
        }
        return monitoringQuery;
      },
      classIds
    );

    if (monitoringResult.error) {
      const message = monitoringResult.error.message || "";
      if (!/monitoring_records|does not exist|schema cache/i.test(message)) {
        return { data: null, error: monitoringResult.error };
      }
    } else {
      monitoringRecords = monitoringResult.data ?? [];
    }
  }

  const studentIds = [
    ...new Set(
      (enrollments ?? [])
        .map((row) => unwrap(row.students)?.id || row.student_id)
        .filter(Boolean)
    ),
  ];

  let philIriRecords = [];
  if (studentIds.length) {
    try {
      const philIriResult = await selectInChunks(
        (chunk) => {
          let q = supabase
            .from("phil_iri_baseline_records")
            .select(
              `
              *,
              teacher:teachers (
                id,
                first_name,
                middle_name,
                last_name
              )
            `
            )
            .in("student_id", chunk);
          if (schoolYear) {
            q = q.eq("school_year", schoolYear);
          }
          return q;
        },
        studentIds
      );

      if (!philIriResult.error) {
        philIriRecords = philIriResult.data ?? [];
      } else {
        const fallbackRes = await selectInChunks(
          (chunk) => {
            let q = supabase
              .from("phil_iri_baseline_records")
              .select("*")
              .in("student_id", chunk);
            if (schoolYear) {
              q = q.eq("school_year", schoolYear);
            }
            return q;
          },
          studentIds
        );
        if (!fallbackRes.error) {
          philIriRecords = fallbackRes.data ?? [];
        }
      }
    } catch (err) {
      console.warn(
        "[getAdminMonitoringRoster] phil_iri_baseline_records query error:",
        err
      );
      philIriRecords = [];
    }
  }

  return {
    data: {
      classes: filteredClasses,
      enrollments: enrollments ?? [],
      grades,
      monitoringRecords,
      philIriRecords,
    },
    error: null,
  };
}

export async function resolveTeacherSessionForMonitoring() {
  return getCurrentTeacherSession();
}

/**
 * Normalizes screening interpretation strings to valid database check constraint values.
 */
export function normalizeScreeningInterpretation(val) {
  if (!val) return "No data";
  const s = String(val).trim().toLowerCase();
  if (
    s.includes("no further") ||
    s.includes("no phil-iri") ||
    s.includes("at grade") ||
    s.includes("not required")
  ) {
    return "No further individualized assessment from GST";
  }
  if (s.includes("3") || s.includes("three")) {
    return "Individualized Assessment (Starting point: 3 grade levels below)";
  }
  if (s.includes("2") || s.includes("two")) {
    return "Individualized Assessment (Starting point: 2 grade levels below)";
  }
  const validDbValues = [
    "3 levels lower Phil-IRI testing",
    "2 levels lower Phil-IRI testing",
    "No Phil-IRI test required",
    "Individualized Assessment (Starting point: 3 grade levels below)",
    "Individualized Assessment (Starting point: 2 grade levels below)",
    "No further individualized assessment from GST",
    "No data",
  ];
  if (validDbValues.includes(val)) return val;
  return "Individualized Assessment (Starting point: 2 grade levels below)";
}

/** Persist explicitly imported screening results in the selected reading period. */
export async function savePhilIriBaselineRecords({ records = [], teacherId = null, schoolYear = "SY 2026-2027",
  quarter = 1, assessmentPeriod, correctionReason = "", supabaseClient = null } = {}) {
  if (!normalizeAralPeriod(assessmentPeriod)) return { data: null, error: new Error("Choose BOSY, MOSY, or EOSY before importing.") };
  try {
    const matched = records.filter((record) => record.isMatched && record.studentId);
    if (!matched.length) return { data: { saved: 0 }, error: null };
    const supabase = supabaseClient || await ensureAuthSession();
    const payloads = await Promise.all(matched.map(async (record) => {
      const input = { ...record, teacherId, schoolYear, quarter, assessmentPeriod,
        subject: String(record.subject || "English").toLowerCase().includes("fil") ? "Filipino" : "English",
        gstScore: record.totalScore, screeningOnly: !record.iraMetrics,
        correctionReason: record.correctionReason || correctionReason };
      const payload = buildPhilIriPayload(input, await readExistingPhilIri(supabase, input));
      return { ...payload, literal_score: record.literalScore ?? null, inferential_score: record.inferentialScore ?? null,
        critical_score: record.criticalScore ?? null, matched_by: record.matchType || "student_id" };
    }));
    const { error } = await supabase.from("phil_iri_baseline_records").upsert(payloads, {
      onConflict: "student_id,school_year,subject,assessment_period",
    });
    if (error) throw philIriSaveError(error);
    invalidateTtlCache("teacher:");
    invalidateTtlCache("admin:");
    return { data: { saved: payloads.length }, error: null };
  } catch (error) { return { data: null, error: philIriSaveError(error) }; }
}

/**
 * Read saved evidence for one learner, language, year and reading period.
 * Read errors must stop a save so existing records cannot be mistaken for new results.
 */
async function readExistingPhilIri(supabase, input) {
  const { data, error } = await supabase.from("phil_iri_baseline_records").select("*")
    .eq("student_id", input.studentId).eq("school_year", input.schoolYear)
    .eq("subject", input.subject).eq("assessment_period", normalizeAralPeriod(input.assessmentPeriod)).maybeSingle();
  if (error) throw philIriSaveError(error);
  return data;
}

/** Explicit batch screening save; never synchronizes assessment data into intervention progress. */
export async function saveBatchClassGstScores({ classId, teacherId = null, schoolYear = "SY 2026-2027",
  quarter = 1, assessmentPeriod, subject = "English", scores = [], correctionReason = "", supabaseClient = null } = {}) {
  if (!normalizeAralPeriod(assessmentPeriod)) return { data: null, error: new Error("Choose BOSY, MOSY, or EOSY.") };
  try {
    const rows = scores.filter((row) => row.isAbsent || (row.gstScore != null && String(row.gstScore).trim() !== ""));
    if (!rows.length) return { data: { count: 0 }, error: null };
    const supabase = supabaseClient || await ensureAuthSession();
    const payloads = await Promise.all(rows.map(async (row) => {
      const input = { ...row, classId: row.classId || classId, teacherId, schoolYear, quarter, assessmentPeriod,
        subject: String(row.subject || subject).toLowerCase().includes("fil") ? "Filipino" : "English",
        correctionReason: row.correctionReason || correctionReason, screeningOnly: true };
      return buildPhilIriPayload(input, await readExistingPhilIri(supabase, input));
    }));
    const { error } = await supabase.from("phil_iri_baseline_records").upsert(payloads, {
      onConflict: "student_id,school_year,subject,assessment_period",
    });
    if (error) throw philIriSaveError(error);
    // Reading results remain independent of academic monitoring and weekly intervention records.
    invalidateTtlCache("teacher:");
    invalidateTtlCache("admin:");
    return { data: { count: payloads.length }, error: null };
  } catch (error) { return { data: null, error: philIriSaveError(error) }; }
}

/**
 * Fetch Phil-IRI baseline records for a list of students
 */
export async function getPhilIriBaselineForStudents(studentIds = [], schoolYear = null) {
  if (!studentIds.length) return { data: [], error: null };
  const supabase = await ensureAuthSession();

  try {
    let query = supabase
      .from("phil_iri_baseline_records")
      .select("*")
      .in("student_id", studentIds);

    if (schoolYear) {
      query = query.eq("school_year", schoolYear);
    }

    const { data, error } = await query;
    if (error) {
      // If table doesn't exist yet, return empty
      return { data: [], error: null };
    }
    return { data: data || [], error: null };
  } catch {
    return { data: [], error: null };
  }
}

/**
 * Refer learner to ARAL from Academic Monitoring triage
 */
export async function referLearnerToAral({
  studentId,
  classId = null,
  monitoringRecordId = null,
  notes = "Referred to ARAL based on Phil-IRI baseline screening and class performance.",
} = {}) {
  const supabase = await ensureAuthSession();
  const session = await resolveTeacherSessionForMonitoring();
  const teacherId = session.data?.teacherId ?? null;

  const payload = {
    monitoring_status: "Referred to ARAL",
    next_action: "ARAL Assignment by Principal",
    teacher_remarks: notes,
    updated_at: new Date().toISOString(),
  };

  if (monitoringRecordId) {
    await supabase
      .from("monitoring_records")
      .update(payload)
      .eq("id", monitoringRecordId);
  } else if (studentId && classId) {
    await supabase
      .from("monitoring_records")
      .update(payload)
      .match({ student_id: studentId, class_id: classId });
  }

  // Also update candidate_status in phil_iri_baseline_records if exists
  try {
    await supabase
      .from("phil_iri_baseline_records")
      .update({ candidate_status: "Referred to ARAL", updated_at: new Date().toISOString() })
      .eq("student_id", studentId);
  } catch {}

  // Also record in learner_intervention_history if exists
  try {
    await supabase
      .from("learner_intervention_history")
      .update({
        intervention_pathway: "aral",
        intervention_status: "Qualified",
        principal_review_status: "Pending Review",
        updated_at: new Date().toISOString(),
      })
      .eq("student_id", studentId);
  } catch {}

  return { success: true, error: null };
}

/**
 * Persists an individual Phil-IRI assessment result entered manually.
 */
export async function saveSinglePhilIriResult({ studentId, classId = null, teacherId = null,
  schoolYear = "SY 2026-2027", quarter = 1, subject = "English", assessmentPeriod,
  gstScore = null, individualAssessmentRequired = false, readingLevel = "Not Assessed", documents,
  isAbsent = false, teacherReviewReason, iraMetrics = null, candidateStatusOverride = null,
  correctionReason = "", grade = null, supabaseClient = null } = {}) {
  if (!studentId || !normalizeAralPeriod(assessmentPeriod)) return {
    data: null, error: new Error("A learner and valid reading assessment period are required."),
  };
  try {
    const supabase = supabaseClient || await ensureAuthSession();
    const input = { studentId, classId, teacherId, schoolYear, quarter,
      subject: String(subject).toLowerCase().includes("fil") ? "Filipino" : "English",
      assessmentPeriod, gstScore, individualAssessmentRequired, readingLevel, documents,
      isAbsent, teacherReviewReason, iraMetrics, candidateStatusOverride, correctionReason, grade };
    const payload = buildPhilIriPayload(input, await readExistingPhilIri(supabase, input));
    const { error } = await supabase.from("phil_iri_baseline_records").upsert(payload, {
      onConflict: "student_id,school_year,subject,assessment_period",
    });
    if (error) throw philIriSaveError(error);
    invalidateTtlCache("teacher:");
    invalidateTtlCache("admin:");
    return { data: { success: true }, error: null };
  } catch (error) { return { data: null, error: philIriSaveError(error) }; }
}

/**
 * Record a concise chronological progress check for an active ARAL intervention.
 */
export async function saveAralProgressCheck({
  interventionId = null,
  studentId,
  teacherId = null,
  checkDate = new Date().toISOString().split("T")[0],
  activityName,
  result,
  competency,
  teacherObservation = "",
  nextAction = "",
}) {
  const supabase = await ensureAuthSession();
  const session = await resolveTeacherSessionForMonitoring();
  const activeTeacherId = teacherId || session.data?.teacherId || null;

  const { data, error } = await supabase
    .from("aral_progress_checks")
    .insert({
      intervention_id: interventionId || null,
      student_id: studentId,
      teacher_id: activeTeacherId,
      check_date: checkDate,
      activity_name: activityName,
      result: result,
      competency: competency,
      teacher_observation: teacherObservation,
      next_action: nextAction,
    })
    .select()
    .single();

  if (error) {
    console.error("Error saving ARAL progress check:", error);
    return { data: null, error };
  }

  // Update learner_intervention_history updated_at and status if needed
  try {
    await supabase
      .from("learner_intervention_history")
      .update({
        intervention_status: "Active Intervention",
        updated_at: new Date().toISOString(),
      })
      .eq("student_id", studentId);
  } catch {}

  return { data, error: null };
}

/**
 * Fetch chronological progress checks for a student.
 */
export async function listAralProgressChecks(studentId) {
  if (!studentId) return { data: [], error: null };
  const supabase = await ensureAuthSession();

  const { data, error } = await supabase
    .from("aral_progress_checks")
    .select(`
      id,
      intervention_id,
      student_id,
      teacher_id,
      check_date,
      activity_name,
      result,
      competency,
      teacher_observation,
      next_action,
      created_at,
      teacher:teachers (
        id,
        first_name,
        last_name
      )
    `)
    .eq("student_id", studentId)
    .order("check_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("listAralProgressChecks query notice:", error.message);
    return { data: [], error };
  }

  return { data: data || [], error: null };
}

/**
 * Update intervention status and target competency.
 */
export async function updateAralInterventionStatus({
  studentId,
  classId = null,
  status,
  targetCompetency = null,
  remarks = null,
}) {
  const supabase = await ensureAuthSession();
  const session = await resolveTeacherSessionForMonitoring();
  const teacherId = session.data?.teacherId || null;

  const historyPayload = {
    intervention_status: status,
    updated_at: new Date().toISOString(),
  };
  if (targetCompetency) historyPayload.target_competency = targetCompetency;
  if (remarks) historyPayload.remarks = remarks;

  try {
    await supabase
      .from("learner_intervention_history")
      .update(historyPayload)
      .eq("student_id", studentId);
  } catch {}

  try {
    const monitoringPayload = {
      intervention_status: status,
      next_action: status,
      updated_at: new Date().toISOString(),
    };
    if (remarks) monitoringPayload.teacher_remarks = remarks;

    if (classId) {
      await supabase
        .from("monitoring_records")
        .update(monitoringPayload)
        .match({ student_id: studentId, class_id: classId });
    } else {
      await supabase
        .from("monitoring_records")
        .update(monitoringPayload)
        .eq("student_id", studentId);
    }
  } catch {}

  return { success: true, error: null };
}

/**
 * Record Midline Assessment and Decision.
 * Rules:
 * Meets Expected Competency -> Enrichment / Exit ARAL (status: Completed)
 * Does Not Meet -> Continue ARAL (status: Active Intervention) or Refer to School Support
 */
export async function recordMidlineDecision({
  studentId,
  classId = null,
  score,
  result,
  decision,
  remarks = "",
  // Midline is the MOSY checkpoint. Reject saves tagged for other periods.
  assessmentPeriod = null,
}) {
  if (!studentId) {
    return { success: false, error: new Error("Student is required.") };
  }
  if (assessmentPeriod !== null && assessmentPeriod !== undefined && assessmentPeriod !== "") {
    const period = normalizeAralPeriod(assessmentPeriod);
    if (period && period !== "MOSY") {
      return {
        success: false,
        error: new Error(
          "Midline decisions can only be recorded during the Mid-Year Assessment (MOSY) period."
        ),
      };
    }
  }
  const supabase = await ensureAuthSession();
  const newStatus =
    decision === "Enrichment / Exit ARAL"
      ? "Completed"
      : decision === "Refer to School Support"
      ? "Referred"
      : "Active Intervention";

  try {
    await supabase
      .from("learner_intervention_history")
      .update({
        midline_assessment_score: Number(score) || null,
        midline_assessment_result: result,
        midline_decision: decision,
        midline_assessed_at: new Date().toISOString(),
        intervention_status: newStatus,
        remarks: remarks || null,
        updated_at: new Date().toISOString(),
      })
      .eq("student_id", studentId);
  } catch {}

  try {
    const monitoringPayload = {
      monitoring_status: newStatus,
      next_action: decision,
      teacher_remarks: remarks || `Midline: ${decision} (${result || score})`,
      updated_at: new Date().toISOString(),
    };

    if (classId) {
      await supabase
        .from("monitoring_records")
        .update(monitoringPayload)
        .match({ student_id: studentId, class_id: classId });
    } else {
      await supabase
        .from("monitoring_records")
        .update(monitoringPayload)
        .eq("student_id", studentId);
    }
  } catch {}

  return { success: true, error: null };
}

/**
 * Record EOSY Assessment and Decision.
 * Rules:
 * Meets Expected Competency -> Completed / Exit ARAL
 * Requires Additional Support -> ARAL Summer Referral
 */
export async function recordEosyDecision({
  studentId,
  classId = null,
  score,
  result,
  decision,
  summerReferralReason = "",
  remarks = "",
  // EOSY is the end-of-year checkpoint. Reject saves tagged for other periods.
  assessmentPeriod = null,
}) {
  if (!studentId) {
    return { success: false, error: new Error("Student is required.") };
  }
  if (assessmentPeriod !== null && assessmentPeriod !== undefined && assessmentPeriod !== "") {
    const period = normalizeAralPeriod(assessmentPeriod);
    if (period && period !== "EOSY") {
      return {
        success: false,
        error: new Error(
          "End-of-year decisions can only be recorded during the End-of-Year Assessment (EOSY) period."
        ),
      };
    }
  }
  const supabase = await ensureAuthSession();
  const isSummer = decision === "ARAL Summer Referral";
  const newStatus = isSummer ? "ARAL Summer Referral" : "Completed";

  try {
    await supabase
      .from("learner_intervention_history")
      .update({
        eosy_assessment_score: Number(score) || null,
        eosy_assessment_result: result,
        eosy_decision: decision,
        eosy_assessed_at: new Date().toISOString(),
        summer_referral_reason: isSummer ? summerReferralReason || "Needs further remediation in summer" : null,
        summer_status: isSummer ? "Referred" : null,
        intervention_status: newStatus,
        remarks: remarks || null,
        updated_at: new Date().toISOString(),
      })
      .eq("student_id", studentId);
  } catch {}

  try {
    const monitoringPayload = {
      monitoring_status: newStatus,
      next_action: decision,
      teacher_remarks: remarks || `EOSY: ${decision} (${result || score})`,
      updated_at: new Date().toISOString(),
    };

    if (classId) {
      await supabase
        .from("monitoring_records")
        .update(monitoringPayload)
        .match({ student_id: studentId, class_id: classId });
    } else {
      await supabase
        .from("monitoring_records")
        .update(monitoringPayload)
        .eq("student_id", studentId);
    }
  } catch {}

  return { success: true, error: null };
}

/**
 * Learners with a recent absent ARAL session (for rescheduling follow-up).
 * Returns a Set of student_ids. Read-only; single query.
 */
export async function listRecentAralAbsenceIds(studentIds = [], days = 30) {
  if (!Array.isArray(studentIds) || !studentIds.length) {
    return { data: new Set(), error: null };
  }
  const supabase = await ensureAuthSession();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  try {
    const { data, error } = await supabase
      .from("monitoring_records")
      .select("student_id")
      .in("student_id", studentIds)
      .eq("session_status", "absent")
      .gte("observation_date", cutoffDate);
    if (error) return { data: new Set(), error };
    return {
      data: new Set((data ?? []).map((row) => row.student_id).filter(Boolean)),
      error: null,
    };
  } catch (err) {
    return { data: new Set(), error: err };
  }
}

/**
 * Principal-Level ARAL Summer Registry.
 */
export async function listAralSummerRegistry(schoolYear = "SY 2026-2027") {
  const supabase = await ensureAuthSession();

  const { data, error } = await supabase
    .from("learner_intervention_history")
    .select(`
      id,
      student_id,
      class_id,
      teacher_id,
      school_year,
      learning_area,
      intervention_status,
      intervention_type,
      notes,
      beginning_assessment_score,
      reading_level_or_placement,
      target_competency,
      midline_assessment_score,
      midline_assessment_result,
      midline_decision,
      midline_assessed_at,
      eosy_assessment_score,
      eosy_assessment_result,
      eosy_decision,
      eosy_assessed_at,
      summer_referral_reason,
      summer_status,
      summer_teacher_id,
      summer_program_name,
      created_at,
      updated_at,
      student:students (
        id,
        first_name,
        last_name,
        lrn,
        student_number,
        gender,
        section:sections (
          id,
          section_name,
          grade_level
        )
      ),
      referring_teacher:teachers!teacher_id (
        id,
        first_name,
        last_name
      ),
      summer_teacher:teachers!summer_teacher_id (
        id,
        first_name,
        last_name
      )
    `)
    .or("summer_status.not.is.null,intervention_status.eq.ARAL Summer Referral,eosy_decision.eq.ARAL Summer Referral")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("listAralSummerRegistry fallback:", error.message);
    return { data: [], error };
  }

  const mapped = (data || []).map((row) => {
    const rawScore = row.beginning_assessment_score;
    const isHighRisk = rawScore != null ? rawScore < 16 : true;

    return {
      id: row.id,
      studentId: row.student_id,
      studentName: row.student ? `${row.student.last_name}, ${row.student.first_name}` : "Student",
      lrn: row.student?.lrn || row.student?.student_number || "—",
      gradeLevel: row.student?.section?.grade_level ? `Grade ${row.student.section.grade_level}` : "Grade —",
      sectionName: row.student?.section?.section_name || "Unassigned",
      gradeAndSection: row.student?.section
        ? `Grade ${row.student.section.grade_level} - ${row.student.section.section_name}`
        : "—",
      subject: row.learning_area || "Reading",
      learningArea: row.learning_area || "Reading",
      bosyLevel: row.reading_level_or_placement || (rawScore != null ? `Score ${rawScore}` : "Frustration"),
      initialAssessmentResult: rawScore != null ? `GST: ${rawScore}/40` : (row.reading_level_or_placement || "Frustration"),
      midlineResult: row.midline_assessment_result || (row.midline_assessment_score != null ? `Score ${row.midline_assessment_score}` : "—"),
      midlineScore: row.midline_assessment_score,
      midlineDecision: row.midline_decision || "Continue ARAL",
      eosyResult: row.eosy_assessment_result || (row.eosy_assessment_score != null ? `Score ${row.eosy_assessment_score}` : "Needs Support"),
      eosyScore: row.eosy_assessment_score,
      eosyDecision: row.eosy_decision || "ARAL Summer Referral",
      interventionHistory: row.target_competency ? `Target: ${row.target_competency}` : "ARAL Reading Intervention",
      reasonForReferral: row.summer_referral_reason || "Did not reach expected competency at EOSY",
      currentAralStatus: row.intervention_status || "ARAL Summer Referral",
      summerStatus: row.summer_status || "Referred",
      assignedSummerProgram: row.summer_program_name || "ARAL Summer Reading Camp",
      assignedTeacherId: row.summer_teacher_id || null,
      assignedTeacherName: row.summer_teacher
        ? `${row.summer_teacher.first_name} ${row.summer_teacher.last_name}`
        : "Unassigned",
      referringTeacherName: row.referring_teacher
        ? `${row.referring_teacher.first_name} ${row.referring_teacher.last_name}`
        : "Subject Teacher",
      referralDate: row.eosy_assessed_at || row.created_at || new Date().toISOString(),
      assignmentDate: row.summer_teacher_id ? row.updated_at : null,
      notes: row.notes || "",
      // Academic risk status from assessment evidence
      rfRiskLevel: isHighRisk ? "High" : "Moderate",
      rfConfidence: null,
      rfFactors: [
        "Phil-IRI screening score below Grade benchmark (Statutory ARAL Criterion)",
        "Quarterly reading progress check indicated continued support need",
      ],
    };
  });

  return { data: mapped, error: null };
}

/**
 * Principal updates summer placement & teacher assignment.
 * Maintains historical reassignment notes to prevent data loss.
 */
export async function updateAralSummerAssignment({
  recordId,
  summerTeacherId,
  summerProgramName = "ARAL Summer Reading Camp",
  summerStatus = "Assigned",
  reassignmentReason = null,
}) {
  const supabase = await ensureAuthSession();

  let updatedNotes = undefined;
  if (reassignmentReason) {
    const { data: existing } = await supabase
      .from("learner_intervention_history")
      .select("notes, summer_teacher_id")
      .eq("id", recordId)
      .maybeSingle();

    const timestamp = new Date().toISOString().slice(0, 10);
    const log = `\n[Reassigned on ${timestamp}]: ${reassignmentReason}`;
    updatedNotes = existing?.notes ? `${existing.notes}${log}` : log.trim();
  }

  const updatePayload = {
    summer_teacher_id: summerTeacherId || null,
    summer_program_name: summerProgramName,
    summer_status: summerStatus,
    updated_at: new Date().toISOString(),
  };

  if (updatedNotes !== undefined) {
    updatePayload.notes = updatedNotes;
  }

  const { data, error } = await supabase
    .from("learner_intervention_history")
    .update(updatePayload)
    .eq("id", recordId)
    .select()
    .single();

  if (error) {
    console.error("Error updating summer assignment:", error);
    return { data: null, error };
  }

  // Also sync aral_facilitator_assignments if summer teacher assigned
  if (data?.student_id && summerTeacherId) {
    try {
      const { data: batch } = await supabase
        .from("aral_program_batches")
        .select("id")
        .eq("school_year", data.school_year || "SY 2026-2027")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (batch?.id) {
        await supabase
          .from("aral_facilitator_assignments")
          .upsert(
            {
              batch_id: batch.id,
              student_id: data.student_id,
              facilitator_teacher_id: summerTeacherId,
              source_class_id: data.class_id || null,
              notes: `Assigned to ${summerProgramName}`,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "batch_id,student_id" }
          );
      }
    } catch (e) {
      console.warn("aral_facilitator_assignments sync non-fatal fallback:", e);
    }
  }

  return { data, error: null };
}

/**
 * Routes a reading concern flagged by a non-language teacher (or adviser)
 * to the section's assigned English or Filipino Subject Teacher.
 */
export async function routeReadingConcernToLanguageTeacher({
  studentId,
  studentName = "Learner",
  sectionId,
  gradeSection = "",
  language = "English", // "English" | "Filipino"
  concernCategory = "Reading Concern",
  teacherRemarks = "",
  referringTeacherId = null,
  referringTeacherName = "Subject Teacher",
  schoolYear = "SY 2026-2027",
  quarter = 1,
}) {
  const supabase = await ensureAuthSession();

  // 1. Resolve language subject teacher for the section
  let query = supabase
    .from("classes")
    .select(`
      id,
      section_id,
      teacher_id,
      school_year,
      subjects!inner (
        id,
        subject_name,
        subject_code
      ),
      teachers (
        id,
        user_id,
        first_name,
        last_name
      )
    `)
    .eq("section_id", sectionId);

  if (schoolYear) {
    query = query.eq("school_year", schoolYear);
  }

  const { data: classesData, error: classError } = await query;
  if (classError) return { success: false, error: classError };

  const normTarget = String(language).toLowerCase().includes("fil") ? "filipino" : "english";
  const matchedClass = (classesData ?? []).find((c) => {
    const sName = String(c.subjects?.subject_name || c.subjects?.subject_code || "").toLowerCase();
    return sName.includes(normTarget);
  });

  if (!matchedClass || !matchedClass.teachers) {
    return {
      success: false,
      error: new Error("Reading assessment teacher not found. No language subject teacher is currently assigned to this section."),
      missingTeacher: true,
    };
  }

  const languageTeacher = matchedClass.teachers;
  const languageTeacherName = `${languageTeacher.first_name || ""} ${languageTeacher.last_name || ""}`.trim();

  // 2. Save canonical monitoring record documenting the flagged reading concern
  const recordRes = await saveOrUpdateCanonicalMonitoringRecord({
    studentId,
    classId: matchedClass.id,
    teacherId: languageTeacher.id,
    schoolYear,
    quarter,
    interventionGiven: "Flagged Reading Concern",
    teacherRemarks: `[Flagged by ${referringTeacherName}]: ${concernCategory}.${teacherRemarks ? ` Note: "${teacherRemarks}"` : ""}`,
    studentProgress: "Needs Assessment",
    monitoringStatus: "Under Review",
    followUpNeeded: true,
  });

  if (recordRes.error) {
    console.warn("Could not save canonical monitoring record for flagged reading concern:", recordRes.error);
  }

  // 3. Dispatch notification to the Language Subject Teacher
  try {
    const profileRes = await resolveProfileIdForTeacher(languageTeacher.id);
    if (profileRes.data) {
      const actorProfile = await getCurrentProfile();
      const notifPayload = buildFlaggedReadingConcernNotification({
        recipientProfileId: profileRes.data,
        actorProfileId: actorProfile?.data?.id ?? null,
        studentId,
        studentName,
        language: normTarget === "filipino" ? "Filipino" : "English",
        concernCategory,
        referringTeacherName,
        notes: teacherRemarks,
        gradeSection,
      });

      if (notifPayload) {
        await createNotificationsSafely([notifPayload]);
      }
    }
  } catch (err) {
    console.error("Failed to send reading concern notification:", err);
  }

  return {
    success: true,
    data: {
      languageTeacherId: languageTeacher.id,
      languageTeacherName,
      language: normTarget === "filipino" ? "Filipino" : "English",
      classId: matchedClass.id,
    },
    error: null,
  };
}


