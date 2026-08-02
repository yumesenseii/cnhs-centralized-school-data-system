export const adminReportsData = {
  controls: {
    schoolYear: "SY 2026-2027",
    schoolYears: ["SY 2026-2027", "SY 2025-2026"],
    quarter: "Quarter 1",
    quarters: ["Quarter 1", "Quarter 2", "Quarter 3", "Quarter 4"],
  },
  quickStats: [
    { id: "classes", label: "Assigned Classes", value: 8, icon: "book", tone: "green" },
    { id: "generated", label: "Reports Generated", value: 7, icon: "chart", tone: "blue" },
    { id: "intervention", label: "Intervention", value: 1, icon: "alert", tone: "orange" },
    { id: "pending", label: "Pendings", value: 6, icon: "clock", tone: "red" },
  ],
  reportCards: [
    {
      id: "academic",
      title: "Academic Performance",
      status: "Generated",
      statusTone: "green",
      metrics: [
        { label: "Overall Class Average", value: "84.2", tone: "default" },
        { label: "Passing Rate", value: "88%", tone: "default" },
        { label: "Lowest Performing Subject", value: "Mathematics", tone: "default" },
        { label: "Learners Requiring Intervention", value: "24", tone: "danger" },
      ],
      actions: ["view", "download"],
    },
    {
      id: "intervention",
      title: "Intervention Report",
      status: "Generated",
      statusTone: "green",
      metrics: [
        { label: "ARAL Learners", value: "5", tone: "default" },
        { label: "Classroom Remediation", value: "19", tone: "default" },
        { label: "Monitoring Reports Submitted", value: "12", tone: "default" },
        { label: "Recommendations Pending Review", value: "8", tone: "default" },
      ],
      actions: ["view", "modify", "download"],
    },
    {
      id: "eclass",
      title: "E-Class Record",
      status: "Validated",
      statusTone: "green",
      metrics: [
        { label: "Latest Upload", value: "July 12, 2026", tone: "default" },
        { label: "Validation Status", value: "Passed", tone: "success" },
        { label: "Total Learners", value: "248", tone: "default" },
        { label: "Last Updated", value: "July 12", tone: "default" },
      ],
      actions: ["view", "reupload", "download"],
    },
    {
      id: "lesson-plan",
      title: "Lesson Plan Report",
      status: "Needs Review",
      statusTone: "orange",
      metrics: [
        { label: "Submitted", value: "6", tone: "default" },
        { label: "Approved", value: "4", tone: "default" },
        { label: "Needs Revision", value: "2", tone: "default" },
        { label: "Pending Review", value: "3", tone: "default" },
      ],
      actions: ["view", "update"],
    },
  ],
  classReports: [
    {
      id: "eng-g8-rizal",
      className: "Grade 8 — Rizal",
      subject: "English",
      iconTone: "blue",
      students: 42,
      averageGrade: 84.2,
      requiringIntervention: 5,
      latestUpload: "July 12, 2026",
      reportStatus: "Not Generated",
    },
    {
      id: "math-g9-bonifacio",
      className: "Grade 9 — Bonifacio",
      subject: "Mathematics",
      iconTone: "violet",
      students: 40,
      averageGrade: 82.5,
      requiringIntervention: 7,
      latestUpload: "July 11, 2026",
      reportStatus: "Available",
    },
    {
      id: "ap-g10-aguinaldo",
      className: "Grade 10 — Aguinaldo",
      subject: "Araling Panlipunan",
      iconTone: "brown",
      students: 39,
      averageGrade: 88.1,
      requiringIntervention: 2,
      latestUpload: "July 10, 2026",
      reportStatus: "Available",
    },
    {
      id: "sci-g7-luna",
      className: "Grade 7 — Luna",
      subject: "Science",
      iconTone: "green",
      students: 45,
      averageGrade: 81.4,
      requiringIntervention: 4,
      latestUpload: "July 9, 2026",
      reportStatus: "Generating",
    },
    {
      id: "fil-g8-mabini",
      className: "Grade 8 — Mabini",
      subject: "Filipino",
      iconTone: "gold",
      students: 41,
      averageGrade: 85.0,
      requiringIntervention: 3,
      latestUpload: "July 8, 2026",
      reportStatus: "Approved",
    },
    {
      id: "mapeh-g9-delpilar",
      className: "Grade 9 — Del Pilar",
      subject: "MAPEH",
      iconTone: "pink",
      students: 41,
      averageGrade: 86.7,
      requiringIntervention: 1,
      latestUpload: "July 7, 2026",
      reportStatus: "Available",
    },
  ],
  preview: {
    "eng-g8-rizal": {
      title: "English — Grade 8 — Rizal",
      subtitle: "Report Preview · SY 2026-2027 · Q1",
      classInformation: {
        learningArea: "English",
        gradeSection: "Grade 8 — Rizal",
        quarter: "1st Quarter",
        teacher: "Sir Allan",
        schoolYear: "2026-2027",
        school: "CNHS",
      },
      academic: {
        classAverage: 84.2,
        passingRate: "80%",
        highestSubject: "MAPEH (90)",
        lowestSubject: "Mathematics (80.3)",
        requiringIntervention: 5,
      },
      attendance: {
        average: "93%",
        perfect: 1,
        below90: 3,
        chart: [
          { label: "Week 1", value: 94 },
          { label: "Week 2", value: 92 },
          { label: "Week 3", value: 93 },
          { label: "Week 4", value: 91 },
        ],
      },
      weakSubjects: [
        { subject: "Mathematics", learners: 4, percent: 100 },
        { subject: "English", learners: 3, percent: 75 },
        { subject: "Science", learners: 2, percent: 50 },
        { subject: "Filipino", learners: 1, percent: 25 },
        { subject: "Araling Panlipunan", learners: 1, percent: 25 },
        { subject: "MAPEH", learners: 0, percent: 0 },
      ],
      risk: [
        { level: "Priority", learners: 2, percent: "33%", tone: "red" },
        { level: "Moderate", learners: 3, percent: "50%", tone: "orange" },
        { level: "Low", learners: 1, percent: "17%", tone: "green" },
      ],
      intervention: {
        aralScreening: 2,
        classroomRemediation: 3,
        underMonitoring: 4,
        monitoringCompleted: 1,
        completionRate: "25%",
      },
      teacherRecommendations: {
        recommendAral: 2,
        continueRemediation: 2,
        showingImprovement: 1,
        immediateAttention: 1,
      },
      schoolSummary: {
        overallAverage: 84.6,
        totalLearners: 248,
        atRisk: 24,
        aralScreening: 5,
        classroomRemediation: 19,
        monitoringCompletionRate: "68%",
        lessonPlansApproved: 18,
        academicRecordsValidated: 6,
      },
    },
  },
};

export function getReportPreview(classId) {
  return (
    adminReportsData.preview[classId] ??
    adminReportsData.preview["eng-g8-rizal"]
  );
}

export function getClassReport(classId) {
  return (
    adminReportsData.classReports.find((item) => item.id === classId) ??
    adminReportsData.classReports[0]
  );
}
