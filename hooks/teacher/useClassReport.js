"use client";

import { useCallback, useState } from "react";
import {
  getTeacherReportsBundle,
  resolveTeacherReportsSession,
} from "@/lib/supabase/queries/reports";
import { REPORT_FILTER_ALL } from "@/lib/teacher/reportsConstants";
import {
  buildClassReportPreview,
  buildTeacherReportsModel,
} from "@/lib/teacher/reportsMappers";

/**
 * On-demand report for a single opened class.
 *
 * Reuses the Teacher Reports data path end to end:
 * - getTeacherReportsBundle (teacher-scoped queries)
 * - buildTeacherReportsModel (roster + recommendationService + subject policy)
 * - buildClassReportPreview (same preview shape as the Reports page)
 *
 * Ownership: the bundle only contains classes where classes.teacher_id matches
 * the authenticated teacher, so a classId from the URL that is not assigned to
 * this teacher yields no report and an authorization error — never another
 * teacher's data.
 */
export function useClassReport(classId) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = useCallback(async () => {
    if (!classId) {
      setError("A class is required to generate a report.");
      return null;
    }

    setLoading(true);
    setError("");

    try {
      const session = await resolveTeacherReportsSession();
      if (session.error || !session.data?.teacherId) {
        throw session.error ?? new Error("Unable to load teacher session.");
      }

      const { teacher, profile, teacherId } = session.data;

      const bundle = await getTeacherReportsBundle({ teacherId });
      if (bundle.error) throw bundle.error;

      const allClasses = bundle.data?.classes ?? [];
      const targetClass = allClasses.find((row) => row.id === classId);

      // Not in the teacher-scoped bundle → not assigned to this teacher.
      if (!targetClass || targetClass.teacher_id !== teacherId) {
        throw new Error("This class is not assigned to you.");
      }

      const classIds = new Set([targetClass.id]);
      const model = await buildTeacherReportsModel({
        classes: [targetClass],
        enrollments: (bundle.data.enrollments ?? []).filter((row) =>
          classIds.has(row.class_id)
        ),
        grades: bundle.data.grades ?? [],
        monitoringRecords: (bundle.data.monitoringRecords ?? []).filter((row) =>
          classIds.has(row.class_id)
        ),
        lessonPlans: bundle.data.lessonPlans ?? [],
        teacher,
        profile,
        filters: {
          schoolYear: targetClass.school_year,
          quarter: Number(targetClass.quarter),
          subject: REPORT_FILTER_ALL,
          section: REPORT_FILTER_ALL,
        },
      });

      const classReport = model.classReports?.[0] ?? null;
      if (!classReport) {
        throw new Error("No report data is available for this class yet.");
      }

      const preview = buildClassReportPreview(classReport, {
        teacherName: model.teacherName,
        schoolYear: classReport.schoolYear,
        quarter: classReport.quarter,
      });

      const next = {
        classReport,
        preview,
        teacherName: model.teacherName,
        schoolYear: classReport.schoolYear,
        quarter: classReport.quarter,
        summary: model.summary,
        charts: model.charts,
        hasGrades: (classReport.subjectGrades ?? []).length > 0,
      };

      setReport(next);
      return next;
    } catch (err) {
      setReport(null);
      setError(err?.message ?? "Unable to generate the class report.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [classId]);

  const reset = useCallback(() => {
    setReport(null);
    setError("");
  }, []);

  return { report, loading, error, generate, reset };
}
