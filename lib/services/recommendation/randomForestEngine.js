import { buildFeatureVector } from "@/lib/services/recommendation/features";
import {
  isRemoteInferenceConfigured,
  mapInferenceResponse,
  predictViaRemoteInference,
} from "@/lib/services/recommendation/inferenceClient";
import { predictViaLocalEnsemble } from "@/lib/services/recommendation/localEnsemble";

/**
 * Academic Prediction — Random Forest recommendation engine.
 *
 * Risk predictions are based on academic performance (ECR grades) only.
 * Attendance / SF2 is never included in the feature vector.
 *
 * Prediction path:
 * 1. Build academic feature vector from the student payload.
 * 2. In the browser, call `/api/recommendations/predict` so server-side
 *    env (RF_INFERENCE_URL) can reach FastAPI / Flask / Python / ONNX HTTP.
 * 3. On the server, call the remote inference URL directly when configured.
 * 4. Fall back to the local ensemble until the trained model is deployed.
 *
 * Do NOT call this from UI components — use recommendationService.generate().
 */
export async function randomForestRecommendation(student = {}) {
  const features = buildFeatureVector(student);

  // Browser → Next.js API gateway (keeps RF_INFERENCE_URL server-only).
  if (typeof window !== "undefined") {
    try {
      const response = await fetch("/api/recommendations/predict", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ student }),
      });

      if (response.ok) {
        const payload = await response.json();
        // API already returns the standardized shape; normalize defensively.
        if (payload?.recommendationType || payload?.recommendation_type) {
          return mapInferenceResponse(payload);
        }
        return {
          recommendationType: payload.recommendationType,
          riskLevel: payload.riskLevel,
          confidence: payload.confidence,
          reasons: payload.reasons ?? [],
          generatedAt: payload.generatedAt || new Date().toISOString(),
          source: payload.source || "api-gateway",
        };
      }

      console.warn(
        "[recommendation] /api/recommendations/predict failed:",
        response.status
      );
    } catch (error) {
      console.warn(
        "[recommendation] API gateway unavailable; using local ensemble.",
        error?.message ?? error
      );
    }

    return predictViaLocalEnsemble(features);
  }

  // Server-side path (API route / RSC / scripts).
  if (isRemoteInferenceConfigured()) {
    try {
      return await predictViaRemoteInference({
        studentId: student.id ?? student.studentId ?? null,
        featureVector: features.featureVector,
        featureList: features.featureList,
        featureNames: features.featureNames,
      });
    } catch (error) {
      console.warn(
        "[recommendation] Remote RF inference failed; using local ensemble.",
        error?.message ?? error
      );
    }
  }

  // -------------------------------------------------------------------------
  // TODO(ONNX): When an ONNX artifact is available, load it here (or in the
  // /api/recommendations/predict route) and run InferenceSession before the
  // local ensemble fallback.
  // -------------------------------------------------------------------------

  return predictViaLocalEnsemble(features);
}
