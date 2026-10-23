import { buildFeatureVector } from "@/lib/services/recommendation/features";
import {
  isRemoteInferenceConfigured,
  mapInferenceResponse,
  predictViaRemoteBatch,
  predictViaRemoteInference,
} from "@/lib/services/recommendation/inferenceClient";
import { predictViaLocalEnsemble } from "@/lib/services/recommendation/localEnsemble";
import { evaluateAcademicSupport } from "@/lib/services/recommendation/academicSupportEngine";

/**
 * Academic Prediction — trained Random Forest risk engine.
 *
 * Risk predictions are based on academic performance (ECR grades) only.
 * Attendance / SF2 is never included in the feature vector.
 *
 * Prediction path:
 * 1. Validate dynamic curriculum completeness (ECR grades finalized).
 * 2. Build academic feature vector from the student payload.
 * 3. Prefer FastAPI Random Forest (/predict or /predict_batch).
 * 4. In the browser, call Next.js API gateways so RF_INFERENCE_URL stays server-only.
 * 5. Fall back to rule-based risk only when ML is unavailable.
 *
 * Do NOT call this from UI components — use recommendationService.generate().
 */

function checkCompleteness(student = {}) {
  if (student.isCompleteTerm === false || student.isProvisional === true) {
    return {
      isComplete: false,
      message:
        "Academic record is marked provisional or incomplete; pattern analysis requires verified, finalized quarterly grades across all required subjects.",
    };
  }
  if (student.isCompleteTerm === true) {
    return { isComplete: true };
  }

  const support = evaluateAcademicSupport(student);
  if (!support.isCompleteTerm) {
    return {
      isComplete: false,
      message:
        support.completenessLimitation ||
        "Academic record is provisional or incomplete; pattern analysis requires verified, finalized quarterly grades across all required subjects.",
    };
  }

  return { isComplete: true };
}

function withFallbackLabel(result) {
  if (!result) return result;
  if (result.source === "rule-based-fallback" || result.source === "local-ensemble") {
    return {
      ...result,
      source: "rule-based-fallback",
      reasons: [
        ...(Array.isArray(result.reasons) ? result.reasons : []),
      ].slice(0, 5),
    };
  }
  return result;
}

export async function randomForestRecommendation(student = {}, options = {}) {
  const completeness = checkCompleteness(student);
  if (!completeness.isComplete) {
    return {
      status: "pending_evidence",
      riskLevel: "—",
      confidence: null,
      probabilities: null,
      source: "pattern-analysis-experimental",
      message: completeness.message,
      reasons: [completeness.message],
      generatedAt: new Date().toISOString(),
    };
  }

  const features = buildFeatureVector(student);

  // preferLocal is deprecated for production — kept only as explicit opt-in
  // to rule-based fallback (e.g. offline demos). Never the default.
  if (options.preferLocal === true && options.forceRuleFallback === true) {
    return withFallbackLabel(predictViaLocalEnsemble(features));
  }

  // Browser → Next.js API gateway
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
        if (payload?.source === "rule-based-fallback") {
          return withFallbackLabel(payload);
        }
        return mapInferenceResponse(payload);
      }

      console.warn(
        "[recommendation] /api/recommendations/predict failed:",
        response.status
      );
    } catch (error) {
      console.warn(
        "[recommendation] API gateway unavailable; using rule-based fallback.",
        error?.message ?? error
      );
    }

    return withFallbackLabel(predictViaLocalEnsemble(features));
  }

  // Server-side path
  if (isRemoteInferenceConfigured()) {
    try {
      const remote = await predictViaRemoteInference({
        studentId: student.id ?? student.studentId ?? null,
        featureVector: features.featureVector,
        featureList: features.featureList,
        featureNames: features.featureNames,
      });
      return remote;
    } catch (error) {
      console.warn(
        "[recommendation] Remote RF inference failed; using rule-based fallback.",
        error?.message ?? error
      );
    }
  }

  return withFallbackLabel(predictViaLocalEnsemble(features));
}

/**
 * Bulk risk prediction for monitoring dashboards.
 * Uses FastAPI /predict_batch via Next.js gateway when available.
 *
 * @param {object[]} students
 * @returns {Promise<object[]>} engine results aligned to input order
 */
export async function randomForestRecommendationBatch(students = []) {
  if (!students.length) return [];

  const results = new Array(students.length).fill(null);
  const completeIndices = [];
  const completeStudents = [];

  students.forEach((student, index) => {
    const completeness = checkCompleteness(student);
    if (!completeness.isComplete) {
      results[index] = {
        status: "pending_evidence",
        riskLevel: "—",
        confidence: null,
        probabilities: null,
        source: "pattern-analysis-experimental",
        message: completeness.message,
        reasons: [completeness.message],
        generatedAt: new Date().toISOString(),
      };
    } else {
      completeIndices.push(index);
      completeStudents.push(student);
    }
  });

  if (completeStudents.length === 0) {
    return results;
  }

  const featureRows = completeStudents.map((student) => {
    const features = buildFeatureVector(student);
    return {
      student,
      features,
      input: {
        studentId: student.id ?? student.studentId ?? null,
        featureVector: features.featureVector,
        featureList: features.featureList,
        featureNames: features.featureNames,
      },
    };
  });

  let batchOutputs = null;

  // Browser → batch gateway
  if (typeof window !== "undefined") {
    try {
      const response = await fetch("/api/recommendations/predict-batch", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          students: completeStudents.map((s) => ({ student: s })),
        }),
      });
      if (response.ok) {
        const payload = await response.json();
        const rows = Array.isArray(payload?.predictions)
          ? payload.predictions
          : [];
        if (rows.length === completeStudents.length) {
          batchOutputs = rows.map((row) =>
            row?.source === "rule-based-fallback"
              ? withFallbackLabel(row)
              : mapInferenceResponse(row)
          );
        }
      }
    } catch (error) {
      console.warn(
        "[recommendation] predict-batch gateway failed:",
        error?.message ?? error
      );
    }
  } else if (isRemoteInferenceConfigured()) {
    try {
      const remote = await predictViaRemoteBatch(
        featureRows.map((row) => row.input)
      );
      if (remote.length === completeStudents.length) {
        batchOutputs = remote;
      }
    } catch (error) {
      console.warn(
        "[recommendation] Remote /predict_batch failed:",
        error?.message ?? error
      );
    }
  }

  if (!batchOutputs) {
    batchOutputs = featureRows.map((row) =>
      withFallbackLabel(predictViaLocalEnsemble(row.features))
    );
  }

  completeIndices.forEach((origIdx, batchIdx) => {
    results[origIdx] = batchOutputs[batchIdx];
  });

  return results;
}
