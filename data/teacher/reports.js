export const teacherReportsData = {
  controls: {
    schoolYear: "SY 2026-2027",
    schoolYears: ["SY 2026-2027", "SY 2025-2026"],
    quarter: "Quarter 1",
    quarters: ["Quarter 1", "Quarter 2", "Quarter 3", "Quarter 4"],
  },
  summaryCards: [
    {
      id: "classes",
      title: "Classes Assigned",
      metrics: [
        { label: "Assigned Classes", value: "6" },
        { label: "Total Students", value: "248" },
        { label: "Average Class Performance", value: "83.8" },
      ],
      tone: "green",
      icon: "book",
    },
    {
      id: "academic",
      title: "Academic Reports",
      metrics: [
        { label: "Reports Generated", value: "4" },
        { label: "Pending Reports", value: "2" },
        { label: "Latest Submission", value: "July 14" },
      ],
      tone: "blue",
      icon: "chart",
    },
    {
      id: "monitoring",
      title: "Monitoring Reports",
      metrics: [
        { label: "Learners Under Monitoring", value: "18" },
        { label: "ARAL Learners", value: "5" },
        { label: "Classroom Remediation", value: "13" },
      ],
      tone: "orange",
      icon: "users",
    },
    {
      id: "lesson-plans",
      title: "Lesson Plan Status",
      metrics: [
        { label: "Approved", value: "6" },
        { label: "Pending Review", value: "3" },
        { label: "Needs Revision", value: "2" },
      ],
      tone: "violet",
      icon: "clipboard",
    },
  ],
  reportCards: [
    {
      id: "academic-performance",
      title: "Academic Performance Report",
      metrics: [
        { label: "Class Average", value: "84.2" },
        { label: "Passing Rate", value: "88%" },
        { label: "Highest Performing Subject", value: "MAPEH" },
        { label: "Lowest Performing Subject", value: "Mathematics" },
      ],
    },
    {
      id: "monitoring-report",
      title: "Monitoring Report",
      metrics: [
        { label: "Learners Under Monitoring", value: "18" },
        { label: "ARAL Learners", value: "5" },
        { label: "Classroom Remediation", value: "13" },
        { label: "Monitoring Completed", value: "7" },
      ],
    },
    {
      id: "lesson-plan-report",
      title: "Lesson Plan Report",
      metrics: [
        { label: "Latest Submission", value: "Narrative Structure Analysis" },
        { label: "Review Status", value: "Pending Review" },
        { label: "Submission Date", value: "July 12, 2026" },
      ],
    },
    {
      id: "eclass-report",
      title: "E-Class Record Report",
      metrics: [
        { label: "Academic Records Submitted", value: "3 of 6" },
        { label: "Validation Status", value: "Passed" },
        { label: "Latest Upload", value: "July 12, 2026" },
      ],
    },
  ],
  classReports: [
    {
      id: "eng-g8-rizal",
      subject: "English",
      gradeSection: "Grade 8 — Rizal",
      students: 42,
      averageGrade: 84.2,
      intervention: 5,
      reportStatus: "Needs Update",
      lastUpdated: "July 14, 2026",
    },
    {
      id: "math-g8-bonifacio",
      subject: "Mathematics",
      gradeSection: "Grade 8 — Bonifacio",
      students: 40,
      averageGrade: 79.5,
      intervention: 8,
      reportStatus: "Available",
      lastUpdated: "July 13, 2026",
    },
    {
      id: "sci-g7-luna",
      subject: "Science",
      gradeSection: "Grade 7 — Luna",
      students: 45,
      averageGrade: 82.1,
      intervention: 3,
      reportStatus: "Available",
      lastUpdated: "July 12, 2026",
    },
    {
      id: "fil-g8-mabini",
      subject: "Filipino",
      gradeSection: "Grade 8 — Mabini",
      students: 41,
      averageGrade: 85.0,
      intervention: 2,
      reportStatus: "Pending",
      lastUpdated: "July 11, 2026",
    },
    {
      id: "ap-g10-aguinaldo",
      subject: "Araling Panlipunan",
      gradeSection: "Grade 10 — Aguinaldo",
      students: 39,
      averageGrade: 86.4,
      intervention: 1,
      reportStatus: "Available",
      lastUpdated: "July 10, 2026",
    },
    {
      id: "mapeh-g9-delpilar",
      subject: "MAPEH",
      gradeSection: "Grade 9 — Del Pilar",
      students: 41,
      averageGrade: 83.7,
      intervention: 4,
      reportStatus: "Needs Update",
      lastUpdated: "July 9, 2026",
    },
  ],
  preview: {
    "eng-g8-rizal": {
      title: "English — Grade 8 — Rizal",
      subtitle: "Teacher Report Preview · SY 2026-2027 · Quarter 1",
      classInformation: {
        subject: "English",
        gradeSection: "Grade 8 — Rizal",
        quarter: "Quarter 1",
        teacher: "Sir Allan",
        schoolYear: "SY 2026-2027",
      },
      academic: {
        classAverage: 84.2,
        passingRate: "88%",
        highestSubject: "MAPEH",
        lowestSubject: "Mathematics",
        requiringIntervention: 5,
      },
      attendance: {
        average: "93%",
        perfect: 8,
        below90: 5,
      },
      weakSubjects: [
        { subject: "English", learners: 5, percent: 100 },
        { subject: "Mathematics", learners: 4, percent: 80 },
        { subject: "Science", learners: 3, percent: 60 },
        { subject: "Filipino", learners: 2, percent: 40 },
        { subject: "MAPEH", learners: 1, percent: 20 },
        { subject: "Araling Panlipunan", learners: 1, percent: 20 },
      ],
      monitoring: {
        aralScreening: 2,
        classroomRemediation: 3,
        monitoringCompleted: 1,
        stillUnderMonitoring: 4,
      },
      recommendations: {
        recommendAral: 2,
        continueRemediation: 2,
        showingImprovement: 1,
        immediateFollowUp: 1,
      },
    },
  },
};

export function getTeacherReportPreview(classId) {
  return (
    teacherReportsData.preview[classId] ??
    teacherReportsData.preview["eng-g8-rizal"]
  );
}
