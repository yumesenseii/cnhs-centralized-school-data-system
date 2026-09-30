import fs from "fs";
import path from "path";

let cachedRecords = null;
let cachedLearners = null;

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Loads and parses the SY 2025-2026 historical dataset from disk.
 */
export function loadCnhsHistoricalRecords() {
  if (cachedRecords) return cachedRecords;

  const csvPath = path.join(
    process.cwd(),
    "data",
    "synthetic",
    "CNHS_LEARN_Synthetic_Historical_Learners.csv"
  );

  if (!fs.existsSync(csvPath)) {
    console.warn(`Historical dataset CSV not found at ${csvPath}`);
    return [];
  }

  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return [];

  const headers = parseCsvLine(lines[0]);
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length < headers.length) continue;

    const row = {};
    headers.forEach((h, idx) => {
      let val = values[idx];
      if (val === "" || val === "None" || val === "null" || val === undefined) {
        val = null;
      } else if (!isNaN(Number(val)) && val !== "N/A" && !h.includes("id") && !h.includes("tier")) {
        val = Number(val);
      }
      row[h] = val;
    });

    records.push(row);
  }

  cachedRecords = records;
  return records;
}

/**
 * Groups records into learner trajectories (1 learner = 3 terms).
 */
export function loadCnhsLearnerTrajectories() {
  if (cachedLearners) return cachedLearners;

  const records = loadCnhsHistoricalRecords();
  const map = new Map();

  for (const r of records) {
    const id = r.learner_id;
    if (!map.has(id)) {
      map.set(id, {
        learnerId: id,
        schoolYear: r.school_year,
        gradeLevel: r.grade_level,
        weakSubject: r.weak_subject,
        riskLevel: r.risk_level,
        interventionPathway: r.intervention_pathway,
        aralPlacementTier: r.aral_placement_tier,
        readingLevel: r.reading_level,
        assessmentType: r.assessment_type,
        movementOutcome: r.movement_outcome,
        progressResult: r.progress_result,
        interventionStatus: r.intervention_status,
        principalReviewStatus: r.principal_review_status,
        terms: {},
      });
    }

    const learner = map.get(id);
    learner.terms[r.term] = {
      term: r.term,
      englishGrade: r.english_grade,
      filipinoGrade: r.filipino_grade,
      mathematicsGrade: r.mathematics_grade,
      scienceGrade: r.science_grade,
      mapehGrade: r.mapeh_grade,
      aralingPanlipunanGrade: r.araling_panlipunan_grade,
      tleGrade: r.tle_grade,
      valuesEducationGrade: r.values_education_grade,
      generalAverage: r.general_average,
      failingSubjectCount: r.failing_subject_count,
      lowestGrade: r.lowest_grade,
      riskLevel: r.risk_level,
      beginningAssessment: r.beginning_assessment,
      middleAssessment: r.middle_assessment,
      endAssessment: r.end_assessment,
      attendanceRate: r.attendance_rate,
      movementOutcome: r.movement_outcome,
      progressResult: r.progress_result,
      interventionStatus: r.intervention_status,
    };

    // Keep latest term summary info
    if (r.term === "Term 3") {
      learner.finalAverage = r.general_average;
      learner.movementOutcome = r.movement_outcome;
      learner.progressResult = r.progress_result;
      learner.interventionStatus = r.intervention_status;
      learner.endAssessment = r.end_assessment;
    }
  }

  cachedLearners = Array.from(map.values());
  return cachedLearners;
}

/**
 * Filter and paginate learner trajectories.
 */
export function queryCnhsHistoricalLearners({
  schoolYear = "SY 2025-2026",
  gradeLevel = null,
  pathway = null,
  tier = null,
  readingLevel = null,
  riskLevel = null,
  status = null,
  outcome = null,
  search = "",
  page = 1,
  pageSize = 20,
} = {}) {
  const allLearners = loadCnhsLearnerTrajectories();

  let filtered = allLearners.filter((l) => {
    if (schoolYear && l.schoolYear !== schoolYear) return false;
    if (gradeLevel && gradeLevel !== "All grades" && l.gradeLevel !== gradeLevel) return false;
    if (pathway && pathway !== "All Pathways") {
      const matchAral = pathway.toLowerCase().includes("aral");
      const matchRem = pathway.toLowerCase().includes("remediation");
      if (matchAral && !l.interventionPathway.toLowerCase().includes("aral")) return false;
      if (matchRem && !l.interventionPathway.toLowerCase().includes("remediation")) return false;
    }
    if (tier && tier !== "All Tiers" && l.aralPlacementTier !== tier) return false;
    if (readingLevel && readingLevel !== "All Reading Levels" && l.readingLevel !== readingLevel) return false;
    if (riskLevel && riskLevel !== "All risks" && l.riskLevel !== riskLevel) return false;
    if (status && status !== "All Status" && l.interventionStatus !== status) return false;
    if (outcome && outcome !== "All Outcomes" && l.movementOutcome !== outcome) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchId = l.learnerId.toLowerCase().includes(q);
      const matchSubj = String(l.weakSubject || "").toLowerCase().includes(q);
      if (!matchId && !matchSubj) return false;
    }
    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Summary Metrics
  const aralCount = filtered.filter((l) => l.interventionPathway.includes("ARAL")).length;
  const basicCount = filtered.filter((l) => l.aralPlacementTier === "Basic").length;
  const plusCount = filtered.filter((l) => l.aralPlacementTier === "Plus").length;
  const remedialCount = filtered.filter((l) => l.interventionPathway.includes("Remediation")).length;
  const highRiskCount = filtered.filter((l) => l.riskLevel === "High Risk").length;
  const moderateRiskCount = filtered.filter((l) => l.riskLevel === "Moderate Risk").length;
  const lowRiskCount = filtered.filter((l) => l.riskLevel === "Low Risk").length;
  const promotedCount = filtered.filter((l) => l.movementOutcome === "Promoted" || l.movementOutcome === "Improved").length;

  return {
    meta: {
      total,
      page: safePage,
      pageSize,
      totalPages,
      schoolYear,
    },
    summary: {
      totalLearners: total,
      aralCount,
      basicCount,
      plusCount,
      remedialCount,
      highRiskCount,
      moderateRiskCount,
      lowRiskCount,
      promotedCount,
      promotionRate: total > 0 ? Math.round((promotedCount / (aralCount + remedialCount || 1)) * 10000) / 100 : 0,
    },
    learners: paged,
  };
}
