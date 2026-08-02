import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildFeatureVector } from "@/lib/services/recommendation/features";
import {
  isRemoteInferenceConfigured,
  predictViaRemoteInference,
} from "@/lib/services/recommendation/inferenceClient";
import { predictViaLocalEnsemble } from "@/lib/services/recommendation/localEnsemble";

/**
 * POST /api/recommendations/predict
 *
 * Academic Prediction gateway. Features are always rebuilt from ECR grades
 * via buildFeatureVector — client-supplied feature maps are ignored so
 * attendance / SF2 keys can never enter the model.
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
    const student = body.student ?? body ?? {};

    // Always rebuild from academic grades — never trust client feature payloads.
    const features = buildFeatureVector(student);

    if (isRemoteInferenceConfigured()) {
      try {
        const remote = await predictViaRemoteInference({
          studentId: student.id ?? student.studentId ?? null,
          featureVector: features.featureVector,
          featureList: features.featureList,
          featureNames: features.featureNames,
        });
        return NextResponse.json(remote);
      } catch (error) {
        console.warn(
          "[api/recommendations/predict] Remote inference failed:",
          error?.message ?? error
        );
      }
    }

    const local = predictViaLocalEnsemble(features);
    return NextResponse.json(local);
  } catch (error) {
    return NextResponse.json(
      {
        error: error?.message ?? "Failed to generate recommendation.",
      },
      { status: 500 }
    );
  }
}
