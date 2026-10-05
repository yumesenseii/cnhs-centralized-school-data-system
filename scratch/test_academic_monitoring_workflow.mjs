import {
  computeAttendanceRate,
  computePerformanceTrend,
  deriveRecommendedSupport,
  buildDecisionSupport,
  buildPlpRecord,
  buildMonitoringRosterShell,
  applyRiskPredictionToLearner,
} from "../lib/teacher/monitoringMappers.js";

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`);
    process.exit(1);
  }
}

console.log("--- 1. Testing computeAttendanceRate ---");
const attFromRecord = computeAttendanceRate("stud-1", { present_days: 18, school_days: 20 });
assert(attFromRecord === "90%", `Expected 90%, got ${attFromRecord}`);

const attDeterministic = computeAttendanceRate("stud-2", null);
assert(attDeterministic.endsWith("%"), `Expected % format, got ${attDeterministic}`);
const num = parseInt(attDeterministic, 10);
assert(num >= 88 && num <= 98, `Expected between 88 and 98, got ${num}`);
console.log("✅ computeAttendanceRate tests passed.");

console.log("--- 2. Testing computePerformanceTrend ---");
assert(computePerformanceTrend(70, 78) === "Declining", "70 vs 78 should be Declining");
assert(computePerformanceTrend(82, 80) === "Improving", "82 vs 80 should be Improving");
assert(computePerformanceTrend(80, 80) === "Stable", "80 vs 80 should be Stable");
assert(computePerformanceTrend(74, 75) === "Stable", "74 vs 75 diff is 1, should be Stable");
assert(computePerformanceTrend(74, 77) === "Declining", "74 vs 77 should be Declining");
console.log("✅ computePerformanceTrend tests passed.");

console.log("--- 3. Testing deriveRecommendedSupport ---");
// Yuka Rinemoto: 70, 78, Declining, English
const yukaSupport = deriveRecommendedSupport({
  currentGrade: 70,
  previousGrade: 78,
  performanceTrend: "Declining",
  subject: "English",
  isAralEligible: true,
  philIriScore: 12,
  readingLevel: "Instructional",
  candidateStatus: "ARAL Candidate",
  monitoringStatus: "Not Started",
});
assert(yukaSupport.support === "ARAL Screening", `Expected ARAL Screening for Yuka, got ${yukaSupport.support}`);
assert(yukaSupport.supportReason.includes("reading intervention screening"), "Expected reading screening rationale");

// Juan Santos: 82, 80, Stable, Science
const juanSupport = deriveRecommendedSupport({
  currentGrade: 82,
  previousGrade: 80,
  performanceTrend: "Stable",
  subject: "Science",
  isAralEligible: false,
  philIriScore: null,
  readingLevel: "Independent",
  candidateStatus: null,
  monitoringStatus: "Not Started",
});
assert(juanSupport.support === "None", `Expected None for Juan, got ${juanSupport.support}`);

// Science learner below 75: Class Remedial
const scienceRemedial = deriveRecommendedSupport({
  currentGrade: 70,
  previousGrade: 78,
  performanceTrend: "Declining",
  subject: "Science",
  isAralEligible: false,
  philIriScore: null,
  readingLevel: "Instructional",
  candidateStatus: null,
  monitoringStatus: "Not Started",
});
assert(scienceRemedial.support === "Class Remedial", `Expected Class Remedial for Science, got ${scienceRemedial.support}`);
assert(scienceRemedial.supportReason.includes("continued difficulty in Science"), "Expected Science difficulty rationale");

// Maria Cruz: 74, 77, Declining, Math
const mariaSupport = deriveRecommendedSupport({
  currentGrade: 74,
  previousGrade: 77,
  performanceTrend: "Declining",
  subject: "Mathematics",
  isAralEligible: false,
  philIriScore: null,
  readingLevel: "Instructional",
  candidateStatus: null,
  monitoringStatus: "Ongoing",
});
assert(mariaSupport.support === "Class Remedial" || mariaSupport.support === "Review", `Expected Review or Remedial, got ${mariaSupport.support}`);
console.log("✅ deriveRecommendedSupport tests passed.");

console.log("--- 4. Testing buildDecisionSupport ---");
const ds = buildDecisionSupport({
  riskLevel: "Moderate Risk",
  confidence: 0.82,
  performanceTrend: "Declining",
  currentGrade: 70,
  previousGrade: 78,
  readingLevel: "Instructional",
  philIriScore: 12,
  attendanceRate: "89%",
  subject: "English",
});
assert(ds.riskLevel === "Moderate", `Expected Moderate, got ${ds.riskLevel}`);
assert(ds.modelConfidenceDisplay === "82%", `Expected 82%, got ${ds.modelConfidenceDisplay}`);
assert(ds.contributingIndicators.length >= 3, `Expected at least 3 indicators, got ${ds.contributingIndicators.length}`);
assert(
  ds.disclaimer === "Random Forest serves as analytical decision support and does not supersede official DepEd assessment rules.",
  "Expected exact DepEd disclaimer"
);
console.log("✅ buildDecisionSupport tests passed.");

console.log("--- 5. Testing buildPlpRecord ---");
const plp = buildPlpRecord({
  studentName: "Yuka Rinemoto",
  subject: "English",
  currentGrade: 70,
  previousGrade: 78,
  performanceTrend: "Declining",
  readingLevel: "Instructional",
  philIriScore: 12,
  support: "Class Remedial",
  supportReason: "Recent academic performance shows continued difficulty in English.",
});
assert(plp.learningNeed.includes("English"), "PLP should mention subject in learning need");
assert(plp.evidence.includes("70"), "PLP should include current grade in evidence");
assert(plp.recommendedIntervention === "Class Remedial", "PLP should have recommended intervention");
assert(plp.progressMonitoring.includes("Continue monitoring"), "PLP should have progress monitoring note");
console.log("✅ buildPlpRecord tests passed.");

console.log("--- 6. Testing buildMonitoringRosterShell integration ---");
const shell = buildMonitoringRosterShell({
  classes: [
    {
      id: "class-1",
      school_year: "SY 2026-2027",
      quarter: 1,
      subject_id: "subj-1",
      section_id: "sec-1",
      subjects: { subject_name: "English" },
      sections: { grade_level: 7, section_name: "Gumamela" },
      teachers: { first_name: "Yukari", last_name: "Nemoto" },
    },
  ],
  enrollments: [
    {
      id: "enr-1",
      class_id: "class-1",
      student_id: "stud-1",
      students: {
        id: "stud-1",
        student_number: "109283748291",
        first_name: "Yuka",
        last_name: "Rinemoto",
        sex: "Female",
      },
    },
  ],
  grades: [
    {
      id: "g-1",
      student_id: "stud-1",
      class_id: "class-1",
      subject_id: "subj-1",
      quarter: 1,
      final_grade: 70,
      school_year: "SY 2026-2027",
      subjects: { subject_name: "English" },
    },
  ],
  monitoringRecords: [],
  philIriRecords: [
    {
      student_id: "stud-1",
      total_score: 12,
      reading_level: "Instructional",
      screening_interpretation: "2 levels lower Phil-IRI testing",
      candidate_status: "ARAL Candidate",
    },
  ],
  attendanceRecords: [
    {
      student_id: "stud-1",
      present_days: 16,
      school_days: 18,
    },
  ],
});

assert(shell.students.length === 1, "Expected 1 student in shell");
const s = shell.students[0];
assert(s.name === "Yuka Rinemoto", `Expected Yuka Rinemoto, got ${s.name}`);
assert(s.currentGrade === 70, `Expected 70, got ${s.currentGrade}`);
assert(s.philIriScore === 12, `Expected 12, got ${s.philIriScore}`);
assert(s.readingLevel === "Instructional", `Expected Instructional, got ${s.readingLevel}`);
assert(s.attendanceRate === "89%", `Expected 89% (16/18), got ${s.attendanceRate}`);
assert(s.recommendedSupport === "ARAL Screening", `Expected ARAL Screening, got ${s.recommendedSupport}`);
assert(s.decisionSupport.disclaimer.includes("official DepEd assessment rules"), "Disclaimer present");
assert(s.plp.learningNeed.length > 0, "PLP learning need present");
console.log("✅ buildMonitoringRosterShell integration tests passed.");

console.log("--- 7. Testing applyRiskPredictionToLearner ---");
const enriched = applyRiskPredictionToLearner(s, {
  recommendationType: "ARAL Program",
  confidence: 0.85,
  riskLevel: "High Risk",
  probabilities: { "High Risk": 0.85, "Moderate Risk": 0.15 },
});
assert(enriched.decisionSupport.modelConfidenceDisplay === "85%", "Decision support confidence updated");
assert(enriched.plp.recommendedIntervention === "ARAL Screening", "PLP intervention intact");
assert(enriched.attendanceRate === "89%", "Attendance rate preserved");
console.log("✅ applyRiskPredictionToLearner tests passed.");

console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
