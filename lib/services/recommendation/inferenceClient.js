/**
 * Remote inference client for the trained Random Forest Academic Risk service.
 *
 * FastAPI contract:
 *   POST /predict
 *   POST /predict_batch
 *
 * RF returns risk_level + confidence + probabilities only.
 * Intervention is applied separately in CNHS LEARN.
 */

import {
  RISK_LEVEL,
} from "@/lib/monitoring/recommendations";

const DEFAULT_TIMEOUT_MS = 8000;

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

function inferenceBaseUrl() {
  const baseUrl = getConfiguredInferenceUrl();
  if (!baseUrl) {
    throw new Error("RF_INFERENCE_URL is not configured.");
  }
  return baseUrl.replace(/\/$/, "").replace(/\/predict$/i, "");
}

export function normalizeRiskLevel(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw.includes("high") || raw === "priority") return RISK_LEVEL.HIGH;
  if (raw.includes("moderate") || raw === "medium") return RISK_LEVEL.MODERATE;
  if (raw.includes("low")) return RISK_LEVEL.LOW;
  return null;
}

function normalizeConfidence(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.5;
  if (n > 1 && n <= 100) return Math.min(1, Math.max(0, n / 100));
  return Math.min(1, Math.max(0, n));
}

function normalizeReasons(payload) {
  if (Array.isArray(payload?.reasons)) {
    return payload.reasons.map(String).filter(Boolean);
  }
  if (payload?.reason) return [String(payload.reason)];
  return [];
}

/**
 * Map a remote RF risk response into the engine result shape.
 * recommendationType is left null — filled by intervention policy.
 */
export function mapInferenceResponse(payload = {}) {
  const riskLevel =
    normalizeRiskLevel(payload.risk_level ?? payload.riskLevel) ||
    normalizeRiskLevel(payload.label ?? payload.prediction);

  if (!riskLevel) {
    throw new Error("Inference response missing risk_level.");
  }

  const probabilities =
    payload.probabilities ??
    payload.class_probabilities ??
    payload.classProbabilities ??
    null;

  const reasons = normalizeReasons(payload);
  return {
    recommendationType: null,
    riskLevel,
    confidence: normalizeConfidence(
      payload.confidence ?? payload.probability
    ),
    probabilities,
    reasons: reasons.length
      ? reasons
      : [`Trained Random Forest predicted ${riskLevel}`],
    generatedAt: new Date().toISOString(),
    source: payload.source || "random-forest",
  };
}

async function fetchJson(url, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(process.env.RF_INFERENCE_API_KEY
          ? { Authorization: `Bearer ${process.env.RF_INFERENCE_API_KEY}` }
          : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Inference service returned ${response.status}${text ? `: ${text}` : ""}`
      );
    }

    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Single-learner RF prediction.
 */
export async function predictViaRemoteInference(input) {
  const timeoutMs = Number(
    process.env.RF_INFERENCE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS
  );
  const predictUrl = `${inferenceBaseUrl()}/predict`;

  const payload = await fetchJson(
    predictUrl,
    {
      student_id: input.studentId ?? null,
      features: input.featureVector,
      feature_list: input.featureList,
      feature_names: input.featureNames,
    },
    timeoutMs
  );

  return mapInferenceResponse(payload);
}

/**
 * Bulk RF prediction via FastAPI /predict_batch.
 *
 * @param {Array<{
 *   studentId?: string|null,
 *   featureVector: Record<string, number|null>,
 *   featureList: number[],
 *   featureNames: string[],
 * }>} inputs
 */
export async function predictViaRemoteBatch(inputs = []) {
  if (!inputs.length) return [];

  const timeoutMs = Number(
    process.env.RF_INFERENCE_BATCH_TIMEOUT_MS ||
      process.env.RF_INFERENCE_TIMEOUT_MS ||
      30000
  );
  const batchUrl = `${inferenceBaseUrl()}/predict_batch`;

  const payload = await fetchJson(
    batchUrl,
    {
      students: inputs.map((input) => ({
        student_id: input.studentId ?? null,
        features: input.featureVector,
        feature_list: input.featureList,
        feature_names: input.featureNames,
      })),
    },
    timeoutMs
  );

  const rows = Array.isArray(payload?.predictions) ? payload.predictions : [];
  return rows.map((row) => mapInferenceResponse(row));
}
