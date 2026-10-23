/**
 * Mock of `@/lib/services/recommendation/inferenceClient` used by the P0-04B
 * scoped route tests.
 *
 * It records the feature vector the route sends to the model so the tests can
 * assert the exact 9-feature contract without a live FastAPI service.
 */

const calls = [];

export function getInferenceCalls() {
  return calls.map((call) => ({ ...call }));
}

export function resetInferenceCalls() {
  calls.length = 0;
}

export function isRemoteInferenceConfigured() {
  return true;
}

export async function predictSubjectTrendViaRemote(payload = {}) {
  calls.push({
    studentId: payload.studentId,
    subject: payload.subject,
    term: payload.term,
    featureVector: { ...(payload.featureVector ?? {}) },
    featureNames: [...(payload.featureNames ?? [])],
  });

  return {
    status: "available",
    subject: payload.subject,
    currentTerm: payload.term,
    targetTerm: Number(payload.term) + 1,
    predictedTrend: "Improving",
    message: `Successfully predicted Improving trend for ${payload.subject} in Term ${
      Number(payload.term) + 1
    }.`,
  };
}
