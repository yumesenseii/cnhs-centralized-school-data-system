import { createClient } from "@/lib/supabase/client";
import { getCurrentTeacherSession } from "@/lib/supabase/queries/myClasses";
import { OFFICIAL_SUBJECT_KEYS, getMatatagDescriptor, computeTermAverage } from "@/lib/reports/sf9DataService";
import { getActiveSchoolYear, normalizeSchoolYear } from "@/lib/academic/activeSchoolYear";

const supabase = createClient();

function formatTeacherRowName(t, fallback = "Teacher") {
  if (!t) return fallback;
  const parts = [t.first_name, t.middle_name, t.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : fallback;
}

/**
 * Fetch the assigned advisory section for the currently logged-in teacher.
 */
export async function getTeacherAdvisorySection(schoolYear = null) {
  const session = await getCurrentTeacherSession();
  if (session.error || !session.data?.teacherId) {
    return { data: null, error: session.error || new Error("No active teacher session.") };
  }

  const teacherId = session.data.teacherId;
  const effectiveYear = schoolYear || getActiveSchoolYear();
  const { variants } = normalizeSchoolYear(effectiveYear);

  const { data: section, error } = await supabase
    .from("sections")
    .select(`
      id,
      section_name,
      grade_level,
      school_year,
      status,
      adviser_id,
      adviser:teachers!adviser_id (
        id,
        first_name,
        middle_name,
        last_name
      )
    `)
    .eq("adviser_id", teacherId)
    .in("school_year", variants)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { data: null, error };
  if (!section) return { data: { hasAdvisory: false, teacherId }, error: null };

  return {
    data: {
      hasAdvisory: true,
      teacherId,
      section: {
        id: section.id,
        sectionName: section.section_name,
        gradeLevel: section.grade_level,
        schoolYear: section.school_year,
        adviserId: section.adviser_id,
        adviserName: formatTeacherRowName(section.adviser, "Teacher Adviser"),
      },
    },
    error: null,
  };
}

/**
 * Fetch full consolidated overview of an advisory section:
 * - Enrolled students
 * - Subject offerings and their publishing status
 * - Transmuted grades across T1, T2, T3
 * - Monthly SF2 attendance
 */
export async function getAdvisorySectionOverview(sectionId, schoolYear = null) {
  if (!sectionId) {
    return { data: null, error: new Error("Section ID is required.") };
  }

  // 1. Fetch section info & enrolled students
  const { data: sectionData, error: sectionErr } = await supabase
    .from("sections")
    .select(`
      id,
      section_name,
      grade_level,
      school_year,
      status,
      adviser_id,
      adviser:teachers!adviser_id ( id, first_name, middle_name, last_name )
    `)
    .eq("id", sectionId)
    .maybeSingle();

  if (sectionErr) return { data: null, error: sectionErr };
  if (!sectionData) return { data: null, error: new Error("Section not found.") };

  const effectiveYear = schoolYear || sectionData.school_year || getActiveSchoolYear();
  const { variants } = normalizeSchoolYear(effectiveYear);

  const { data: students, error: studentErr } = await supabase
    .from("students")
    .select("id, student_number, first_name, middle_name, last_name, sex, birthdate, status")
    .eq("section_id", sectionId)
    .order("last_name");

  if (studentErr) return { data: null, error: studentErr };

  // 2. Fetch subject classes offered for this section matching active school year variants
  const { data: classes, error: classErr } = await supabase
    .from("classes")
    .select(`
      id,
      quarter,
      school_year,
      subject:subjects ( id, subject_name ),
      teacher:teachers ( id, first_name, middle_name, last_name )
    `)
    .eq("section_id", sectionId)
    .in("school_year", variants);

  if (classErr) return { data: null, error: classErr };

  const classIds = (classes || []).map((c) => c.id);
  const studentIds = (students || []).map((s) => s.id);

  // 3. Fetch ECR workbooks and term sheets for these classes to track publishing status
  let workbooks = [];
  if (classIds.length > 0) {
    const { data: wbData } = await supabase
      .from("ecr_workbooks")
      .select(`
        id,
        class_id,
        status,
        ecr_term_sheets (
          id,
          term,
          status,
          updated_at
        )
      `)
      .in("class_id", classIds);
    workbooks = wbData || [];
  }

  // Build subject publishing status tracker map
  const subjectPublishStatus = [];
  const classBySubjectKey = new Map();

  OFFICIAL_SUBJECT_KEYS.forEach((subj) => {
    // Match class offering with this subject
    const matchedClass = (classes || []).find((c) => {
      const name = (c.subject?.subject_name || "").toLowerCase();
      if (subj.key === "filipino") return name.includes("filipino");
      if (subj.key === "english") return name.includes("english");
      if (subj.key === "mathematics") return name.includes("math");
      if (subj.key === "science") return name.includes("science");
      if (subj.key === "araling_panlipunan") return name.includes("araling") || name.includes("ap");
      if (subj.key === "values_education") return name.includes("values") || name.includes("gmrc") || name.includes("esp");
      if (subj.key === "tle") return name.includes("tle") || name.includes("epp");
      if (subj.key === "mapeh") return name.includes("mapeh");
      return false;
    });

    const wb = matchedClass ? workbooks.find((w) => w.class_id === matchedClass.id) : null;
    const termSheets = wb?.ecr_term_sheets || [];

    const t1Sheet = termSheets.find((t) => t.term === 1);
    const t2Sheet = termSheets.find((t) => t.term === 2);
    const t3Sheet = termSheets.find((t) => t.term === 3);

    const isT1Published = t1Sheet?.status === "published";
    const isT2Published = t2Sheet?.status === "published";
    const isT3Published = t3Sheet?.status === "published";
    const isAnyPublished = isT1Published || isT2Published || isT3Published;

    subjectPublishStatus.push({
      key: subj.key,
      label: subj.label,
      isComposite: subj.isComposite || false,
      subAreas: subj.subAreas || null,
      classId: matchedClass?.id || null,
      teacherName: formatTeacherRowName(matchedClass?.teacher, "Unassigned"),
      t1Status: isT1Published ? "published" : t1Sheet ? "draft" : "pending",
      t2Status: isT2Published ? "published" : t2Sheet ? "draft" : "pending",
      t3Status: isT3Published ? "published" : t3Sheet ? "draft" : "pending",
      isPublished: isAnyPublished,
      allTermsPublished: isT1Published && isT2Published && isT3Published,
    });

    if (matchedClass) {
      classBySubjectKey.set(subj.key, matchedClass.id);
    }
  });

  // 4. Fetch published grades from grades table
  let publishedGrades = [];
  if (studentIds.length > 0) {
    const { data: gData } = await supabase
      .from("grades")
      .select(`
        id,
        student_id,
        class_id,
        subject_id,
        quarter,
        final_grade,
        school_year,
        subject:subjects ( id, subject_name )
      `)
      .in("school_year", variants)
      .in("student_id", studentIds);
    publishedGrades = gData || [];
  }

  // 5. Fetch SF2 Attendance monthly closes for this section
  let attendanceMonths = [];
  const { data: attData } = await supabase
    .from("attendance_section_months")
    .select("month, school_days, absences, total_attendance")
    .eq("section_id", sectionId)
    .in("school_year", variants);
  attendanceMonths = attData || [];

  // 6. Build consolidated learners matrix
  const learnersConsolidated = (students || []).map((student) => {
    const studentGrades = publishedGrades.filter((g) => g.student_id === student.id);
    const gradesMap = {};

    OFFICIAL_SUBJECT_KEYS.forEach((subj) => {
      gradesMap[subj.key] = { t1: null, t2: null, t3: null, final: null };
      if (subj.isComposite) {
        (subj.subAreas || []).forEach((sub) => {
          gradesMap[sub.key] = { t1: null, t2: null, t3: null, final: null };
        });
      }
    });

    studentGrades.forEach((g) => {
      const sName = (g.subject?.subject_name || "").toLowerCase();
      let key = null;
      if (sName.includes("filipino")) key = "filipino";
      else if (sName.includes("english")) key = "english";
      else if (sName.includes("math")) key = "mathematics";
      else if (sName.includes("science")) key = "science";
      else if (sName.includes("araling") || sName.includes("ap")) key = "araling_panlipunan";
      else if (sName.includes("values") || sName.includes("gmrc") || sName.includes("esp")) key = "values_education";
      else if (sName.includes("tle") || sName.includes("epp")) key = "tle";
      else if (sName.includes("music") || sName.includes("art")) key = "music_arts";
      else if (sName.includes("pe") || sName.includes("health") || sName.includes("physical")) key = "pe_health";
      else if (sName.includes("mapeh")) key = "mapeh";

      if (key && gradesMap[key]) {
        const q = Number(g.quarter || 1);
        const val = g.final_grade !== null ? Number(g.final_grade) : null;
        if (q === 1) gradesMap[key].t1 = val;
        else if (q === 2) gradesMap[key].t2 = val;
        else if (q === 3) gradesMap[key].t3 = val;
      }
    });

    // Compute composite MAPEH and final term averages per subject
    const finalGradesList = [];
    OFFICIAL_SUBJECT_KEYS.forEach((subj) => {
      if (subj.isComposite) {
        const sub1 = gradesMap["music_arts"] || {};
        const sub2 = gradesMap["pe_health"] || {};
        const t1Vals = [sub1.t1, sub2.t1].filter((v) => v != null).map(Number);
        const t2Vals = [sub1.t2, sub2.t2].filter((v) => v != null).map(Number);
        const t3Vals = [sub1.t3, sub2.t3].filter((v) => v != null).map(Number);

        if (t1Vals.length) gradesMap.mapeh.t1 = Math.round(t1Vals.reduce((a, b) => a + b, 0) / t1Vals.length);
        if (t2Vals.length) gradesMap.mapeh.t2 = Math.round(t2Vals.reduce((a, b) => a + b, 0) / t2Vals.length);
        if (t3Vals.length) gradesMap.mapeh.t3 = Math.round(t3Vals.reduce((a, b) => a + b, 0) / t3Vals.length);

        const mapehFinal = computeTermAverage(gradesMap.mapeh.t1, gradesMap.mapeh.t2, gradesMap.mapeh.t3);
        gradesMap.mapeh.final = mapehFinal;
        if (mapehFinal !== null) finalGradesList.push(mapehFinal);
      } else {
        const finalG = computeTermAverage(gradesMap[subj.key].t1, gradesMap[subj.key].t2, gradesMap[subj.key].t3);
        gradesMap[subj.key].final = finalG;
        if (finalG !== null) finalGradesList.push(finalG);
      }
    });

    let generalAverage = null;
    if (finalGradesList.length > 0) {
      generalAverage = Math.round(finalGradesList.reduce((a, b) => a + b, 0) / finalGradesList.length);
    }
    const descriptor = getMatatagDescriptor(generalAverage);

    // Count how many of the 8 main subjects have at least 1 published grade
    const publishedSubjectCount = OFFICIAL_SUBJECT_KEYS.filter((s) => {
      const g = gradesMap[s.key];
      return g.t1 !== null || g.t2 !== null || g.t3 !== null;
    }).length;

    const fullName = [student.first_name, student.middle_name, student.last_name]
      .filter(Boolean)
      .join(" ");

    return {
      id: student.id,
      studentId: student.id,
      name: fullName,
      lrn: student.student_number || "—",
      studentNumber: student.student_number || "—",
      firstName: student.first_name,
      middleName: student.middle_name || "",
      lastName: student.last_name,
      first_name: student.first_name,
      middle_name: student.middle_name || "",
      last_name: student.last_name,
      gender: student.sex || "—",
      sex: student.sex || "—",
      birthdate: student.birthdate,
      gradeLevel: sectionData.grade_level,
      sectionName: sectionData.section_name,
      adviserName: formatTeacherRowName(sectionData.adviser, "Teacher Adviser"),
      grades: gradesMap,
      generalAverage,
      descriptor: descriptor.descriptor,
      remarks: descriptor.remarks,
      publishedSubjectCount,
      isComplete: publishedSubjectCount === 8,
    };
  });

  const totalLearners = learnersConsolidated.length;
  const maleCount = learnersConsolidated.filter((s) => (s.sex || s.gender || "").toLowerCase().startsWith("m")).length;
  const femaleCount = learnersConsolidated.filter((s) => (s.sex || s.gender || "").toLowerCase().startsWith("f")).length;
  const publishedSubjectsCount = subjectPublishStatus.filter((s) => s.isPublished).length;

  return {
    data: {
      section: {
        id: sectionData.id,
        sectionName: sectionData.section_name,
        gradeLevel: sectionData.grade_level,
        schoolYear: sectionData.school_year,
        adviserId: sectionData.adviser_id,
        adviserName: formatTeacherRowName(sectionData.adviser, "Teacher Adviser"),
        totalLearners,
        maleCount,
        femaleCount,
      },
      subjectPublishStatus,
      publishedSubjectsCount,
      totalSubjectsCount: OFFICIAL_SUBJECT_KEYS.length,
      learners: learnersConsolidated,
      attendanceMonths,
    },
    error: null,
  };
}

/**
 * Check if the teacher is the official adviser of a specific student.
 */
export async function isTeacherAdviserOfStudent(teacherId, studentId) {
  if (!teacherId || !studentId) return false;
  const { data: student } = await supabase
    .from("students")
    .select("section:sections ( adviser_id )")
    .eq("id", studentId)
    .maybeSingle();

  return Boolean(student?.section?.adviser_id === teacherId);
}
