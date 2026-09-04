import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildFeatureVector } from "@/lib/services/recommendation/features";
import {
  isRemoteInferenceConfigured,
  mapInferenceResponse,
  predictViaRemoteInference,
} from "@/lib/services/recommendation/inferenceClient";
import { predictViaLocalEnsemble } from "@/lib/services/recommendation/localEnsemble";

/**
 * POST /api/recommendations/predict
 *
 * Academic risk gateway → FastAPI Random Forest.
 * Features rebuilt from ECR grades only (never trust client feature maps).
 */
async function requireStaff(supabase) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile || profile.is_active === false) {
    return {
      error: NextResponse.json(
        { error: "Inactive or missing profile." },
        { status: 403 }
      ),
    };
  }

  if (profile.role !== "admin" && profile.role !== "teacher") {
    return {
      error: NextResponse.json(
        { error: "Insufficient role for recommendations." },
        { status: 403 }
      ),
    };
  }

  return { user, profile };
}

export async function POST(request) {
  try {
    const supabase = await createClient();
    const auth = await requireStaff(supabase);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const student = body.student ?? body ?? {};
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

    const fallback = predictViaLocalEnsemble(features);
    return NextResponse.json(fallback);
  } catch (error) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to generate prediction." },
      { status: 500 }
    );
  }
}
