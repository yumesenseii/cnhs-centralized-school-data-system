/**
 * Remote inference client for Random Forest predictions.
 *
 * Supports HTTP prediction services such as:
 * - FastAPI
 * - Flask
 * - Generic Python / REST APIs
 *
 * ONNX can be wired later by loading a .onnx model in the Next.js
 * API route or behind the same HTTP contract.
 *
 * Request body (POST):
 * {
 *   "student_id": "...",
 *   "features": { ...featureVector },
 *   "feature_list": [ ... ],
 *   "feature_names": [ ... ]
 * }
 *
 * Accepted response shapes (any one):
 * {
 *   "recommendation_type" | "recommendationType": "ARAL Learners" | legacy "ARAL Screening" | ...,
 *   "risk_level" | "riskLevel": "High Risk" | "Moderate Risk" | "Low Risk" | legacy aliases,
 *   "confidence": 0.91,
 *   "reasons": ["..."] | "reason": "..."
 * }
 */

import {
  RECOMMENDATION,
  RISK_LEVEL,
} from "@/lib/monitoring/recommendations";

const DEFAULT_TIMEOUT_MS = 5000;

function getConfiguredInferenceUrl() {
  return (
    process.env.RF_INFERENCE_URL ||
    process.env.NEXT_PUBLIC_RF_INFERENCE_URL ||
    ""
  ).trim();
}

export function isRemoteInferenceConfigured() {
  return Boolean(getConfiguredInferenceUrl());
}

function normalizeRecommendationType(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (raw.includes("aral")) return RECOMMENDATION.ARAL;
  if (raw.includes("remediat")) return RECOMMENDATION.REMEDIATION;
  if (raw.includes("none") || raw.includes("no recommendation")) {
    return RECOMMENDATION.NONE;
  }
  if (value === RECOMMENDATION.ARAL) return RECOMMENDATION.ARAL;
  if (value === RECOMMENDATION.REMEDIATION) return RECOMMENDATION.REMEDIATION;
  if (value === RECOMMENDATION.NONE) return RECOMMENDATION.NONE;
  return null;
}

function normalizeRiskLevel(value, recommendationType) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw.includes("high") || raw === "priority") return RISK_LEVEL.HIGH;
  if (raw.includes("moderate") || raw === "medium") return RISK_LEVEL.MODERATE;
  if (raw.includes("low")) return RISK_LEVEL.LOW;

  if (recommendationType === RECOMMENDATION.ARAL) return RISK_LEVEL.HIGH;
  if (recommendationType === RECOMMENDATION.REMEDIATION) {
    return RISK_LEVEL.MODERATE;
  }
  return RISK_LEVEL.LOW;
}

function normalizeReasons(payload) {
  if (Array.isArray(payload?.reasons)) {
    return payload.reasons.map(String).filter(Boolean);
  }
  if (payload?.reason) return [String(payload.reason)];
  if (Array.isArray(payload?.explanations)) {
    return payload.explanations.map(String).filter(Boolean);
  }
  return [];
}

function normalizeConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.5;
  if (n > 1 && n <= 100) return Math.min(1, Math.max(0, n / 100));
  return Math.min(1, Math.max(0, n));
}

/**
 * Map a remote model response into the Monitoring recommendation contract.
 */
export function mapInferenceResponse(payload = {}) {
  const recommendationType = normalizeRecommendationType(
    payload.recommendation_type ??
      payload.recommendationType ??
      payload.label ??
      payload.prediction
  );

  if (!recommendationType) {
    throw new Error("Inference response missing recommendation type.");
  }

  const reasons = normalizeReasons(payload);
  return {
    recommendationType,
    riskLevel: normalizeRiskLevel(
      payload.risk_level ?? payload.riskLevel,
      recommendationType
    ),
    confidence: normalizeConfidence(payload.confidence ?? payload.probability),
    reasons: reasons.length
      ? reasons
      : [`Model predicted ${recommendationType}`],
    generatedAt: new Date().toISOString(),
    source: "remote-inference",
  };
}

/**
 * Call a configured Random Forest HTTP inference service.
 *
 * @param {{
 *   studentId?: string|null,
 *   featureVector: Record<string, number|null>,
 *   featureList: number[],
 *   featureNames: string[],
 * }} input
 */
export async function predictViaRemoteInference(input) {
  const baseUrl = getConfiguredInferenceUrl();
  if (!baseUrl) {
    throw new Error("RF_INFERENCE_URL is not configured.");
  }

  const timeoutMs = Number(
    process.env.RF_INFERENCE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS
  );
  const endpoint = baseUrl.replace(/\/$/, "");
  const predictUrl = /\/predict$/i.test(endpoint)
    ? endpoint
    : `${endpoint}/predict`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(predictUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(process.env.RF_INFERENCE_API_KEY
          ? { Authorization: `Bearer ${process.env.RF_INFERENCE_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        student_id: input.studentId ?? null,
        features: input.featureVector,
        feature_list: input.featureList,
        feature_names: input.featureNames,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Inference service returned ${response.status}${text ? `: ${text}` : ""}`
      );
    }

    const payload = await response.json();
    return mapInferenceResponse(payload);
  } finally {
    clearTimeout(timer);
  }
}
