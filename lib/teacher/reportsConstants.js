/**
 * Teacher Reports configuration and display labels.
 */

import {
  TERM_ALL_LABEL,
  TERM_OPTIONS,
  termLabel,
} from "@/lib/academic/termLabels";

export const PASSING_GRADE = 75;

/** Share of graded students below passing that triggers class-level remedial. */
export const CLASSROOM_REMEDIAL_THRESHOLD = 0.5;

export const CLASSROOM_REMEDIAL = {
  RECOMMENDED: "Classroom Remedial Recommended",
  NOT_NEEDED: "No Classroom Remedial Needed",
};

export const REPORT_FILTER_ALL = "all";

/** @deprecated Prefer TERM_OPTIONS from @/lib/academic/termLabels — kept for imports. */
export const QUARTER_OPTIONS = TERM_OPTIONS.map((opt) => ({
  value: opt.value,
  label: opt.label,
}));

export { TERM_ALL_LABEL, TERM_OPTIONS, termLabel };

export const PERFORMANCE_BUCKETS = [
  { id: "excellent", label: "90–100", min: 90, max: 100.01, color: "#40916c" },
  { id: "good", label: "85–89", min: 85, max: 90, color: "#52b788" },
  { id: "fair", label: "75–84", min: 75, max: 85, color: "#f4a261" },
  { id: "failing", label: "Below 75", min: 0, max: 75, color: "#e76f51" },
];
