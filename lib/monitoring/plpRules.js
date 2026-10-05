/**
 * Rule-based Personalized Learning Plan (PLP) prescription engine for CNHS LEARN.
 * Generates tailored pedagogical intervention strings based on:
 * - Learning Area (English vs Filipino)
 * - Diagnostic Reading Level / Score (Phil-IRI / CRLA)
 * - Grade Level (Grades 7–10)
 */

export function generatePlpPrescription({
  learningArea = "English",
  philIriScore = null,
  crlaScore = null,
  readingLevel = null,
  gradeLevel = 7,
}) {
  const isFilipino = /filipino/i.test(learningArea);
  const score = philIriScore != null ? Number(philIriScore) : (crlaScore != null ? Number(crlaScore) : null);
  const lvl = String(readingLevel || "").toLowerCase();

  // Tier 1: Severe / Non-reader / Frustration (< 50% or explicit Frustration)
  if (lvl.includes("non-reader") || (score !== null && score < 50) || lvl.includes("frustration")) {
    if (isFilipino) {
      return "Tier 1 Remediation (Filipino): Masinsinang Pagsasanay sa Palabigkasan, Pagkilala sa Pantig, at Pagbasa ng Payak na Salita.";
    }
    return "Tier 1 Remediation (English): Intensive Phonemic Awareness, Sound-Letter Blending, and High-Frequency Sight Word Drills.";
  }

  // Tier 2: Emerging / Developing (50% - 74% or Instructional)
  if (lvl.includes("instructional") || (score !== null && score < 75)) {
    if (isFilipino) {
      return "Tier 2 Support (Filipino): Pagpapayaman ng Talasalitaan, Pagsusuri sa Istruktura ng Pangungusap, at Pag-unawa sa Binabasa.";
    }
    return "Tier 2 Support (English): Targeted Oral Reading Fluency, Vocabulary Acquisition, and Literal Comprehension Strategies.";
  }

  // Tier 3: Transition / Near-Proficiency (>= 75% or Independent)
  if (isFilipino) {
    return "Tier 3 Enrichment (Filipino): Mapanuring Pag-unawa, Paghinuha, at Pagbuo ng Sariling Reaksyon sa Akdang Pampanitikan.";
  }
  return "Tier 3 Enrichment (English): Critical Reading, Inferential Thinking, and Context-Clue Textual Analysis.";
}

export const EOSY_OUTCOME_OPTIONS = [
  { value: "proficient", label: "Proficient (Post-Assessment ≥ 75% — Program Exit)" },
  { value: "deficient", label: "Deficient (Post-Assessment < 75% — Summer Referral)" },
];
