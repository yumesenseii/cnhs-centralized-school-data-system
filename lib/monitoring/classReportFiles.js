/**
 * Class report "files" for Academic Monitoring cabinet.
 * One logical Excel file per classId + schoolYear + term.
 * Generate (My Classes) refreshes metadata; Monitoring lists/views/sends.
 *
 * Classification uses ONLY the report file's selected term grade
 * (termGrades[quarterNumber]). Empty later terms never drive risk.
 */

import { isAralRecommended } from "@/lib/monitoring/aralProgress";
import {
  ARAL_APPROVAL_STATUS,
  dbStatusToLabel,
  hasHtApprovalRecord,
  isAralHtTrackedLearner,
} from "@/lib/monitoring/aralApproval";
import { termLabel } from "@/lib/academic/termLabels";
import { PASSING_GRADE } from "@/lib/teacher/reportsConstants";
import { initialsFromName } from "@/lib/teacher/monitoringMappers";
import { riskLevelFromGrade } from "@/lib/services/recommendation/riskFromGrade";
import { isAralEligibleSubject } from "@/lib/services/recommendation/subjectCapabilities";

const STORAGE_KEY = "cnhs.classReportFiles.v1";

/** Report term choices for Generate (1–3 + Final as 4). */
export const REPORT_TERM_OPTIONS = [
  { value: 1, label: "Term 1" },
  { value: 2, label: "Term 2" },
  { value: 3, label: "Term 3" },
  { value: 4, label: "Final Grade / Average" },
];

export const REPORT_TERM_ALL = "all";

export function classReportFileId(classId, schoolYear, quarterNumber) {
  return `${classId}:${schoolYear}:${Number(quarterNumber) || 1}`;
}

export function buildClassReportFileName({
  subject,
  gradeLevel,
  grade,
  sectionName,
  section,
  gradeSection,
  quarterNumber,
} = {}) {
  const subj = subject || "Class";
  let base;
  if (gradeSection) {
    base = `${subj} · ${gradeSection}`.replace(/\s+/g, " ").trim();
  } else {
    const g =
      grade ||
      (gradeLevel != null && gradeLevel !== ""
        ? `Grade ${gradeLevel}`
        : "Grade");
    const sec = sectionName || section || "Section";
    base = `${subj} · ${g} - ${sec}`.replace(/\s+/g, " ").trim();
  }
  const q = Number(quarterNumber);
  if (Number.isFinite(q) && q >= 1 && q <= 4) {
    return `${base} · ${termLabel(q)}`;
  }
  return base;
}

/**
 * Resolve the class row id for a chosen report term (term-group aware).
 */
export function resolveClassIdForReportTerm(classItem, quarterNumber) {
  if (!classItem) return null;
  const q = Number(quarterNumber) || 1;
  if (classItem.isTermGroup && classItem.termClassIds) {
    return (
      classItem.termClassIds[q] ||
      classItem.termClassIds[1] ||
      classItem.id
    );
  }
  return classItem.id;
}

/**
 * Terms to generate for a class when the teacher picks a term or "All Terms".
 * Prefer availableTerms on the card; otherwise Term 1–4 for All.
 */
export function resolveReportTermsToGenerate(classItem, selection) {
  if (selection === REPORT_TERM_ALL || selection === "all") {
    const available = (classItem?.availableTerms ?? [])
      .map((t) => Number(t))
      .filter((n) => Number.isFinite(n) && n >= 1 && n <= 4);
    if (available.length) return [...new Set(available)].sort((a, b) => a - b);
    return [1, 2, 3, 4];
  }
  const q = Number(selection);
  if (Number.isFinite(q) && q >= 1 && q <= 4) return [q];
  return [Number(classItem?.quarterNumber) || 1];
}

function readGeneratedMeta() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeGeneratedMeta(map) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota
  }
}

/**
 * Mark / refresh a class report as generated (My Classes → Monitoring).
 */
export function markClassReportGenerated({
  classId,
  schoolYear,
  quarterNumber,
  fileName,
  uploadedBy,
  uploadedByInitials,
} = {}) {
  if (!classId || !schoolYear) return null;
  const q = Number(quarterNumber) || 1;
  const id = classReportFileId(classId, schoolYear, q);
  const map = readGeneratedMeta();
  const now = new Date().toISOString();
  map[id] = {
    id,
    classId,
    schoolYear,
    quarterNumber: q,
    fileName: fileName || map[id]?.fileName || "Class report",
    uploadedBy: uploadedBy || map[id]?.uploadedBy || "Teacher",
    uploadedByInitials:
      uploadedByInitials ||
      map[id]?.uploadedByInitials ||
      initialsFromName(uploadedBy || "Teacher"),
    generatedAt: now,
    modifiedAt: now,
  };
  writeGeneratedMeta(map);
  return map[id];
}

/**
 * Generate one or more term-scoped report files from a My Classes card.
 * @returns {{ files: object[], terms: number[] }}
 */
export function generateClassReportFilesForTerms({
  classItem,
  termSelection,
  uploadedBy,
} = {}) {
  if (!classItem?.schoolYear) {
    return { files: [], terms: [] };
  }

  const terms = resolveReportTermsToGenerate(classItem, termSelection);
  const files = [];

  for (const quarterNumber of terms) {
    const classId = resolveClassIdForReportTerm(classItem, quarterNumber);
    if (!classId) continue;

    const fileName = buildClassReportFileName({
      subject: classItem.subject,
      gradeSection: String(classItem.gradeSection || "").replace(/—/g, "-"),
      grade: classItem.grade,
      section: classItem.section,
      quarterNumber,
    });

    const saved = markClassReportGenerated({
      classId,
      schoolYear: classItem.schoolYear,
      quarterNumber,
      fileName,
      uploadedBy,
    });
    if (saved) files.push(saved);
  }

  return { files, terms };
}

export function getClassReportGeneratedMeta(fileId) {
  const map = readGeneratedMeta();
  return map[fileId] || null;
}

/**
 * Grade used for FAILING / MODERATE / PASSING and Risk column for a report term.
 * Uses termGrades[reportQuarter] only — never averages unfinished terms.
 */
export function gradeForReportTerm(learner, reportQuarter) {
  const q = Number(reportQuarter);
  if (!Number.isFinite(q) || q < 1 || q > 4) return null;

  const fromTerm = learner?.termGrades?.[q];
  if (fromTerm !== null && fromTerm !== undefined && fromTerm !== "") {
    const n = Number(fromTerm);
    if (Number.isFinite(n)) return n;
  }

  // Same-term class row may expose classSubjectGrade when termGrades cell is empty.
  if (Number(learner?.quarterNumber) === q) {
    const g = Number(learner.classSubjectGrade);
    if (Number.isFinite(g)) return g;
  }

  return null;
}

/** Fallback when callers omit report quarter (uses learner's class term). */
function currentGradeForLearner(learner) {
  return gradeForReportTerm(
    learner,
    learner?.quarterNumber ?? learner?.reportQuarterNumber ?? 1
  );
}

/**
 * Grade sheet buckets (exclusive, grade-only — never ARAL / atRisk flags):
 *   FAILING   → grade < 75  (High Risk — aligns with atRisk / ARAL language)
 *   MODERATE  → 75–80       (fairly passed; NOT labeled "At Risk" in the UI)
 *   PASSING   → grade > 80  (Low Risk)
 * Ungraded (null for the report term) are listed under PASSING so teachers can edit.
 */
export function isFailingLearner(
  learner,
  passingGrade = PASSING_GRADE,
  reportQuarter = null
) {
  const g =
    reportQuarter != null
      ? gradeForReportTerm(learner, reportQuarter)
      : currentGradeForLearner(learner);
  if (g === null) return false;
  return g < passingGrade;
}

/** Passed narrowly: 75–80 inclusive (Moderate Risk band). */
export function isNeedsMonitoringLearner(
  learner,
  passingGrade = PASSING_GRADE,
  moderateMax = 80,
  reportQuarter = null
) {
  const g =
    reportQuarter != null
      ? gradeForReportTerm(learner, reportQuarter)
      : currentGradeForLearner(learner);
  if (g === null) return false;
  return g >= passingGrade && g <= moderateMax;
}

/** Strong pass: above 80, or not yet graded for this report term. */
export function isPassingLearner(
  learner,
  passingGrade = PASSING_GRADE,
  reportQuarter = null
) {
  const g =
    reportQuarter != null
      ? gradeForReportTerm(learner, reportQuarter)
      : currentGradeForLearner(learner);
  if (g === null) return true;
  return g > 80;
}

/**
 * @deprecated Use isFailingLearner — FAILING tab is grade < 75 only.
 */
export function isFailingOrAtRiskLearner(
  learner,
  passingGrade = PASSING_GRADE,
  reportQuarter = null
) {
  return isFailingLearner(learner, passingGrade, reportQuarter);
}

export function riskLabelForReportTerm(learner, reportQuarter) {
  const g = gradeForReportTerm(learner, reportQuarter);
  return riskLevelFromGrade(g);
}

/**
 * Aggregate HT status for a class file.
 * Counts live ARAL recommendations AND learners who already have a
 * submitted/approved/returned approval row (so HT inbox is not dropped
 * when RF later says No Recommendation).
 */
export function aggregateClassHtStatus(learners = []) {
  const tracked = learners.filter(isAralHtTrackedLearner);
  if (!tracked.length) {
    return {
      status: "Not applicable",
      label: "—",
      submittedCount: 0,
      approvedCount: 0,
      returnedCount: 0,
      draftCount: 0,
      aralCount: 0,
    };
  }

  let submitted = 0;
  let approved = 0;
  let returned = 0;
  let draft = 0;

  for (const l of tracked) {
    const s = l.aralApprovalStatus || ARAL_APPROVAL_STATUS.SUGGESTED;
    if (s === ARAL_APPROVAL_STATUS.APPROVED) approved += 1;
    else if (s === ARAL_APPROVAL_STATUS.RETURNED) returned += 1;
    else if (s === ARAL_APPROVAL_STATUS.SUBMITTED) submitted += 1;
    else draft += 1;
  }

  let status = ARAL_APPROVAL_STATUS.SUGGESTED;
  let label = "Draft";
  if (returned > 0) {
    status = ARAL_APPROVAL_STATUS.RETURNED;
    label = "Returned";
  } else if (approved === tracked.length) {
    status = ARAL_APPROVAL_STATUS.APPROVED;
    label = "Approved";
  } else if (submitted > 0 || approved > 0) {
    status = ARAL_APPROVAL_STATUS.SUBMITTED;
    label = "Submitted for review";
  }

  return {
    status,
    label,
    submittedCount: submitted,
    approvedCount: approved,
    returnedCount: returned,
    draftCount: draft,
    aralCount: tracked.length,
  };
}

function formatModified(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function annotateLearnersForTerm(learners, reportQuarter) {
  return (learners ?? []).map((l) => {
    const reportGrade = gradeForReportTerm(l, reportQuarter);
    return {
      ...l,
      reportQuarterNumber: reportQuarter,
      reportGrade,
      riskLevel: riskLevelFromGrade(reportGrade),
    };
  });
}

function buildFileRow({
  classId,
  schoolYear,
  quarterNumber,
  cls,
  learners,
  saved,
  teacherName,
  teacherInitials,
}) {
  const q = Number(quarterNumber) || 1;
  const id = classReportFileId(classId, schoolYear, q);
  const annotated = annotateLearnersForTerm(learners, q);
  const failing = annotated.filter((l) =>
    isFailingLearner(l, PASSING_GRADE, q)
  );
  const moderate = annotated.filter((l) =>
    isNeedsMonitoringLearner(l, PASSING_GRADE, 80, q)
  );
  const passing = annotated.filter((l) =>
    isPassingLearner(l, PASSING_GRADE, q)
  );
  const ht = aggregateClassHtStatus(annotated);

  const fileName =
    saved?.fileName ||
    buildClassReportFileName({
      subject: cls?.subject,
      gradeLevel: cls?.gradeLevel,
      sectionName: cls?.sectionName,
      gradeSection: cls?.gradeSection,
      quarterNumber: q,
    });

  const modifiedAt = saved?.modifiedAt || saved?.generatedAt || null;

  return {
    id,
    classId,
    schoolYear,
    quarterNumber: q,
    quarterLabel: termLabel(q),
    subject: cls?.subject,
    subjectId: cls?.subjectId ?? null,
    gradeLevel: cls?.gradeLevel,
    sectionName: cls?.sectionName,
    gradeSection: cls?.gradeSection,
    fileName,
    type: "EXCEL",
    modifiedAt,
    modifiedLabel: formatModified(modifiedAt),
    uploadedBy: saved?.uploadedBy || cls?.teacherName || teacherName,
    uploadedByInitials:
      saved?.uploadedByInitials ||
      initialsFromName(saved?.uploadedBy || cls?.teacherName || teacherName) ||
      teacherInitials,
    generated: Boolean(saved?.generatedAt),
    learnerCount: annotated.length,
    passingCount: passing.length,
    moderateCount: moderate.length,
    /** @deprecated Use moderateCount — middle band is Moderate, not At Risk. */
    atRiskCount: moderate.length,
    failingCount: failing.length,
    learners: annotated,
    passingLearners: passing,
    moderateLearners: moderate,
    /** @deprecated Use moderateLearners */
    atRiskLearners: moderate,
    failingLearners: failing,
    htStatus: ht.status,
    htLabel: ht.label,
    htMeta: ht,
    aralEligible: Boolean(cls?.aralEligible),
    subjectAralEligible: Boolean(cls?.aralEligible),
  };
}

/**
 * Build file cabinet rows from monitoring roster + class summaries.
 * Emits one file per (classId, schoolYear, term) for the class assigned term
 * plus any additional terms the teacher generated via My Classes.
 */
export function buildClassReportFiles({
  students = [],
  classSummaries = [],
  teacherName = "Teacher",
  onlyGenerated = false,
} = {}) {
  const meta = readGeneratedMeta();
  const teacherInitials = initialsFromName(teacherName);
  const classesById = new Map(
    (classSummaries ?? []).map((cls) => [cls.id, cls])
  );

  /** @type {Map<string, { classId: string, schoolYear: string, quarterNumber: number, cls: object }>} */
  const specs = new Map();

  for (const cls of classSummaries ?? []) {
    const classId = cls.id;
    const schoolYear = cls.schoolYear;
    if (!classId || !schoolYear) continue;
    const q = Number(cls.quarter) || 1;
    const id = classReportFileId(classId, schoolYear, q);
    specs.set(id, { classId, schoolYear, quarterNumber: q, cls });

    // Add other generated terms for the same class row.
    for (const saved of Object.values(meta)) {
      if (saved?.classId !== classId || saved?.schoolYear !== schoolYear) {
        continue;
      }
      const metaQ = Number(saved.quarterNumber) || 1;
      const metaId = classReportFileId(classId, schoolYear, metaQ);
      if (!specs.has(metaId)) {
        specs.set(metaId, {
          classId,
          schoolYear,
          quarterNumber: metaQ,
          cls,
        });
      }
    }
  }

  const files = [...specs.values()].map(
    ({ classId, schoolYear, quarterNumber, cls }) => {
      const id = classReportFileId(classId, schoolYear, quarterNumber);
      const learners = students.filter((s) => s.classId === classId);
      return buildFileRow({
        classId,
        schoolYear,
        quarterNumber,
        cls,
        learners,
        saved: meta[id] || null,
        teacherName,
        teacherInitials,
      });
    }
  );

  const list = onlyGenerated ? files.filter((f) => f.generated) : files;

  return list.sort((a, b) => {
    if (Boolean(b.generated) !== Boolean(a.generated)) {
      return b.generated ? 1 : -1;
    }
    const byName = String(a.fileName).localeCompare(String(b.fileName));
    if (byName !== 0) return byName;
    return (a.quarterNumber || 0) - (b.quarterNumber || 0);
  });
}

/**
 * HT/Admin inbox: Eng/Fil class report files driven by approval records.
 * Includes (classId, schoolYear, quarter) from submitted/approved/returned
 * rows even when the live RF label is no longer ARAL, and even when the
 * class assignment term differs from the report term the teacher sent.
 */
export function buildHtReceivedClassReportFiles({
  students = [],
  classSummaries = [],
  teacherName = "Teacher",
} = {}) {
  const teacherInitials = initialsFromName(teacherName);
  const classesById = new Map(
    (classSummaries ?? []).map((cls) => [cls.id, cls])
  );
  const meta = readGeneratedMeta();

  /** @type {Map<string, { classId: string, schoolYear: string, quarterNumber: number, cls: object }>} */
  const specs = new Map();

  function ensureSpec(classId, schoolYear, quarterNumber, seedLearner = null) {
    if (!classId || !schoolYear) return;
    const q = Number(quarterNumber) || 1;
    const id = classReportFileId(classId, schoolYear, q);
    if (specs.has(id)) return;

    let cls = classesById.get(classId);
    if (!cls && seedLearner) {
      cls = {
        id: classId,
        subject: seedLearner.subject,
        subjectId: seedLearner.subjectId ?? null,
        gradeLevel: seedLearner.gradeLevel ?? null,
        sectionName: seedLearner.section,
        gradeSection: seedLearner.gradeSection,
        schoolYear,
        quarter: q,
        quarterLabel: termLabel(q),
        teacherName: seedLearner.teacherName || teacherName,
        aralEligible:
          seedLearner.aralEligible !== false &&
          isAralEligibleSubject(seedLearner.subject),
      };
    }
    if (!cls) return;

    const engFil =
      cls.aralEligible === true ||
      isAralEligibleSubject(cls.subject) ||
      seedLearner?.aralEligible === true;
    if (!engFil) return;

    specs.set(id, {
      classId,
      schoolYear,
      quarterNumber: q,
      cls: { ...cls, aralEligible: true },
    });
  }

  // Class assignment terms (baseline).
  for (const cls of classSummaries ?? []) {
    if (!cls?.id || !cls.schoolYear) continue;
    if (!cls.aralEligible && !isAralEligibleSubject(cls.subject)) continue;
    ensureSpec(cls.id, cls.schoolYear, Number(cls.quarter) || 1);
  }

  // Approval-backed terms (teacher may have sent Term 1 while class row is another term).
  for (const learner of students ?? []) {
    if (!hasHtApprovalRecord(learner)) continue;
    const q =
      Number(learner.aralApprovalQuarter) ||
      Number(learner.reportQuarterNumber) ||
      Number(learner.quarterNumber) ||
      1;
    ensureSpec(
      learner.classId,
      learner.schoolYear,
      q,
      learner
    );
  }

  const files = [...specs.values()].map(
    ({ classId, schoolYear, quarterNumber, cls }) => {
      const id = classReportFileId(classId, schoolYear, quarterNumber);
      // Prefer learners whose approval quarter matches this file term;
      // always include class roster for grade sheet editing/view.
      const learners = (students ?? []).filter((s) => {
        if (s.classId !== classId) return false;
        if (s.schoolYear && s.schoolYear !== schoolYear) return false;
        return true;
      });

      // Annotate approval quarter onto matching rows for HT status on this term.
      const termLearners = learners.map((s) => {
        const aq = Number(s.aralApprovalQuarter);
        if (Number.isFinite(aq) && aq !== Number(quarterNumber)) {
          // Different-term approval: don't count toward this file's HT badge
          // unless they also have live ARAL for display.
          if (hasHtApprovalRecord(s) && !isAralRecommended(s)) {
            return {
              ...s,
              aralApprovalDbStatus: null,
              aralApprovalStatus: ARAL_APPROVAL_STATUS.SUGGESTED,
            };
          }
        }
        return s;
      });

      return buildFileRow({
        classId,
        schoolYear,
        quarterNumber,
        cls,
        learners: termLearners,
        saved: meta[id] || null,
        teacherName: cls.teacherName || teacherName,
        teacherInitials,
      });
    }
  );

  return files
    .filter((f) => {
      if (!f.aralEligible) return false;
      const ht = f.htMeta;
      return (
        (ht?.submittedCount ?? 0) > 0 ||
        (ht?.approvedCount ?? 0) > 0 ||
        (ht?.returnedCount ?? 0) > 0
      );
    })
    .sort((a, b) => {
      const byName = String(a.fileName).localeCompare(String(b.fileName));
      if (byName !== 0) return byName;
      return (a.quarterNumber || 0) - (b.quarterNumber || 0);
    });
}

export { dbStatusToLabel };
