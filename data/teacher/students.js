export const studentsByClass = {
  "eng-g8-rizal": {
    filters: {
      riskLevels: ["All Risk Levels", "Priority", "Moderate", "Low"],
      interventions: [
        "All Interventions",
        "ARAL Learners",
        "Classroom Remediation",
        "None",
      ],
      monitoring: ["All Monitoring", "Active", "Completed", "Pending"],
    },
    students: [
      {
        id: "miguel-torres",
        name: "Miguel Torres",
        studentNumber: "104793129251",
        initials: "MT",
        avatarTone: "red",
        averageGrade: 71.0,

        weakSubject: "English",
        riskLevel: "Priority",
        intervention: "ARAL Learners",
        interventionStatus: "Active",
        latestMonitoring: "Week 2 — Flagged",
        lastUpdated: "July 14, 2026",
        gender: "Male",
        grade: "Grade 8",
        section: "Rizal",
        quarter: "Quarter 1",
        schoolYear: "SY 2026-2027",
      },
      {
        id: "ana-reyes",
        name: "Ana Reyes",
        studentNumber: "104793129250",
        initials: "AR",
        avatarTone: "orange",
        averageGrade: 73.0,

        weakSubject: "English",
        riskLevel: "Priority",
        intervention: "ARAL Learners",
        interventionStatus: "Active",
        latestMonitoring: "Week 2 — Needs Monitoring",
        lastUpdated: "July 13, 2026",
        gender: "Female",
        grade: "Grade 8",
        section: "Rizal",
        quarter: "Quarter 1",
        schoolYear: "SY 2026-2027",
      },
      {
        id: "carlo-dela-cruz",
        name: "Carlo Dela Cruz",
        studentNumber: "104793129249",
        initials: "CD",
        avatarTone: "amber",
        averageGrade: 76.5,

        weakSubject: "Mathematics",
        riskLevel: "Moderate",
        intervention: "Classroom Remediation",
        interventionStatus: "Active",
        latestMonitoring: "Week 3 — In Progress",
        lastUpdated: "July 12, 2026",
        gender: "Male",
        grade: "Grade 8",
        section: "Rizal",
        quarter: "Quarter 1",
        schoolYear: "SY 2026-2027",
      },
      {
        id: "maria-santos",
        name: "Maria Santos",
        studentNumber: "104793129248",
        initials: "MS",
        avatarTone: "violet",
        averageGrade: 78.2,

        weakSubject: "Science",
        riskLevel: "Moderate",
        intervention: "Classroom Remediation",
        interventionStatus: "Active",
        latestMonitoring: "Week 1 — Needs Monitoring",
        lastUpdated: "July 11, 2026",
        gender: "Female",
        grade: "Grade 8",
        section: "Rizal",
        quarter: "Quarter 1",
        schoolYear: "SY 2026-2027",
      },
      {
        id: "jose-mendoza",
        name: "Jose Mendoza",
        studentNumber: "104793129247",
        initials: "JM",
        avatarTone: "blue",
        averageGrade: 77.8,

        weakSubject: "English",
        riskLevel: "Moderate",
        intervention: "Classroom Remediation",
        interventionStatus: "Completed",
        latestMonitoring: "Week 4 — Completed",
        lastUpdated: "July 10, 2026",
        gender: "Male",
        grade: "Grade 8",
        section: "Rizal",
        quarter: "Quarter 1",
        schoolYear: "SY 2026-2027",
      },
      {
        id: "liza-gomez",
        name: "Liza Gomez",
        studentNumber: "104793129246",
        initials: "LG",
        avatarTone: "green",
        averageGrade: 88.4,

        weakSubject: "—",
        riskLevel: "Low",
        intervention: "None",
        interventionStatus: null,
        latestMonitoring: "—",
        lastUpdated: "July 9, 2026",
        gender: "Female",
        grade: "Grade 8",
        section: "Rizal",
        quarter: "Quarter 1",
        schoolYear: "SY 2026-2027",
      },
      {
        id: "pedro-ramos",
        name: "Pedro Ramos",
        studentNumber: "104793129245",
        initials: "PR",
        avatarTone: "teal",
        averageGrade: 86.1,

        weakSubject: "—",
        riskLevel: "Low",
        intervention: "None",
        interventionStatus: null,
        latestMonitoring: "—",
        lastUpdated: "July 9, 2026",
        gender: "Male",
        grade: "Grade 8",
        section: "Rizal",
        quarter: "Quarter 1",
        schoolYear: "SY 2026-2027",
      },
      {
        id: "sofia-navarro",
        name: "Sofia Navarro",
        studentNumber: "104793129244",
        initials: "SN",
        avatarTone: "pink",
        averageGrade: 84.7,

        weakSubject: "Filipino",
        riskLevel: "Low",
        intervention: "None",
        interventionStatus: null,
        latestMonitoring: "—",
        lastUpdated: "July 8, 2026",
        gender: "Female",
        grade: "Grade 8",
        section: "Rizal",
        quarter: "Quarter 1",
        schoolYear: "SY 2026-2027",
      },
      {
        id: "ryan-villanueva",
        name: "Ryan Villanueva",
        studentNumber: "104793129243",
        initials: "RV",
        avatarTone: "slate",
        averageGrade: 82.3,

        weakSubject: "Mathematics",
        riskLevel: "Low",
        intervention: "None",
        interventionStatus: "Completed",
        latestMonitoring: "Week 3 — Completed",
        lastUpdated: "July 8, 2026",
        gender: "Male",
        grade: "Grade 8",
        section: "Rizal",
        quarter: "Quarter 1",
        schoolYear: "SY 2026-2027",
      },
      {
        id: "elena-cruz",
        name: "Elena Cruz",
        studentNumber: "104793129221",
        initials: "EC",
        avatarTone: "indigo",
        averageGrade: 80.5,

        weakSubject: "Science",
        riskLevel: "Moderate",
        intervention: "Classroom Remediation",
        interventionStatus: "Active",
        latestMonitoring: "Week 2 — In Progress",
        lastUpdated: "July 7, 2026",
        gender: "Female",
        grade: "Grade 8",
        section: "Rizal",
        quarter: "Quarter 1",
        schoolYear: "SY 2026-2027",
      },
    ],
  },
};

export const studentProfiles = {
  "miguel-torres": {
    id: "miguel-torres",
    classId: "eng-g8-rizal",
    name: "Miguel Torres",
    studentNumber: "104793689525",
    initials: "MT",
    avatarTone: "red",
    riskLevel: "Priority",
    gender: "Male",
    grade: "Grade 8",
    section: "Rizal",
    quarter: "Quarter 1",
    schoolYear: "SY 2026-2027",

    academicSummary: {
      quarterLabel: "Academic Summary — Q1",
      subjects: [
        { subject: "English", grade: 65, weak: true },
        { subject: "Mathematics", grade: 72, weak: false },
        { subject: "Science", grade: 74, weak: false },
        { subject: "Filipino", grade: 78, weak: false },
        { subject: "Araling Panlipunan", grade: 80, weak: false },
        { subject: "MAPEH", grade: 82, weak: false },
      ],
      generalAverage: 73.7,
    },
    intervention: {
      recommended: "ARAL Learners",
      generatedBy: "Random Forest",
      currentStatus: "ARAL Learners",
      monitoringStatus: "Active",
      parentConference: "Pending",
      aralEnrollment: "Pending Screening",
      learningGoal: "Improve English performance",
      targetOutcome: "Achieve at least 80 in English by end of Quarter 1",
      recommendedIntervention: "ARAL Learners",
      monitoringFrequency: "Weekly",
      planStatus: "Active",
    },
    riskAssessment: {
      weakSubject: "English",
      riskLevel: "Priority",
      riskScore: 87,
      generatedDate: "July 11, 2026",
      systemRecommendation: "Recommend for ARAL Learners and continue weekly classroom monitoring.",
      reasons: [
        "General average below 75",
        "Attendance rate below 90% target",
        "English grade critically low (65)",
        "System-identified high intervention need",
      ],
    },
  },
};

export function getStudentsForClass(classId) {
  return studentsByClass[classId] ?? studentsByClass["eng-g8-rizal"];
}

export function getStudentProfile(studentId) {
  if (studentProfiles[studentId]) {
    return studentProfiles[studentId];
  }

  const listStudent =
    Object.values(studentsByClass)
      .flatMap((group) => group.students)
      .find((student) => student.id === studentId) ??
    studentsByClass["eng-g8-rizal"].students[0];

  const base = studentProfiles["miguel-torres"];

  return {
    ...base,
    id: listStudent.id,
    name: listStudent.name,
    studentNumber: listStudent.studentNumber,
    initials: listStudent.initials,
    avatarTone: listStudent.avatarTone,
    riskLevel: listStudent.riskLevel,
    gender: listStudent.gender,
    grade: listStudent.grade,
    section: listStudent.section,
    quarter: listStudent.quarter,
    schoolYear: listStudent.schoolYear,

    academicSummary: {
      ...base.academicSummary,
      generalAverage: listStudent.averageGrade,
      subjects: base.academicSummary.subjects.map((subject) =>
        subject.subject === listStudent.weakSubject
          ? { ...subject, weak: true, grade: Math.min(subject.grade, 70) }
          : { ...subject, weak: false }
      ),
    },
    intervention: {
      ...base.intervention,
      recommended: listStudent.intervention,
      currentStatus: listStudent.intervention,
      recommendedIntervention: listStudent.intervention,
      monitoringStatus: listStudent.interventionStatus ?? "Pending",
      planStatus: listStudent.interventionStatus ?? "Pending",
    },
    riskAssessment: {
      ...base.riskAssessment,
      weakSubject: listStudent.weakSubject === "—" ? "None" : listStudent.weakSubject,
      riskLevel: listStudent.riskLevel,
      riskScore:
        listStudent.riskLevel === "Priority"
          ? 87
          : listStudent.riskLevel === "Moderate"
            ? 64
            : 28,
    },
  };
}

export function getStudentInClass(classId, studentId) {
  const classStudents = getStudentsForClass(classId);
  return (
    classStudents.students.find((s) => s.id === studentId) ??
    classStudents.students[0]
  );
}
