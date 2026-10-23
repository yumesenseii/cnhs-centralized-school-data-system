/**
 * Pure scoping helpers for the Experimental Per-Subject Next-Term Trend Forecast.
 *
 * This module owns the READ SCOPE of the forecast:
 *   - which school year may be read (validated against the learner's authorized
 *     academic context — a client supplied school year is only ever a REQUEST),
 *   - which quarters legitimately act as a grading term (never quarter 4),
 *   - which classes belong to the forecast subject's class family
 *     (subject + section + school year, spanning every term row),
 *   - whether publication evidence is published / draft / missing.
 *
 * Pure by design: no database, no network, no React, no clock dependency.
 */

import {
  TREND_SUBJECTS,
  TREND_REQUIRED_QUARTERS,
  TREND_SUPPORTED_SOURCE_TERMS,
  normalizeTrendSubject,
} from "@/lib/services/recommendation/trendFeatures";
import { normalizeSchoolYear } from "@/lib/academic/activeSchoolYear";

export { TREND_REQUIRED_QUARTERS, TREND_SUPPORTED_SOURCE_TERMS };

/**
 * Normalize a school year without falling back to the current date.
 * `normalizeSchoolYear("")` resolves to the active school year, which would make
 * this module clock dependent; empty input must stay empty here.
 */
function safeNormalizeSchoolYear(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  return normalizeSchoolYear(raw);
}

/** Start year of a school year label ("2026-2027" -> 2026). */
function schoolYearStartYear(value) {
  const normalized = safeNormalizeSchoolYear(value);
  const match = normalized?.raw?.match(/(\d{4})/);
  return match ? Number(match[1]) : 0;
}

/**
 * True when a stored school year label belongs to the same school year as one of
 * the accepted variants. Format tolerant: "SY 2026-2027" and "2026-2027" match.
 */
export function matchesSchoolYear(value, schoolYearVariants) {
  if (!schoolYearVariants || schoolYearVariants.length === 0) return true;
  const raw = safeNormalizeSchoolYear(value)?.raw;
  if (!raw) return false;
  return schoolYearVariants.some(
    (variant) => safeNormalizeSchoolYear(variant)?.raw === raw
  );
}

/**
 * Resolve the school year the forecast may read.
 *
 * The client value is treated as a REQUEST only. It is accepted exclusively when
 * it matches a school year the learner is authorized for; otherwise the server
 * falls back to the learner's authorized academic context (preferring the active
 * school year, otherwise the most recent authorized one).
 */
export function resolveAuthorizedSchoolYear({
  requestedSchoolYear = null,
  authorizedSchoolYears = [],
  activeSchoolYear = null,
} = {}) {
  const authorized = [];
  const seen = new Set();
  for (const value of authorizedSchoolYears ?? []) {
    const normalized = safeNormalizeSchoolYear(value);
    if (!normalized || seen.has(normalized.raw)) continue;
    seen.add(normalized.raw);
    authorized.push(normalized);
  }

  const requested = safeNormalizeSchoolYear(requestedSchoolYear);
  const requestedAccepted = Boolean(requested && seen.has(requested.raw));

  let resolved = null;
  let source = "authorized-context";

  if (requestedAccepted) {
    resolved = requested;
    source = "requested";
  } else if (authorized.length > 0) {
    const activeRaw = safeNormalizeSchoolYear(activeSchoolYear)?.raw ?? null;
    const activeMatch = activeRaw
      ? authorized.find((entry) => entry.raw === activeRaw)
      : null;
    resolved =
      activeMatch ??
      [...authorized].sort(
        (a, b) => schoolYearStartYear(b.raw) - schoolYearStartYear(a.raw)
      )[0];
  } else if (requested) {
    // No authorized context could be read (for example every grade row is hidden
    // by RLS). The request is only a hint: the caller still applies server side
    // filters, so it can never widen the read scope on its own.
    resolved = requested;
    source = "requested-unverified";
  } else {
    resolved = safeNormalizeSchoolYear(activeSchoolYear);
    source = resolved ? "active" : "unresolved";
  }

  return {
    standard: resolved?.standard ?? null,
    raw: resolved?.raw ?? null,
    variants: resolved?.variants ?? [],
    requested: requested?.standard ?? null,
    requestedAccepted,
    authorized: authorized.map((entry) => entry.raw),
    source,
  };
}

/**
 * Resolve the forecast subject onto its canonical key and its database subject
 * ids, and detect subject records that map to the same canonical key.
 *
 * Duplicates are reported, never silently collapsed.
 */
export function resolveCanonicalSubject({
  subjectIdentifier = "",
  subjectRows = [],
} = {}) {
  const canonical = normalizeTrendSubject(subjectIdentifier);

  const grouped = new Map();
  for (const row of subjectRows ?? []) {
    const key = normalizeTrendSubject(row?.subject_name ?? row?.subjectName ?? "");
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push({
      id: row?.id ?? null,
      subjectName: row?.subject_name ?? row?.subjectName ?? null,
      subjectCode: row?.subject_code ?? row?.subjectCode ?? null,
    });
  }

  const duplicates = [];
  for (const [key, rows] of grouped.entries()) {
    if (rows.length < 2) continue;
    // Only canonical learning areas can make a grade ambiguous.
    if (!TREND_SUBJECTS.includes(key)) continue;
    duplicates.push({
      canonicalKey: key,
      subjectIds: rows.map((row) => row.id).filter(Boolean),
      subjectNames: rows.map((row) => row.subjectName).filter(Boolean),
    });
  }

  const matches = canonical ? grouped.get(canonical) ?? [] : [];

  return {
    canonical: canonical ?? null,
    isCanonical: Boolean(canonical && TREND_SUBJECTS.includes(canonical)),
    subjectIds: matches.map((row) => row.id).filter(Boolean),
    subjectNames: matches.map((row) => row.subjectName).filter(Boolean),
    duplicates,
    duplicateForForecastSubject: duplicates.some(
      (entry) => entry.canonicalKey === canonical
    ),
  };
}

/**
 * Resolve the forecast subject's full class family.
 *
 * A class family is every class row that shares the same subject, the same
 * section and the same school year, across all term rows. Term 1 and Term 2
 * grades live in DIFFERENT class rows (see syncEcrTermToGrades ->
 * siblingClassMap[quarter]), so the family must span quarters or the prior
 * term's evidence would be dropped.
 */
export function resolveSubjectFamily({
  subjectIds = [],
  sectionId = null,
  schoolYearVariants = [],
  classRows = [],
} = {}) {
  const idSet = new Set((subjectIds ?? []).filter(Boolean));

  const rows = (classRows ?? []).filter((row) => {
    if (idSet.size === 0) return false;
    if (!idSet.has(row?.subject_id)) return false;
    if (sectionId && row?.section_id !== sectionId) return false;
    if (!matchesSchoolYear(row?.school_year, schoolYearVariants)) return false;
    return true;
  });

  const classIds = [];
  const classByQuarter = new Map();
  for (const row of rows) {
    if (row?.id && !classIds.includes(row.id)) classIds.push(row.id);
    const quarter = Number(row?.quarter);
    if (Number.isFinite(quarter) && !classByQuarter.has(quarter)) {
      classByQuarter.set(quarter, row.id);
    }
  }

  return {
    classRows: rows,
    classIds,
    classByQuarter,
    quarters: [...classByQuarter.keys()].sort((a, b) => a - b),
  };
}

/**
 * Evaluate publication evidence for the subject family's required term sheets.
 *
 * Three states are kept strictly distinct:
 *   - "published" — a sheet exists for the term and none of them is a draft,
 *   - "draft"     — at least one sheet for the term is still a draft,
 *   - "missing"   — no sheet exists for the term.
 *
 * A missing term sheet is NOT positive proof of publication: it stays a
 * blocking, distinguishable state.
 */
export function evaluatePublicationEvidence({
  sheets = [],
  requiredTerms = [],
} = {}) {
  const terms = (requiredTerms ?? [])
    .map((term) => Number(term))
    .filter((term) => Number.isFinite(term));

  const evidence = {};
  const missingTerms = [];
  const draftTerms = [];

  for (const term of terms) {
    const termSheets = (sheets ?? []).filter(
      (sheet) => Number(sheet?.term) === term
    );

    if (termSheets.length === 0) {
      evidence[term] = { state: "missing", sheetIds: [], workbookIds: [] };
      missingTerms.push(term);
      continue;
    }

    const draftSheets = termSheets.filter(
      (sheet) => String(sheet?.status ?? "").toLowerCase() === "draft"
    );

    if (draftSheets.length > 0) {
      evidence[term] = {
        state: "draft",
        sheetIds: draftSheets.map((sheet) => sheet.id).filter(Boolean),
        workbookIds: draftSheets
          .map((sheet) => sheet.workbook_id)
          .filter(Boolean),
      };
      draftTerms.push(term);
      continue;
    }

    evidence[term] = {
      state: "published",
      sheetIds: termSheets.map((sheet) => sheet.id).filter(Boolean),
      workbookIds: termSheets.map((sheet) => sheet.workbook_id).filter(Boolean),
    };
  }

  const state =
    draftTerms.length > 0
      ? "draft"
      : missingTerms.length > 0
        ? "missing"
        : "published";

  return {
    state,
    evidence,
    missingTerms,
    draftTerms,
    requiredTerms: terms,
  };
}

/**
 * User facing description of the publication evidence state.
 * Returns null when the evidence is complete.
 */
export function describePublicationEvidence(evaluation, { subjectLabel = null } = {}) {
  const subject = subjectLabel ? ` for ${subjectLabel}` : "";

  if (evaluation?.state === "draft") {
    const terms = (evaluation.draftTerms ?? [])
      .map((term) => `Term ${term}`)
      .join(", ");
    return `The official academic record${subject} for ${terms} is still in draft / unpublished state in the E-Class Record. The subject teacher must finalize and publish the term grades before a next-term forecast can be produced.`;
  }

  if (evaluation?.state === "missing") {
    const terms = (evaluation.missingTerms ?? [])
      .map((term) => `Term ${term}`)
      .join(", ");
    return `No published E-Class Record sheet${subject} was found for ${terms}. A missing term sheet is not treated as proof of publication — publish the term sheet first.`;
  }

  return null;
}

/**
 * Full scope resolution for one forecast request.
 *
 * All inputs are already fetched rows; this function performs no I/O so it can
 * be exercised directly against production shaped fixtures.
 */
export function resolveTrendScope({
  requestedTerm = null,
  subjectIdentifier = "",
  requestedSchoolYear = null,
  activeSchoolYear = null,
  sectionId = null,
  subjectRows = [],
  classRows = [],
  gradeRows = [],
  learnerSchoolYears = [],
} = {}) {
  const term = Number(requestedTerm);
  const supported = TREND_SUPPORTED_SOURCE_TERMS.includes(term);
  const requiredQuarters = supported ? [...TREND_REQUIRED_QUARTERS[term]] : [];

  const subject = resolveCanonicalSubject({
    subjectIdentifier,
    subjectRows,
  });

  const schoolYear = resolveAuthorizedSchoolYear({
    requestedSchoolYear,
    authorizedSchoolYears: learnerSchoolYears,
    activeSchoolYear,
  });

  const family = resolveSubjectFamily({
    subjectIds: subject.subjectIds,
    sectionId,
    schoolYearVariants: schoolYear.variants,
    classRows,
  });

  const scopedGrades = (gradeRows ?? []).filter(
    (grade) =>
      requiredQuarters.includes(Number(grade?.quarter)) &&
      matchesSchoolYear(grade?.school_year, schoolYear.variants)
  );

  return {
    term,
    supported,
    requiredQuarters,
    subject,
    schoolYear,
    family,
    scopedGrades,
  };
}
