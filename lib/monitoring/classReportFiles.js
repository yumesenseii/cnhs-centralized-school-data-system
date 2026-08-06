/**
 * Class report "files" for Academic Monitoring cabinet.
 * One logical Excel file per classId + schoolYear + term.
 * Generate (My Classes) refreshes metadata; Monitoring lists/views/sends.
 */

import { isAralRecommended } from "@/lib/monitoring/aralProgress";
import {
  ARAL_APPROVAL_STATUS,
  dbStatusToLabel,
} from "@/lib/monitoring/aralApproval";
import { PASSING_GRADE } from "@/lib/teacher/reportsConstants";
import { initialsFromName } from "@/lib/teacher/monitoringMappers";

const STORAGE_KEY = "cnhs.classReportFiles.v1";

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
} = {}) {
  const subj = subject || "Class";
  if (gradeSection) {
    return `${subj} · ${gradeSection}`.replace(/\s+/g, " ").trim();
  }
  const g =
    grade ||
    (gradeLevel != null && gradeLevel !== ""
      ? `Grade ${gradeLevel}`
      : "Grade");
  const sec = sectionName || section || "Section";
  return `${subj} · ${g} - ${sec}`.replace(/\s+/g, " ").trim();
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
  const id = classReportFileId(classId, schoolYear, quarterNumber);
  const map = readGeneratedMeta();
  const now = new Date().toISOString();
  map[id] = {
    id,
    classId,
    schoolYear,
    quarterNumber: Number(quarterNumber) || 1,
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

export function getClassReportGeneratedMeta(fileId) {
  const map = readGeneratedMeta();
  return map[fileId] || null;
}

function currentGradeForLearner(learner) {
  const q = Number(learner.quarterNumber);
  const fromTerm = learner.termGrades?.[q];
  if (fromTerm !== null && fromTerm !== undefined && fromTerm !== "") {
    const n = Number(fromTerm);
    if (Number.isFinite(n)) return n;
  }
  const g = Number(learner.classSubjectGrade ?? learner.generalAverage);
  return Number.isFinite(g) ? g : null;
}

export function isPassingLearner(learner, passingGrade = PASSING_GRADE) {
  const g = currentGradeForLearner(learner);
  if (g === null) return false;
  return g >= passingGrade;
}

export function isFailingOrAtRiskLearner(learner, passingGrade = PASSING_GRADE) {
  if (isAralRecommended(learner)) return true;
  if (learner.atRisk) return true;
  const g = currentGradeForLearner(learner);
  if (g === null) return false;
  return g < passingGrade;
}

/**
 * Aggregate HT status for a class file from its ARAL learner rows.
 */
export function aggregateClassHtStatus(learners = []) {
  const aral = learners.filter(isAralRecommended);
  if (!aral.length) {
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

  for (const l of aral) {
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
  } else if (approved === aral.length) {
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
    aralCount: aral.length,
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

/**
 * Build file cabinet rows from monitoring roster + class summaries.
 */
export function buildClassReportFiles({
  students = [],
  classSummaries = [],
  teacherName = "Teacher",
  onlyGenerated = false,
} = {}) {
  const meta = readGeneratedMeta();
  const teacherInitials = initialsFromName(teacherName);

  const files = (classSummaries ?? []).map((cls) => {
    const classId = cls.id;
    const schoolYear = cls.schoolYear;
    const quarterNumber = Number(cls.quarter) || 1;
    const id = classReportFileId(classId, schoolYear, quarterNumber);
    const learners = students.filter((s) => s.classId === classId);
    const passing = learners.filter((l) => isPassingLearner(l));
    const failing = learners.filter((l) => isFailingOrAtRiskLearner(l));
    const ht = aggregateClassHtStatus(learners);
    const saved = meta[id];
    const fileName =
      saved?.fileName ||
      buildClassReportFileName({
        subject: cls.subject,
        gradeLevel: cls.gradeLevel,
        sectionName: cls.sectionName,
        gradeSection: cls.gradeSection,
      });

    const modifiedAt =
      saved?.modifiedAt ||
      saved?.generatedAt ||
      null;

    return {
      id,
      classId,
      schoolYear,
      quarterNumber,
      quarterLabel: cls.quarterLabel || `Term ${quarterNumber}`,
      subject: cls.subject,
      subjectId: cls.subjectId ?? null,
      gradeLevel: cls.gradeLevel,
      sectionName: cls.sectionName,
      gradeSection: cls.gradeSection,
      fileName,
      type: "EXCEL",
      modifiedAt,
      modifiedLabel: formatModified(modifiedAt),
      uploadedBy: saved?.uploadedBy || cls.teacherName || teacherName,
      uploadedByInitials:
        saved?.uploadedByInitials ||
        initialsFromName(saved?.uploadedBy || cls.teacherName || teacherName) ||
        teacherInitials,
      generated: Boolean(saved?.generatedAt),
      learnerCount: learners.length,
      passingCount: passing.length,
      failingCount: failing.length,
      learners,
      passingLearners: passing,
      failingLearners: failing,
      htStatus: ht.status,
      htLabel: ht.label,
      htMeta: ht,
      aralEligible: Boolean(cls.aralEligible),
      subjectAralEligible: Boolean(cls.aralEligible),
    };
  });

  if (onlyGenerated) {
    return files.filter((f) => f.generated);
  }

  // Prefer showing all assigned classes as files; mark ungenerated in UI.
  return files.sort((a, b) => {
    if (Boolean(b.generated) !== Boolean(a.generated)) {
      return b.generated ? 1 : -1;
    }
    return String(a.fileName).localeCompare(String(b.fileName));
  });
}

export { dbStatusToLabel };
