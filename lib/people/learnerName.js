/**
 * Consistent learner display: SURNAME, Given M.
 */

function titleCaseToken(token) {
  const raw = String(token || "").trim();
  if (!raw) return "";
  if (/^[a-z]\.?$/i.test(raw)) {
    return `${raw[0].toUpperCase()}${raw.includes(".") ? "." : ""}`;
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function titleCasePhrase(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(titleCaseToken)
    .join(" ");
}

function middleInitialFrom(value) {
  const token = String(value || "").trim().split(/\s+/).filter(Boolean)[0] || "";
  if (!token) return "";
  const letter = token.replace(/[^A-Za-zÑñ]/g, "").charAt(0);
  return letter ? `${letter.toUpperCase()}.` : "";
}

export function parseLearnerName(input = {}) {
  let first = String(input.first_name ?? input.firstName ?? "").trim();
  let middle = String(input.middle_name ?? input.middleName ?? "").trim();
  let last = String(input.last_name ?? input.lastName ?? "").trim();
  const full = String(
    input.name ?? input.learner ?? input.studentName ?? ""
  ).trim();

  if ((!first || !last) && full) {
    if (full.includes(",")) {
      const [sur, rest = ""] = full.split(",");
      last = last || sur.trim();
      const restParts = rest.trim().split(/\s+/).filter(Boolean);
      if (!first && restParts[0]) first = restParts[0];
      if (!middle && restParts.length > 1) {
        middle = restParts.slice(1).join(" ");
      }
    } else {
      const parts = full.split(/\s+/).filter(Boolean);
      if (parts.length === 1) {
        first = first || parts[0];
      } else {
        last = last || parts[parts.length - 1];
        first = first || parts[0];
        if (!middle && parts.length > 2) {
          middle = parts.slice(1, -1).join(" ");
        }
      }
    }
  }

  let firstTokens = first.split(/\s+/).filter(Boolean);
  if (!middle && firstTokens.length > 1) {
    middle = firstTokens[firstTokens.length - 1];
    firstTokens = firstTokens.slice(0, -1);
  }

  const givenNames = titleCasePhrase(firstTokens.join(" "));
  const initial = middleInitialFrom(middle);
  const given = [givenNames, initial].filter(Boolean).join(" ");
  const surname = last.replace(/,/g, "").trim().toUpperCase();
  const display =
    surname && given
      ? `${surname}, ${given}`
      : surname || given || "—";

  return {
    given,
    surname,
    display,
  };
}
