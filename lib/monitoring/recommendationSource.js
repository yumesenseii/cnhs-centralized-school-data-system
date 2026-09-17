/**
 * Recommendation engine source labels for Monitoring UI honesty.
 * Do not claim sklearn Random Forest or per-category probabilities in product UI.
 * Do not put ML/ops status into teacher/admin Reason text.
 */

const OPS_REASON_RE =
  /\bml\b|unavailable|fallback|prediction service/i;

export function isRecommendationFallback(source) {
  const value = String(source || "").toLowerCase();
  return (
    value === "rule-based-fallback" ||
    value === "local-ensemble" ||
    value.includes("fallback")
  );
}

/** True when every roster row is grades-only fallback (do not TTL-cache). */
export function isFullyFallbackRoster(roster) {
  const students = roster?.students;
  if (!Array.isArray(students) || students.length === 0) return false;
  return students.every((row) =>
    isRecommendationFallback(row?.recommendationSource)
  );
}

export function recommendationSourceLabel(source) {
  if (isRecommendationFallback(source)) {
    return "From ECR grades";
  }
  if (!source) return null;
  return "Recommendation from ECR grades";
}

export function isOpsRecommendationReason(text) {
  return OPS_REASON_RE.test(String(text || ""));
}

/** Grade/intervention facts only — drops ML unavailable / fallback sentences. */
export function displayRecommendationReasons(reasons = []) {
  const list = Array.isArray(reasons)
    ? reasons
    : String(reasons || "")
        .split(/\.\s+/)
        .filter(Boolean);
  return list
    .map((item) => String(item || "").trim().replace(/\.+$/, ""))
    .filter(Boolean)
    .filter((item) => !isOpsRecommendationReason(item));
}

export function joinDisplayRecommendationReasons(reasons = []) {
  return displayRecommendationReasons(reasons).join(". ");
}
