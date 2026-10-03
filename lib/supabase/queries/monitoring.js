import { notifyMonitoringRecord } from "@/lib/notifications/monitoringNotifications";
import { createClient } from "@/lib/supabase/client";
import {
  getCurrentTeacherSession,
  getTeacherClasses,
} from "@/lib/supabase/queries/myClasses";

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
  teachers (
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
      .order("observation_date", { ascending: false });

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

  return {
    data: {
      classes,
      enrollments: enrollments ?? [],
      grades,
      monitoringRecords,
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

  return {
    data: {
      classRow,
      student: unwrap(enrollment.students),
      grades: grades ?? [],
      monitoringRecords,
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
} = {}) {
  const ids = [...new Set((studentIds ?? []).filter(Boolean))];
  const classes = [...new Set((classIds ?? []).filter(Boolean))];
  if (!ids.length) return { data: [], error: null };

  const supabase = await ensureAuthSession();
  let query = supabase
    .from("monitoring_records")
    .select(MONITORING_RECORD_SELECT)
    .in("student_id", ids)
    .order("observation_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (classes.length) query = query.in("class_id", classes);

  const { data, error } = await query;
  if (error) {
    const message = error.message || "";
    if (/monitoring_records|does not exist|schema cache/i.test(message)) {
      return { data: [], error: null };
    }
    return { data: [], error };
  }
  return { data: data ?? [], error: null };
}

export async function createMonitoringRecord(payload) {
  const supabase = await ensureAuthSession();
  const row = {
    student_id: payload.student_id,
    class_id: payload.class_id,
    teacher_id: payload.teacher_id,
    observation_date: payload.observation_date,
    intervention_given: payload.intervention_given?.trim() || null,
    teacher_remarks: payload.teacher_remarks?.trim() || null,
    student_progress: payload.student_progress?.trim() || null,
    follow_up_needed: Boolean(payload.follow_up_needed),
    monitoring_status: payload.monitoring_status || "Ongoing",
    school_year: payload.school_year,
    quarter: Number(payload.quarter),
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

  if (!error && data?.id) await notifyMonitoringRecord(data);

  return { data, error };
}

export async function updateMonitoringRecord(id, updates) {
  if (!id) {
    return { data: null, error: new Error("Monitoring record id is required.") };
  }

  const supabase = await ensureAuthSession();
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
    ...(updates.monitoring_status
      ? { monitoring_status: updates.monitoring_status }
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

  if (!error && data?.id) await notifyMonitoringRecord(data);

  return { data, error };
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

  const { data, error } = await supabase
    .from("monitoring_records")
    .update(payload)
    .eq("id", monitoringRecordId)
    .select(MONITORING_RECORD_SELECT)
    .single();

  if (!error && data?.id) await notifyMonitoringRecord(data);

  return { data, error };
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

  return {
    data: {
      classes: filteredClasses,
      enrollments: enrollments ?? [],
      grades,
      monitoringRecords,
    },
    error: null,
  };
}

export async function resolveTeacherSessionForMonitoring() {
  return getCurrentTeacherSession();
}
