/**
 * Dummy visual student numbers for ECRs that only list learner names
 * (no LRN / student ID column).
 *
 * Format: 104793 + 6 digits (12 chars total, fits varchar(30)).
 * Digits are derived from learner identity so re-imports stay stable;
 * collisions fall back to a random 6-digit suffix.
 */

const PREFIX = "104793";

function sixDigitsFromKey(key) {
  let hash = 0;
  const text = String(key ?? "");
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return String(Math.abs(hash) % 1_000_000).padStart(6, "0");
}

function randomSixDigits() {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

/**
 * @param {{ fullName?: string, sex?: string, index?: number, section?: string }} identity
 * @param {Set<string>} [seenNumbers]
 * @returns {string}
 */
export function buildDummyStudentNumber(identity = {}, seenNumbers = null) {
  const key = [
    identity.section ?? "",
    identity.sex ?? "",
    identity.fullName ?? "",
    identity.index ?? "",
  ].join("|");

  let candidate = `${PREFIX}${sixDigitsFromKey(key)}`;
  if (!seenNumbers) return candidate;

  if (!seenNumbers.has(candidate)) {
    seenNumbers.add(candidate);
    return candidate;
  }

  for (let attempt = 0; attempt < 25; attempt += 1) {
    candidate = `${PREFIX}${randomSixDigits()}`;
    if (!seenNumbers.has(candidate)) {
      seenNumbers.add(candidate);
      return candidate;
    }
  }

  candidate = `${PREFIX}${String(Date.now()).slice(-6)}`;
  seenNumbers.add(candidate);
  return candidate;
}
