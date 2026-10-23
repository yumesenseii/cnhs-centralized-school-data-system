/**
 * P1-01 — default academic term resolver & Final Grade separation.
 * Run: node --import ./scripts/test-env.mjs --loader ./scripts/alias-loader.mjs scripts/test_p1_01_default_term.mjs
 */
import assert from "node:assert/strict";
import {
  FINAL_GRADE_QUARTER,
  isAcademicTermNumber,
  parseTermNumber,
  resolveDefaultAcademicTerm,
  termLabel,
} from "../lib/academic/termLabels.js";
import { filterRosterContext } from "../lib/monitoring/academicLearnerAggregation.js";
import { getHistoricalTermLabel } from "../lib/monitoring/aralAcademicStatus.js";

const SY = "SY 2026-2027";
let passed = 0;
function t(name, fn) {
  fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

t("T1+T2+Final(4) rows -> default 2 (not 4)", () => {
  const rows = [{ quarter: 1 }, { quarter: 2 }, { quarter: 4 }];
  assert.equal(resolveDefaultAcademicTerm(rows), 2);
});

t("only legacy quarter=4 rows -> Term 1, never 4", () => {
  assert.equal(resolveDefaultAcademicTerm([{ quarter: 4 }, { quarterNumber: 4 }]), 1);
});

t("T1-T3 + Final -> default 3", () => {
  const rows = [1, 2, 3, 4].map((q) => ({ quarterNumber: q }));
  assert.equal(resolveDefaultAcademicTerm(rows), 3);
});

t("'Final Grade / Average' string is ignored", () => {
  const rows = [{ quarter: "Term 1" }, { quarter: "Final Grade / Average" }];
  assert.equal(resolveDefaultAcademicTerm(rows), 1);
});

t("other school year rows are ignored", () => {
  const rows = [
    { quarter: 1, schoolYear: SY },
    { quarter: 3, schoolYear: "SY 2025-2026" },
  ];
  assert.equal(resolveDefaultAcademicTerm(rows, { schoolYear: SY }), 1);
});

t("empty / nullish input -> Term 1", () => {
  assert.equal(resolveDefaultAcademicTerm([]), 1);
  assert.equal(resolveDefaultAcademicTerm(undefined), 1);
  assert.equal(resolveDefaultAcademicTerm(null), 1);
});

t("configuredTerm 1-3 wins; 4 / garbage ignored", () => {
  const rows = [{ quarter: 1 }, { quarter: 2 }];
  assert.equal(resolveDefaultAcademicTerm(rows, { configuredTerm: 3 }), 3);
  assert.equal(resolveDefaultAcademicTerm(rows, { configuredTerm: 4 }), 2);
  assert.equal(resolveDefaultAcademicTerm(rows, { configuredTerm: "abc" }), 2);
});

t("isAcademicTermNumber accepts only 1-3", () => {
  assert.equal(isAcademicTermNumber(1), true);
  assert.equal(isAcademicTermNumber(3), true);
  assert.equal(isAcademicTermNumber(4), false);
  assert.equal(isAcademicTermNumber(null), false);
});

t("Final Grade compatibility preserved (quarter=4)", () => {
  assert.equal(FINAL_GRADE_QUARTER, 4);
  assert.equal(parseTermNumber(4), 4);
  assert.equal(parseTermNumber("Final Grade / Average"), 4);
  assert.equal(termLabel(4), "Final Grade / Average");
  assert.equal(termLabel(3), "Term 3");
});

t("explicit Final Grade filter still returns quarter=4 rows", () => {
  const rows = [
    { id: "a", quarter: 2, schoolYear: SY },
    { id: "b", quarter: 4, schoolYear: SY },
  ];
  const out = filterRosterContext(rows, {
    schoolYear: SY,
    quarter: "Final Grade / Average",
  });
  assert.deepEqual(out.map((r) => r.id), ["b"]);
  const t2 = filterRosterContext(rows, { schoolYear: SY, quarter: "Term 2" });
  assert.deepEqual(t2.map((r) => r.id), ["a"]);
});

t("default term 2 does not label a Term 2 record as Historical", () => {
  assert.equal(getHistoricalTermLabel({ quarterNumber: 2 }, 2), null);
  // Old behaviour (default 4) would have produced this label:
  assert.equal(getHistoricalTermLabel({ quarterNumber: 2 }, 4), "Historical Record · Term 2");
});

console.log(`\nP1-01 default term: ${passed}/${passed} passed`);
