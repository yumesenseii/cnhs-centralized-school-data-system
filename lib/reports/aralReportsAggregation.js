/**
 * aralReportsAggregation.js
 * Canonical reporting engine for:
 * 1. Teacher / ARAL Facilitator Reports
 * 2. Principal ARAL Reports
 * 3. Principal ARAL Outcomes
 *
 * Implements strict DepEd reporting safeguards:
 * - Single source of truth: operates on canonical ARAL cases from aggregateAralLearners
 * - No "In Progress" as outcome: Under ARAL Support is a workflow state, not an outcome
 * - Terms (Term 1-3) and Assessment Periods (BOSY/MOSY/EOSY) kept strictly separate
 * - Accurate Reading Profile percentages: denominator is strictly learners with valid profiles
 * - Matched learners for progress comparison: only compares learners with results in both periods
 * - Canonical unique ARAL cases: deduplicated by learner + language + school year
 */

import { evaluateGstScore, formatGradeSection } from "../monitoring/philIriEvaluation.js";
import { normalizeAralPeriod, aralPeriodLabel } from "../monitoring/assessmentTimeline.js";
import { getSimplifiedAralStatus } from "../monitoring/aralAcademicStatus.js";

/**
 * Extracts the authoritative Phil-IRI Reading Profile for a learner.
 * Returns: "Independent" | "Instructional" | "Frustration" | null.
 */
export function getAuthoritativeReadingProfile(learner) {
  if (!learner) return null;

  const raw =
    learner.readingProfile ||
    learner.oralReadingProfile ||
    learner.readingLevel ||
    learner.iraReadingProfile;

  if (raw && typeof raw === "string") {
    const s = raw.trim().toLowerCase();
    if (s === "independent") return "Independent";
    if (s === "instructional") return "Instructional";
    if (s === "frustration") return "Frustration";
  }

  // Reading Profile (Independent, Instructional, Frustration) is established
  // ONLY by Form 3 / Individual Reading Assessment, never from GST alone.
  return null;
}

/**
 * Resolves the completed assessment/support outcome for a learner.
 * SAFEGUARD 1: "Under ARAL Support" or "In Progress" is a workflow state, NOT an outcome.
 * Outcomes only contain completed assessment or milestone dispositions.
 *
 * Returns: "No Further Support Needed" | "Completed Support" | "Needs Continued Support" | "Summer Eligible" | null
 */
export function resolveLearnerOutcome(learner, aralPeriod = "BOSY") {
  if (!learner) return null;
  const normPeriod = normalizeAralPeriod(aralPeriod) || "BOSY";

  const rawOutcome = String(learner.outcome || learner.movementOutcome || "").trim().toLowerCase();
  const mStatus = String(learner.monitoringStatus || "").trim().toLowerCase();
  const eosyDec = String(learner.eosyDecision || "").trim().toLowerCase();
  const aralSt = String(learner.aralStatus || learner.interventionStatus || "").trim().toLowerCase();
  const stepKey = learner.currentStepKey;

  // 1. Summer Eligible (Only relevant and valid in EOSY stage)
  if (
    normPeriod === "EOSY" &&
    (learner.summerStatus === "Eligible" ||
      eosyDec === "aral summer referral" ||
      learner.isSummerEligible === true ||
      rawOutcome === "summer eligible")
  ) {
    return "Summer Eligible";
  }

  // 2. Explicit milestone outcome: Needs Continued Support
  if (
    mStatus === "needs further support" ||
    mStatus === "needs continued support" ||
    mStatus === "for further monitoring" ||
    eosyDec === "needs continued support" ||
    rawOutcome === "needs continued support"
  ) {
    return "Needs Continued Support";
  }

  // 3. Completed Support
  const isCompleted =
    stepKey === "completed" ||
    aralSt === "completed" ||
    aralSt === "exit aral" ||
    mStatus === "completed" ||
    rawOutcome === "completed support" ||
    rawOutcome === "promoted";

  const profile = getAuthoritativeReadingProfile(learner);

  // If learner assessed as Independent and never required ARAL sessions
  if (stepKey === "assessment_complete_no_support" || profile === "Independent") {
    if (!learner.inAralProgram && aralSt !== "completed") {
      return "No Further Support Needed";
    }
  }

  if (isCompleted) {
    if (profile === "Independent") {
      return "No Further Support Needed";
    }
    return "Completed Support";
  }

  if (rawOutcome === "no further support needed") {
    return "No Further Support Needed";
  }

  // Under ARAL Support / In Progress during active cycle without milestone disposition has NO outcome yet
  return null;
}

/**
 * Computes Facilitator Report data for an individual teacher.
 * SAFEGUARD 5 & 8: Takes canonical learners array from aggregateAralLearners.
 */
export function computeFacilitatorReportData(
  canonicalLearners = [],
  {
    teacherId = null,
    teacherName = "",
    schoolYear = "SY 2026-2027",
    aralPeriod = "BOSY",
    grade = "All Grades",
    language = "All Languages",
  } = {}
) {
  const normPeriod = normalizeAralPeriod(aralPeriod) || "BOSY";

  // Check if teacher is assigned facilitator for any learner
  const assignedLearners = canonicalLearners.filter((l) => {
    if (l.isAssignedToMe) return true;
    if (teacherId && l.aralFacilitatorTeacherId === teacherId) return true;
    if (teacherName && l.aralFacilitatorName && l.aralFacilitatorName.toLowerCase() === teacherName.toLowerCase()) {
      return true;
    }
    return false;
  });

  const isAssignedFacilitator = assignedLearners.length > 0;
  // If teacher has assigned facilitation cases, focus on them; otherwise show reading analytics for enrolled class learners
  const targetLearners = isAssignedFacilitator ? assignedLearners : canonicalLearners;

  if (!targetLearners.length) {
    const referredLearners = canonicalLearners.filter((l) => {
      if (l.isReferredByMe) return true;
      if (teacherId && l.referredByTeacherId === teacherId) return true;
      if (teacherName && l.referredBy && l.referredBy.toLowerCase() === teacherName.toLowerCase()) {
        return true;
      }
      return false;
    });

    return {
      isFacilitator: false,
      isAssignedFacilitator: false,
      referredLearners,
      schoolYear,
      aralPeriod: normPeriod,
      totalReferred: referredLearners.length,
    };
  }

  // Filter target learners by Grade and Language (No unrelated subjects)
  const filtered = targetLearners.filter((l) => {
    if (grade && grade !== "All Grades") {
      const cleanTarget = String(grade).replace(/^Grade\s+/i, "").trim();
      const cleanLearnerGrade = String(l.grade || "").replace(/^Grade\s+/i, "").trim();
      if (cleanLearnerGrade !== cleanTarget) return false;
    }
    if (language && language !== "All Languages") {
      if (String(l.language || "").toLowerCase() !== String(language).toLowerCase()) {
        return false;
      }
    }
    return true;
  });

  // 2. Canonical Status Aggregations
  const statusCounts = {
    pending: 0,
    needsAssessment: 0,
    screeningComplete: 0,
    completed: 0,
    followUp: 0,
    forReview: 0,
  };

  for (const l of filtered) {
    const st = getSimplifiedAralStatus(l);
    if (st.label === "Needs Assessment") statusCounts.needsAssessment++;
    else if (st.label === "Screening Complete") statusCounts.screeningComplete++;
    else if (st.label === "Completed") statusCounts.completed++;
    else if (st.label === "Follow-Up Required") statusCounts.followUp++;
    else if (st.label === "ARAL Eligible — For Review") statusCounts.forReview++;
    else statusCounts.pending++;
  }

  const assignedCount = filtered.length;
  const waitingAssessmentCount = statusCounts.pending;
  const needsIraCount = statusCounts.needsAssessment;
  const screeningCompleteCount = statusCounts.screeningComplete;
  const assessmentCompleteCount = statusCounts.completed;
  const forReviewCount = statusCounts.forReview;
  const totalCompleteCount = screeningCompleteCount + assessmentCompleteCount;

  const summaryCounts = {
    assigned: assignedCount,
    waitingForAssessment: waitingAssessmentCount,
    needsIndividualAssessment: needsIraCount,
    underAralSupport: totalCompleteCount,
    completed: totalCompleteCount,
    screeningComplete: screeningCompleteCount,
    assessmentComplete: assessmentCompleteCount,
    forReview: forReviewCount,
    followUp: statusCounts.followUp,
  };

  // 3. Table 1: Assessment Status (Canonical 7 statuses)
  const assessmentStatusTable = [
    { status: "Pending Screening", learners: statusCounts.pending },
    { status: "Needs Assessment (Form 3)", learners: statusCounts.needsAssessment },
    { status: "Screening Complete", learners: statusCounts.screeningComplete },
    { status: "Assessment Completed", learners: statusCounts.completed },
    { status: "Follow-Up Required", learners: statusCounts.followUp },
    { status: "ARAL Eligible — For Review", learners: statusCounts.forReview },
  ];

  // 4. Table 2: Reading Profile Report (SAFEGUARD 3: Denominator is strictly learners with valid profiles)
  let indepCount = 0;
  let instrCount = 0;
  let frustCount = 0;

  for (const l of filtered) {
    const p = getAuthoritativeReadingProfile(l);
    if (p === "Independent") indepCount++;
    else if (p === "Instructional") instrCount++;
    else if (p === "Frustration") frustCount++;
  }

  const totalAssessed = indepCount + instrCount + frustCount;
  const hasReadingProfiles = totalAssessed > 0;

  const calcPct = (cnt) => {
    if (!totalAssessed) return 0;
    return Math.round((cnt / totalAssessed) * 1000) / 10;
  };

  const readingProfileTable = [
    { profile: "Independent", count: indepCount, percentage: calcPct(indepCount) },
    { profile: "Instructional", count: instrCount, percentage: calcPct(instrCount) },
    { profile: "Frustration", count: frustCount, percentage: calcPct(frustCount) },
  ];

  const readingProfileChartData = [
    { profile: "Independent", count: indepCount, fill: "#166534" },
    { profile: "Instructional", count: instrCount, fill: "#2563eb" },
    { profile: "Frustration", count: frustCount, fill: "#dc2626" },
  ];

  // 5. Short rule-based interpretation (Actual counts only, no speculative AI)
  let shortInterpretation = "";
  if (hasReadingProfiles) {
    if (instrCount >= indepCount && instrCount >= frustCount) {
      shortInterpretation = `Most assessed learners (${instrCount}) are currently at the Instructional level. ${
        frustCount > 0
          ? `${frustCount} learner${frustCount === 1 ? "" : "s"} remain at the Frustration level and require closer reading support.`
          : "No learners are at the Frustration level."
      }`;
    } else if (frustCount >= indepCount && frustCount >= instrCount) {
      shortInterpretation = `${frustCount} assessed learner${
        frustCount === 1 ? " is" : "s are"
      } currently at the Frustration level and require intensive, focused reading intervention.`;
    } else {
      shortInterpretation = `Most assessed learners (${indepCount}) have achieved the Independent reading level. ${
        frustCount > 0
          ? `${frustCount} learner${frustCount === 1 ? "" : "s"} remain at the Frustration level and require reading support.`
          : ""
      }`.trim();
    }
  }

  // 6. Facilitator Progress Report (SAFEGUARD 4: Matched learners comparison)
  // Check if historical period data exists for matched learners
  let progressReport = null;
  const matchedLearners = filtered.filter((l) => {
    const hasBosy = Boolean(l.bosyProfile || l.bosyScore != null || (normPeriod === "MOSY" && l.philIriScore != null));
    const hasCurrent = Boolean(l.mosyProfile || l.mosyScore != null || l.readingProfile);
    return hasBosy && hasCurrent && normPeriod !== "BOSY";
  });

  if (matchedLearners.length > 0 && normPeriod !== "BOSY") {
    // Tally BOSY vs Current
    let bosyFrust = 0, bosyInstr = 0, bosyIndep = 0;
    let currFrust = 0, currInstr = 0, currIndep = 0;

    for (const l of matchedLearners) {
      const bProf = l.bosyProfile || (l.philIriScore != null ? getAuthoritativeReadingProfile(l) : null);
      if (bProf === "Frustration") bosyFrust++;
      else if (bProf === "Instructional") bosyInstr++;
      else if (bProf === "Independent") bosyIndep++;

      const cProf = l.mosyProfile || getAuthoritativeReadingProfile(l);
      if (cProf === "Frustration") currFrust++;
      else if (cProf === "Instructional") currInstr++;
      else if (cProf === "Independent") currIndep++;
    }

    const fmtChange = (c, b) => {
      const diff = c - b;
      if (diff > 0) return `↑ ${diff}`;
      if (diff < 0) return `↓ ${Math.abs(diff)}`;
      return "—";
    };

    progressReport = {
      isAvailable: true,
      isMatched: true,
      label: `READING PROGRESS (${matchedLearners.length} learners with comparable BOSY and ${normPeriod} results)`,
      rows: [
        { profile: "Frustration", bosy: bosyFrust, current: currFrust, change: fmtChange(currFrust, bosyFrust) },
        { profile: "Instructional", bosy: bosyInstr, current: currInstr, change: fmtChange(currInstr, bosyInstr) },
        { profile: "Independent", bosy: bosyIndep, current: currIndep, change: fmtChange(currIndep, bosyIndep) },
      ],
    };
  } else {
    progressReport = {
      isAvailable: false,
      notice: "Progress comparison will appear after the next applicable assessment period.",
    };
  }

  // 7. Learner Breakdown Rows (Read-only for reports)
  const learnerBreakdown = filtered.map((l) => ({
    id: l.id || l.studentId,
    name: l.name || `${l.lastName || ""}, ${l.firstName || ""}`.trim() || "Learner",
    gradeSection: l.gradeSectionDisplay || formatGradeSection(l.grade, l.section),
    language: l.language || l.subject || "English",
    readingProfile: getAuthoritativeReadingProfile(l) || "Not Screened",
    currentAralStatus: l.currentStepLabel || "Waiting for Assessment",
  }));

  return {
    isFacilitator: true,
    schoolYear,
    aralPeriod: normPeriod,
    summaryCounts,
    assessmentStatusTable,
    readingProfileTable,
    readingProfileChartData,
    totalAssessed,
    hasReadingProfiles,
    shortInterpretation,
    progressReport,
    learnerBreakdown,
  };
}

/**
 * Computes Principal ARAL Reports & Outcomes.
 * SAFEGUARD 1, 2, 6, 8:
 * - Operates strictly on canonical unique ARAL cases
 * - Differentiates Term trends vs Reading Assessment progress
 * - No "In Progress" as an outcome
 */
export function computePrincipalAralReportData(
  canonicalLearners = [],
  {
    schoolYear = "SY 2026-2027",
    quarter = "",
    aralPeriod = "BOSY",
  } = {}
) {
  const normPeriod = normalizeAralPeriod(aralPeriod) || "BOSY";

  // Filter canonical learners for current school year
  const yearCases = canonicalLearners.filter((l) => {
    if (!schoolYear) return true;
    return !l.schoolYear || l.schoolYear === schoolYear;
  });

  // 8. Principal ARAL Summary (4 Scoped Cards)
  // 8. Principal ARAL Summary (4 Scoped Cards)
  const waitingAssessment = yearCases.filter((l) => {
    return l.currentStepKey === "waiting_for_assessment" || l.currentStepKey === "absent_reschedule";
  }).length;

  const needsIra = yearCases.filter((l) => {
    return l.currentStepKey === "needs_individual_assessment" || l.currentStepKey === "gst_under_review";
  }).length;

  const assessedCount = yearCases.filter((l) => {
    return l.currentStepKey === "screening_complete_at_grade" || l.currentStepKey === "assessment_complete" || l.currentStepKey === "completed";
  }).length;

  const forReviewCount = yearCases.filter((l) => {
    return l.currentStepKey === "for_review";
  }).length;

  const summaryCards = [
    {
      label: "Total Enrolled",
      value: yearCases.length,
      desc: "Enrolled in English & Filipino reading classes",
    },
    {
      label: "Needs Screening",
      value: waitingAssessment,
      desc: "Initial GST screening test pending",
    },
    {
      label: "Needs Reading Assessment",
      value: needsIra,
      desc: "Score < 28 — Form 3 passage assessment needed",
    },
    {
      label: "Assessment Complete",
      value: assessedCount,
      desc: forReviewCount > 0 ? `${assessedCount} completed (${forReviewCount} for EOSY review)` : `${assessedCount} completed reading assessments`,
    },
  ];

  const underSupport = yearCases.filter((l) => {
    return (
      l.currentStepKey === "under_aral_support" ||
      l.currentStepKey === "progress_check_due" ||
      l.inAralProgram === true
    );
  }).length;

  // Outcomes: only resolved, non-null outcomes (Safeguard 1)
  const validOutcomesList = [];
  for (const l of yearCases) {
    const outcome = resolveLearnerOutcome(l, normPeriod);
    if (outcome) {
      validOutcomesList.push({
        learner: l,
        outcome,
      });
    }
  }

  const outcomesCount = validOutcomesList.length;

  // 9 & 10. Term-Based ARAL Trend & Term Movement (SAFEGUARDS 2 & 6)
  // Track term-based workflow records: New Referrals, Started Support, Completed / Exited
  const currentQuarterNum = Number(quarter) || 1;
  const isComparableTermAvailable = currentQuarterNum > 1;

  // Derive term movements from actual records
  const newReferrals = yearCases.filter((l) => {
    const q = Number(l.quarter || l.referralQuarter || 1);
    return q === currentQuarterNum;
  }).length;

  const startedSupport = yearCases.filter((l) => {
    return (
      (l.currentStepKey === "under_aral_support" || l.inAralProgram) &&
      Number(l.quarter || 1) === currentQuarterNum
    );
  }).length;

  const completedExited = validOutcomesList.filter(({ learner }) => {
    return (
      learner.currentStepKey === "completed" ||
      learner.aralStatus === "Completed" ||
      Number(learner.quarter || 1) === currentQuarterNum
    );
  }).length;

  const netChange = startedSupport - completedExited;

  let trendData = null;
  if (isComparableTermAvailable) {
    // Derive previous term active cases
    const prevTermCount = Math.max(0, underSupport - netChange);
    const diff = underSupport - prevTermCount;
    const directionText =
      diff < 0
        ? "Fewer learners currently need ARAL support compared with the previous term."
        : diff > 0
          ? "More learners currently need ARAL support compared with the previous term."
          : "ARAL support volume is steady compared with the previous term.";

    trendData = {
      isAvailable: true,
      previousTermLabel: `Term ${currentQuarterNum - 1}`,
      previousTermCount: prevTermCount,
      currentTermLabel: `Term ${currentQuarterNum}`,
      currentTermCount: underSupport,
      changeText: diff < 0 ? `↓ ${Math.abs(diff)} learners` : diff > 0 ? `↑ ${diff} learners` : "0 learners",
      directionText,
    };
  } else {
    trendData = {
      isAvailable: false,
      notice: "Trend will appear when a previous comparable term is available.",
    };
  }

  const termMovement = {
    newReferrals,
    startedSupport,
    completedExited,
    netChangeText: netChange < 0 ? `↓ ${Math.abs(netChange)}` : netChange > 0 ? `↑ ${netChange}` : "0",
  };

  // 11. ARAL Status by Grade (Grades 7, 8, 9, 10 - Valid ARAL cases only)
  const gradeCounts = {
    "Grade 7": 0,
    "Grade 8": 0,
    "Grade 9": 0,
    "Grade 10": 0,
  };

  for (const l of yearCases) {
    const rawG = String(l.grade || "");
    const match = rawG.match(/\b(7|8|9|10)\b/);
    if (match) {
      const gKey = `Grade ${match[1]}`;
      if (gradeCounts[gKey] !== undefined) {
        gradeCounts[gKey]++;
      }
    }
  }

  const gradeChartData = Object.entries(gradeCounts).map(([grade, learners]) => ({
    grade,
    learners,
  }));

  // 12. Section Summary Table (Section, Total Cases, Waiting for Assessment, Under ARAL Support, Completed / Outcomes)
  const sectionMap = new Map();

  for (const l of yearCases) {
    const secName = l.gradeSectionDisplay || formatGradeSection(l.grade, l.section) || "Unassigned";
    if (!sectionMap.has(secName)) {
      sectionMap.set(secName, {
        section: secName,
        totalCases: 0,
        waitingAssessment: 0,
        underSupport: 0,
        completedOutcomes: 0,
      });
    }

    const row = sectionMap.get(secName);
    row.totalCases++;

    if (l.currentStepKey === "waiting_for_assessment" || (l.aralFacilitatorAssigned && l.philIriScore == null)) {
      row.waitingAssessment++;
    } else if (l.currentStepKey === "under_aral_support" || l.inAralProgram) {
      row.underSupport++;
    }

    if (resolveLearnerOutcome(l, normPeriod) != null) {
      row.completedOutcomes++;
    }
  }

  const sectionSummaryTable = Array.from(sectionMap.values()).sort((a, b) =>
    a.section.localeCompare(b.section)
  );

  // 13 & 14. Principal Outcomes Summary (SAFEGUARD 1)
  let noSupportNeededCount = 0;
  let completedSupportCount = 0;
  let needsContinuedCount = 0;
  let summerEligibleCount = 0;

  for (const { outcome } of validOutcomesList) {
    if (outcome === "No Further Support Needed") noSupportNeededCount++;
    else if (outcome === "Completed Support") completedSupportCount++;
    else if (outcome === "Needs Continued Support") needsContinuedCount++;
    else if (outcome === "Summer Eligible") summerEligibleCount++;
  }

  const outcomeCategoriesSummary = [
    { label: "No Further Support Needed", count: noSupportNeededCount },
    { label: "Completed Support", count: completedSupportCount },
    { label: "Needs Continued Support", count: needsContinuedCount },
    ...(normPeriod === "EOSY" ? [{ label: "Summer Eligible", count: summerEligibleCount }] : []),
  ];

  // 15. Outcomes Table (Learner, Grade & Sec, Language, Latest Reading Profile, Outcome, Period, Action)
  const outcomesTableRows = validOutcomesList.map(({ learner, outcome }) => ({
    id: learner.id || learner.studentId,
    learnerName: learner.name || `${learner.lastName || ""}, ${learner.firstName || ""}`.trim() || "Learner",
    gradeSection: learner.gradeSectionDisplay || formatGradeSection(learner.grade, learner.section),
    language: learner.language || learner.subject || "English",
    latestReadingProfile: getAuthoritativeReadingProfile(learner) || "—",
    outcome,
    assessmentPeriod: normPeriod,
    rawLearner: learner,
  }));

  return {
    schoolYear,
    quarter: quarter || "All Terms",
    aralPeriod: normPeriod,
    summaryCards,
    trendData,
    termMovement,
    gradeChartData,
    sectionSummaryTable,
    hasOutcomes: outcomesCount > 0,
    outcomeCategoriesSummary,
    outcomesTableRows,
  };
}

/**
 * Computes Form 2: School Reading Profile (Consolidated School-Level Report).
 * Reconciled 100% with canonical learner records.
 */
export function computeSchoolReadingProfileForm2(
  canonicalLearners = [],
  { schoolYear = "SY 2026-2027", language = "All Languages", aralPeriod = "BOSY" } = {}
) {
  const normPeriod = normalizeAralPeriod(aralPeriod) || "BOSY";

  const filtered = canonicalLearners.filter((l) => {
    if (schoolYear && l.schoolYear && l.schoolYear !== schoolYear) return false;
    if (language !== "All Languages" && l.language && l.language.toLowerCase() !== language.toLowerCase()) {
      return false;
    }
    return true;
  });

  const grades = ["Grade 7", "Grade 8", "Grade 9", "Grade 10"];
  const rows = grades.map((gradeLabel) => {
    const num = gradeLabel.replace(/\D/g, "");
    const gradeCases = filtered.filter((l) => {
      const g = String(l.grade || "");
      return g.includes(num);
    });

    let totalCases = gradeCases.length;
    let assessed = 0;
    let atGradeLevel = 0;
    let twoLevelsDown = 0;
    let threeLevelsDown = 0;
    let form3Assessed = 0;
    let form3Independent = 0;
    let form3Instructional = 0;
    let form3Frustration = 0;

    for (const l of gradeCases) {
      if (l.philIriScore != null) {
        assessed++;
        const s = Number(l.philIriScore);
        if (s >= 28) {
          atGradeLevel++;
        } else if (s >= 16) {
          twoLevelsDown++;
        } else {
          threeLevelsDown++;
        }
      }

      const p = getAuthoritativeReadingProfile(l);
      if (p) {
        form3Assessed++;
        if (p === "Independent") form3Independent++;
        else if (p === "Instructional") form3Instructional++;
        else if (p === "Frustration") form3Frustration++;
      }
    }

    return {
      grade: gradeLabel,
      totalCases,
      assessed,
      atGradeLevel,
      twoLevelsDown,
      threeLevelsDown,
      form3Assessed,
      form3Independent,
      form3Instructional,
      form3Frustration,
    };
  });

  const total = rows.reduce(
    (acc, r) => ({
      grade: "Total",
      totalCases: acc.totalCases + r.totalCases,
      assessed: acc.assessed + r.assessed,
      atGradeLevel: acc.atGradeLevel + r.atGradeLevel,
      twoLevelsDown: acc.twoLevelsDown + r.twoLevelsDown,
      threeLevelsDown: acc.threeLevelsDown + r.threeLevelsDown,
      form3Assessed: acc.form3Assessed + r.form3Assessed,
      form3Independent: acc.form3Independent + r.form3Independent,
      form3Instructional: acc.form3Instructional + r.form3Instructional,
      form3Frustration: acc.form3Frustration + r.form3Frustration,
    }),
    {
      grade: "Total",
      totalCases: 0,
      assessed: 0,
      atGradeLevel: 0,
      twoLevelsDown: 0,
      threeLevelsDown: 0,
      form3Assessed: 0,
      form3Independent: 0,
      form3Instructional: 0,
      form3Frustration: 0,
    }
  );

  return { rows, total, aralPeriod: normPeriod, schoolYear, language };
}

/**
 * Computes Form 5: Phil-IRI School Summary Report on Learners' Reading Level.
 * Official DepEd summary table by reading level.
 */
export function computePhilIriSchoolSummaryForm5(
  canonicalLearners = [],
  { schoolYear = "SY 2026-2027", language = "All Languages", aralPeriod = "BOSY" } = {}
) {
  const normPeriod = normalizeAralPeriod(aralPeriod) || "BOSY";

  const profileData = computeSchoolReadingProfileForm2(canonicalLearners, {
    schoolYear,
    language,
    aralPeriod: normPeriod,
  });

  const rows = profileData.rows.map((r) => {
    const requiringSupport = r.form3Instructional + r.form3Frustration;
    return {
      grade: r.grade,
      totalScreened: r.assessed,
      atGradeLevel: r.atGradeLevel,
      instructional: r.form3Instructional,
      frustration: r.form3Frustration,
      independent: r.form3Independent,
      requiringSupport,
    };
  });

  const total = {
    grade: "Total",
    totalScreened: profileData.total.assessed,
    atGradeLevel: profileData.total.atGradeLevel,
    instructional: profileData.total.form3Instructional,
    frustration: profileData.total.form3Frustration,
    independent: profileData.total.form3Independent,
    requiringSupport: profileData.total.form3Instructional + profileData.total.form3Frustration,
  };

  return { rows, total, aralPeriod: normPeriod, schoolYear, language };
}

