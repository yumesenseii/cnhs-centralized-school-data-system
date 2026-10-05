/**
 * Utility functions to aggregate class-enrollment rows into unique student records for ARAL Monitoring.
 * Avoids duplicating the same student across multiple language subject classes (e.g. English + Filipino).
 */

export function aggregateAralLearners(students = []) {
  if (!Array.isArray(students) || !students.length) return [];

  const map = new Map();

  for (const s of students) {
    // Primary student identity
    const key = String(s.id || s.studentId || s.lrn || s.studentNumber || "").trim();
    if (!key) continue;

    if (!map.has(key)) {
      const subj = s.subject ? [s.subject] : [];
      map.set(key, {
        ...s,
        id: s.id || s.studentId || key,
        studentId: s.studentId || s.id || key,
        lrn: s.lrn || s.studentNumber || "—",
        subjects: subj,
        displaySubject: s.subject || "English / Filipino",
      });
    } else {
      const existing = map.get(key);
      
      // Merge subjects if distinct
      if (s.subject && !existing.subjects.includes(s.subject)) {
        existing.subjects.push(s.subject);
        existing.displaySubject = existing.subjects.join(" & ");
      }

      // Preserve Phil-IRI score/reading level if available in secondary record
      if (existing.philIriScore == null && s.philIriScore != null) {
        existing.philIriScore = s.philIriScore;
        existing.readingLevel = s.readingLevel;
        existing.screeningInterpretation = s.screeningInterpretation;
        existing.candidateStatus = s.candidateStatus;
      }

      // Merge ARAL approval / status if secondary record has higher progression
      const priorityOrder = {
        Completed: 6,
        "Program Completed": 6,
        "ARAL Summer Referral": 5,
        "For EOSY Assessment": 4,
        "For Midline Assessment": 3,
        "Active Intervention": 2,
        Progressing: 2,
        "In Progress": 2,
        Assigned: 2,
        "Needs Review": 1,
        "For Review": 1,
        "ARAL Candidate": 1,
      };

      const existingStatus = existing.interventionStatus || existing.aralStatus || "Needs Review";
      const newStatus = s.interventionStatus || s.aralStatus || "Needs Review";

      const existingPriority = priorityOrder[existingStatus] || 0;
      const newPriority = priorityOrder[newStatus] || 0;

      if (newPriority > existingPriority) {
        existing.interventionStatus = newStatus;
        existing.aralStatus = s.aralStatus || newStatus;
        existing.aralApprovalStatus = s.aralApprovalStatus || existing.aralApprovalStatus;
      }

      // Combine scores if missing
      if (existing.midlineScore == null && s.midlineScore != null) {
        existing.midlineScore = s.midlineScore;
      }
      if (existing.eosyScore == null && s.eosyScore != null) {
        existing.eosyScore = s.eosyScore;
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Filter aggregated learners strictly to language & reading classes
 */
export function getLanguageLearners(students = []) {
  const aggregated = aggregateAralLearners(students);
  return aggregated.filter((s) => {
    const subj = (s.displaySubject || s.subject || "").toLowerCase();
    return (
      subj.includes("english") ||
      subj.includes("filipino") ||
      subj.includes("reading") ||
      subj.includes("&")
    );
  });
}

/**
 * Filter ARAL learners based on search query and dropdown selections
 */
export function filterAralLearners(learners = [], {
  searchTerm = "",
  grade = "All grades",
  section = "All sections",
  subject = "All subjects",
  assessmentStatus = "All assessment statuses",
  readingLevel = "All reading levels",
} = {}) {
  return (learners || []).filter((row) => {
    const q = (searchTerm || "").toLowerCase().trim();
    if (q) {
      const nameHit = (row.name || `${row.lastName || ""} ${row.firstName || ""}`).toLowerCase().includes(q);
      const lrnHit = String(row.studentNumber || row.lrn || "").toLowerCase().includes(q);
      if (!nameHit && !lrnHit) return false;
    }

    if (grade && grade !== "All grades") {
      if (row.grade !== grade && `Grade ${row.grade}` !== grade) return false;
    }

    if (section && section !== "All sections") {
      if (row.section !== section) return false;
    }

    if (subject && subject !== "All subjects") {
      const subj = (row.displaySubject || row.subject || "").toLowerCase();
      const targetSubj = subject.toLowerCase();
      if (!subj.includes(targetSubj)) return false;
    }

    if (assessmentStatus && assessmentStatus !== "All assessment statuses") {
      const hasScore = row.philIriScore != null;
      if (assessmentStatus === "Not Screened" && hasScore) return false;
      if (assessmentStatus === "Assessed" && !hasScore) return false;
      if (assessmentStatus === "Pending" && (hasScore || row.interventionStatus === "Completed")) return false;
    }

    if (readingLevel && readingLevel !== "All reading levels") {
      const currentLevel = row.readingLevel || "Not Screened";
      if (readingLevel === "Not Screened" && currentLevel !== "Not Screened") return false;
      if (readingLevel !== "Not Screened" && currentLevel.toLowerCase() !== readingLevel.toLowerCase()) return false;
    }

    return true;
  });
}
