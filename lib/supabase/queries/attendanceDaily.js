import { createClient } from "@/lib/supabase/client";
import { getCurrentTeacherSession } from "@/lib/supabase/queries/myClasses";
import {
  formatSf2LearnerName,
  monthTotalsFromMarks,
  normalizeSf2Session,
  sexLabel,
} from "@/lib/attendance/sf2Daily";
import {
  monthNameFromNumber,
  monthTrendFromMarks,
  sessionRatePercent,
  sessionTotalsFromMarks,
  summarizeSectionLearners,
  weekdayDatesWithNoSave,
} from "@/lib/attendance/dailyAnalytics";
import { MONTH_LABELS } from "@/lib/attendance/constants";
import { getSectionMonthClose } from "@/lib/supabase/queries/attendanceMonthClose";

const supabase = createClient();

function studentNameParts(student) {
  return {
    first_name: student?.first_name,
    middle_name: student?.middle_name,
    last_name: student?.last_name,
  };
}

function sexSortRank(sex) {
  if (sex === "M") return 0;
  if (sex === "F") return 1;
  return 2;
}

function compareRosterRows(a, b) {
  const sexCmp = sexSortRank(a.sex) - sexSortRank(b.sex);
  if (sexCmp !== 0) return sexCmp;
  return a.name.localeCompare(b.name, "en");
}

function monthRange(year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  return {
    start: `${y}-${m}-01`,
    end: `${y}-${m}-${String(lastDay).padStart(2, "0")}`,
  };
}

function yearFromSchoolYear(schoolYear, month) {
  const match = String(schoolYear || "").match(/(\d{4})/g);
  const first = Number(match?.[0]);
  const second = Number(match?.[1]) || first + 1;
  if (!first) return new Date().getFullYear();
  return Number(month) >= 6 ? first : second;
}

async function loadSectionStudents(sectionId, schoolYear) {
  const { data: classes, error: classError } = await supabase
    .from("classes")
    .select("id")
    .eq("section_id", sectionId)
    .eq("school_year", schoolYear);

  if (classError) return { data: null, error: classError };

  const classIds = (classes ?? []).map((row) => row.id);
  const studentMap = new Map();

  if (classIds.length) {
    const { data: enrollments, error: enrollError } = await supabase
      .from("class_students")
      .select(
        `
        student_id,
        students (
          id,
          student_number,
          first_name,
          middle_name,
          last_name,
          sex
        )
      `
      )
      .in("class_id", classIds);

    if (enrollError) return { data: null, error: enrollError };

    for (const row of enrollments ?? []) {
      const student = row.students;
      if (!student?.id || studentMap.has(student.id)) continue;
      studentMap.set(student.id, student);
    }
  }

  if (!studentMap.size) {
    const { data: sectionStudents, error: studentError } = await supabase
      .from("students")
      .select("id, student_number, first_name, middle_name, last_name, sex")
      .eq("section_id", sectionId);

    if (studentError) return { data: null, error: studentError };

    for (const student of sectionStudents ?? []) {
      if (!student?.id || studentMap.has(student.id)) continue;
      studentMap.set(student.id, student);
    }
  }

  return { data: studentMap, error: null };
}

export async function getSectionDailyRoster({
  sectionId,
  schoolYear,
  attendanceDate,
  session: attendanceSession,
}) {
  const sessionKey = normalizeSf2Session(attendanceSession);
  if (!sectionId || !schoolYear || !attendanceDate || !sessionKey) {
    return {
      data: null,
      error: new Error("Section, school year, date, and session are required."),
    };
  }

  const teacherSession = await getCurrentTeacherSession();
  const teacherId = teacherSession.data?.teacherId ?? null;

  const { data: section, error: sectionError } = await supabase
    .from("sections")
    .select("id, section_name, grade_level, school_year, adviser_id")
    .eq("id", sectionId)
    .maybeSingle();

  if (sectionError) return { data: null, error: sectionError };
  if (!section) {
    return { data: null, error: new Error("Section not found.") };
  }

  const isAdviser = Boolean(teacherId && section.adviser_id === teacherId);

  const rosterResult = await loadSectionStudents(sectionId, schoolYear);
  if (rosterResult.error) return { data: null, error: rosterResult.error };
  const studentMap = rosterResult.data ?? new Map();

  const date = String(attendanceDate);
  const [year, month] = date.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const monthStart = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const studentIds = [...studentMap.keys()];
  let dayMarks = [];
  let monthMarks = [];

  if (studentIds.length) {
    const [dayResult, monthResult] = await Promise.all([
      supabase
        .from("attendance_daily")
        .select("student_id, status, attendance_date, session")
        .eq("section_id", sectionId)
        .eq("attendance_date", date)
        .eq("session", sessionKey)
        .in("student_id", studentIds),
      supabase
        .from("attendance_daily")
        .select("student_id, status, attendance_date, session")
        .eq("section_id", sectionId)
        .gte("attendance_date", monthStart)
        .lte("attendance_date", monthEnd)
        .in("student_id", studentIds),
    ]);

    if (dayResult.error) return { data: null, error: dayResult.error };
    if (monthResult.error) return { data: null, error: monthResult.error };
    dayMarks = dayResult.data ?? [];
    monthMarks = monthResult.data ?? [];
  }

  const statusByStudent = new Map(
    dayMarks.map((row) => [row.student_id, row.status])
  );
  const monthByStudent = new Map();
  for (const row of monthMarks) {
    const list = monthByStudent.get(row.student_id) ?? [];
    list.push(row);
    monthByStudent.set(row.student_id, list);
  }

  const roster = [...studentMap.values()]
    .map((student) => {
      const marks = monthByStudent.get(student.id) ?? [];
      return {
        studentId: student.id,
        studentNumber: student.student_number || "",
        name: formatSf2LearnerName(studentNameParts(student)),
        sex: sexLabel(student.sex),
        status: statusByStudent.get(student.id) || "present",
        saved: statusByStudent.has(student.id),
        savedStatus: statusByStudent.get(student.id) ?? null,
        monthTotals: monthTotalsFromMarks(marks),
        monthMarks: marks,
      };
    })
    .sort(compareRosterRows);

  return {
    data: {
      section,
      isAdviser,
      session: sessionKey,
      roster,
    },
    error: null,
  };
}

export async function saveSectionDailyAttendance({
  sectionId,
  schoolYear,
  attendanceDate,
  session: attendanceSession,
  marks,
}) {
  const sessionKey = normalizeSf2Session(attendanceSession);
  if (!sectionId || !schoolYear || !attendanceDate || !sessionKey) {
    return {
      data: null,
      error: new Error("Section, school year, date, and session are required."),
    };
  }

  const teacherSession = await getCurrentTeacherSession();
  const teacherId = teacherSession.data?.teacherId ?? null;
  if (!teacherId) {
    return { data: null, error: new Error("Only the class adviser can save daily attendance.") };
  }

  const { data: section, error: sectionError } = await supabase
    .from("sections")
    .select("id, adviser_id")
    .eq("id", sectionId)
    .maybeSingle();

  if (sectionError) return { data: null, error: sectionError };
  if (!section || section.adviser_id !== teacherId) {
    return {
      data: null,
      error: new Error("Daily SF2 can be marked by the class adviser only."),
    };
  }

  const rows = (marks ?? [])
    .filter((row) => row.studentId)
    .filter((row) => {
      const next = row.status;
      const prev = row.savedStatus;
      if (
        (prev === "late" || prev === "cutting") &&
        next === prev
      ) {
        return false;
      }
      return next === "present" || next === "absent";
    })
    .map((row) => ({
      student_id: row.studentId,
      section_id: sectionId,
      school_year: schoolYear,
      attendance_date: attendanceDate,
      session: sessionKey,
      status: row.status === "absent" ? "absent" : "present",
      marked_by: teacherId,
      updated_at: new Date().toISOString(),
    }));

  if (!rows.length) {
    return { data: { saved: 0 }, error: null };
  }

  const { error } = await supabase.from("attendance_daily").upsert(rows, {
    onConflict: "student_id,section_id,attendance_date,session",
  });

  if (error) return { data: null, error };
  return { data: { saved: rows.length, session: sessionKey }, error: null };
}

export async function getSectionDailyMonth({
  sectionId,
  schoolYear,
  month,
}) {
  if (!sectionId || !schoolYear || !month) {
    return {
      data: null,
      error: new Error("Section, school year, and month are required."),
    };
  }

  const { data: section, error: sectionError } = await supabase
    .from("sections")
    .select("id, section_name, grade_level, school_year, adviser_id")
    .eq("id", sectionId)
    .maybeSingle();

  if (sectionError) return { data: null, error: sectionError };
  if (!section) {
    return { data: null, error: new Error("Section not found.") };
  }

  const rosterResult = await loadSectionStudents(sectionId, schoolYear);
  if (rosterResult.error) return { data: null, error: rosterResult.error };
  const studentMap = rosterResult.data ?? new Map();

  const year = yearFromSchoolYear(schoolYear, month);
  const { start, end } = monthRange(year, Number(month));
  const studentIds = [...studentMap.keys()];

  let monthMarks = [];
  let yearMarks = [];
  if (studentIds.length) {
    const [monthResult, yearResult] = await Promise.all([
      supabase
        .from("attendance_daily")
        .select("student_id, status, attendance_date, session")
        .eq("section_id", sectionId)
        .eq("school_year", schoolYear)
        .gte("attendance_date", start)
        .lte("attendance_date", end)
        .in("student_id", studentIds),
      supabase
        .from("attendance_daily")
        .select("student_id, status, attendance_date, session")
        .eq("section_id", sectionId)
        .eq("school_year", schoolYear)
        .in("student_id", studentIds),
    ]);
    if (monthResult.error) return { data: null, error: monthResult.error };
    if (yearResult.error) return { data: null, error: yearResult.error };
    monthMarks = monthResult.data ?? [];
    yearMarks = yearResult.data ?? [];
  }

  const monthByStudent = new Map();
  for (const row of monthMarks) {
    const list = monthByStudent.get(row.student_id) ?? [];
    list.push(row);
    monthByStudent.set(row.student_id, list);
  }

  const roster = [...studentMap.values()]
    .map((student) => ({
      studentId: student.id,
      studentNumber: student.student_number || "",
      name: formatSf2LearnerName(studentNameParts(student)),
      sex: sexLabel(student.sex),
      monthMarks: monthByStudent.get(student.id) ?? [],
      monthTotals: monthTotalsFromMarks(monthByStudent.get(student.id) ?? []),
    }))
    .sort(compareRosterRows);

  const summary = summarizeSectionLearners(roster);
  const savedDates = [
    ...new Set(
      monthMarks.map((row) => String(row.attendance_date)).filter(Boolean)
    ),
  ];
  const closeResult = await getSectionMonthClose({
    sectionId,
    schoolYear,
    month,
  });
  if (closeResult.error) return { data: null, error: closeResult.error };

  return {
    data: {
      section,
      month: Number(month),
      monthName: MONTH_LABELS[Number(month) - 1] || "—",
      schoolYear,
      year,
      ...summary,
      weekdayHints: weekdayDatesWithNoSave({
        year,
        month: Number(month),
        savedDates,
      }),
      monthClose: closeResult.data,
      trend: monthTrendFromMarks(yearMarks),
    },
    error: null,
  };
}

export async function getSchoolDailyMonth({ schoolYear, month }) {
  if (!schoolYear || !month) {
    return {
      data: null,
      error: new Error("School year and month are required."),
    };
  }

  const { data: sections, error: sectionError } = await supabase
    .from("sections")
    .select("id, section_name, grade_level, school_year")
    .eq("school_year", schoolYear)
    .order("grade_level");

  if (sectionError) return { data: null, error: sectionError };

  const year = yearFromSchoolYear(schoolYear, month);
  const { start, end } = monthRange(year, Number(month));

  const { data: marks, error: markError } = await supabase
    .from("attendance_daily")
    .select("student_id, section_id, status, attendance_date, session")
    .eq("school_year", schoolYear)
    .gte("attendance_date", start)
    .lte("attendance_date", end);

  if (markError) return { data: null, error: markError };

  const { data: yearMarks, error: yearError } = await supabase
    .from("attendance_daily")
    .select("status, attendance_date, session, section_id")
    .eq("school_year", schoolYear);

  if (yearError) return { data: null, error: yearError };

  const marksBySection = new Map();
  for (const row of marks ?? []) {
    const list = marksBySection.get(row.section_id) ?? [];
    list.push(row);
    marksBySection.set(row.section_id, list);
  }

  const rows = (sections ?? []).map((section) => {
    const sectionMarks = marksBySection.get(section.id) ?? [];
    const totals = sessionTotalsFromMarks(sectionMarks);
    const learnerIds = new Set(sectionMarks.map((row) => row.student_id));
    return {
      id: `${section.id}-${month}`,
      sectionId: section.id,
      sectionName: section.section_name,
      gradeLevel: section.grade_level,
      schoolYear,
      month: Number(month),
      monthName: monthNameFromNumber(month),
      ...totals,
      sessionRate: sessionRatePercent(totals),
      learnersMarked: learnerIds.size,
    };
  });

  const schoolTotals = rows.reduce(
    (acc, row) => {
      acc.present += row.present;
      acc.absent += row.absent;
      acc.other += row.other;
      return acc;
    },
    { present: 0, absent: 0, other: 0 }
  );

  const trend = monthTrendFromMarks(yearMarks ?? []);
  const withData = rows.filter((row) => row.saved > 0);

  return {
    data: {
      schoolYear,
      month: Number(month),
      monthName: monthNameFromNumber(month),
      year,
      rows,
      presentSessions: schoolTotals.present,
      absentSessions: schoolTotals.absent,
      sessionRate: sessionRatePercent(schoolTotals),
      sectionsWithData: withData.length,
      sectionCount: rows.length,
      trend,
    },
    error: null,
  };
}
