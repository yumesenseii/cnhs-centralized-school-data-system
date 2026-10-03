import { getCachedTeacherRoster, loadBuiltTeacherRoster } from "@/lib/teacher/teacherRosterCache";
import { listAralAssessmentScoresForStudents } from "@/lib/supabase/queries/aralProgram";
import { buildRecordedProgress, displayInterventionStatus, interventionTypeLabel } from "@/lib/monitoring/interventionLifecycle";
import { markClassReportGenerated, resolveReportTermsToGenerate, resolveClassIdForReportTerm, buildClassReportFileName } from "@/lib/monitoring/classReportFiles";

/**
 * Shared service to generate class reports containing a strict historical snapshot 
 * of the learners' risk, intervention, and assessment data.
 */
export async function buildAndSaveClassReportSnapshot({
  classItem,
  termSelection,
  teacherId,
  teacherName,
}) {
  if (!classItem?.schoolYear || !teacherId) {
    return { files: [], terms: [] };
  }

  // 1. Fetch raw roster for the teacher
  const rosterResult = await getCachedTeacherRoster({ teacherId });
  if (rosterResult.error || !rosterResult.data) {
    throw new Error(rosterResult.error?.message || "Unable to fetch roster for snapshot.");
  }

  let roster = await loadBuiltTeacherRoster(rosterResult.data, { teacherId });
  if (roster?.predictionsPending) {
    roster = await loadBuiltTeacherRoster(rosterResult.data, { teacherId });
  }

  const terms = resolveReportTermsToGenerate(classItem, termSelection);
  const files = [];

  for (const quarterNumber of terms) {
    const classId = resolveClassIdForReportTerm(classItem, quarterNumber);
    if (!classId) continue;

    // 2. Filter roster for the specific class
    const classLearners = roster.students.filter(s => s.classId === classId);

    // 3. Fetch assessment scores
    const studentIds = classLearners.map(s => s.studentId).filter(Boolean);
    const scoresResult = await listAralAssessmentScoresForStudents(studentIds);
    const progressByStudent = {};

    if (!scoresResult.error) {
      const byStudent = new Map();
      for (const row of scoresResult.data ?? []) {
        const list = byStudent.get(row.studentId) ?? [];
        list.push(row);
        byStudent.set(row.studentId, list);
      }
      for (const [studentId, list] of byStudent) {
        progressByStudent[studentId] = buildRecordedProgress(list);
      }
    }

    // 4. Build strict snapshot for each learner
    const snapshotLearners = classLearners.map((s) => {
      const prog = progressByStudent[s.studentId] || {};
      
      return {
        id: s.id, // ecr enrollment id
        studentId: s.studentId,
        name: s.name,
        lastName: s.lastName,
        firstName: s.firstName,
        middleName: s.middleName,
        studentNumber: s.studentNumber,
        classId: s.classId,
        grade: s.grade,
        section: s.section,
        gradeSection: s.gradeSection,
        subject: s.subject,
        subjectId: s.subjectId,
        termGrades: s.termGrades || {}, // needed for the grading sheet
        
        // Monitoring exact snapshot
        academicRisk: s.riskLevel || "—",
        monitoringStatus: displayInterventionStatus(s.monitoringStatus),
        aralPlacementTier: s.aralPlacementTier || null,
        aralFacilitatorName: s.aralFacilitatorName || null,
        interventionPathway: interventionTypeLabel(s),
        
        // Assessment exact snapshot
        begScore: prog.baseline?.score ?? null,
        begDate: prog.baseline?.date ?? null,
        midScore: prog.checks?.find(c => c.phase === "mid")?.score ?? null,
        midDate: prog.checks?.find(c => c.phase === "mid")?.date ?? null,
        endScore: prog.checks?.find(c => c.phase === "post")?.score ?? null,
        endDate: prog.checks?.find(c => c.phase === "post")?.date ?? null,
        
        // Approvals (if any)
        aralApprovalStatus: s.aralApprovalStatus || null,
        aralApprovalQuarter: s.aralApprovalQuarter || null,
        aralApprovalDbStatus: s.aralApprovalDbStatus || null,
      };
    });

    const fileName = buildClassReportFileName({
      subject: classItem.subject,
      gradeSection: String(classItem.gradeSection || "").replace(/—/g, "-"),
      grade: classItem.grade,
      section: classItem.section,
      quarterNumber,
    });

    // 5. Save the report and its snapshot to local storage
    const saved = markClassReportGenerated({
      classId,
      schoolYear: classItem.schoolYear,
      quarterNumber,
      fileName,
      uploadedBy: teacherName,
      snapshotLearners,
    });
    if (saved) files.push(saved);
  }

  return { files, terms };
}
