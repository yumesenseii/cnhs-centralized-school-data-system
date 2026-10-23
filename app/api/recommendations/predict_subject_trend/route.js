import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  isRemoteInferenceConfigured,
  predictSubjectTrendViaRemote,
} from "@/lib/services/recommendation/inferenceClient";
import {
  TREND_REQUIRED_QUARTERS,
  TREND_SUPPORTED_SOURCE_TERMS,
  describeUnsupportedTrendSubject,
  verifyAndBuildTrendFeatures,
} from "@/lib/services/recommendation/trendFeatures";
import {
  authorizeLearnerAccess,
  authorizeStaff,
} from "@/lib/services/recommendation/trendAuth";
import {
  describePublicationEvidence,
  evaluatePublicationEvidence,
  resolveAuthorizedSchoolYear,
  resolveCanonicalSubject,
  resolveSubjectFamily,
} from "@/lib/services/recommendation/trendScope";
import { getActiveSchoolYear } from "@/lib/academic/activeSchoolYear";

/**
 * POST /api/recommendations/predict_subject_trend
 *
 * Dedicated authenticated gateway for the experimental per-subject next-term
 * trend forecast. Features are derived from trusted server-side academic records
 * only.
 *
 * READ SCOPE (P0-04B Track A):
 * - The school year is validated against the learner's authorized academic
 *   context. A client supplied school year is only ever a REQUEST.
 * - Only the current school year and the required grading quarters are read.
 *   Quarter 4 is the general average and is never a grading term.
 * - Publication evidence is checked for the forecast subject's OWN class family
 *   (subject + section + school year, spanning the Term 1 and Term 2 rows).
 * - Publication states stay distinct: published / draft / missing. A missing
 *   term sheet is not proof of publication.
 *
 * The route performs READS ONLY. It never writes grades, ECR sheets or any
 * other academic record.
 */

const ADVISORY_DISCLAIMER =
  "Experimental Subject Trend Forecast — Advisory Only (Synthetic-Data Model).";

/**
 * Teacher sessions must not learn which cross-subject records are hidden from
 * them. They receive an accurate, non-revealing message instead of the
 * subject-level completeness list.
 */
const TEACHER_SCOPE_MESSAGE =
  "This next-term trend forecast requires a leadership session (pending full-term evaluation): the learner's complete cross-subject academic record is not visible to a teacher account. Please ask the principal or administrator to run the forecast.";

function unavailablePayload({
  subject,
  currentTerm,
  targetTerm = null,
  message,
  schoolYear = null,
  duplicateSubjects = [],
}) {
  const payload = {
    status: "unavailable",
    subject,
    currentTerm,
    targetTerm,
    predictedTrend: "—",
    source: "pattern-analysis-experimental",
    disclaimer: ADVISORY_DISCLAIMER,
    message,
  };

  if (schoolYear) payload.schoolYear = schoolYear;
  if (duplicateSubjects.length > 0) payload.duplicateSubjects = duplicateSubjects;

  return payload;
}

export async function POST(request) {
  try {
    const supabase = await createClient();

    // --- Authorization ---------------------------------------------------
    const staff = await authorizeStaff(supabase);
    if (!staff.ok) {
      return NextResponse.json({ error: staff.message }, { status: staff.status });
    }

    const body = await request.json().catch(() => ({}));
    const studentId = body.learnerId ?? body.studentId ?? body.id ?? null;
    const requestedSubject =
      body.subject ?? body.subjectIdentifier ?? body.classSubject ?? null;
    const requestedTerm = Number(
      body.currentTerm ?? body.term ?? body.quarter ?? 1
    );
    // The client may REQUEST a school year. It is never trusted as-is: it is
    // validated against the learner's authorized academic context below.
    const requestedSchoolYear = body.schoolYear ?? body.school_year ?? null;

    if (!studentId) {
      return NextResponse.json(
        { error: "Learner ID is required." },
        { status: 400 }
      );
    }

    if (!requestedSubject) {
      return NextResponse.json(
        { error: "Subject identifier is required." },
        { status: 400 }
      );
    }

    const access = await authorizeLearnerAccess(
      supabase,
      staff.profile,
      staff.user,
      studentId
    );
    if (!access.ok) {
      return NextResponse.json(
        {
          error:
            access.message || "Forbidden: Learner access out of permitted scope.",
        },
        { status: access.status }
      );
    }

    // --- Term boundary ---------------------------------------------------
    if (!TREND_SUPPORTED_SOURCE_TERMS.includes(requestedTerm)) {
      return NextResponse.json(
        unavailablePayload({
          subject: requestedSubject,
          currentTerm: requestedTerm,
          message: `Forecasting is only supported for Term 1 → Term 2 and Term 2 → Term 3 (requested Term ${requestedTerm}).`,
        })
      );
    }

    const requiredQuarters = [...TREND_REQUIRED_QUARTERS[requestedTerm]];
    const activeSchoolYear = getActiveSchoolYear();

    // --- Authorized academic context -------------------------------------
    // 1. The learner's section. The class family is resolved from it.
    const { data: learnerRows, error: learnerError } = await supabase
      .from("students")
      .select("id, section_id")
      .eq("id", studentId)
      .maybeSingle();

    if (learnerError) {
      return NextResponse.json(
        { error: `Failed to load learner context: ${learnerError.message}` },
        { status: 500 }
      );
    }

    const sectionId = learnerRows?.section_id ?? null;

    // 2. Subject catalogue: canonical mapping + duplicate canonical key check.
    const { data: subjectRows, error: subjectError } = await supabase
      .from("subjects")
      .select("id, subject_name, subject_code")
      .order("subject_name", { ascending: true });

    if (subjectError) {
      return NextResponse.json(
        { error: `Failed to load subject catalogue: ${subjectError.message}` },
        { status: 500 }
      );
    }

    const subject = resolveCanonicalSubject({
      subjectIdentifier: requestedSubject,
      subjectRows: subjectRows ?? [],
    });

    if (!subject.isCanonical) {
      return NextResponse.json(
        unavailablePayload({
          subject: requestedSubject,
          currentTerm: requestedTerm,
          targetTerm: requestedTerm === 1 ? 2 : 3,
          message: describeUnsupportedTrendSubject(requestedSubject),
        })
      );
    }

    const duplicateSubjectKeys = subject.duplicates.map(
      (entry) => entry.canonicalKey
    );

    // 3. The learner's class rows for the forecast subject. These rows carry the
    //    learner's authorized school years and the class family itself.
    const { data: sectionClassRows, error: classError } = await supabase
      .from("classes")
      .select("id, subject_id, section_id, school_year, quarter, teacher_id")
      .eq("section_id", sectionId)
      .in("subject_id", subject.subjectIds);

    if (classError) {
      return NextResponse.json(
        { error: `Failed to load class records: ${classError.message}` },
        { status: 500 }
      );
    }

    // 4. Resolve the school year against the learner's authorized context.
    const authorizedSchoolYears = [
      ...new Set(
        (sectionClassRows ?? [])
          .map((row) => row?.school_year)
          .filter(Boolean)
      ),
    ];

    const scope = resolveAuthorizedSchoolYear({
      requestedSchoolYear,
      authorizedSchoolYears,
      activeSchoolYear,
    });

    // 5. The forecast subject's class family: subject + section + school year,
    //    spanning every term row (Term 1 and Term 2 grades live in different
    //    class rows).
    const family = resolveSubjectFamily({
      subjectIds: subject.subjectIds,
      sectionId,
      schoolYearVariants: scope.variants,
      classRows: sectionClassRows ?? [],
    });

    if (family.classIds.length === 0) {
      return NextResponse.json(
        unavailablePayload({
          subject: requestedSubject,
          currentTerm: requestedTerm,
          targetTerm: requestedTerm === 1 ? 2 : 3,
          message: `No class record was found for ${subject.canonical} in ${
            scope.standard ?? "the active school year"
          }, so the publication evidence for this subject could not be verified.`,
          schoolYear: scope.standard,
          duplicateSubjects: duplicateSubjectKeys,
        })
      );
    }

    // --- Scoped academic reads -------------------------------------------
    // Grades: current school year + required grading quarters only.
    const { data: gradesData, error: gradesError } = await supabase
      .from("grades")
      .select(
        `
        id,
        class_id,
        subject_id,
        quarter,
        final_grade,
        school_year,
        subjects (
          id,
          subject_name,
          subject_code
        )
      `
      )
      .eq("student_id", studentId)
      .in("school_year", scope.variants)
      .in("quarter", requiredQuarters);

    if (gradesError) {
      return NextResponse.json(
        { error: `Failed to load grades: ${gradesError.message}` },
        { status: 500 }
      );
    }

    // ECR term sheets: only the subject family's own workbooks, current SY.
    const { data: sheetRows, error: sheetError } = await supabase
      .from("ecr_term_sheets")
      .select("id, term, status, workbook_id, ecr_workbooks!inner(class_id, school_year)")
      .in("ecr_workbooks.class_id", family.classIds)
      .in("ecr_workbooks.school_year", scope.variants);

    if (sheetError) {
      return NextResponse.json(
        { error: `Failed to load ECR publication evidence: ${sheetError.message}` },
        { status: 500 }
      );
    }

    const ecrSheets = sheetRows ?? [];

    // --- Publication evidence (published / draft / missing) ---------------
    const evidence = evaluatePublicationEvidence({
      sheets: ecrSheets,
      requiredTerms: requiredQuarters,
    });

    if (evidence.state !== "published") {
      return NextResponse.json(
        unavailablePayload({
          subject: requestedSubject,
          currentTerm: requestedTerm,
          targetTerm: requestedTerm === 1 ? 2 : 3,
          message: describePublicationEvidence(evidence, {
            subjectLabel: subject.canonical,
          }),
          schoolYear: scope.standard,
          duplicateSubjects: duplicateSubjectKeys,
        })
      );
    }

    // --- Evidence verification and feature construction ------------------
    const featureCheck = verifyAndBuildTrendFeatures({
      learnerId: studentId,
      subjectIdentifier: requestedSubject,
      currentTerm: requestedTerm,
      gradesRecords: gradesData ?? [],
      ecrTermSheets: ecrSheets,
    });

    if (!featureCheck.eligible) {
      const isTeacherSession = staff.profile.role === "teacher";
      const message = isTeacherSession
        ? TEACHER_SCOPE_MESSAGE
        : featureCheck.reason ||
          "Academic record is incomplete or pending published ECR evidence across all required subjects.";

      return NextResponse.json(
        unavailablePayload({
          subject: requestedSubject,
          currentTerm: requestedTerm,
          targetTerm: requestedTerm === 1 ? 2 : 3,
          message,
          schoolYear: scope.standard,
          duplicateSubjects: duplicateSubjectKeys,
        })
      );
    }

    // --- Remote inference -------------------------------------------------
    if (isRemoteInferenceConfigured()) {
      try {
        const remote = await predictSubjectTrendViaRemote({
          studentId,
          subject: featureCheck.subject,
          term: featureCheck.currentTerm,
          featureVector: featureCheck.features,
          featureNames: featureCheck.featureNames,
        });

        // Ensure sanitized return shape
        return NextResponse.json({
          status: remote.status,
          subject: remote.subject,
          currentTerm: remote.currentTerm,
          targetTerm: remote.targetTerm,
          predictedTrend: remote.predictedTrend,
          source: "pattern-analysis-experimental",
          disclaimer: ADVISORY_DISCLAIMER,
          message: remote.message,
          schoolYear: scope.standard,
          ...(duplicateSubjectKeys.length > 0
            ? { duplicateSubjects: duplicateSubjectKeys }
            : {}),
        });
      } catch (err) {
        console.warn(
          "[api/recommendations/predict_subject_trend] Remote inference call failed:",
          err?.message ?? err
        );
      }
    }

    // Fallback when ML service is offline
    return NextResponse.json(
      unavailablePayload({
        subject: featureCheck.subject,
        currentTerm: featureCheck.currentTerm,
        targetTerm: featureCheck.targetTerm,
        message:
          "Random Forest ML prediction service is currently unavailable. Academic monitoring is operating on authoritative rule-based evaluation.",
        schoolYear: scope.standard,
      })
    );
  } catch (error) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to process trend forecast request." },
      { status: 500 }
    );
  }
}
