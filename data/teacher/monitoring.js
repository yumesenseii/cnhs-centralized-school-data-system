export const monitoringByStudent = {
  "miguel-torres": {
    weekly: [
      {
        id: "w1",
        week: "Week 1",
        status: "Needs Monitoring",
        statusTone: "red",
        observation: "Difficulty during English activities and oral reading.",
        participation: "Low",
        assessmentScore: 62,
        progress: "Limited",
        submittedDate: "July 1, 2026",
      },
      {
        id: "w2",
        week: "Week 2",
        status: "Flagged",
        statusTone: "red",
        observation: "Incomplete work; referred for additional support.",
        participation: "Low",
        assessmentScore: 60,
        progress: "No improvement",
        submittedDate: "July 8, 2026",
      },
      {
        id: "w3",
        week: "Week 3",
        status: "In Progress",
        statusTone: "blue",
        observation: "One-on-one remediation session conducted.",
        participation: "Moderate",
        assessmentScore: 68,
        progress: "Gradual improvement",
        submittedDate: "July 15, 2026",
      },
      {
        id: "w4",
        week: "Week 4",
        status: "Pending",
        statusTone: "slate",
        observation: "Awaiting entry.",
        participation: "—",
        assessmentScore: null,
        progress: "Pending",
        submittedDate: null,
      },
    ],
    history: [
      {
        id: "h1",
        date: "July 15, 2026",
        week: "Week 3",
        observation: "One-on-one remediation session conducted.",
        progress: "Gradual improvement",
        submittedBy: "Allan A. Marcelo",
        status: "Submitted",
      },
      {
        id: "h2",
        date: "July 8, 2026",
        week: "Week 2",
        observation: "Incomplete work; referred for additional support.",
        progress: "No improvement",
        submittedBy: "Allan A. Marcelo",
        status: "Flagged",
      },
      {
        id: "h3",
        date: "July 1, 2026",
        week: "Week 1",
        observation: "Difficulty during English activities and oral reading.",
        progress: "Limited",
        submittedBy: "Allan A. Marcelo",
        status: "Submitted",
      },
    ],
    recommendationOptions: [
      "Continue Monitoring",
      "Continue Classroom Remediation",
      "Recommend for ARAL Learners",
      "Recommend Completion",
      "Needs Parent Conference",
    ],
    defaultRecommendation: "Recommend for ARAL Learners",
    defaultRemarks:
      "Based on weekly monitoring and academic performance, I recommend Miguel Torres for ARAL Learners. English remains critically low despite classroom remediation support.",
  },
};

export function getMonitoringForStudent(studentId) {
  return monitoringByStudent[studentId] ?? monitoringByStudent["miguel-torres"];
}
