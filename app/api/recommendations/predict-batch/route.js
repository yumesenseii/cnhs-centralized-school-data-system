import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildFeatureVector } from "@/lib/services/recommendation/features";
import {
  isRemoteInferenceConfigured,
  predictViaRemoteBatch,
} from "@/lib/services/recommendation/inferenceClient";
import { predictViaLocalEnsemble } from "@/lib/services/recommendation/localEnsemble";

/**
 * POST /api/recommendations/predict-batch
 *
 * Bulk academic risk gateway → FastAPI /predict_batch.
 * Body: { students: [{ student: {...} }, ...] }
 */
export async function POST(request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!profile || profile.is_active === false) {
      return NextResponse.json(
        { error: "Inactive or missing profile." },
        { status: 403 }
      );
    }

    if (profile.role !== "admin" && profile.role !== "teacher") {
      return NextResponse.json(
        { error: "Insufficient role for recommendations." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawStudents = Array.isArray(body.students) ? body.students : [];
    const students = rawStudents.map((row) => row.student ?? row ?? {});

    const featureInputs = students.map((student) => {
      const features = buildFeatureVector(student);
      return {
        studentId: student.id ?? student.studentId ?? null,
        featureVector: features.featureVector,
        featureList: features.featureList,
        featureNames: features.featureNames,
        features,
      };
    });

    if (isRemoteInferenceConfigured() && featureInputs.length) {
      try {
        const remote = await predictViaRemoteBatch(
          featureInputs.map(({ studentId, featureVector, featureList, featureNames }) => ({
            studentId,
            featureVector,
            featureList,
            featureNames,
          }))
        );
        if (remote.length === featureInputs.length) {
          return NextResponse.json({
            predictions: remote,
            count: remote.length,
            source: "random-forest",
          });
        }
      } catch (error) {
        console.warn(
          "[api/recommendations/predict-batch] Remote batch failed:",
          error?.message ?? error
        );
      }
    }

    const fallback = featureInputs.map(({ features }) =>
      predictViaLocalEnsemble(features)
    );
    return NextResponse.json({
      predictions: fallback,
      count: fallback.length,
      source: "rule-based-fallback",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to generate batch predictions." },
      { status: 500 }
    );
  }
}
